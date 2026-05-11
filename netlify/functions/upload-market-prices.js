// Admin only — bulk upload market prices from CSV rows

const crypto = require('crypto');

function verifyJWT(token, secret) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('Invalid signature');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) throw new Error('Token expired');
  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = (event.headers['authorization'] || '').replace('Bearer ', '');
  let jwt;
  try { jwt = verifyJWT(authHeader, process.env.JWT_SECRET); }
  catch { return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }; }
  if (!jwt.is_admin) return { statusCode: 403, body: JSON.stringify({ error: 'Admin only' }) };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { prices } = parsed;
  if (!Array.isArray(prices) || !prices.length) {
    return { statusCode: 400, body: JSON.stringify({ error: 'prices array required' }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows = prices
    .map(p => ({
      name: (p.name || '').trim(),
      price: parseFloat(p.price),
      unit: (p.unit || 'ק"ג').trim(),
      date: today,
      updated_at: new Date().toISOString()
    }))
    .filter(p => p.name && !isNaN(p.price) && p.price > 0);

  if (!rows.length) return { statusCode: 400, body: JSON.stringify({ error: 'No valid rows' }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  try {
    // Delete existing prices for the uploaded product names, then insert fresh
    const names = rows.map(r => r.name).join(',');
    await fetch(`${SUPABASE_URL}/rest/v1/market_prices?name=in.(${encodeURIComponent(names)})`, {
      method: 'DELETE', headers: H
    });

    const r = await fetch(`${SUPABASE_URL}/rest/v1/market_prices`, {
      method: 'POST',
      headers: { ...H, 'Prefer': 'return=minimal' },
      body: JSON.stringify(rows)
    });

    if (!r.ok) {
      const err = await r.text();
      return { statusCode: 500, body: JSON.stringify({ error: err }) };
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploaded: rows.length }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
