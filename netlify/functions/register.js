const crypto = require('crypto');

function codeEmailHtml(businessName, personalCode, siteUrl) {
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
  <div style="background:linear-gradient(135deg,#4A1F85,#9B6DD6);padding:28px;text-align:center">
    <div style="font-size:26px;font-weight:800;color:white;letter-spacing:-1px">Reverto</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px">ניהול רכש חכם</div>
  </div>
  <div style="padding:28px;text-align:right">
    <h2 style="font-size:20px;font-weight:800;color:#1C1428;margin:0 0 12px">הקוד האישי שלך</h2>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 20px">שלום ${businessName || ''},<br>תודה שהצטרפת ל-Reverto! שמור את הקוד הזה — תצטרך אותו לכל כניסה עתידית.</p>
    <div style="background:#F3EFFE;border:2px solid #6B35B8;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
      <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#6B35B8;font-family:monospace">${personalCode}</div>
      <div style="font-size:12px;color:#9889AE;margin-top:8px">הזן אותו במסך הכניסה של Reverto</div>
    </div>
    <a href="${siteUrl}" style="display:block;background:linear-gradient(135deg,#4A1F85,#9B6DD6);color:white;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:700">כניסה למערכת</a>
    <p style="font-size:12px;color:#aaa;margin-top:16px;text-align:center">שכחת את הקוד? בקש שליחה מחדש דרך מסך הכניסה</p>
  </div>
</div>
</body></html>`;
}

async function sendCodeEmail(toEmail, businessName, personalCode) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !toEmail) return;
  const siteUrl = process.env.SITE_URL || 'https://reverto-v2.netlify.app';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Reverto <noreply@mail.reverto.cloud>',
        to: [toEmail],
        subject: 'הקוד האישי שלך ל-Reverto — ' + personalCode,
        html: codeEmailHtml(businessName, personalCode, siteUrl)
      })
    });
  } catch (e) {
    console.error('Email send failed:', e.message);
  }
}

function signJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function generatePersonalCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous 0/O/1/I/L
  const bytes = crypto.randomBytes(6);
  return 'RV-' + Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { signup_code, profile } = parsed;
  if (!signup_code || !profile) return { statusCode: 400, body: JSON.stringify({ error: 'Missing data' }) };

  const codeUpper = signup_code.trim().toUpperCase();
  if (!codeUpper.startsWith('REVERTO')) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signup code' }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  try {
    // Validate signup code is active
    const cr = await fetch(
      `${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(codeUpper)}&type=eq.generic&is_active=eq.true&select=duration_months`,
      { headers: H }
    );
    const codes = await cr.json();
    if (!codes?.length) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid signup code' }) };
    const { duration_months } = codes[0];

    // Generate unique personal_code (retry on collision)
    let personal_code, codeOk = false;
    for (let i = 0; i < 5; i++) {
      personal_code = generatePersonalCode();
      const check = await fetch(
        `${SUPABASE_URL}/rest/v1/users?personal_code=eq.${encodeURIComponent(personal_code)}&select=id`,
        { headers: H }
      );
      const existing = await check.json();
      if (!existing?.length) { codeOk = true; break; }
    }
    if (!codeOk) return { statusCode: 500, body: JSON.stringify({ error: 'Code generation failed' }) };

    const proUntil = new Date();
    proUntil.setMonth(proUntil.getMonth() + duration_months);

    // Create user
    const ur = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
      method: 'POST',
      headers: { ...H, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        ...profile,
        personal_code,
        plan: 'pro',
        pro_until: proUntil.toISOString(),
        onboarding_done: true,
        is_active: true
      })
    });
    if (!ur.ok) {
      const detail = await ur.text();
      console.error('User insert failed:', detail);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create user', detail }) };
    }

    const newUsers = await ur.json();
    const user = Array.isArray(newUsers) ? newUsers[0] : newUsers;

    // Register personal code in access_codes
    await fetch(`${SUPABASE_URL}/rest/v1/access_codes`, {
      method: 'POST',
      headers: { ...H, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ code: personal_code, type: 'personal', duration_months: 0, user_id: user.id, is_active: true })
    });

    // Send personal code to email (fire and forget — don't block registration)
    sendCodeEmail(profile.email, profile.business_name, personal_code).catch(() => {});

    const jwt = signJWT(
      { user_id: user.id, plan: 'pro', exp: Math.floor(Date.now() / 1000) + 86400 },
      process.env.JWT_SECRET
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, jwt, personal_code })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
