// ── Dashboard ─────────────────────────────────────────────────

let dashData = { invoices: [], suppliers: [], revenues: [] };
let currentPeriod = 'month';

async function renderDashboard() {
  const userId = Auth.userId;
  if (!userId) return;

  // Show plan badge
  renderPlanBadge();

  // Load all data in parallel
  const [invoices, revenues] = await Promise.all([
    DB.get('invoices', `?user_id=eq.${encodeURIComponent(userId)}&select=*&order=date.desc`),
    DB.get('daily_revenues', `?user_id=eq.${encodeURIComponent(userId)}&select=*&order=date.desc`)
  ]);
  dashData.invoices = invoices || [];
  dashData.revenues = revenues || [];

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
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const monthlyInvoices = dashData.invoices.filter(i => i.date >= monthStart);
  const monthlyTotal = monthlyInvoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);

  document.getElementById('dash-monthly').textContent = '₪' + monthlyTotal.toLocaleString('he-IL', {maximumFractionDigits:0});
  document.getElementById('dash-monthly-sub').textContent = monthlyInvoices.length + ' חשבוניות';

  // Saving (placeholder for now)
  document.getElementById('dash-saving').textContent = '₪0';

  // Alerts will be calculated in renderPriceAlerts
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
  const market = await DB.get('market_prices', '?select=name,price,unit&limit=5&order=id.desc');
  if (!market || !market.length) {
    el.innerHTML = `<div class="card-pad"><div style="font-size:13px;color:var(--on-surface-3);text-align:center">אין נתוני שוק זמינים</div></div>`;
    return;
  }
  el.innerHTML = market.map(m => `
    <div class="list-row">
      <div style="flex:1;font-size:13px;font-weight:700">${m.name}</div>
      <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${parseFloat(m.price||0).toFixed(2)}</div>
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

function showAIInsights(topic) {
  const profile = Auth.profile;
  const isPro = profile.plan === 'pro' && profile.pro_until && new Date(profile.pro_until) > new Date();
  if (!isPro) { showProModal(); return; }

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(8px)';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px;max-width:420px;width:100%;max-height:85vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3)">
      <div style="padding:24px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;background:linear-gradient(135deg,#6B35B8,#C084FC);border-radius:12px;display:flex;align-items:center;justify-content:center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M9 12l2 2 4-4"/></svg>
        </div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:800">תובנות AI</div>
          <div style="font-size:12px;color:var(--on-surface-3)">${topic || 'ניתוח כללי'}</div>
        </div>
        <button onclick="this.closest('.ai-modal-wrap').remove()" style="background:var(--surface-low);border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;font-size:18px">×</button>
      </div>
      <div style="padding:24px">
        <div style="font-size:14px;line-height:1.7;color:var(--on-surface-2)">
          🚧 ניתוח AI בבנייה. בקרוב כאן יופיעו תובנות מבוססות נתוני העסק שלך וביחס לעסקים דומים.
        </div>
      </div>
    </div>
  `;
  modal.classList.add('ai-modal-wrap');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('he-IL', {day:'numeric', month:'short'});
}

function openInvoice(id) { console.log('open invoice', id); }
