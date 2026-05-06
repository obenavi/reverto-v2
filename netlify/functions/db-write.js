const crypto = require('crypto');

// Public tables: no auth, insert only
const PUBLIC_WRITE_TABLES = ['waitlist'];

// User tables: JWT required — value is the ownership column name
const USER_TABLES = {
  users: 'id',
  invoices: 'user_id',
  invoice_items: 'user_id',
  suppliers: 'user_id',
  daily_revenues: 'user_id',
};

const ALLOWED_ACTIONS = ['insert', 'update', 'delete'];

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

  const { table, action, filter = '', data } = parsed;
  if (!table || !action) return { statusCode: 400, body: JSON.stringify({ error: 'Missing table or action' }) };
  if (!ALLOWED_ACTIONS.includes(action)) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action' }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const BASE_HEADERS = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  // Public tables: unauthenticated insert only
  if (PUBLIC_WRITE_TABLES.includes(table)) {
    if (action !== 'insert') return { statusCode: 400, body: JSON.stringify({ error: 'Only insert allowed on this table' }) };
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...BASE_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(data)
      });
      return { statusCode: r.ok ? 200 : r.status, body: '{}' };
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

  const col = USER_TABLES[table];
  const userId = jwt.user_id;

  try {
    let url, method, headers, reqBody;

    if (action === 'insert') {
      // Force ownership column — client cannot write as another user
      const safeData = Array.isArray(data)
        ? data.map(d => ({ ...d, [col]: userId }))
        : { ...data, [col]: userId };
      url = `${SUPABASE_URL}/rest/v1/${table}`;
      method = 'POST';
      headers = { ...BASE_HEADERS, 'Prefer': 'return=representation' };
      reqBody = JSON.stringify(safeData);

    } else if (action === 'update') {
      // Inject ownership filter — client can only update their own rows
      const sep = filter.includes('?') ? '&' : '?';
      const safeFilter = `${filter}${sep}${col}=eq.${encodeURIComponent(userId)}`;
      // Strip ownership column from data so client cannot reassign rows
      const { [col]: _drop, ...safeData } = (data || {});
      url = `${SUPABASE_URL}/rest/v1/${table}${safeFilter}`;
      method = 'PATCH';
      headers = { ...BASE_HEADERS, 'Prefer': 'return=minimal' };
      reqBody = JSON.stringify(safeData);

    } else if (action === 'delete') {
      // Inject ownership filter — client can only delete their own rows
      const sep = filter.includes('?') ? '&' : '?';
      const safeFilter = `${filter}${sep}${col}=eq.${encodeURIComponent(userId)}`;
      url = `${SUPABASE_URL}/rest/v1/${table}${safeFilter}`;
      method = 'DELETE';
      headers = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
      reqBody = undefined;
    }

    const r = await fetch(url, { method, headers, body: reqBody });

    if (action === 'insert') {
      if (!r.ok) return { statusCode: r.status, body: JSON.stringify({ error: 'Insert failed' }) };
      const result = await r.json();
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(result) };
    }

    return { statusCode: r.ok ? 200 : r.status, body: '{}' };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
