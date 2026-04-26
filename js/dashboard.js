// ── Dashboard ─────────────────────────────────────────────────

let dashData = { invoices: [], suppliers: [] };
let currentPeriod = 'week';

async function renderDashboard() {
  const userId = Auth.userId;
  if (!userId) return;

  // Load invoices
  const invoices = await DB.get('invoices', `?user_id=eq.${encodeURIComponent(userId)}&select=*&order=date.desc`);
  dashData.invoices = invoices || [];

  // Monthly total
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthlyInvoices = dashData.invoices.filter(i => i.date >= monthStart);
  const monthlyTotal = monthlyInvoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);

  document.getElementById('dash-monthly').textContent = '₪' + monthlyTotal.toLocaleString('he-IL', {maximumFractionDigits:0});
  document.getElementById('dash-monthly-sub').textContent = monthlyInvoices.length + ' חשבוניות';

  // Food Cost
  const profile = Auth.profile;
  const dailyRevenue = parseFloat(profile.daily_revenue) || 0;
  if (dailyRevenue > 0) {
    const daysInMonth = now.getDate();
    const monthRevenue = dailyRevenue * daysInMonth;
    const foodCost = monthRevenue > 0 ? (monthlyTotal / monthRevenue * 100) : 0;
    document.getElementById('dash-foodcost').textContent = foodCost.toFixed(1) + '%';
    document.getElementById('dash-foodcost-sub').textContent = foodCost < 30 ? 'תקין' : foodCost < 35 ? 'גבוה מעט' : 'גבוה';
    document.getElementById('dash-foodcost').style.color = foodCost < 30 ? 'var(--success)' : foodCost < 35 ? 'var(--warning)' : 'var(--error)';
  }

  // Recent invoices
  renderRecentInvoices(dashData.invoices.slice(0, 5));

  // Chart
  renderChart(currentPeriod);

  // Price alerts
  renderPriceAlerts();

  // Benchmark
  renderBenchmark();

  // Saving
  calcSaving();
}

function renderRecentInvoices(invoices) {
  const el = document.getElementById('dash-recent-invoices');
  if (!invoices.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
      <div class="empty-state-title">אין חשבוניות עדיין</div>
      <div class="empty-state-sub">סרוק את החשבונית הראשונה שלך</div>
    </div>`;
    return;
  }
  el.innerHTML = invoices.map(inv => `
    <div class="list-row" onclick="openInvoice('${inv.id}')">
      <div class="list-avatar">${(inv.supplier_name||'?')[0]}</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">${inv.supplier_name || 'ספק לא ידוע'}</div>
        <div style="font-size:12px;color:var(--on-surface-3)">${formatDate(inv.date)}</div>
      </div>
      <div style="font-size:15px;font-weight:800;color:var(--primary)">₪${parseFloat(inv.total_amount||0).toLocaleString('he-IL',{maximumFractionDigits:0})}</div>
    </div>
  `).join('');
}

function renderPriceAlerts() {
  const el = document.getElementById('dash-alerts-list');
  const invoices = dashData.invoices;
  if (invoices.length < 2) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-title">אין התראות</div><div class="empty-state-sub">נזהה עליות מחיר כשיהיו מספיק נתונים</div></div>`;
    document.getElementById('dash-alerts').textContent = '0';
    return;
  }

  // Find price increases per product
  const productPrices = {};
  invoices.forEach(inv => {
    if (!inv.items) return;
    const items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items;
    items.forEach(item => {
      if (!item.product_name || !item.unit_price) return;
      if (!productPrices[item.product_name]) productPrices[item.product_name] = [];
      productPrices[item.product_name].push({ price: parseFloat(item.unit_price), date: inv.date });
    });
  });

  const alerts = [];
  Object.entries(productPrices).forEach(([name, entries]) => {
    if (entries.length < 2) return;
    entries.sort((a,b) => new Date(b.date) - new Date(a.date));
    const latest = entries[0].price;
    const prev = entries[1].price;
    if (latest > prev * 1.05) {
      const pct = ((latest - prev) / prev * 100).toFixed(0);
      alerts.push({ name, latest, prev, pct });
    }
  });

  document.getElementById('dash-alerts').textContent = alerts.length;

  if (!alerts.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-title">אין התראות</div><div class="empty-state-sub">כל המחירים יציבים</div></div>`;
    return;
  }

  el.innerHTML = alerts.slice(0,5).map(a => `
    <div class="alert-row">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">${a.name}</div>
        <div style="font-size:11px;color:var(--on-surface-3)">היה ₪${a.prev.toFixed(2)} → עכשיו ₪${a.latest.toFixed(2)}</div>
      </div>
      <div class="badge badge-error">+${a.pct}%</div>
    </div>
  `).join('');
}

