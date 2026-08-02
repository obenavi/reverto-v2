// Called daily by GitHub Actions via HTTP POST
// Reads invoice_items → aggregates → writes to community_prices
// Requires x-cron-secret header for auth

// Different customers (and different suppliers' invoices) name the same base
// product differently — brand, package size, grade. Grouping by the exact raw
// string means most products never reach the 5-business sample-size threshold
// even when there's real data for them. This buckets known common staples into
// one generic name for aggregation, deliberately ignoring brand/grade for now —
// coarse on purpose, to get a usable community price sooner. Order matters: more
// specific patterns are checked before broader ones. Extend this list over time
// as more products are identified; anything unmatched falls back to its raw name,
// same as before this existed.
const GENERIC_PRODUCT_MAP = [
  // Dry goods / staples
  { generic: 'אורז', pattern: /אורז/ },
  { generic: 'סוכר', pattern: /סוכר/ },
  { generic: 'מלח', pattern: /מלח/ },
  { generic: 'קמח', pattern: /קמח/ },
  { generic: 'שמן זית', pattern: /שמן זית/ },
  { generic: 'שמן בישול', pattern: /שמן (קנולה|סויה|חמניות|תירס|בישול)/ },
  { generic: 'פסטה', pattern: /פסטה|ספגטי/ },
  { generic: 'עדשים', pattern: /עדשים/ },
  { generic: 'קינואה', pattern: /קינואה/ },

  // Vegetables
  { generic: 'עגבניות', pattern: /עגבני/ },
  { generic: 'מלפפונים', pattern: /מלפפון/ },
  { generic: 'בצל אדום', pattern: /בצל אדום/ },
  { generic: 'בצל ירוק', pattern: /בצל ירוק/ },
  { generic: 'בצל לבן', pattern: /בצל (לבן|יבש)/ },
  { generic: 'גזר', pattern: /גזר/ },
  { generic: 'תפוחי אדמה', pattern: /תפו״?א|תפוח(י)? אדמה/ },
  { generic: 'שום', pattern: /שום/ },
  { generic: 'חציל', pattern: /חציל/ },
  { generic: 'קישואים', pattern: /קישוא/ },
  { generic: 'תרד', pattern: /תרד/ },
  { generic: 'ברוקולי', pattern: /ברוקול/ },
  { generic: 'כרובית', pattern: /כרובית/ },
  { generic: 'כרוב לבן', pattern: /כרוב לבן/ },
  { generic: 'כרוב אדום', pattern: /כרוב אדום/ },
  { generic: 'חסה', pattern: /חסה/ },
  { generic: 'פלפל אדום', pattern: /פלפל אדום/ },
  { generic: 'פלפל צהוב', pattern: /פלפל צהוב/ },
  { generic: 'פלפל ירוק', pattern: /פלפל ירוק/ },
  { generic: 'פלפל חריף', pattern: /פלפל חריף|צ׳ילי|צ'ילי/ },

  // Fruits
  { generic: 'לימון', pattern: /לימון/ },
  { generic: 'תפוחים', pattern: /תפוח עץ|תפוחים/ },
  { generic: 'בננות', pattern: /בננ/ },
  { generic: 'אבטיח', pattern: /אבטיח/ },
  { generic: 'מלון', pattern: /מלון/ },
  { generic: 'תות שדה', pattern: /תות שדה|תותים/ },
  { generic: 'ענבים', pattern: /ענבים/ },
  { generic: 'אבוקדו', pattern: /אבוקדו/ },

  // Dairy / eggs
  { generic: 'ביצים', pattern: /ביצ/ },
  { generic: 'חלב', pattern: /^חלב/ },
  { generic: 'שמנת', pattern: /שמנת/ },

  // Meat / poultry
  { generic: 'חזה עוף', pattern: /חזה עוף/ },
  { generic: 'שוק עוף', pattern: /שוק עוף|ירך עוף/ },
  { generic: 'עוף שלם', pattern: /עוף שלם/ },
  { generic: 'בשר טחון בקר', pattern: /טחון בקר|בקר טחון/ }
];

function normalizeToGeneric(name) {
  const n = (name || '').trim();
  for (const { generic, pattern } of GENERIC_PRODUCT_MAP) {
    if (pattern.test(n)) return generic;
  }
  return n;
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
    // Fetch invoice_items from last 30 days
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/invoice_items?select=product_name,unit_price,user_id,unit&date=gte.${sinceStr}&unit_price=gt.0`,
      { headers: H }
    );
    const items = await r.json();
    if (!Array.isArray(items)) throw new Error('Failed to fetch invoice_items');

    // Group by generic product name + unit. Never average a ₪/kg price together
    // with a ₪/package price for "the same" product — that's comparing different
    // things. Rows scanned before unit tracking existed have unit=null and form
    // their own group rather than being guessed into one of the real ones.
    const map = {};
    items.forEach(item => {
      const generic = normalizeToGeneric(item.product_name);
      if (!generic || !item.unit_price) return;
      const unit = (item.unit || '').trim();
      const key = generic.toLowerCase() + '|' + unit.toLowerCase();
      if (!map[key]) map[key] = { name: generic, unit, prices: [], users: new Set() };
      map[key].prices.push(parseFloat(item.unit_price));
      map[key].users.add(item.user_id);
    });

    // Only include products with 5+ unique businesses
    const MIN_SAMPLE = 5;
    const rows = [];
    Object.values(map).forEach(({ name, unit, prices, users }) => {
      if (users.size < MIN_SAMPLE) return;
      prices.sort((a, b) => a - b);
      const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
      const mid = Math.floor(prices.length / 2);
      const median = prices.length % 2 === 0 ? (prices[mid - 1] + prices[mid]) / 2 : prices[mid];
      rows.push({
        // community_prices has no separate unit column — fold it into the display
        // name (e.g. "אורז (ק"ג)") so the unit stays visible and unambiguous.
        product_name: unit ? `${name} (${unit})` : name,
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
