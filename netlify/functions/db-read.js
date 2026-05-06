const crypto = require('crypto');

const PUBLIC_TABLES = ['market_prices'];
const USER_TABLES = {
  users: 'id',
  invoices: 'user_id',
  invoice_items: 'user_id',
  suppliers: 'user_id',
  daily_revenues: 'user_id',
};

function verifyJWT(token, secret) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    throw new Error('Invalid signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) throw new Error('Token expired');
  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let parsed;
  try {
    parsed = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { table, filter = '' } = parsed;
  if (!table) return { statusCode: 400, body: JSON.stringify({ error: 'Missing table' }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  // Public tables: no auth required
  if (PUBLIC_TABLES.includes(table)) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filter}`, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
      });
      const data = await r.json();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }

  // User tables: JWT required
  if (!USER_TABLES[table]) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid table' }) };
  }

  const authHeader = (event.headers['authorization'] || '').replace('Bearer ', '');
  let jwt;
  try {
    jwt = verifyJWT(authHeader, process.env.JWT_SECRET);
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // Always inject the user ownership filter — client cannot override this
  const col = USER_TABLES[table];
  const sep = filter.includes('?') ? '&' : '?';
  const safeFilter = `${filter}${sep}${col}=eq.${encodeURIComponent(jwt.user_id)}`;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${safeFilter}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    const data = await r.json();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
