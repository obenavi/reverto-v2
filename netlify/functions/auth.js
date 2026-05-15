const crypto = require('crypto');

function signJWT(payload, secret) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { code } = JSON.parse(event.body || '{}');
  if (!code) return { statusCode: 400, body: 'Missing code' };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const JWT_SECRET = process.env.JWT_SECRET;
  const codeUpper = code.trim().toUpperCase();
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  try {

    // ── REVERTO generic codes → redirect to create new account ─
    if (codeUpper.startsWith('REVERTO')) {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(codeUpper)}&type=eq.generic&is_active=eq.true&select=duration_months`,
        { headers: H }
      );
      const rows = await r.json();
      if (!rows?.length) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid code' }) };
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_user_signup: true, duration_months: rows[0].duration_months, signup_code: codeUpper })
      };
    }

    // ── PILOT codes → admin user, 2-hour session ───────────────
    if (codeUpper.startsWith('PILOT')) {
      const cr = await fetch(
        `${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(codeUpper)}&type=eq.pilot&is_active=eq.true&select=user_id`,
        { headers: H }
      );
      const codes = await cr.json();
      if (!codes?.length) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid code' }) };

      const ur = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(codes[0].user_id)}&select=*`,
        { headers: H }
      );
      const users = await ur.json();
      if (!users?.length) return { statusCode: 401, body: JSON.stringify({ error: 'User not found' }) };

      const user = { ...users[0], plan: 'pro', pro_until: '2099-12-31T00:00:00Z' };
      const jwt = signJWT(
        { user_id: user.id, plan: 'pro', is_admin: true, exp: Math.floor(Date.now() / 1000) + 86400 * 180 }, // 6 months
        JWT_SECRET
      );
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, jwt }) };
    }

    // ── Personal + partner codes (RV-) → returning user ───────
    if (codeUpper.startsWith('RV-')) {
      // Look up via access_codes — supports both personal and partner codes
      const cr = await fetch(
        `${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(codeUpper)}&type=in.(personal,partner)&is_active=eq.true&select=user_id`,
        { headers: H }
      );
      const codes = await cr.json();
      if (!codes?.length) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid code' }) };

      const ur = await fetch(
        `${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(codes[0].user_id)}&select=*`,
        { headers: H }
      );
      const users = await ur.json();
      if (!users?.length) return { statusCode: 401, body: JSON.stringify({ error: 'User not found' }) };

      const user = users[0];
      if (user.is_active === false) return { statusCode: 403, body: JSON.stringify({ error: 'Account suspended' }) };

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
        { user_id: user.id, plan: user.plan, exp: Math.floor(Date.now() / 1000) + 86400 }, // 24 hours
        JWT_SECRET
      );
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user, jwt }) };
    }

    return { statusCode: 401, body: JSON.stringify({ error: 'Invalid code' }) };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
