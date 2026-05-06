const crypto = require('crypto');

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
        code_duration_months: duration_months,
        onboarding_done: true,
        is_active: true
      })
    });
    if (!ur.ok) return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create user' }) };

    const newUsers = await ur.json();
    const user = Array.isArray(newUsers) ? newUsers[0] : newUsers;

    // Register personal code in access_codes
    await fetch(`${SUPABASE_URL}/rest/v1/access_codes`, {
      method: 'POST',
      headers: { ...H, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ code: personal_code, type: 'personal', duration_months: 0, user_id: user.id, is_active: true })
    });

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
