// ── Dashboard ─────────────────────────────────────────────────

let dashData = { invoices: [], suppliers: [], revenues: [] };
let currentPeriod = 'month';

async function renderDashboard() {
  const userId = Auth.userId;
  if (!userId) return;

  // Show plan badge
  renderPlanBadge();

  // Load all data in parallel, filtered by active location if set
  const loc = getActiveLocation();
  const locFilter = loc ? `&location_id=eq.${encodeURIComponent(loc.id)}` : '';
  const [invoices, revenues] = await Promise.all([
    DB.get('invoices', `?select=*&order=date.desc${locFilter}`),
    DB.get('daily_revenues', `?select=*&order=date.desc${locFilter}`)
  ]);
  dashData.invoices = invoices || [];
  dashData.revenues = revenues || [];

  // Update greeting with location if active
  const greeting = document.getElementById('dash-greeting');
  if (greeting) {
    const name = Auth.profile.business_name || '';
    greeting.textContent = loc ? `שלום, ${name} — ${loc.name}` : `שלום, ${name}!`;
  }

  // Stats
  renderStats();

  // Combined chart
  renderCombinedChart(currentPeriod);

  // Alerts
  renderPriceAlerts();

  // Benchmark
  renderBenchmark();

  // Recent invoices
  renderRecentInvoices(dashData.invoices.slice(0, 5));
}

function renderPlanBadge() {
  const profile = Auth.profile;
  const isPro = profile.plan === 'pro' && profile.pro_until && new Date(profile.pro_until) > new Date();
  const badge = document.getElementById('plan-badge');
  if (!badge) return;

  if (isPro) {
    const daysLeft = Math.ceil((new Date(profile.pro_until) - new Date()) / (1000*60*60*24));
    const isPilot = daysLeft > 365*10;
    badge.innerHTML = `<span style="background:linear-gradient(135deg,#FFD700,#FFA500);color:#1C1428;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:800;display:inline-flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg>PRO${isPilot ? '' : ` · ${daysLeft} ימים`}</span>`;
  } else {
    badge.innerHTML = `<button onclick="showProModal()" style="background:linear-gradient(135deg,var(--primary-dark),var(--primary-light));color:white;border:none;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:inherit"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg>שדרג ל-PRO</button>`;
  }
}

function renderStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const monthlyInvoices = dashData.invoices.filter(i => i.date >= monthStart);
  const monthlyPurchases = monthlyInvoices.reduce((s, i) => s + (parseFloat(i.total_amount || i.total) || 0), 0);
  const monthlyRevenue = dashData.revenues
    .filter(r => r.date >= monthStart)
    .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  // Show total of all invoices if current month is empty
  const allPurchases = dashData.invoices.reduce((s, i) => s + (parseFloat(i.total_amount || i.total) || 0), 0);
  const displayPurchases = monthlyPurchases > 0 ? monthlyPurchases : allPurchases;
  const displayLabel = monthlyPurchases > 0
    ? monthlyInvoices.length + ' חשבוניות החודש'
    : dashData.invoices.length + ' חשבוניות סה"כ';

  document.getElementById('dash-monthly').textContent = '₪' + displayPurchases.toLocaleString('he-IL', {maximumFractionDigits: 0});
  document.getElementById('dash-monthly-sub').textContent = displayLabel;

  document.getElementById('dash-saving').textContent = '₪0';

  // Revenue card — monthly total + today indicator
  const today = new Date().toISOString().slice(0, 10);
  const todayRevenue = dashData.revenues.find(r => r.date === today);
  const revEl = document.getElementById('dash-today-revenue');
  const revSubEl = document.getElementById('dash-today-revenue-sub');
  if (revEl) {
    revEl.textContent = monthlyRevenue > 0 ? '₪' + Math.round(monthlyRevenue).toLocaleString('he-IL') : '—';
    if (revSubEl) revSubEl.textContent = todayRevenue ? `היום: ₪${parseFloat(todayRevenue.amount).toLocaleString('he-IL', {maximumFractionDigits:0})} ✓` : 'היום: לא הוזן';
  }

  const fcEl = document.getElementById('dash-foodcost');
  const fcSubEl = document.getElementById('dash-foodcost-sub');
  if (monthlyRevenue > 0) {
    const fc = (monthlyPurchases / monthlyRevenue * 100).toFixed(1);
    fcEl.textContent = fc + '%';
    fcEl.style.color = parseFloat(fc) > 35 ? 'var(--error)' : parseFloat(fc) > 28 ? 'var(--warning, #F59E0B)' : 'var(--success)';
    fcSubEl.textContent = 'מחזור ₪' + monthlyRevenue.toLocaleString('he-IL', {maximumFractionDigits: 0});
  } else {
    fcEl.textContent = '--%';
    fcSubEl.textContent = 'הכנס מחזור יומי';
  }
}

