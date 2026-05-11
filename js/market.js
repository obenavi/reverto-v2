// ── Market Prices ─────────────────────────────────────────────

let allMarketPrices = [];

async function renderMarket() {
  const el = document.getElementById('market-list');
  el.innerHTML = `<div class="card-pad"><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px"></div></div>`;

  const prices = await DB.get('market_prices', '?select=*&order=name.asc');
  allMarketPrices = prices || [];

  displayMarket(allMarketPrices);
  renderCommunityBench();
}

function displayMarket(prices) {
  const el = document.getElementById('market-list');
  if (!prices.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-title">אין נתוני שוק</div>
      <div class="empty-state-sub">נתוני תקליט יעודכנו בקרוב</div>
    </div>`;
    return;
  }

  // Group by date
  const byDate = {};
  prices.forEach(p => {
    const d = p.date || p.updated_at?.slice(0, 10) || '';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(p);
  });

  const latestDate = Object.keys(byDate).filter(d => d).sort().reverse()[0];
  const latest = (byDate[latestDate] || prices).filter(p => p.name && p.price != null && !isNaN(parseFloat(p.price)));

  el.innerHTML = `
    <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--on-surface-3);font-weight:700">
      עדכון אחרון: ${latestDate ? new Date(latestDate).toLocaleDateString('he-IL') : 'לא ידוע'}
    </div>
    ${latest.map(p => `
      <div class="list-row">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${p.name || ''}</div>
          ${p.unit ? `<div style="font-size:11px;color:var(--on-surface-3)">${p.unit}</div>` : ''}
        </div>
        <div style="font-size:15px;font-weight:800;color:var(--primary)">
          ₪${parseFloat(p.price || 0).toFixed(2)}
        </div>
      </div>
    `).join('')}
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
            הנתונים יופיעו כאשר לפחות 5 עסקים סרקו חשבוניות עם אותו מוצר.<br>
            עדיין בבנייה — חזור בקרוב.
          </div>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--on-surface-3);font-weight:700">
        ממוצע שוק — ${data[0]?.period || ''} · ${data.length} מוצרים
      </div>
      ${data.map(p => `
        <div class="list-row">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700">${p.product_name}</div>
            <div style="font-size:11px;color:var(--on-surface-3)">${p.sample_count} עסקים · טווח ₪${parseFloat(p.min_price).toFixed(2)}–₪${parseFloat(p.max_price).toFixed(2)}</div>
          </div>
          <div style="text-align:left">
            <div style="font-size:15px;font-weight:800;color:var(--primary)">₪${parseFloat(p.avg_price).toFixed(2)}</div>
            <div style="font-size:10px;color:var(--on-surface-3)">ממוצע</div>
          </div>
        </div>
      `).join('')}
    `;
  } catch {
    el.innerHTML = '';
  }
}
