// Market price scraper — runs via GitHub Actions daily
// Tries multiple sources with fallback. Exits 1 on total failure
// (GitHub will send failure email automatically)

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const today = new Date().toISOString().slice(0, 10);

async function pushToSupabase(prices) {
  if (!prices.length) throw new Error('No prices to push');
  const rows = prices.map(p => ({ ...p, date: today, updated_at: new Date().toISOString() }));
  const res = await fetch(`${SUPABASE_URL}/rest/v1/market_prices`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) throw new Error(`Supabase error: ${await res.text()}`);
  console.log(`✓ Pushed ${rows.length} prices to Supabase`);
}

// ── Source 1: plants.moonsite.co.il ──────────────────────────
async function scrapeSource1() {
  const res = await fetch('https://plants.moonsite.co.il/prices', {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Reverto/1.0)' },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  const prices = [];
  // Match table rows with product name + price — adjust selector if page structure changes
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
  let row;
  while ((row = rowRegex.exec(html)) !== null) {
    const cells = [];
    let cell;
    const cellMatcher = new RegExp(cellRegex.source, 'gi');
    while ((cell = cellMatcher.exec(row[1])) !== null) {
      cells.push(cell[1].replace(/<[^>]+>/g, '').trim());
    }
    if (cells.length >= 2) {
      const name = cells[0];
      const price = parseFloat(cells[1].replace(/[^\d.]/g, ''));
      const unit = cells[2] || 'ק"ג';
      if (name && price > 0) prices.push({ name, price, unit });
    }
  }

  if (!prices.length) throw new Error('No prices parsed from source 1');
  console.log(`Source 1: parsed ${prices.length} prices`);
  return prices;
}

// ── Source 2: mash.gov.il ────────────────────────────────────
async function scrapeSource2() {
  // Ministry of Agriculture price tariff
  // TODO: implement once page structure is confirmed
  throw new Error('Source 2 not yet implemented — add scraping logic here');
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const sources = [
    { name: 'plants.moonsite.co.il', fn: scrapeSource1 },
    { name: 'mash.gov.il', fn: scrapeSource2 },
  ];

  for (const { name, fn } of sources) {
    try {
      console.log(`Trying ${name}...`);
      const prices = await fn();
      await pushToSupabase(prices);
      console.log('Market prices updated successfully');
      process.exit(0);
    } catch (e) {
      console.error(`${name} failed: ${e.message}`);
    }
  }

  console.error('All sources failed — GitHub will send failure notification');
  process.exit(1);
}

main();