async function renderBenchmark() {
  const el = document.getElementById('dash-benchmark');
  const market = await DB.get('market_prices', '?select=name,price,unit&limit=5&order=updated_at.desc');
  if (!market || !market.length) {
    el.innerHTML = `<div class="card-pad"><div style="font-size:13px;color:var(--on-surface-3);text-align:center">אין נתוני שוק זמינים</div></div>`;
    return;
  }
  el.innerHTML = `<div>` + market.map(m => `
    <div class="list-row">
      <div style="flex:1;font-size:13px;font-weight:700">${m.name}</div>
      <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${parseFloat(m.price||0).toFixed(2)}</div>
      <div style="font-size:11px;color:var(--on-surface-3);margin-right:4px">/${m.unit||'ק"ג'}</div>
    </div>
  `).join('') + `</div>`;
}

function calcSaving() {
  // Placeholder — will be calculated from benchmark vs supplier prices
  document.getElementById('dash-saving').textContent = '₪0';
}

function setPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderChart(period);
}

function renderChart(period) {
  const canvas = document.getElementById('chart-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth;
  canvas.width = W;
  canvas.height = 130;

  const now = new Date();
  let labels = [];
  let buckets = [];

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('he-IL', {weekday:'short'}));
      buckets.push(d.toISOString().slice(0,10));
    }
  } else if (period === 'month') {
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i*7);
      labels.push('שבוע ' + (4-i));
      buckets.push(d.toISOString().slice(0,10));
    }
  } else if (period === 'quarter') {
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i);
      labels.push(d.toLocaleDateString('he-IL', {month:'short'}));
      buckets.push(d.toISOString().slice(0,7));
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now); d.setMonth(d.getMonth() - i);
      labels.push(d.toLocaleDateString('he-IL', {month:'short'}));
      buckets.push(d.toISOString().slice(0,7));
    }
  }

  // Sum invoices per bucket
  const values = buckets.map(b => {
    return dashData.invoices
      .filter(inv => inv.date && inv.date.startsWith(b))
      .reduce((s, inv) => s + (parseFloat(inv.total_amount) || 0), 0);
  });

  const max = Math.max(...values, 1);
  const barW = (W - 32) / labels.length - 6;
  const padL = 16;
  const padB = 24;
  const chartH = 130 - padB - 8;

  ctx.clearRect(0, 0, W, 130);

  values.forEach((v, i) => {
    const x = padL + i * ((W - 32) / labels.length);
    const h = Math.max((v / max) * chartH, 2);
    const y = chartH - h + 8;

    // Bar
    const grad = ctx.createLinearGradient(0, y, 0, chartH + 8);
    grad.addColorStop(0, '#6B35B8');
    grad.addColorStop(1, '#9B6DD6');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, h, 4);
    ctx.fill();

    // Label
    ctx.fillStyle = '#9889AE';
    ctx.font = '500 10px Manrope, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(labels[i], x + barW/2, 128);
  });
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('he-IL', {day:'numeric', month:'short'});
}

function openInvoice(id) {
  // TODO: open invoice detail
  console.log('open invoice', id);
}
