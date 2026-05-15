// Builds/updates product_catalog from invoice_items averages
// Called by the product tree page to sync real prices from invoices

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

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
  const userId = jwt.user_id;

  try {
    // Fetch all invoice items for this user
    const itemsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/invoice_items?user_id=eq.${encodeURIComponent(userId)}&unit_price=gt.0&select=product_name,unit_price`,
      { headers: H }
    );
    const items = await itemsRes.json();
    if (!Array.isArray(items) || !items.length) {
      return { statusCode: 200, body: JSON.stringify({ new: 0, updated: 0, unchanged: 0 }) };
    }

    // Average price per product
    const priceMap = {};
    items.forEach(item => {
      const name = (item.product_name || '').trim();
      if (!name) return;
      if (!priceMap[name]) priceMap[name] = [];
      priceMap[name].push(parseFloat(item.unit_price));
    });

    // Fetch existing catalog entries for this user
    const existingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/product_catalog?user_id=eq.${encodeURIComponent(userId)}&select=id,name,price_per_unit`,
      { headers: H }
    );
    const existing = await existingRes.json();
    const existingMap = {};
    (existing || []).forEach(p => { existingMap[p.name] = p; });

    let newCount = 0, updatedCount = 0, unchangedCount = 0;

    for (const [name, prices] of Object.entries(priceMap)) {
      const avg = Math.round((prices.reduce((s, p) => s + p, 0) / prices.length) * 100) / 100;

      if (existingMap[name]) {
        const existing = existingMap[name];
        const pctChange = existing.price_per_unit > 0
          ? Math.abs((avg - existing.price_per_unit) / existing.price_per_unit * 100)
          : 100;

        if (pctChange >= 1) {
          await fetch(`${SUPABASE_URL}/rest/v1/product_catalog?id=eq.${encodeURIComponent(existing.id)}`, {
            method: 'PATCH',
            headers: { ...H, 'Prefer': 'return=minimal' },
            body: JSON.stringify({
              previous_price: existing.price_per_unit,
              price_per_unit: avg,
              price_updated_at: new Date().toISOString()
            })
          });
          updatedCount++;
        } else {
          unchangedCount++;
        }
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/product_catalog`, {
          method: 'POST',
          headers: { ...H, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ user_id: userId, name, price_per_unit: avg })
        });
        newCount++;
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new: newCount, updated: updatedCount, unchanged: unchangedCount })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
