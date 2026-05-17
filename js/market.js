// ── Market Prices ─────────────────────────────────────────────

let allMarketPrices = [];
let userPriceAvg = {}; // user's average price per product name

async function renderMarket() {
  const el = document.getElementById('market-list');
  el.innerHTML = `<div class="card-pad"><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px"></div></div>`;

  // Load market prices + user's own invoice item prices in parallel
  const [prices, items] = await Promise.all([
    DB.get('market_prices', '?select=*&order=name.asc'),
    DB.get('invoice_items', '?select=product_name,unit_price&unit_price=gt.0')
  ]);
  allMarketPrices = prices || [];

  // Build user average price map
  const priceMap = {};
  (items || []).forEach(item => {
    const name = (item.product_name || '').trim();
    if (!name) return;
    if (!priceMap[name]) priceMap[name] = [];
    priceMap[name].push(parseFloat(item.unit_price));
  });
  userPriceAvg = {};
  Object.entries(priceMap).forEach(([name, arr]) => {
    userPriceAvg[name] = arr.reduce((s, p) => s + p, 0) / arr.length;
  });

  displayMarket(allMarketPrices);
  renderCommunityBench();
}

function displayMarket(prices) {
  const el = document.getElementById('market-list');
  if (!prices.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-title">אין נתוני שוק</div>
      <div class="empty-state-sub">האדמין טרם העלה את מחירון התקליט</div>
    </div>`;
    return;
  }

  const byDate = {};
  prices.forEach(p => {
    const d = p.date || p.updated_at?.slice(0, 10) || '';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(p);
  });

  const latestDate = Object.keys(byDate).filter(d => d).sort().reverse()[0];
  const latest = (byDate[latestDate] || prices).filter(p => p.name && p.price != null && !isNaN(parseFloat(p.price)));

  const aboveCount = latest.filter(p => {
    const u = userPriceAvg[p.name];
    return u && ((u - parseFloat(p.price)) / parseFloat(p.price) * 100) > 5;
  }).length;

  el.innerHTML = `
    <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:11px;color:var(--on-surface-3);font-weight:700">עדכון: ${latestDate ? new Date(latestDate).toLocaleDateString('he-IL') : 'לא ידוע'} · ${latest.length} מוצרים</div>
      ${aboveCount > 0 ? `<div style="font-size:11px;font-weight:700;color:var(--error)">⚠️ משלם יותר ב-${aboveCount} מוצרים</div>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr auto auto;gap:0;font-size:10px;font-weight:700;color:var(--on-surface-3);padding:6px 14px;background:var(--surface-low);border-bottom:1px solid var(--border)">
      <div>מוצר</div>
      <div style="text-align:center;padding:0 8px">מחיר שוק</div>
      <div style="text-align:center">המחיר שלך</div>
    </div>
    ${latest.map(p => {
      const mktPrice = parseFloat(p.price);
      const userPrice = userPriceAvg[p.name];
      const diff = userPrice ? ((userPrice - mktPrice) / mktPrice * 100) : null;
      const diffColor = diff === null ? 'var(--on-surface-3)'
        : diff > 10 ? 'var(--error)'
        : diff > 0 ? '#F59E0B'
        : 'var(--success)';
      const diffText = diff === null ? '—'
        : (diff > 0 ? '+' : '') + diff.toFixed(0) + '%';
      const diffIcon = diff === null ? '' : diff > 5 ? '↑' : diff < -5 ? '↓' : '≈';
      return `
        <div style="display:grid;grid-template-columns:1fr auto auto;gap:0;padding:10px 14px;border-bottom:1px solid var(--border);align-items:center">
          <div>
            <div style="font-size:13px;font-weight:700">${p.name}</div>
            ${p.unit ? `<div style="font-size:10px;color:var(--on-surface-3)">${p.unit}</div>` : ''}
          </div>
          <div style="text-align:center;padding:0 10px">
            <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${mktPrice.toFixed(2)}</div>
          </div>
          <div style="text-align:center;min-width:70px">
            ${userPrice ? `
              <div style="font-size:13px;font-weight:700">₪${userPrice.toFixed(2)}</div>
              <div style="font-size:11px;font-weight:700;color:${diffColor}">${diffIcon} ${diffText}</div>`
            : `<div style="font-size:11px;color:var(--on-surface-3)">אין נתון</div>`}
          </div>
        </div>`;
    }).join('')}
  `;
}

function filterMarket(q) {
  if (!q) { displayMarket(allMarketPrices); return; }
  const filtered = allMarketPrices.filter(p => (p.name || '').includes(q));
  displayMarket(filtered);
}

async function renderCommunityBench() {
  const el = document.getElementById('community-bench');
  if (!el) return;

  el.innerHTML = `<div class="card-pad"><div class="skeleton" style="height:40px;margin-bottom:8px"></div><div class="skeleton" style="height:40px"></div></div>`;

  try {
    const jwt = Auth.jwt;
    if (!jwt) { el.innerHTML = ''; return; }

    const res = await fetch('/.netlify/functions/community-bench', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt }
    });
    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      el.innerHTML = `
        <div class="card-pad" style="text-align:center;padding:20px">
          <div style="font-size:13px;font-weight:700;margin-bottom:6px">בנצ'מרק קהילתי</div>
          <div style="font-size:12px;color:var(--on-surface-3);line-height:1.6">
            הנתונים יופיעו כאשר לפחות 5 עסקים סרקו חשבוניות עם אותו מוצר.
          </div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--on-surface-3);font-weight:700">
        ממוצע שוק — ${data[0]?.period || ''} · ${data.length} מוצרים
      </div>
      ${data.map(p => {
        const userPrice = userPriceAvg[p.product_name];
        const avgPrice = parseFloat(p.avg_price);
        const diff = userPrice ? ((userPrice - avgPrice) / avgPrice * 100) : null;
        const diffColor = diff === null ? 'var(--on-surface-3)' : diff > 5 ? 'var(--error)' : diff < -5 ? 'var(--success)' : '#F59E0B';
        return `
          <div class="list-row">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">${p.product_name}</div>
              <div style="font-size:11px;color:var(--on-surface-3)">${p.sample_count} עסקים · ₪${parseFloat(p.min_price).toFixed(2)}–₪${parseFloat(p.max_price).toFixed(2)}</div>
            </div>
            <div style="text-align:left">
              <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${avgPrice.toFixed(2)}</div>
              ${userPrice ? `<div style="font-size:11px;font-weight:700;color:${diffColor}">${diff > 0 ? '+' : ''}${diff?.toFixed(0)}% שלך</div>` : ''}
            </div>
          </div>`;
      }).join('')}
    `;
  } catch {
    el.innerHTML = '';
  }
}
