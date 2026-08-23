// Called daily by GitHub Actions via HTTP POST
// Reads invoice_items → cold-matches → aggregates → writes community_prices
// Requires x-cron-secret header for auth
//
// COLD MATCHING: products are pooled by head noun alone — grade, variety, brand,
// trim, cut and flavour are all discarded, so every rice is one bucket and every
// apple is one bucket. That is deliberate. Precise matching on Hebrew free text
// leaves almost every bucket below the sample threshold, which is why the old
// exact-string grouping produced nothing at all. Pooling wide and publishing the
// MEDIAN gives a usable "what do restaurants pay for rice" number: the middle
// value is unmoved by a few premium or bargain variants, where an average would
// be dragged by both.
//
// What the median CANNOT absorb is a difference of basis (₪/kg vs ₪/carton), so
// buckets are segmented by canonical unit and unresolved units are dropped.

const { coldKey } = require('./_shared/cold-match');
const { canonicalUnit } = require('./_shared/units');

// Minimum distinct businesses before a bucket may be published. Anonymity comes
// from the size of the pool, so this is the privacy control: below it, a viewer
// could subtract their own price and read a competitor's. Configurable so the
// threshold can track the size of the user base, but never below 3.
const MIN_BUSINESSES = Math.max(3, parseInt(process.env.COMMUNITY_MIN_BUSINESSES || '5', 10));

// A bucket whose middle half spans more than this fraction of its median is not
// measuring one thing — it is a mix of bases or corrupted rows. Suppress rather
// than publish a number nobody can act on.
const MAX_IQR_RATIO = parseFloat(process.env.COMMUNITY_MAX_IQR_RATIO || '1.2');

const LOOKBACK_DAYS = parseInt(process.env.COMMUNITY_LOOKBACK_DAYS || '90', 10);

function quantile(sorted, q) {
  if (!sorted.length) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Median absolute deviation — drops rows the OCR mangled (a ₪2,970 line that
// should read ₪183) without assuming a normal distribution the way stddev does.
function dropOutliers(values) {
  if (values.length < 4) return values;
  const sorted = [...values].sort((a, b) => a - b);
  const med = quantile(sorted, 0.5);
  const deviations = sorted.map(v => Math.abs(v - med)).sort((a, b) => a - b);
  const mad = quantile(deviations, 0.5);
  if (!mad) return values;
  // 3.5 modified z-scores ≈ the conventional outlier cut for MAD
  return values.filter(v => Math.abs(v - med) / (1.4826 * mad) <= 3.5);
}

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
    const since = new Date();
    since.setDate(since.getDate() - LOOKBACK_DAYS);
    const sinceStr = since.toISOString().slice(0, 10);

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/invoice_items` +
      `?select=product_name,unit_price,quantity,total_price,user_id,unit` +
      `&date=gte.${sinceStr}&unit_price=gt.0`,
      { headers: H }
    );
    const items = await r.json();
    if (!Array.isArray(items)) throw new Error('Failed to fetch invoice_items');

    const stats = { scanned: items.length, no_key: 0, no_unit: 0, inconsistent: 0, used: 0 };
    const map = {};

    for (const item of items) {
      const price = parseFloat(item.unit_price);
      if (!(price > 0)) continue;

      // A line whose own arithmetic disagrees was mis-parsed; one bad row can
      // move a small bucket's median, so it never enters the pool.
      const qty = parseFloat(item.quantity);
      const total = parseFloat(item.total_price);
      if (qty > 0 && total > 0 && Math.abs(price * qty - total) > Math.max(0.02, total * 0.02)) {
        stats.inconsistent++;
        continue;
      }

      const unit = canonicalUnit(item.unit);
      if (!unit) { stats.no_unit++; continue; }

      const { key, label } = coldKey(item.product_name);
      if (!key) { stats.no_key++; continue; }

      const mapKey = `${key}|${unit}`;
      if (!map[mapKey]) map[mapKey] = { label, unit, prices: [], byUser: new Map() };
      map[mapKey].prices.push(price);
      // Track per-business so one heavy uploader cannot dominate a bucket
      const list = map[mapKey].byUser.get(item.user_id) || [];
      list.push(price);
      map[mapKey].byUser.set(item.user_id, list);
      stats.used++;
    }

    const rows = [];
    const suppressed = { thin: 0, spread: 0 };

    for (const { label, unit, byUser } of Object.values(map)) {
      if (byUser.size < MIN_BUSINESSES) { suppressed.thin++; continue; }

      // One observation per business (its own median) before pooling, so a
      // restaurant that uploaded 40 invoices does not outvote one that uploaded 1.
      const perBusiness = [...byUser.values()].map(list => {
        const s = [...list].sort((a, b) => a - b);
        return quantile(s, 0.5);
      });

      const cleaned = dropOutliers(perBusiness).sort((a, b) => a - b);
      if (cleaned.length < MIN_BUSINESSES) { suppressed.thin++; continue; }

      const p25 = quantile(cleaned, 0.25);
      const p50 = quantile(cleaned, 0.50);
      const p75 = quantile(cleaned, 0.75);

      if (!p50 || (p75 - p25) / p50 > MAX_IQR_RATIO) { suppressed.spread++; continue; }

      rows.push({
        // community_prices has no unit column — fold it into the display name
        product_name: `${label} (${unit === 'kg' ? 'ק"ג' : unit === 'l' ? 'ליטר' : "יח'"})`,
        // Median is the published benchmark. avg_price is kept populated for the
        // existing UI contract, but it carries the median too — an average of a
        // cold bucket is not a number anyone should see.
        avg_price: Math.round(p50 * 100) / 100,
        median_price: Math.round(p50 * 100) / 100,
        // Quartiles, never true min/max: the extremes of a small pool are two
        // identifiable businesses' actual prices.
        min_price: Math.round(p25 * 100) / 100,
        max_price: Math.round(p75 * 100) / 100,
        sample_count: byUser.size,
        period
      });
    }

    if (rows.length > 0) {
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
      body: JSON.stringify({
        success: true, period, published: rows.length,
        buckets: Object.keys(map).length, suppressed, stats,
        min_businesses: MIN_BUSINESSES
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
