const crypto = require('crypto');

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

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
