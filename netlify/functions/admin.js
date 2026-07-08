const crypto = require('crypto');
const { sendWelcomeEmail } = require('./_shared/welcome-email');
const { sendCampaignEmail } = require('./_shared/campaign-email');
const { SEGMENTS, getUsersWithStats, filterSegment } = require('./_shared/campaign-segments');

async function sendCampaignNow(SUPABASE_URL, H, campaign) {
  const users = await getUsersWithStats(SUPABASE_URL, H);
  const audience = filterSegment(users, campaign.target_segment);
  const results = [];
  for (const u of audience) {
    if (!u.email) { results.push({ user_id: u.id, status: 'skipped' }); continue; }
    const name = u.contact_name || u.business_name || '';
    const sent = await sendCampaignEmail(u.email, name, campaign.subject || campaign.title, campaign.body);
    const sendStatus = sent ? 'sent' : 'failed';
    results.push({ user_id: u.id, status: sendStatus });
    await fetch(`${SUPABASE_URL}/rest/v1/marketing_campaign_sends`, {
      method: 'POST',
      headers: { ...H, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ campaign_id: campaign.id, user_id: u.id, channel: 'email', status: sendStatus, error: sent ? null : 'send_failed' })
    });
  }
  const finalStatus = results.some(r => r.status === 'sent') ? 'sent' : 'failed';
  await fetch(`${SUPABASE_URL}/rest/v1/marketing_campaigns?id=eq.${encodeURIComponent(campaign.id)}`, {
    method: 'PATCH',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ status: finalStatus, sent_at: new Date().toISOString() })
  });
  return { campaign: { ...campaign, status: finalStatus }, results };
}

