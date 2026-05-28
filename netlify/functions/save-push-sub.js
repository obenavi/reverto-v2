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
  catch { return { statusCode: 401, body: 'Unauthorized' }; }

  const { sub } = JSON.parse(event.body || '{}');
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { statusCode: 400, body: 'Missing subscription fields' };
  }

  const H = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal,resolution=merge-duplicates'
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      user_id:  payload.user_id,
      endpoint: sub.endpoint,
      p256dh:   sub.keys.p256dh,
      auth:     sub.keys.auth
    })
  });

  return { statusCode: r.ok ? 200 : 500, body: r.ok ? '{"ok":true}' : 'DB error' };
};
