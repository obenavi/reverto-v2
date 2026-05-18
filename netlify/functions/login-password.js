// Email + password login for REVERTO customers (not PILOT)
const crypto = require('crypto');

function signJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyPassword(password, stored) {
  return new Promise((resolve) => {
    const [salt, hash] = (stored || '').split(':');
    if (!salt || !hash) { resolve(false); return; }
    crypto.scrypt(password, salt, 64, (err, derived) => {
      if (err) { resolve(false); return; }
      try { resolve(crypto.timingSafeEqual(Buffer.from(hash, 'hex'), derived)); }
      catch { resolve(false); }
    });
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { email, password } = parsed;
  if (!email || !password) return { statusCode: 400, body: JSON.stringify({ error: 'Missing credentials' }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=ilike.${encodeURIComponent(email)}&select=*`,
      { headers: H }
    );
    const users = await r.json();
    if (!users?.length) return { statusCode: 401, body: JSON.stringify({ error: 'wrong_credentials' }) };

    const user = users[0];
    if (user.is_active === false) return { statusCode: 403, body: JSON.stringify({ error: 'suspended' }) };
    if (!user.password_hash) return { statusCode: 401, body: JSON.stringify({ error: 'use_code', message: 'משתמש זה נכנס עם קוד גישה — השתמש בקוד RV- שלך' }) };

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return { statusCode: 401, body: JSON.stringify({ error: 'wrong_credentials' }) };

    // Auto-downgrade if PRO expired
    if (user.plan === 'pro' && user.pro_until && new Date(user.pro_until) < new Date()) {
      user.plan = 'free';
      fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: { ...H, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ plan: 'free' })
      }).catch(() => {});
    }

    const jwt = signJWT(
      { user_id: user.id, plan: user.plan, exp: Math.floor(Date.now() / 1000) + 86400 * 90 }, // 3 months
      process.env.JWT_SECRET
    );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, jwt })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