function verifyJWT(token, secret) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('Invalid signature');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) throw new Error('Token expired');
  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = (event.headers['authorization'] || '').replace('Bearer ', '');
  let jwt;
  try {
    jwt = verifyJWT(authHeader, process.env.JWT_SECRET);
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  if (!jwt.is_admin) return { statusCode: 403, body: JSON.stringify({ error: 'Admin only' }) };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { action } = parsed;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  try {
    // ── KPIs ─────────────────────────────────────────────────
    if (action === 'kpis') {
      const [users, invoices, revenues] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/users?select=id,plan,pro_until,created_at,onboarding_done`, { headers: H }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/invoices?select=id,total_amount,created_at`, { headers: H }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/daily_revenues?select=amount`, { headers: H }).then(r => r.json())
      ]);

      const now = new Date();
      const thisMonth = now.toISOString().slice(0, 7);
      const proUsers = users.filter(u => u.plan === 'pro' && u.pro_until && new Date(u.pro_until) > now);
      const newThisMonth = users.filter(u => u.created_at?.startsWith(thisMonth));
      const totalInvoiceValue = invoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
      const totalRevenue = revenues.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_users: users.length,
          pro_users: proUsers.length,
          free_users: users.length - proUsers.length,
          onboarded: users.filter(u => u.onboarding_done).length,
          new_this_month: newThisMonth.length,
          total_invoices: invoices.length,
          total_invoice_value: Math.round(totalInvoiceValue),
          total_revenue_entered: Math.round(totalRevenue)
        })
      };
    }

    // ── Users list ────────────────────────────────────────────
    if (action === 'users') {
      const users = await fetch(
        `${SUPABASE_URL}/rest/v1/users?select=id,business_name,contact_name,phone,email,city,category,plan,pro_until,personal_code,onboarding_done,created_at,is_active,gmail_consent,gmail_consent_at,welcome_email_sent_at&order=created_at.desc`,
        { headers: H }
      ).then(r => r.json());

      // Attach invoice count per user
      const invoices = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?select=user_id`,
        { headers: H }
      ).then(r => r.json());

      const countByUser = {};
      invoices.forEach(i => { countByUser[i.user_id] = (countByUser[i.user_id] || 0) + 1; });

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(users.map(u => ({ ...u, invoice_count: countByUser[u.id] || 0 })))
      };
    }

    // ── Codes list ────────────────────────────────────────────
    if (action === 'codes') {
      const codes = await fetch(
        `${SUPABASE_URL}/rest/v1/access_codes?select=*&order=created_at.desc`,
        { headers: H }
      ).then(r => r.json());
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(codes) };
    }

    // ── Create generic code ───────────────────────────────────
    if (action === 'create_code') {
      const { code, duration_months } = parsed;
      if (!code || !duration_months) return { statusCode: 400, body: JSON.stringify({ error: 'Missing code or duration' }) };
      const r = await fetch(`${SUPABASE_URL}/rest/v1/access_codes`, {
        method: 'POST',
        headers: { ...H, 'Prefer': 'return=representation' },
        body: JSON.stringify({ code: code.toUpperCase(), type: 'generic', duration_months: parseInt(duration_months), is_active: true })
      });
      const result = await r.json();
      return { statusCode: r.ok ? 200 : 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
    }

    // ── Send a preview of the welcome email (does not touch any user row) ──
    // Always treated as a test send: bcc's revertoo.ino@gmail.com and tags the
    // subject with a test marker (see project memory: test-email-review rule).
    if (action === 'send_test_welcome_email') {
      const { to_email, name } = parsed;
      if (!to_email) return { statusCode: 400, body: JSON.stringify({ error: 'Missing to_email' }) };

      // Use the recipient's real personal code if they already have an account,
      // so a preview to an existing user shows their actual code, not a placeholder.
      let personalCode = 'RV-XXXXXX';
      const lookup = await fetch(
        `${SUPABASE_URL}/rest/v1/users?email=ilike.${encodeURIComponent(to_email)}&select=personal_code,business_name,contact_name&limit=1`,
        { headers: H }
      );
      const found = lookup.ok ? await lookup.json() : [];
      const displayName = name || found[0]?.contact_name || found[0]?.business_name || 'בדיקה';
      if (found[0]?.personal_code) personalCode = found[0].personal_code;

      const sent = await sendWelcomeEmail(to_email, displayName, personalCode, { isTest: true });
      return { statusCode: sent ? 200 : 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sent, personal_code: personalCode }) };
    }

    // ── One-time bulk send of the welcome email to existing users ──────────
    // Skips anyone who already has welcome_email_sent_at set (e.g. someone who
    // signed up after the automatic send was fixed) to avoid double-sending.
    if (action === 'send_welcome_to_all_users') {
      const usersRes = await fetch(
        `${SUPABASE_URL}/rest/v1/users?select=id,email,business_name,contact_name,personal_code,welcome_email_sent_at&is_active=eq.true`,
        { headers: H }
      );
      const allUsers = usersRes.ok ? await usersRes.json() : [];
      const results = [];
      for (const u of allUsers) {
        if (u.welcome_email_sent_at) { results.push({ email: u.email, status: 'skipped_already_sent' }); continue; }
        if (!u.email) { results.push({ email: null, status: 'skipped_no_email' }); continue; }
        const name = u.contact_name || u.business_name || '';
        const sent = await sendWelcomeEmail(u.email, name, u.personal_code);
        if (sent) {
          await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(u.id)}`, {
            method: 'PATCH',
            headers: { ...H, 'Prefer': 'return=minimal' },
            body: JSON.stringify({ welcome_email_sent_at: new Date().toISOString() })
          });
        }
        results.push({ email: u.email, status: sent ? 'sent' : 'failed' });
      }
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ results }) };
    }

    // ── Toggle code active/inactive ───────────────────────────
    if (action === 'toggle_code') {
      const { code, is_active } = parsed;
      if (!code) return { statusCode: 400, body: JSON.stringify({ error: 'Missing code' }) };
      await fetch(`${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(code)}`, {
        method: 'PATCH',
        headers: { ...H, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_active })
      });
      return { statusCode: 200, body: '{}' };
    }

    // ── Toggle user active ────────────────────────────────────
    if (action === 'toggle_user') {
      const { user_id, is_active } = parsed;
      if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id' }) };
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user_id)}`, {
        method: 'PATCH',
        headers: { ...H, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ is_active })
      });
      return { statusCode: 200, body: '{}' };
    }

    // ── Full data dump (for rich admin page) ──────────────────
    if (action === 'full_data') {
      const [users, invoices, items, suppliers, market, waitlist] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc`, { headers: H }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/invoices?select=*&order=created_at.desc`, { headers: H }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/invoice_items?select=*`, { headers: H }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/suppliers?select=*`, { headers: H }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/market_prices?select=*&order=updated_at.desc&limit=500`, { headers: H }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/waitlist?select=*&order=created_at.desc`, { headers: H }).then(r => r.json()),
      ]);
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ users: users||[], invoices: invoices||[], items: items||[], suppliers: suppliers||[], market: market||[], waitlist: waitlist||[] }) };
    }

    // ── Update user fields ─────────────────────────────────────
    if (action === 'update_user') {
      const { user_id, updates } = parsed;
      if (!user_id || !updates) return { statusCode: 400, body: JSON.stringify({ error: 'Missing data' }) };
      const allowed = ['business_name', 'city', 'category', 'phone', 'email', 'address', 'plan', 'pro_until', 'is_active'];
      const safe = {};
      Object.keys(updates).forEach(k => { if (allowed.includes(k)) safe[k] = updates[k]; });
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user_id)}`, {
        method: 'PATCH', headers: { ...H, 'Prefer': 'return=minimal' }, body: JSON.stringify(safe)
      });
      return { statusCode: 200, body: '{}' };
    }

    // ── Delete user + all their data ───────────────────────────
    if (action === 'delete_user') {
      const { user_id } = parsed;
      if (!user_id) return { statusCode: 400, body: JSON.stringify({ error: 'Missing user_id' }) };
      await fetch(`${SUPABASE_URL}/rest/v1/invoice_items?user_id=eq.${encodeURIComponent(user_id)}`, { method: 'DELETE', headers: H });
      await fetch(`${SUPABASE_URL}/rest/v1/invoices?user_id=eq.${encodeURIComponent(user_id)}`, { method: 'DELETE', headers: H });
      await fetch(`${SUPABASE_URL}/rest/v1/suppliers?user_id=eq.${encodeURIComponent(user_id)}`, { method: 'DELETE', headers: H });
      await fetch(`${SUPABASE_URL}/rest/v1/daily_revenues?user_id=eq.${encodeURIComponent(user_id)}`, { method: 'DELETE', headers: H });
      await fetch(`${SUPABASE_URL}/rest/v1/access_codes?user_id=eq.${encodeURIComponent(user_id)}`, { method: 'DELETE', headers: H });
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user_id)}`, { method: 'DELETE', headers: H });
      return { statusCode: 200, body: '{}' };
    }

    // ── Export users CSV ──────────────────────────────────────
    if (action === 'export_users') {
      const users = await fetch(
        `${SUPABASE_URL}/rest/v1/users?select=business_name,contact_name,phone,email,city,category,plan,pro_until,personal_code,created_at&order=created_at.desc`,
        { headers: H }
      ).then(r => r.json());

      const headers = ['שם עסק', 'איש קשר', 'טלפון', 'מייל', 'עיר', 'קטגוריה', 'תוכנית', 'PRO עד', 'קוד אישי', 'תאריך הצטרפות'];
      const rows = users.map(u => [
        u.business_name, u.contact_name, u.phone, u.email,
        u.city, u.category, u.plan, u.pro_until?.slice(0, 10),
        u.personal_code, u.created_at?.slice(0, 10)
      ].map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));

      const csv = '﻿' + [headers.join(','), ...rows].join('\n');
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="reverto-users.csv"' },
        body: csv
      };
    }

    // ── Marketing: audience segment sizes (for the campaign composer) ──────
    if (action === 'campaign_segment_counts') {
      const users = await getUsersWithStats(SUPABASE_URL, H);
      const counts = {};
      SEGMENTS.forEach(seg => { counts[seg] = filterSegment(users, seg).length; });
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(counts) };
    }

    // ── Marketing: campaign history with per-campaign send stats ───────────
    if (action === 'campaign_list') {
      const [campaigns, sends] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/marketing_campaigns?select=*&order=created_at.desc`, { headers: H }).then(r => r.json()),
        fetch(`${SUPABASE_URL}/rest/v1/marketing_campaign_sends?select=campaign_id,status`, { headers: H }).then(r => r.json())
      ]);
      const statsByCampaign = {};
      (sends || []).forEach(s => {
        const rec = statsByCampaign[s.campaign_id] || (statsByCampaign[s.campaign_id] = { sent: 0, failed: 0, skipped: 0 });
        rec[s.status] = (rec[s.status] || 0) + 1;
      });
      const withStats = (campaigns || []).map(c => ({ ...c, stats: statsByCampaign[c.id] || { sent: 0, failed: 0, skipped: 0 } }));
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(withStats) };
    }

    // ── Marketing: send a one-off preview of a campaign draft ──────────────
    // Always a test send: bcc's revertoo.ino@gmail.com and tags the subject
    // (see project memory: test-email-review rule).
    if (action === 'campaign_send_test') {
      const { subject, body, to_email } = parsed;
      if (!body) return { statusCode: 400, body: JSON.stringify({ error: 'חסר תוכן הקמפיין' }) };
      const target = to_email || 'revertoo.ino@gmail.com';
      const sent = await sendCampaignEmail(target, 'בדיקה', subject || 'קמפיין - בדיקה', body, { isTest: true });
      return { statusCode: sent ? 200 : 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sent }) };
    }

    // ── Marketing: create a campaign — draft, scheduled, or send immediately ──
    if (action === 'campaign_create') {
      const { title, subject, body, channel = 'email', target_segment = 'all', send_now, scheduled_at } = parsed;
      if (!title || !body) return { statusCode: 400, body: JSON.stringify({ error: 'חסר כותרת או תוכן' }) };
      if (channel !== 'email') return { statusCode: 400, body: JSON.stringify({ error: 'כרגע רק ערוץ המייל פעיל — WhatsApp ידלק כשיתקבלו פרטי ה-API' }) };
      if (!SEGMENTS.includes(target_segment)) return { statusCode: 400, body: JSON.stringify({ error: 'קהל יעד לא מוכר' }) };

      let status = 'draft';
      if (send_now) status = 'sending';
      else if (scheduled_at) status = 'scheduled';

      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/marketing_campaigns`, {
        method: 'POST',
        headers: { ...H, 'Prefer': 'return=representation' },
        body: JSON.stringify({ title, subject: subject || title, body, channel, target_segment, status, scheduled_at: scheduled_at || null })
      });
      const created = await createRes.json();
      const campaign = Array.isArray(created) ? created[0] : created;
      if (!campaign?.id) return { statusCode: 500, body: JSON.stringify({ error: 'יצירת הקמפיין נכשלה' }) };

      if (send_now) {
        const { campaign: sentCampaign, results } = await sendCampaignNow(SUPABASE_URL, H, campaign);
        return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign: sentCampaign, results }) };
      }

      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campaign }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
