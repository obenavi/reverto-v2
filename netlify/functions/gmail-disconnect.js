const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function verifyJwt(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const [h, b, s] = token.split('.');
  if (!h || !b || !s) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
  if (expected !== s) return null;
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (payload.exp < Date.now() / 1000) return null;
  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  await fetch(`${SUPABASE_URL}/rest/v1/email_integrations?user_id=eq.${payload.user_id}`, {
    method: 'DELETE', headers: H
  });

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
