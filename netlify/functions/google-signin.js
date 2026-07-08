const crypto = require('crypto');
const { sendWelcomeEmail } = require('./_shared/welcome-email');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

function signJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 86400 * 90 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function generatePersonalCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(6);
  return 'RV-' + Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let credential;
  try { ({ credential } = JSON.parse(event.body || '{}')); }
  catch (_) { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  if (!credential) return { statusCode: 400, body: JSON.stringify({ error: 'Missing credential' }) };

  // Verify Google ID token
  const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`);
  if (!verifyRes.ok) return { statusCode: 401, body: JSON.stringify({ error: 'Invalid Google token' }) };

  const gUser = await verifyRes.json();

  // Validate audience
  if (gUser.aud !== GOOGLE_CLIENT_ID) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Token audience mismatch' }) };
  }

  const email = (gUser.email || '').toLowerCase();
  const name = gUser.name || gUser.email || '';
  if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'No email in token' }) };

  const H = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  // Look up existing user by email
  const findRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?email=ilike.${encodeURIComponent(email)}&select=*&limit=1`,
    { headers: H }
  );
  const existing = findRes.ok ? await findRes.json() : [];

  if (existing.length) {
    // Existing user — log in
    const user = existing[0];

    // Auto-downgrade if PRO expired
    if (user.plan === 'pro' && user.pro_until && new Date(user.pro_until) < new Date()) {
      user.plan = 'free';
      fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
        method: 'PATCH', headers: H, body: JSON.stringify({ plan: 'free' })
      }).catch(() => {});
    }

    const jwt = signJWT({ user_id: user.id, plan: user.plan });
    return {
      statusCode: 200,
      body: JSON.stringify({ user, jwt, new_user: false })
    };
  }

  // New user — create with Google data, mark onboarding needed
  let personal_code, codeOk = false;
  for (let i = 0; i < 5; i++) {
    personal_code = generatePersonalCode();
    const check = await fetch(
      `${SUPABASE_URL}/rest/v1/users?personal_code=eq.${encodeURIComponent(personal_code)}&select=id&limit=1`,
      { headers: H }
    );
    const rows = check.ok ? await check.json() : [];
    if (!rows.length) { codeOk = true; break; }
  }
  if (!codeOk) return { statusCode: 500, body: JSON.stringify({ error: 'Code generation failed' }) };

  const createRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      email,
      business_name: name,
      personal_code,
      auth_type: 'google',
      plan: 'free',
      onboarding_done: false,
      is_active: true
    })
  });

  if (!createRes.ok) return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create user' }) };
  const [user] = await createRes.json();

  // Register personal code
  await fetch(`${SUPABASE_URL}/rest/v1/access_codes`, {
    method: 'POST',
    headers: { ...H, 'Prefer': 'return=minimal' },
    body: JSON.stringify({ code: personal_code, type: 'personal', duration_months: 0, user_id: user.id, is_active: true })
  });

  // Send welcome email with personal code (fire and forget — don't block signup)
  sendWelcomeEmail(email, name, personal_code).catch(() => {});

  const jwt = signJWT({ user_id: user.id, plan: 'free' });
  return {
    statusCode: 201,
    body: JSON.stringify({ user, jwt, new_user: true, personal_code })
  };
};