function renderPriceAlerts() {
  const productPrices = {};
  dashData.invoices.forEach(inv => {
    if (!inv.items) return;
    let items;
    try { items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items; }
    catch(e) { return; }
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

  const el = document.getElementById('dash-alerts-list');
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
  const market = await DB.get('market_prices', '?select=name,price,unit&order=updated_at.desc&limit=20');
  const valid = (market || []).filter(m => m.name && m.price != null && !isNaN(parseFloat(m.price))).slice(0, 5);
  if (!valid.length) {
    el.innerHTML = `<div class="card-pad"><div style="font-size:13px;color:var(--on-surface-3);text-align:center">אין נתוני שוק זמינים</div></div>`;
    return;
  }
  el.innerHTML = valid.map(m => `
    <div class="list-row">
      <div style="flex:1;font-size:13px;font-weight:700">${m.name}</div>
      <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${parseFloat(m.price).toFixed(2)}</div>
      <div style="font-size:11px;color:var(--on-surface-3);margin-right:4px">/${m.unit||'יח׳'}</div>
    </div>
  `).join('');
}

function renderRecentInvoices(invoices) {
  const el = document.getElementById('dash-recent-invoices');
  if (!invoices.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-title">אין חשבוניות עדיין</div>
      <div class="empty-state-sub">סרוק את החשבונית הראשונה שלך</div>
    </div>`;
    return;
  }
  el.innerHTML = invoices.map(inv => `
    <div class="list-row">
      <div class="list-avatar">${(inv.supplier_name||'?')[0]}</div>
      <div style="flex:1">
        <div style="font-size:14px;font-weight:700">${inv.supplier_name || 'ספק לא ידוע'}</div>
        <div style="font-size:12px;color:var(--on-surface-3)">${formatDate(inv.date)}</div>
      </div>
      <div style="font-size:15px;font-weight:800;color:var(--primary)">₪${parseFloat(inv.total_amount||0).toLocaleString('he-IL',{maximumFractionDigits:0})}</div>
    </div>
  `).join('');
}

function setPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderCombinedChart(period);
}

function renderCombinedChart(period) {
  const canvas = document.getElementById('chart-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 400;
  canvas.width = W;
  canvas.height = 180;

  const now = new Date();
  let labels = [], buckets = [];

  if (period === 'week') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      labels.push(d.toLocaleDateString('he-IL', {weekday:'short'}));
      buckets.push(d.toISOString().slice(0,10));
    }
  } else if (period === 'month') {
    for (let i = 29; i >= 0; i -= 5) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      labels.push(d.getDate() + '/' + (d.getMonth()+1));
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

  // Aggregate data per bucket
  const purchases = buckets.map(b =>
    dashData.invoices.filter(inv => inv.date && inv.date.startsWith(b))
      .reduce((s, inv) => s + (parseFloat(inv.total_amount) || 0), 0)
  );
  const revenues = buckets.map(b =>
    dashData.revenues.filter(r => r.date && r.date.startsWith(b))
      .reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  );
  const foodCost = revenues.map((rev, i) => rev > 0 ? (purchases[i] / rev * 100) : 0);

  const maxMoney = Math.max(...purchases, ...revenues, 1);
  const padL = 40, padR = 40, padT = 20, padB = 30;
  const chartW = W - padL - padR;
  const chartH = 180 - padT - padB;

  ctx.clearRect(0, 0, W, 180);

  // Grid lines
  ctx.strokeStyle = '#E4DFF2';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH * i / 4);
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(padL + chartW, y);
    ctx.stroke();
  }

  // Bars (purchases)
  const barW = chartW / labels.length * 0.6;
  purchases.forEach((v, i) => {
    const x = padL + (chartW / labels.length) * (i + 0.2);
    const h = (v / maxMoney) * chartH;
    const y = padT + chartH - h;
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, '#6B35B8');
    grad.addColorStop(1, '#9B6DD6');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, Math.max(h, 1), 3);
    ctx.fill();
  });

  // Line — Revenue
  if (revenues.some(r => r > 0)) {
    ctx.strokeStyle = '#10B981';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    revenues.forEach((v, i) => {
      const x = padL + (chartW / labels.length) * (i + 0.5);
      const y = padT + chartH - (v / maxMoney) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    revenues.forEach((v, i) => {
      if (v === 0) return;
      const x = padL + (chartW / labels.length) * (i + 0.5);
      const y = padT + chartH - (v / maxMoney) * chartH;
      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // Line — Food Cost % (right axis, max 100%)
  if (foodCost.some(f => f > 0)) {
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    foodCost.forEach((v, i) => {
      if (v === 0) return;
      const x = padL + (chartW / labels.length) * (i + 0.5);
      const y = padT + chartH - (Math.min(v, 100) / 100) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // X labels
  ctx.fillStyle = '#9889AE';
  ctx.font = '500 10px Manrope, sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((l, i) => {
    const x = padL + (chartW / labels.length) * (i + 0.5);
    ctx.fillText(l, x, 175);
  });

  // Y axis labels (left = ₪)
  ctx.textAlign = 'right';
  ctx.fillStyle = '#9889AE';
  for (let i = 0; i <= 4; i++) {
    const v = maxMoney * (1 - i / 4);
    const y = padT + (chartH * i / 4) + 3;
    ctx.fillText('₪' + Math.round(v/1000) + 'K', padL - 4, y);
  }

  // Y axis labels (right = %)
  ctx.textAlign = 'left';
  ctx.fillStyle = '#F59E0B';
  for (let i = 0; i <= 4; i++) {
    const v = 100 * (1 - i / 4);
    const y = padT + (chartH * i / 4) + 3;
    ctx.fillText(Math.round(v) + '%', padL + chartW + 4, y);
  }
}

// ── Daily Revenue Modal ───────────────────────────────────────

function openRevenueModal() {
  const today = new Date().toISOString().slice(0, 10);
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:28px 24px 40px;width:100%;max-width:480px">
      <div style="font-size:18px;font-weight:800;margin-bottom:6px">הזנת מחזור יומי</div>
      <div style="font-size:13px;color:var(--on-surface-3);margin-bottom:20px">המחזור משמש לחישוב Food Cost</div>
      <label class="field-label">תאריך</label>
      <input class="input mb-12" id="rev-date" type="date" value="${today}">
      <label class="field-label">סכום (₪)</label>
      <input class="input mb-16" id="rev-amount" type="number" min="0" step="1" placeholder="0">
      <button class="btn-primary mb-8" onclick="saveRevenue()">שמור</button>
      <button class="btn-ghost" onclick="this.closest('[data-rev-modal]').remove()">ביטול</button>
    </div>
  `;
  modal.setAttribute('data-rev-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('rev-amount')?.focus(), 100);
}

async function saveRevenue() {
  const date = document.getElementById('rev-date')?.value;
  const amount = parseFloat(document.getElementById('rev-amount')?.value);
  if (!date || !amount || amount <= 0) return;

  const btn = document.querySelector('[data-rev-modal] .btn-primary');
  if (btn) { btn.textContent = 'שומר...'; btn.disabled = true; }

  try {
    const existing = await DB.get('daily_revenues', `?date=eq.${date}&select=id`);
    let ok = false;
    if (existing?.length) {
      ok = await DB.update('daily_revenues', `?date=eq.${date}`, { amount });
    } else {
      const result = await DB.insert('daily_revenues', { date, amount });
      ok = !!result;
    }

    if (!ok) {
      showToast('שגיאה בשמירה — כנס מחדש עם PILOT-001');
      if (btn) { btn.textContent = 'שמור'; btn.disabled = false; }
      return;
    }

    document.querySelector('[data-rev-modal]')?.remove();
    showToast('מחזור נשמר ✓');
    await renderDashboard();
    // Re-open history view so user sees updated list
    openRevenueHistory();
  } catch(e) {
    showToast('שגיאה: ' + e.message);
    if (btn) { btn.textContent = 'שמור'; btn.disabled = false; }
  }
}

// ── AI Insights ───────────────────────────────────────────────

function buildInsightData(topic) {
  const profile = Auth.profile;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);

  const monthlyInvoices = dashData.invoices.filter(i => i.date >= monthStart);
  const lastMonthInvoices = dashData.invoices.filter(i => i.date >= lastMonthStart && i.date < monthStart);
  const monthlyPurchases = monthlyInvoices.reduce((s, i) => s + (parseFloat(i.total_amount || i.total) || 0), 0);
  const lastMonthPurchases = lastMonthInvoices.reduce((s, i) => s + (parseFloat(i.total_amount || i.total) || 0), 0);
  const monthlyRevenue = dashData.revenues.filter(r => r.date >= monthStart).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  const supplierTotals = {};
  monthlyInvoices.forEach(inv => {
    supplierTotals[inv.supplier_name] = (supplierTotals[inv.supplier_name] || 0) + (parseFloat(inv.total_amount) || 0);
  });
  const topSupplier = Object.entries(supplierTotals).sort((a, b) => b[1] - a[1])[0];

  const productPrices = {};
  dashData.invoices.forEach(inv => {
    let items;
    try { items = typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items; } catch { return; }
    (items || []).forEach(item => {
      if (!item.product_name || !item.unit_price) return;
      if (!productPrices[item.product_name]) productPrices[item.product_name] = [];
      productPrices[item.product_name].push({ price: parseFloat(item.unit_price), date: inv.date });
    });
  });

  const alerts = [];
  Object.entries(productPrices).forEach(([name, entries]) => {
    if (entries.length < 2) return;
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = entries[0].price, prev = entries[1].price;
    if (latest > prev * 1.05) alerts.push({ product: name, prev_price: prev.toFixed(2), current_price: latest.toFixed(2), pct: ((latest - prev) / prev * 100).toFixed(0) + '%' });
  });

  const usedPurchases = monthlyPurchases > 0 ? monthlyPurchases : allPurchases;
  const base = {
    category: profile.category || 'עסק מזון',
    city: profile.city || '',
    monthly_purchases: Math.round(usedPurchases),
    invoice_count: monthlyPurchases > 0 ? monthlyInvoices.length : dashData.invoices.length,
    change_vs_last_month: lastMonthPurchases > 0 ? (((monthlyPurchases - lastMonthPurchases) / lastMonthPurchases) * 100).toFixed(0) + '%' : 'אין נתון קודם'
  };

  if (topic === 'spending') return { ...base, top_supplier: topSupplier ? { name: topSupplier[0], amount: Math.round(topSupplier[1]) } : null };
  if (topic === 'foodcost') return { ...base, monthly_revenue: Math.round(monthlyRevenue), food_cost_pct: monthlyRevenue > 0 ? (monthlyPurchases / monthlyRevenue * 100).toFixed(1) : null, target: 30 };
  if (topic === 'alerts') return { ...base, price_increases: alerts.slice(0, 5) };
  if (topic === 'savings') return { ...base, top_suppliers: Object.entries(supplierTotals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, amount]) => ({ name, amount: Math.round(amount) })) };
  if (topic === 'overview') return {
    ...base,
    top_supplier: topSupplier ? { name: topSupplier[0], amount: Math.round(topSupplier[1]) } : null,
    monthly_revenue: Math.round(monthlyRevenue),
    food_cost_pct: monthlyRevenue > 0 ? (monthlyPurchases / monthlyRevenue * 100).toFixed(1) : null,
    alerts_count: alerts.length,
    top_suppliers: Object.entries(supplierTotals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, amount]) => ({ name, amount: Math.round(amount) }))
  };
  return base;
}

