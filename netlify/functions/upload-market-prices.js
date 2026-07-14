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

  const VALID_CATEGORIES = ['produce', 'animal', 'drinks', 'frozen', 'packaged', 'cleaning', 'other'];
  const today = new Date().toISOString().slice(0, 10);
  const rows = prices
    .map(p => ({
      name: (p.name || '').trim(),
      price: parseFloat(p.price),
      unit: (p.unit || 'ק"ג').trim(),
      category: VALID_CATEGORIES.includes(p.category) ? p.category : '',
      date: today,
      updated_at: new Date().toISOString()
    }))
    .filter(p => p.name && !isNaN(p.price) && p.price > 0);

  if (!rows.length) return { statusCode: 400, body: JSON.stringify({ error: 'No valid rows' }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  // Rows with a known category go through as-is. Rows without one (e.g. a plain CSV
  // upload with no AI classification) must NOT include the category key at all in
  // their upsert — otherwise they'd overwrite a category already set for that
  // product (from an earlier AI-classified upload) with an empty value.
  const withCat = rows.filter(r => r.category);
  const withoutCat = rows.filter(r => !r.category).map(({ category, ...rest }) => rest);

  try {
    // market_prices holds exactly one row per product — upsert (replace in place)
    // so re-uploading never creates duplicates or leaves stale rows behind.
    for (const batch of [withCat, withoutCat]) {
      if (!batch.length) continue;
      const r = await fetch(`${SUPABASE_URL}/rest/v1/market_prices?on_conflict=name`, {
        method: 'POST',
        headers: { ...H, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(batch)
      });
      if (!r.ok) {
        const err = await r.text();
        return { statusCode: 500, body: JSON.stringify({ error: err }) };
      }
    }

    // market_price_history is an append-only log (one row per product per upload
    // date) — this is what powers "price history per product" and long-term admin
    // tracking, completely separate from the current-price table above so history
    // never clutters or bloats the "latest price" views.
    for (const batch of [withCat, withoutCat]) {
      if (!batch.length) continue;
      const historyRows = batch.map(({ updated_at, ...r }) => r);
      await fetch(`${SUPABASE_URL}/rest/v1/market_price_history?on_conflict=name,date`, {
        method: 'POST',
        headers: { ...H, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(historyRows)
      });
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uploaded: rows.length }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
