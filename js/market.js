// ── Market Prices ─────────────────────────────────────────────

let allMarketPrices = [];

async function renderMarket() {
  const el = document.getElementById('market-list');
  el.innerHTML = `<div class="card-pad"><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px"></div></div>`;

  const prices = await DB.get('market_prices', '?select=*&order=name.asc');
  allMarketPrices = prices || [];

  displayMarket(allMarketPrices);
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
    const d = p.date || p.updated_at?.slice(0,10) || '';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(p);
  });

  const latestDate = Object.keys(byDate).sort().reverse()[0];
  const latest = byDate[latestDate] || prices;

  el.innerHTML = `
    <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--on-surface-3);font-weight:700">
      עדכון אחרון: ${latestDate ? new Date(latestDate).toLocaleDateString('he-IL') : 'לא ידוע'}
    </div>
    ${latest.map(p => `
      <div class="list-row">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${p.name||''}</div>
          ${p.unit ? `<div style="font-size:11px;color:var(--on-surface-3)">${p.unit}</div>` : ''}
        </div>
        <div style="font-size:15px;font-weight:800;color:var(--primary)">
          ₪${parseFloat(p.price||0).toFixed(2)}
        </div>
      </div>
    `).join('')}
  `;
}

function filterMarket(q) {
  if (!q) { displayMarket(allMarketPrices); return; }
  const filtered = allMarketPrices.filter(p =>
    (p.name||'').includes(q)
  );
  displayMarket(filtered);
}