const INSIGHT_LABELS = { spending: 'ניתוח רכש', foodcost: 'Food Cost', alerts: 'התייקרויות', savings: 'חיסכון פוטנציאלי', overview: 'ניתוח עסקי מקיף' };

async function showAIInsights(topic) {
  const profile = Auth.profile;
  const isPro = profile.plan === 'pro' && profile.pro_until && new Date(profile.pro_until) > new Date();
  if (!isPro) { showProModal(); return; }

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
      <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;background:linear-gradient(135deg,#6B35B8,#C084FC);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        </div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:800">תובנות AI</div>
          <div style="font-size:12px;color:var(--on-surface-3)">${INSIGHT_LABELS[topic] || topic}</div>
        </div>
        <button onclick="this.closest('[data-insight-modal]').remove()" style="background:var(--surface-low);border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center">×</button>
      </div>
      <div id="insight-body" style="padding:24px">
        <div style="display:flex;align-items:center;gap:12px;color:var(--on-surface-3)">
          <div style="width:20px;height:20px;border:2px solid var(--primary);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0"></div>
          <span style="font-size:14px">מנתח את הנתונים שלך...</span>
        </div>
      </div>
    </div>
  `;
  modal.setAttribute('data-insight-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  try {
    const data = buildInsightData(topic);
    const res = await fetch('/.netlify/functions/ai-insight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.jwt },
      body: JSON.stringify({ topic, data })
    });
    const result = await res.json();
    const body = document.getElementById('insight-body');
    if (body) {
      body.innerHTML = `<div style="font-size:15px;line-height:1.8;color:var(--on-surface);white-space:pre-line">${result.insight || 'לא ניתן לנתח כעת — נסה שוב.'}</div>`;
    }
  } catch {
    const body = document.getElementById('insight-body');
    if (body) body.innerHTML = `<div style="color:var(--error);font-size:14px">שגיאת חיבור — נסה שוב.</div>`;
  }
}

function showProModal() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px;max-width:380px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
      <div style="background:linear-gradient(135deg,#4A1F85,#9B6DD6);padding:24px;color:white;text-align:center">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="white" style="margin-bottom:8px"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg>
        <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px">Reverto PRO</div>
        <div style="font-size:13px;opacity:0.9;margin-top:4px">כל הכלים לעסק חכם</div>
      </div>
      <div style="padding:24px">
        <div style="font-size:32px;font-weight:800;color:var(--on-surface);text-align:center;margin-bottom:4px">₪98<span style="font-size:14px;font-weight:600;color:var(--on-surface-3)">/חודש</span></div>
        <div style="font-size:12px;text-align:center;color:var(--on-surface-3);margin-bottom:20px">ביטול בכל עת</div>
        <div style="border-top:1px solid var(--border);padding-top:16px">
          ${[
            'מעקב מחזור יומי וגרף מצטבר',
            'חישוב Food Cost חודשי ושנתי',
            'תובנות AI על נתוני העסק שלך',
            'השוואה לעסקים דומים בשוק',
            'תזכורות יומיות חכמות',
            'BID — הצעות מחיר מספקים מתחרים'
          ].map(f => `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span style="font-size:13px;font-weight:600">${f}</span>
            </div>
          `).join('')}
        </div>
        <button class="btn-primary" style="margin-top:20px" onclick="alert('בקרוב — תשלום מאובטח')">שדרג עכשיו</button>
        <button class="btn-ghost" style="margin-top:8px" onclick="this.closest('.pro-modal-wrap').remove()">לא עכשיו</button>
      </div>
    </div>
  `;
  modal.classList.add('pro-modal-wrap');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ── Invoice List Modal ────────────────────────────────────────

function openInvoiceList() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.setAttribute('data-inv-list', '');
  const all = dashData.invoices || [];
  const total = all.reduce((s, i) => s + (parseFloat(i.total_amount || i.total) || 0), 0);

  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:88vh;display:flex;flex-direction:column">
      <div style="padding:20px 20px 10px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <div>
          <div style="font-size:18px;font-weight:800">רכש</div>
          <div style="font-size:13px;color:var(--on-surface-3)">${all.length} חשבוניות · ₪${Math.round(total).toLocaleString('he-IL')} סה"כ</div>
        </div>
        <button onclick="this.closest('[data-inv-list]').remove()" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--on-surface-3);padding:0;line-height:1">×</button>
      </div>
      <div style="overflow-y:auto;flex:1;padding:0 20px 20px">
        ${all.length ? all.map((inv, i) => {
          const invItems = inv.items ? (typeof inv.items === 'string' ? (() => { try { return JSON.parse(inv.items); } catch { return []; } })() : inv.items) : [];
          const invTotal = parseFloat(inv.total_amount || inv.total || 0);
          return `
            <div style="border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:10px;padding:12px 0;cursor:pointer" onclick="toggleDashInv(${i})">
                <div style="width:36px;height:36px;background:var(--surface-low);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0">${(inv.supplier_name||'?')[0]}</div>
                <div style="flex:1">
                  <div style="font-size:13px;font-weight:700">${inv.supplier_name||'—'}</div>
                  <div style="font-size:11px;color:var(--on-surface-3)">${inv.date ? new Date(inv.date+'T00:00:00').toLocaleDateString('he-IL',{day:'numeric',month:'short',year:'numeric'}) : '—'}${inv.invoice_number ? ' · ' + inv.invoice_number : ''}</div>
                </div>
                <div style="text-align:left">
                  <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${Math.round(invTotal).toLocaleString('he-IL')}</div>
                </div>
                <svg id="darr-${i}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--on-surface-3)" stroke-width="2" stroke-linecap="round" style="transition:transform 0.2s;flex-shrink:0"><polyline points="6 9 12 15 18 9"/></svg>
              </div>
              <div id="dinv-${i}" style="display:none;padding:0 0 10px 46px">
                ${invItems.length ? invItems.map(it => `
                  <div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px">
                    <span style="color:var(--on-surface-2)">${it.product_name||'—'}</span>
                    <span style="color:var(--on-surface-3)">${it.quantity||''} × ₪${parseFloat(it.unit_price||0).toFixed(2)}</span>
                  </div>`).join('') : '<div style="font-size:11px;color:var(--on-surface-3)">אין פרטי פריטים</div>'}
              </div>
            </div>`;
        }).join('') : '<div style="padding:24px;text-align:center;color:var(--on-surface-3)">אין חשבוניות</div>'}
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function toggleDashInv(i) {
  const el = document.getElementById('dinv-' + i);
  const arr = document.getElementById('darr-' + i);
  if (!el) return;
  const open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  if (arr) arr.style.transform = open ? 'rotate(180deg)' : '';
}

// ── Revenue History ───────────────────────────────────────────

let _revView = 'list';

function openRevenueHistory() {
  _revView = 'list';
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.setAttribute('data-rev-history', '');
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:90vh;display:flex;flex-direction:column">
      <div style="padding:20px 20px 10px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <div style="font-size:18px;font-weight:800">מחזור יומי</div>
        <div style="display:flex;gap:8px;align-items:center">
          <button onclick="showAddRevenue()" style="background:var(--primary);color:white;border:none;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ הוסף</button>
          <button onclick="this.closest('[data-rev-history]').remove()" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--on-surface-3);padding:0;line-height:1">×</button>
        </div>
      </div>

      <!-- Monthly hero total (always shown) -->
      <div id="rev-monthly-hero" style="padding:4px 20px 12px;text-align:center;flex-shrink:0"></div>

      <!-- Period tabs -->
      <div style="display:flex;gap:4px;padding:0 20px 8px;flex-shrink:0">
        ${[['month','חודש'],['quarter','רבעון'],['half','חצי שנה'],['year','שנה']].map(([p,l]) =>
          `<button onclick="setRevPeriod('${p}')" id="revp-${p}" class="period-btn${p==='month'?' active':''}" style="flex:1">${l}</button>`
        ).join('')}
      </div>

      <!-- Period sub-total + list/chart toggle -->
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0 20px 8px;flex-shrink:0">
        <div id="rev-period-total" style="font-size:13px;color:var(--on-surface-3)"></div>
        <div style="display:flex;gap:4px">
          <button onclick="setRevView('list')" id="revv-list" class="period-btn active">רשימה</button>
          <button onclick="setRevView('chart')" id="revv-chart" class="period-btn">גרף</button>
        </div>
      </div>

      <!-- Content -->
      <div id="rev-content" style="overflow-y:auto;flex:1;padding:0 20px 20px"></div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  renderRevHistory('month');
}

