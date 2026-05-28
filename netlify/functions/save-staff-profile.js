const crypto = require('crypto');

function verifyJWT(token, secret) {
  const [header, payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  if (sig !== expected) throw new Error('invalid signature');
  return JSON.parse(Buffer.from(payload, 'base64url').toString());
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const JWT_SECRET   = process.env.JWT_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();

  let payload;
  try { payload = verifyJWT(token, JWT_SECRET); }
  catch { return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }; }

  const { code, staff_name, staff_phone, staff_email } = JSON.parse(event.body || '{}');
  if (!code || !staff_name) return { statusCode: 400, body: JSON.stringify({ error: 'Missing fields' }) };

  const H = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  };

  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/access_codes?code=eq.${encodeURIComponent(code.toUpperCase())}&user_id=eq.${encodeURIComponent(payload.user_id)}`,
    { method: 'PATCH', headers: H, body: JSON.stringify({ staff_name, staff_phone, staff_email }) }
  );

  if (!r.ok) {
    const text = await r.text();
    return { statusCode: 500, body: JSON.stringify({ error: text }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
