// Called daily by GitHub Actions via HTTP POST
// Reads invoice_items → aggregates → writes to community_prices
// Requires x-cron-secret header for auth

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const secret = event.headers['x-cron-secret'] || '';
  if (!secret || secret !== process.env.CRON_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };
  const period = new Date().toISOString().slice(0, 7); // 'YYYY-MM'

  try {
    // Fetch invoice_items from last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/invoice_items?select=product_name,unit_price,user_id&date=gte.${sinceStr}&unit_price=gt.0`,
      { headers: H }
    );
    const items = await r.json();
    if (!Array.isArray(items)) throw new Error('Failed to fetch invoice_items');

    // Aggregate by product name (normalized to lowercase)
    const map = {};
    items.forEach(item => {
      const key = (item.product_name || '').trim().toLowerCase();
      if (!key || !item.unit_price) return;
      if (!map[key]) map[key] = { name: item.product_name.trim(), prices: [], users: new Set() };
      map[key].prices.push(parseFloat(item.unit_price));
      map[key].users.add(item.user_id);
    });

    // Only include products with 5+ unique businesses
    const MIN_SAMPLE = 5;
    const rows = [];
    Object.values(map).forEach(({ name, prices, users }) => {
      if (users.size < MIN_SAMPLE) return;
      prices.sort((a, b) => a - b);
      const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
      const mid = Math.floor(prices.length / 2);
      const median = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
      rows.push({
        product_name: name,
        avg_price: Math.round(avg * 100) / 100,
        min_price: prices[0],
        max_price: prices[prices.length - 1],
        median_price: Math.round(median * 100) / 100,
        sample_count: users.size,
        period
      });
    });

    if (rows.length > 0) {
      // Delete stale data for this period then insert fresh
      await fetch(`${SUPABASE_URL}/rest/v1/community_prices?period=eq.${period}`, {
        method: 'DELETE', headers: H
      });
      await fetch(`${SUPABASE_URL}/rest/v1/community_prices`, {
        method: 'POST',
        headers: { ...H, 'Prefer': 'return=minimal' },
        body: JSON.stringify(rows)
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, aggregated: rows.length, period, total_items: items.length })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