function setRevPeriod(period) {
  document.querySelectorAll('[id^="revp-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('revp-' + period)?.classList.add('active');
  renderRevHistory(period);
}

function setRevView(view) {
  _revView = view;
  document.querySelectorAll('[id^="revv-"]').forEach(b => b.classList.remove('active'));
  document.getElementById('revv-' + view)?.classList.add('active');
  const period = document.querySelector('[id^="revp-"].active')?.id.replace('revp-', '') || 'month';
  renderRevHistory(period);
}

function renderRevHistory(period) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  let startDate;
  if (period === 'month')   startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'quarter') startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  if (period === 'half')    startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  if (period === 'year')    startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const startStr = startDate.toISOString().slice(0, 10);

  const all = dashData.revenues || [];
  const filtered = all.filter(r => r.date >= startStr).sort((a, b) => b.date.localeCompare(a.date));
  const periodTotal = filtered.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  // Monthly hero — always show current month
  const monthlyTotal = all.filter(r => r.date >= monthStart).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const heroEl = document.getElementById('rev-monthly-hero');
  if (heroEl) heroEl.innerHTML = `
    <div style="font-size:38px;font-weight:800;color:var(--primary);line-height:1">₪${Math.round(monthlyTotal).toLocaleString('he-IL')}</div>
    <div style="font-size:12px;color:var(--on-surface-3);margin-top:2px">סה"כ החודש</div>`;

  // Period sub-total
  const periodEl = document.getElementById('rev-period-total');
  if (periodEl) periodEl.innerHTML = period === 'month' ? '' :
    `<span style="font-weight:700">₪${Math.round(periodTotal).toLocaleString('he-IL')}</span> · ${filtered.length} ימים`;

  const contentEl = document.getElementById('rev-content');
  if (!contentEl) return;

  if (_revView === 'chart') {
    contentEl.innerHTML = '<canvas id="rev-chart-canvas" style="width:100%;display:block"></canvas>';
    setTimeout(() => renderRevChart(filtered), 50);
    return;
  }

  // List view
  if (!filtered.length) {
    contentEl.innerHTML = '<div style="text-align:center;padding:24px;color:var(--on-surface-3);font-size:13px">אין נתונים לתקופה זו</div>';
    return;
  }
  contentEl.innerHTML = filtered.map(r => {
    const d = new Date(r.date + 'T00:00:00');
    const dateStr = d.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short' });
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1;font-size:13px;font-weight:600">${dateStr}</div>
        <div style="font-size:15px;font-weight:800;color:var(--primary)">₪${Math.round(parseFloat(r.amount)).toLocaleString('he-IL')}</div>
        <button onclick="editRevEntry('${r.date}',${r.amount})" style="background:none;border:1px solid var(--border);border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--on-surface-2)">עריכה</button>
      </div>`;
  }).join('');
}

function renderRevChart(filtered) {
  const canvas = document.getElementById('rev-chart-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 320;
  canvas.width = W; canvas.height = 180;

  if (!filtered.length) return;

  const sorted = [...filtered].reverse(); // oldest first
  const maxAmt = Math.max(...sorted.map(r => parseFloat(r.amount)));
  const padL = 48, padR = 8, padT = 12, padB = 28;
  const cW = W - padL - padR, cH = 180 - padT - padB;

  ctx.clearRect(0, 0, W, 180);

  // Grid
  ctx.strokeStyle = '#E4DFF2'; ctx.lineWidth = 1;
  for (let i = 0; i <= 3; i++) {
    const y = padT + cH * i / 3;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + cW, y); ctx.stroke();
  }

  // Bars
  const barW = Math.max(3, cW / sorted.length * 0.6);
  sorted.forEach((r, i) => {
    const x = padL + (cW / sorted.length) * (i + 0.2);
    const h = (parseFloat(r.amount) / maxAmt) * cH;
    const y = padT + cH - h;
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, '#10B981'); grad.addColorStop(1, '#34D399');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.roundRect(x, y, barW, Math.max(h, 1), 2); ctx.fill();
  });

  // X labels (every few days)
  ctx.fillStyle = '#9889AE'; ctx.font = '500 9px Manrope,sans-serif'; ctx.textAlign = 'center';
  const step = Math.ceil(sorted.length / 7);
  sorted.forEach((r, i) => {
    if (i % step === 0 || i === sorted.length - 1) {
      const x = padL + (cW / sorted.length) * (i + 0.5);
      const d = new Date(r.date + 'T00:00:00');
      ctx.fillText(d.getDate() + '/' + (d.getMonth() + 1), x, 176);
    }
  });

  // Y labels
  ctx.textAlign = 'right';
  for (let i = 0; i <= 3; i++) {
    const v = maxAmt * (1 - i / 3);
    ctx.fillText('₪' + (v >= 1000 ? Math.round(v/1000) + 'K' : Math.round(v)), padL - 3, padT + cH * i / 3 + 3);
  }
}

function showAddRevenue() {
  document.querySelector('[data-rev-history]')?.remove();
  openRevenueModal();
}

function editRevEntry(date, amount) {
  document.querySelector('[data-rev-history]')?.remove();
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.setAttribute('data-rev-modal', '');
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:28px 24px 48px;width:100%;max-width:480px">
      <div style="font-size:18px;font-weight:800;margin-bottom:20px">עריכת מחזור</div>
      <label class="field-label">תאריך</label>
      <input class="input mb-12" id="rev-date" type="date" value="${date}">
      <label class="field-label">סכום (₪)</label>
      <input class="input mb-16" id="rev-amount" type="number" min="0" step="1" value="${Math.round(amount)}">
      <button class="btn-primary mb-8" onclick="saveRevenue()">שמור</button>
      <button class="btn-ghost" onclick="this.closest('[data-rev-modal]').remove();openRevenueHistory()">ביטול</button>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('he-IL', {day:'numeric', month:'short'});
}

function openInvoice(id) { console.log('open invoice', id); }
