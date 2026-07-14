// ── Suppliers ─────────────────────────────────────────────────

let allSuppliers = [];
let currentSupplier = null;
let _newSupTerm = null;

// Same category keys used by the market page tabs (js/market.js CAT_RULES) — tagging
// a supplier's category here lets the market view use it as a hint when a product
// name alone is ambiguous.
const SUPPLIER_CATEGORIES = [
  { val: '', label: 'לא מוגדר' },
  { val: 'produce', label: 'ירקות ופירות' },
  { val: 'animal', label: 'מן החי (בשר/דגים/עוף/מוצרי חלב)' },
  { val: 'packaged', label: 'מזון ארוז' },
  { val: 'cleaning', label: 'חומרי ניקוי' },
  { val: 'other', label: 'אחר' }
];

async function renderSuppliersList() {
  const userId = Auth.userId;
  if (!userId) return;

  // Restore page structure if it was replaced by viewSupplier
  const page = document.getElementById('page-suppliers');
  if (!document.getElementById('suppliers-list')) {
    page.innerHTML = `<div class="page-content">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="font-size:22px;font-weight:800">ספקים</div>
        <button onclick="showPaymentForecast()" style="display:flex;align-items:center;gap:6px;background:linear-gradient(135deg,var(--primary-dark),var(--primary-light));color:white;border:none;border-radius:20px;padding:8px 14px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit">
          <span class="mi" style="font-size:16px;color:white">payments</span>
          תשלומים
        </button>
      </div>
      <div style="position:relative;margin-bottom:12px">
        <input class="input" id="supplier-search" type="text" placeholder="חיפוש ספק..." oninput="filterSuppliers(this.value)" style="padding-right:40px">
        <svg style="position:absolute;right:12px;top:50%;transform:translateY(-50%);pointer-events:none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--on-surface-3)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
      <div id="suppliers-list" class="card"></div>
      <button class="btn-primary mt-12" onclick="showAddSupplier()">+ הוסף ספק</button>
    </div>`;
  }

  const el = document.getElementById('suppliers-list');
  el.innerHTML = `<div class="card-pad"><div class="skeleton" style="height:48px;margin-bottom:8px"></div><div class="skeleton" style="height:48px;margin-bottom:8px"></div><div class="skeleton" style="height:48px"></div></div>`;

  const loc = getActiveLocation();
  const locFilter = loc ? `&location_id=eq.${encodeURIComponent(loc.id)}` : '';
  const suppliers = await DB.get('suppliers', `?select=*&order=total_amount.desc${locFilter}`);
  allSuppliers = suppliers || [];

  displaySuppliers(allSuppliers);
}

function displaySuppliers(suppliers) {
  const el = document.getElementById('suppliers-list');
  if (!suppliers.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
      <div class="empty-state-title">אין ספקים עדיין</div>
      <div class="empty-state-sub">ספקים יתווספו אוטומטית בעת סריקת חשבוניות</div>
    </div>`;
    return;
  }

  el.innerHTML = suppliers.map(s => `
    <div class="list-row">
      <div class="list-avatar" onclick="viewSupplier('${s.id}')">${(s.name||'?')[0]}</div>
      <div style="flex:1;cursor:pointer" onclick="viewSupplier('${s.id}')">
        <div style="font-size:14px;font-weight:700">${s.name}</div>
        <div style="font-size:12px;color:var(--on-surface-3)">${s.invoice_count||0} חשבוניות · אחרונה ${formatDate(s.last_invoice_date)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${s.phone ? `<a href="https://wa.me/${formatWANumber(s.phone)}" target="_blank" onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:#25D366;border-radius:50%;flex-shrink:0"><svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>` : ''}
        <div onclick="viewSupplier('${s.id}')" style="cursor:pointer;text-align:left">
          <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${parseFloat(s.total_amount||0).toLocaleString('he-IL',{maximumFractionDigits:0})}</div>
          <div style="font-size:10px;color:var(--on-surface-3)">סה"כ רכש</div>
        </div>
      </div>
    </div>
  `).join('');
}

function filterSuppliers(q) {
  if (!q) { displaySuppliers(allSuppliers); return; }
  const filtered = allSuppliers.filter(s => s.name.includes(q));
  displaySuppliers(filtered);
}

async function viewSupplier(id) {
  const sup = allSuppliers.find(s => s.id === id);
  if (!sup) return;
  currentSupplier = sup;

  const [invoices, items, marketPrices] = await Promise.all([
    DB.get('invoices', `?supplier_name=eq.${encodeURIComponent(sup.name)}&select=*&order=date.desc`),
    DB.get('invoice_items', `?supplier_name=eq.${encodeURIComponent(sup.name)}&select=*&order=date.desc`),
    DB.get('market_prices', '?select=name,price,unit')
  ]);

  // Store globally for use in modals / filter
  window._supInvoices = invoices || [];
  window._supProductHistory = {};
  (items || []).forEach(item => {
    if (!item.product_name) return;
    if (!window._supProductHistory[item.product_name]) window._supProductHistory[item.product_name] = [];
    window._supProductHistory[item.product_name].push({ price: parseFloat(item.unit_price || 0), date: item.date });
  });

  // Reference market price per product, for the "מחיר שוק" column in the product list
  window._marketPriceByName = {};
  (marketPrices || []).forEach(m => {
    if (m.name && m.price != null) window._marketPriceByName[m.name] = { price: parseFloat(m.price), unit: m.unit };
  });

  // Calculate stats
  const now = new Date();
  const yr = now.getFullYear(), mo = now.getMonth();
  const annualInvs  = (invoices || []).filter(i => new Date(i.date + 'T00:00:00').getFullYear() === yr);
  const monthlyInvs = annualInvs.filter(i => new Date(i.date + 'T00:00:00').getMonth() === mo);
  const annualTotal  = annualInvs.reduce((s, i) => s + parseFloat(i.total_amount || i.total || 0), 0);
  const monthlyTotal = monthlyInvs.reduce((s, i) => s + parseFloat(i.total_amount || i.total || 0), 0);
  const allTotal     = (invoices || []).reduce((s, i) => s + parseFloat(i.total_amount || i.total || 0), 0);
  const avgInvoice   = (invoices || []).length ? allTotal / invoices.length : 0;
  const monthName    = now.toLocaleDateString('he-IL', { month: 'long' });

  const el = document.getElementById('page-suppliers');
  el.innerHTML = `
    <div class="page-content">
      <button onclick="renderSuppliersList();navTo('suppliers')" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--primary);font-weight:700;font-size:14px;margin-bottom:16px;font-family:inherit">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        חזרה לספקים
      </button>

      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px">
        <div style="font-size:22px;font-weight:800">${escHtml(sup.name)}</div>
        <button onclick="document.getElementById('sup-details-card')?.scrollIntoView({behavior:'smooth',block:'start'})"
          style="flex-shrink:0;background:var(--surface-low);border:1.5px solid var(--border);border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;color:var(--primary);cursor:pointer;font-family:inherit;white-space:nowrap">
          ערוך פרטי ספק
        </button>
      </div>
      <div style="font-size:12px;color:var(--on-surface-3);margin-bottom:18px">${sup.invoice_count || 0} חשבוניות · אחרונה ${formatDate(sup.last_invoice_date)}</div>

      <!-- 3 Stat Boxes -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
        <div onclick="showAnnualBreakdown()" class="card-tap" style="background:var(--surface-card);border:1.5px solid var(--border);border-radius:14px;padding:12px 8px;text-align:center;cursor:pointer">
          <div style="font-size:9px;font-weight:700;color:var(--on-surface-3);margin-bottom:4px;line-height:1.3">רכש שנתי</div>
          <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${Math.round(annualTotal).toLocaleString('he-IL')}</div>
          <div style="font-size:9px;color:var(--primary);margin-top:3px">${yr} ›</div>
        </div>
        <div onclick="showMonthlyInvoices()" class="card-tap" style="background:var(--surface-card);border:1.5px solid var(--border);border-radius:14px;padding:12px 8px;text-align:center;cursor:pointer">
          <div style="font-size:9px;font-weight:700;color:var(--on-surface-3);margin-bottom:4px;line-height:1.3">רכש חודשי</div>
          <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${Math.round(monthlyTotal).toLocaleString('he-IL')}</div>
          <div style="font-size:9px;color:var(--primary);margin-top:3px">${monthName} ›</div>
        </div>
        <div style="background:var(--surface-card);border:1.5px solid var(--border);border-radius:14px;padding:12px 8px;text-align:center">
          <div style="font-size:9px;font-weight:700;color:var(--on-surface-3);margin-bottom:4px;line-height:1.3">ממוצע חשבונית</div>
          <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${Math.round(avgInvoice).toLocaleString('he-IL')}</div>
          <div style="font-size:9px;color:var(--on-surface-3);margin-top:3px">${sup.invoice_count || 0} חשבוניות</div>
        </div>
      </div>

      <!-- Order Button (below stats, slightly inset) -->
      <div style="margin:14px 10px 16px">
        <button onclick="openOrderForm()" class="btn-primary" style="width:100%;background:linear-gradient(135deg,#10B981,#059669);font-size:15px;padding:13px;display:flex;align-items:center;justify-content:center;gap:8px">
          <span class="mi" style="color:white;font-size:20px">shopping_cart</span>
          הזמנת סחורה
        </button>
      </div>

      <!-- Products -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="section-title">מוצרים</div>
        <div style="font-size:10px;color:var(--on-surface-3);background:var(--surface-low);padding:3px 8px;border-radius:12px">לפני מע"מ 18%</div>
      </div>
      <div style="position:relative;margin-bottom:10px">
        <input class="input" id="sup-product-search" type="text" placeholder="חיפוש מוצר..." oninput="filterSupProducts(this.value)" style="padding-right:36px;font-size:13px">
        <svg style="position:absolute;right:10px;top:50%;transform:translateY(-50%);pointer-events:none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--on-surface-3)" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </div>
      <div class="card mb-16" id="sup-products-list">
        ${renderSupProductRows(window._supProductHistory)}
      </div>

      <!-- Supplier Details -->
      <div class="section-title mb-8" id="sup-details-card">פרטי ספק</div>
      <div class="card card-pad mb-24">
        <label class="field-label">שם נציג / סוכן</label>
        <input class="input mb-10" id="sup-agent-input" type="text" placeholder="שם הנציג או הסוכן" value="${escHtml(sup.contact_name || '')}">

        <label class="field-label">קטגוריה</label>
        <select class="input mb-10" id="sup-category-input">
          ${SUPPLIER_CATEGORIES.map(c => `<option value="${c.val}"${(sup.category || '') === c.val ? ' selected' : ''}>${c.label}</option>`).join('')}
        </select>

        <label class="field-label">טלפון *</label>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
          <input class="input" id="sup-phone-input" type="tel" placeholder="050-0000000" value="${escHtml(sup.phone || '')}" style="flex:1">
          ${'contacts' in navigator && navigator.contacts ? `
          <button onclick="supContactPicker()" title="ייבא מאנשי קשר"
            style="flex-shrink:0;width:38px;height:38px;border-radius:10px;border:1.5px solid var(--border);background:var(--surface-low);cursor:pointer;display:flex;align-items:center;justify-content:center">
            <span class="mi" style="font-size:18px;color:var(--primary)">contact_phone</span>
          </button>` : ''}
        </div>

        <label class="field-label">מייל</label>
        <input class="input mb-10" id="sup-email-input" type="email" placeholder="email@supplier.com" value="${escHtml(sup.email || '')}">

        <label class="field-label">הסדר תשלומים *</label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
          ${PAYMENT_TERMS_LIST.map(({ val, label, color }) => {
            const active = (sup.payment_terms || '') === val;
            return `<button onclick="setPaymentTerms('${sup.id}','${val}')"
              style="padding:6px 12px;border-radius:20px;border:2px solid ${color};font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;background:${active ? color : 'transparent'};color:${active ? 'white' : color};transition:all 0.15s"
              id="pt-${val}">${label}</button>`;
          }).join('')}
        </div>

        <label class="field-label">ימי אספקה</label>
        <input class="input mb-14" id="sup-delivery-days" type="text" placeholder="לדוגמה: ראשון, שלישי" value="${escHtml(sup.delivery_days || '')}">

        <button onclick="saveSupplierDetails()" class="btn-primary" style="width:100%">שמור פרטי ספק</button>
        ${sup.phone ? `
        <a href="https://wa.me/${formatWANumber(sup.phone)}" target="_blank" class="btn-ghost mt-8"
          style="width:100%;display:flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;background:#25D366;color:white;border-color:#25D366">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </a>` : ''}
      </div>
    </div>
  `;
}

// ── Product rows renderer ─────────────────────────────────────

// Looks up the reference market price for a product name — exact match first,
// falling back to a word-overlap match since invoice product names rarely match
// the uploaded price-list names character-for-character.
function findMarketPrice(name) {
  const map = window._marketPriceByName || {};
  if (map[name]) return map[name];
  const pn = (name || '').trim();
  if (!pn) return null;
  const pWords = pn.split(/[\s\/,]+/).filter(w => w.length > 1);
  if (!pWords.length) return null;
  let best = null, bestScore = 0;
  for (const [mn, val] of Object.entries(map)) {
    const mWords = mn.split(/[\s\/,]+/).filter(w => w.length > 1);
    const shared = pWords.filter(w => mWords.some(mw => mw.includes(w) || w.includes(mw)));
    const score = shared.length / Math.max(pWords.length, mWords.length);
    if (score > bestScore && score >= 0.5) { bestScore = score; best = val; }
  }
  return best;
}

function renderSupProductRows(productHistory, filter = '') {
  const entries = Object.entries(productHistory || {})
    .filter(([name]) => !filter || name.includes(filter));

  if (!entries.length) {
    return `<div style="padding:20px;text-align:center;color:var(--on-surface-3);font-size:13px">${filter ? 'לא נמצאו מוצרים' : 'אין מוצרים'}</div>`;
  }

  return entries.map(([name, history]) => {
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = history[0]?.price || 0;
    const prev   = history[1]?.price;
    const trend  = prev ? (latest > prev * 1.03 ? 'up' : latest < prev * 0.97 ? 'down' : 'stable') : 'stable';
    const pct    = prev ? Math.abs(((latest - prev) / prev) * 100).toFixed(0) : null;
    const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');

    const dot = trend === 'up'
      ? `<div style="width:9px;height:9px;border-radius:50%;background:#EF4444;flex-shrink:0;margin-top:2px"></div>`
      : trend === 'down'
      ? `<div style="width:9px;height:9px;border-radius:50%;background:#10B981;flex-shrink:0;margin-top:2px"></div>`
      : `<div style="width:9px;height:9px;border-radius:50%;background:var(--border);flex-shrink:0;margin-top:2px"></div>`;

    const mkt = findMarketPrice(name);

    return `
      <div onclick="showProductHistory('${safeId}')"
        style="display:grid;grid-template-columns:14px 1fr auto auto;gap:8px;align-items:start;padding:11px 14px;border-bottom:1px solid var(--border);cursor:pointer">
        ${dot}
        <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(name)}</div>
        <div style="text-align:left;min-width:64px">
          <div style="font-size:14px;font-weight:800">₪${parseFloat(latest).toFixed(2)}</div>
          ${pct && pct !== '0' ? `<div style="font-size:10px;font-weight:700;color:${trend === 'up' ? '#EF4444' : '#10B981'}">${trend === 'up' ? '↑' : '↓'}${pct}%</div>` : ''}
        </div>
        <div style="text-align:left;min-width:52px">
          <div style="font-size:9px;color:var(--on-surface-3);font-weight:600;margin-bottom:1px">מחיר שוק</div>
          ${mkt ? `<div style="font-size:11px;font-weight:700;color:var(--on-surface-2)">₪${mkt.price.toFixed(2)}</div>` : `<div style="font-size:11px;color:var(--on-surface-3)">—</div>`}
        </div>
      </div>`;
  }).join('');
}

function filterSupProducts(q) {
  const el = document.getElementById('sup-products-list');
  if (el) el.innerHTML = renderSupProductRows(window._supProductHistory || {}, q);
}

function showProductHistory(safeId) {
  const ph = window._supProductHistory || {};
  const name = Object.keys(ph).find(k => k.replace(/[^a-zA-Z0-9]/g, '_') === safeId);
  if (!name) return;
  const history = (ph[name] || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:75vh;overflow-y:auto">
      <div style="padding:20px 20px 8px;display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:16px;font-weight:800">${escHtml(name)}</div>
        <button onclick="this.closest('[data-ph-modal]').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--on-surface-3)">×</button>
      </div>
      <div style="padding:0 20px 32px">
        ${history.map((h, i) => {
          const prev = history[i + 1]?.price;
          const trend = prev ? (h.price > prev * 1.03 ? 'up' : h.price < prev * 0.97 ? 'down' : 'stable') : 'stable';
          const color = trend === 'up' ? '#EF4444' : trend === 'down' ? '#10B981' : 'var(--on-surface-3)';
          const arrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '';
          return `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="font-size:13px;color:var(--on-surface-2)">${formatDate(h.date)}</div>
              <div style="display:flex;align-items:center;gap:6px">
                ${arrow ? `<span style="font-size:12px;color:${color};font-weight:700">${arrow}</span>` : ''}
                <span style="font-size:15px;font-weight:800">₪${parseFloat(h.price).toFixed(2)}</span>
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>`;
  modal.setAttribute('data-ph-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ── Annual / Monthly invoice modals ──────────────────────────

function showMonthlyInvoices() {
  const now = new Date();
  const invs = (window._supInvoices || []).filter(i => {
    const d = new Date(i.date + 'T00:00:00');
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const title = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  _showInvoiceListModal(title, invs);
}

function showAnnualBreakdown() {
  const now = new Date();
  const yr = now.getFullYear();
  const invs = (window._supInvoices || []).filter(i =>
    new Date(i.date + 'T00:00:00').getFullYear() === yr
  );

  // Group by month
  const byMonth = {};
  invs.forEach(i => {
    const d = new Date(i.date + 'T00:00:00');
    const key = d.getMonth();
    if (!byMonth[key]) byMonth[key] = { label: d.toLocaleDateString('he-IL', { month: 'long' }), invoices: [], total: 0 };
    byMonth[key].invoices.push(i);
    byMonth[key].total += parseFloat(i.total_amount || i.total || 0);
  });

  const annualTotal = invs.reduce((s, i) => s + parseFloat(i.total_amount || i.total || 0), 0);
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:82vh;overflow-y:auto">
      <div style="padding:20px 20px 8px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:16px;font-weight:800">רכש שנתי ${yr}</div>
          <div style="font-size:13px;color:var(--primary);font-weight:700">סה"כ: ₪${Math.round(annualTotal).toLocaleString('he-IL')}</div>
        </div>
        <button onclick="this.closest('[data-annual-modal]').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--on-surface-3)">×</button>
      </div>
      <div style="padding:0 20px 32px">
        ${Object.entries(byMonth).sort((a, b) => b[0] - a[0]).map(([, m]) => `
          <div onclick="_showInvoiceListModal('${m.label}', ${JSON.stringify(m.invoices).replace(/'/g, "\\'")})" class="card-tap"
            style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid var(--border);cursor:pointer">
            <div style="font-size:14px;font-weight:700">${m.label}</div>
            <div style="display:flex;align-items:center;gap:8px">
              <div style="font-size:12px;color:var(--on-surface-3)">${m.invoices.length} חשבוניות</div>
              <div style="font-size:15px;font-weight:800;color:var(--primary)">₪${Math.round(m.total).toLocaleString('he-IL')}</div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--on-surface-3)" stroke-width="2" stroke-linecap="round"><path d="M9 18l-6-6 6-6"/></svg>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
  modal.setAttribute('data-annual-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function _showInvoiceListModal(title, invoices) {
  document.querySelector('[data-invlist-modal]')?.remove();
  const total = (invoices || []).reduce((s, i) => s + parseFloat(i.total_amount || i.total || 0), 0);
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:78vh;overflow-y:auto">
      <div style="padding:18px 20px 8px;display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:15px;font-weight:800">${title}</div>
          <div style="font-size:12px;color:var(--primary);font-weight:700">סה"כ: ₪${Math.round(total).toLocaleString('he-IL')}</div>
        </div>
        <button onclick="this.closest('[data-invlist-modal]').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:var(--on-surface-3)">×</button>
      </div>
      <div style="padding:0 20px 32px">
        ${(invoices || []).length ? (invoices || []).map(inv => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:13px;font-weight:700">${formatDate(inv.date)}</div>
              <div style="font-size:11px;color:var(--on-surface-3)">${inv.invoice_number || '—'}</div>
            </div>
            <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${parseFloat(inv.total_amount || inv.total || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 })}</div>
          </div>`).join('') :
          '<div style="padding:20px;text-align:center;color:var(--on-surface-3)">אין חשבוניות</div>'}
      </div>
    </div>`;
  modal.setAttribute('data-invlist-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ── Save supplier details ─────────────────────────────────────

async function saveSupplierDetails() {
  if (!currentSupplier) return;
  const phone    = document.getElementById('sup-phone-input')?.value.trim();
  const email    = document.getElementById('sup-email-input')?.value.trim();
  const delivery = document.getElementById('sup-delivery-days')?.value.trim();
  const agent    = document.getElementById('sup-agent-input')?.value.trim();
  const category = document.getElementById('sup-category-input')?.value || '';
  if (!phone) { showToast('טלפון הוא שדה חובה'); return; }
  const btn = document.querySelector('#page-suppliers .card-pad .btn-primary');
  if (btn) { btn.textContent = 'שומר...'; btn.disabled = true; }
  const updates = { phone, email: email || null, delivery_days: delivery || null, contact_name: agent || null, category: category || null };
  const ok = await DB.update('suppliers', `?id=eq.${currentSupplier.id}`, updates);
  if (ok) {
    Object.assign(currentSupplier, updates);
    const sup = allSuppliers.find(s => s.id === currentSupplier.id);
    if (sup) Object.assign(sup, updates);
    showToast('פרטי ספק עודכנו ✓');
  } else {
    showToast('שגיאה בשמירה');
  }
  if (btn) { btn.textContent = 'שמור פרטי ספק'; btn.disabled = false; }
}

function renderServiceAreas(areas) {
  const wrap = document.getElementById('service-areas-chips');
  if (!wrap) return;
  if (!areas.length) {
    wrap.innerHTML = `<div style="font-size:13px;color:var(--on-surface-3)">אין אזורי שירות — הוסף עיר למטה</div>`;
    return;
  }
  wrap.innerHTML = areas.map((a, i) => `
    <span style="display:inline-flex;align-items:center;gap:4px;background:var(--surface-low);border:1px solid var(--border);border-radius:20px;padding:5px 12px;font-size:12px;font-weight:600;margin:3px">
      ${escHtml(a)}
      <button onclick="removeArea(${i})" style="background:none;border:none;cursor:pointer;color:var(--on-surface-3);font-size:16px;line-height:1;padding:0 0 0 4px">×</button>
    </span>
  `).join('');
}

async function addArea() {
  const input = document.getElementById('new-area-input');
  const city = input?.value.trim();
  if (!city || !currentSupplier) return;
  const areas = [...(currentSupplier.service_areas || []), city];
  await DB.update('suppliers', `?id=eq.${currentSupplier.id}`, { service_areas: areas });
  currentSupplier.service_areas = areas;
  const sup = allSuppliers.find(s => s.id === currentSupplier.id);
  if (sup) sup.service_areas = areas;
  input.value = '';
  renderServiceAreas(areas);
  showToast('אזור נוסף');
}

async function removeArea(index) {
  if (!currentSupplier) return;
  const areas = (currentSupplier.service_areas || []).filter((_, i) => i !== index);
  await DB.update('suppliers', `?id=eq.${currentSupplier.id}`, { service_areas: areas });
  currentSupplier.service_areas = areas;
  const sup = allSuppliers.find(s => s.id === currentSupplier.id);
  if (sup) sup.service_areas = areas;
  renderServiceAreas(areas);
}

// ── הזמנת סחורה ──────────────────────────────────────────────

function unitKind(unit) {
  const u = (unit || '').replace(/"/g, '').toLowerCase();
  if (['קג','גרם','ג','kg','g'].some(w => u.includes(w))) return 'weight';
  if (['ליטר','מל','מ"ל','ml','l','cc','סמ'].some(w => u.includes(w))) return 'volume';
  return 'count';
}

function unitStep(unit) { return unitKind(unit) === 'count' ? 1 : 0.1; }
function unitColor(unit) {
  const k = unitKind(unit);
  return k === 'weight' ? '#0891B2' : k === 'volume' ? '#059669' : '#7C3AED';
}

let _orderQty = {};

function openOrderForm() {
  if (!currentSupplier) return;
  _orderQty = {};

  // Build product list from current supplier's price history
  const page = document.getElementById('page-suppliers');
  const priceRows = page.querySelectorAll('[data-product-price]');
  const products = [];
  // Fallback: use product history from items already loaded
  // We'll re-read from the DOM price rows or use a stored cache
  // Actually use the global allSuppliers data isn't enough — need items
  // Use a simple approach: show the products we know about
  const supName = currentSupplier.name;

  // We'll fetch items for this supplier to get product list
  DB.get('invoice_items', `?supplier_name=eq.${encodeURIComponent(supName)}&select=product_name,unit_price,unit&order=product_name.asc`)
    .then(items => {
      const seen = new Set();
      const prods = (items || []).filter(i => {
        if (seen.has(i.product_name)) return false;
        seen.add(i.product_name);
        return true;
      });
      showOrderModal(prods);
    });
}

function showOrderModal(products) {
  const sup = currentSupplier;
  const bizName = Auth.profile.business_name || '';
  document.querySelector('[data-order-modal]')?.remove();

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.setAttribute('data-order-modal', '');
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;width:100%;max-width:480px;max-height:88vh;display:flex;flex-direction:column">
      <div style="padding:20px 20px 12px;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <div>
          <div style="font-size:18px;font-weight:800">הזמנת סחורה</div>
          <div style="font-size:13px;color:var(--on-surface-3)">${sup.name}</div>
        </div>
        <button onclick="this.closest('[data-order-modal]').remove()" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--on-surface-3);padding:0;line-height:1">×</button>
      </div>

      <div style="overflow-y:auto;flex:1;padding:0 20px">
        ${products.length ? products.map((p, i) => {
          const kind = unitKind(p.unit);
          const color = unitColor(p.unit);
          const step = unitStep(p.unit);
          const kindLabel = kind === 'weight' ? 'משקל' : kind === 'volume' ? 'נפח' : 'יחידות';
          return `
          <div style="display:flex;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);gap:10px">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:6px">
                <div style="font-size:13px;font-weight:700">${p.product_name}</div>
                <span style="font-size:10px;font-weight:700;color:${color};background:${color}18;border-radius:10px;padding:2px 6px">${kindLabel}</span>
              </div>
              <div style="font-size:11px;color:var(--on-surface-3)">₪${parseFloat(p.unit_price||0).toFixed(2)} / ${p.unit||'יח\''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:5px">
              <button onclick="orderAdj(${i},-${step})" style="width:30px;height:30px;border-radius:50%;border:2px solid var(--border);background:none;font-size:16px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;flex-shrink:0">−</button>
              <div id="oq-${i}" style="min-width:36px;text-align:center;font-size:14px;font-weight:800">0</div>
              <div style="font-size:11px;color:${color};font-weight:700;flex-shrink:0">${p.unit||'יח\''}</div>
              <button onclick="orderAdj(${i},${step})" style="width:30px;height:30px;border-radius:50%;border:2px solid ${color};background:${color};color:white;font-size:16px;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;flex-shrink:0">+</button>
            </div>
          </div>`;
        }).join('') : '<div style="padding:20px;text-align:center;color:var(--on-surface-3)">אין מוצרים — סרוק חשבונית ראשונה מספק זה</div>'}
      </div>

      <div style="padding:14px 20px;border-top:1px solid var(--border);flex-shrink:0">
        <div id="order-total" style="font-size:14px;font-weight:700;color:var(--on-surface-3);margin-bottom:10px;text-align:center">סה"כ משוער: ₪0</div>
        <textarea id="order-notes" placeholder="הערות חופשיות להזמנה..." style="width:100%;border:1px solid var(--border);border-radius:var(--radius-md);padding:10px;font-family:inherit;font-size:13px;resize:none;height:70px;margin-bottom:10px;outline:none;direction:rtl"></textarea>
        <div style="display:flex;gap:8px">
          <button onclick="sendOrder('wa')" class="btn-primary" style="flex:1;background:#25D366;display:flex;align-items:center;justify-content:center;gap:6px">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </button>
          <button onclick="sendOrder('sms')" class="btn-ghost" style="flex:1">SMS</button>
        </div>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  window._orderProducts = products;
  window._orderBizName = bizName;
}

function orderAdj(i, delta) {
  const step = delta < 0 ? -Math.abs(delta) : Math.abs(delta);
  _orderQty[i] = Math.max(0, Math.round((_orderQty[i] || 0) * 10 + step * 10) / 10);
  const el = document.getElementById('oq-' + i);
  const p = (window._orderProducts || [])[i];
  const isCount = unitKind(p?.unit) === 'count';
  if (el) el.textContent = isCount ? _orderQty[i] : _orderQty[i].toFixed(1);
  let total = 0;
  (window._orderProducts || []).forEach((p, idx) => {
    total += (parseFloat(p.unit_price) || 0) * (_orderQty[idx] || 0);
  });
  const totEl = document.getElementById('order-total');
  if (totEl) totEl.textContent = `סה"כ משוער: ₪${total.toFixed(2)}`;
}

function buildOrderMessage() {
  const prods = window._orderProducts || [];
  const biz = window._orderBizName || Auth.profile.business_name || '';
  const notes = document.getElementById('order-notes')?.value.trim() || '';
  const lines = prods.map((p, i) => {
    const q = _orderQty[i] || 0;
    if (!q) return null;
    const isCount = unitKind(p.unit) === 'count';
    const qStr = isCount ? q : q.toFixed(1);
    return `• ${p.product_name}: ${qStr} ${p.unit || 'יח\''}`;
  }).filter(Boolean);
  if (!lines.length && !notes) return null;
  let msg = `היי, זאת הזמנה מ-${biz} שנשלחת דרך מערכת REVERTO — המקום שבו כל הנתונים מתחברים 🔗\n\n`;
  if (lines.length) msg += `${lines.join('\n')}\n`;
  if (notes) msg += `\n📝 ${notes}\n`;
  msg += '\nתודה!';
  return msg;
}

function sendOrder(method) {
  const msg = buildOrderMessage();
  if (!msg) { showToast('הוסף כמות לפחות למוצר אחד'); return; }
  const sup = currentSupplier;
  if (method === 'wa') {
    const num = sup.phone ? formatWANumber(sup.phone) : '';
    const url = num ? `https://wa.me/${num}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  } else {
    const num = sup.phone ? sup.phone.replace(/\D/g, '') : '';
    window.location.href = `sms:${num}?body=${encodeURIComponent(msg)}`;
  }
  document.querySelector('[data-order-modal]')?.remove();
}

// ── Payment terms ─────────────────────────────────────────────
// PAYMENT_TERMS_LABELS and calcDueDate defined in db.js (loaded first)

function paymentDueDateLabel(terms) {
  const now = new Date();
  const eom = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const addDays = (n) => { const r = new Date(eom); r.setDate(r.getDate() + n); return r; };
  const fmt = d => d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  switch (terms) {
    case 'cash_delivery': return 'בקבלת הסחורה';
    case 'cash_eom': return fmt(eom);
    case 'net30': return fmt(addDays(30));
    case 'net60': return fmt(addDays(60));
    case 'net90': return fmt(addDays(90));
    default: return fmt(addDays(30));
  }
}

async function setPaymentTerms(supId, terms) {
  await DB.update('suppliers', `?id=eq.${supId}`, { payment_terms: terms });
  // Update UI buttons
  ['cash_delivery','cash_eom','net30','net60','net90'].forEach(v => {
    const btn = document.getElementById('pt-' + v);
    if (!btn) return;
    const colors = { cash_delivery:'#059669', cash_eom:'#0891B2', net30:'#7C3AED', net60:'#D97706', net90:'#DC2626' };
    const c = colors[v];
    btn.style.background = v === terms ? c : 'transparent';
    btn.style.color = v === terms ? 'white' : c;
  });
  if (currentSupplier) currentSupplier.payment_terms = terms;
  const sup = allSuppliers.find(s => s.id === supId);
  if (sup) sup.payment_terms = terms;
  showToast('הסדר תשלומים עודכן');
}

// ── Product price inline edit ─────────────────────────────────

function startEditProduct(id, name, price) {
  document.getElementById('prod-view-' + id).style.display = 'none';
  document.getElementById('prod-edit-' + id).style.display = 'block';
}

function cancelEditProduct(id) {
  document.getElementById('prod-view-' + id).style.display = 'grid';
  document.getElementById('prod-edit-' + id).style.display = 'none';
}

async function saveEditProduct(id, oldName) {
  const newName = document.getElementById('prod-name-' + id)?.value.trim();
  const newPrice = parseFloat(document.getElementById('prod-price-' + id)?.value) || 0;
  if (!newName) return;

  const supName = currentSupplier?.name;
  const btn = document.querySelector(`#prod-edit-${id} .btn-primary`);
  if (btn) { btn.textContent = 'שומר...'; btn.disabled = true; }

  // Update all invoice_items for this supplier + product
  if (newName !== oldName) {
    await DB.update('invoice_items',
      `?supplier_name=eq.${encodeURIComponent(supName)}&product_name=eq.${encodeURIComponent(oldName)}`,
      { product_name: newName }
    );
  }
  if (newPrice > 0) {
    await DB.update('invoice_items',
      `?supplier_name=eq.${encodeURIComponent(supName)}&product_name=eq.${encodeURIComponent(newName)}&order=date.desc&limit=1`,
      { unit_price: newPrice }
    );
  }

  showToast('מוצר עודכן');
  // Reload supplier detail to reflect changes
  await viewSupplier(currentSupplier.id);
}

function toggleInvDetail(i) {
  const el = document.getElementById('inv-detail-' + i);
  const arr = document.getElementById('inv-arr-' + i);
  if (!el) return;
  const open = el.style.display === 'none';
  el.style.display = open ? 'block' : 'none';
  if (arr) arr.style.transform = open ? 'rotate(180deg)' : '';
}

async function supContactPicker() {
  try {
    const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
    if (contacts?.length) {
      const phone = contacts[0].tel?.[0] || '';
      if (phone) document.getElementById('sup-phone-input').value = phone;
    }
  } catch { showToast('לא ניתן לגשת לאנשי הקשר'); }
}


function showAddSupplier() {
  _newSupTerm = null;
  const el = document.getElementById('suppliers-list');
  const hasContacts = 'contacts' in navigator && navigator.contacts;
  el.innerHTML = `
    <div class="card-pad">
      <div style="font-size:16px;font-weight:800;margin-bottom:4px">ספק חדש</div>
      <div style="font-size:12px;color:var(--on-surface-3);margin-bottom:16px">* שדות חובה</div>

      ${hasContacts ? `
        <button onclick="addSupplierFromContacts()" class="btn-ghost mb-12" style="width:100%;border-color:var(--primary);color:var(--primary);display:flex;align-items:center;justify-content:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          ייבא מאנשי הקשר
        </button>` : ''}

      <label class="field-label">שם ספק *</label>
      <input class="input mb-10" id="new-sup-name" type="text" placeholder="שם הספק">

      <label class="field-label">טלפון *</label>
      <input class="input mb-14" id="new-sup-phone" type="tel" placeholder="050-0000000">

      <label class="field-label">הסדר תשלומים *</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
        ${PAYMENT_TERMS_LIST.map(({ val, label, color }) => `
          <button type="button" onclick="selectNewSupTerm('${val}')" id="nst-${val}"
            style="padding:7px 13px;border-radius:20px;border:2px solid ${color};font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;background:transparent;color:${color};transition:all 0.15s">
            ${label}
          </button>`).join('')}
      </div>

      <button class="btn-primary mb-8" onclick="saveNewSupplier()">הוסף ספק</button>
      <button class="btn-ghost" onclick="renderSuppliersList()">ביטול</button>
    </div>
  `;
}

function selectNewSupTerm(val) {
  _newSupTerm = val;
  PAYMENT_TERMS_LIST.forEach(({ val: v, color }) => {
    const btn = document.getElementById('nst-' + v);
    if (!btn) return;
    btn.style.background = v === val ? color : 'transparent';
    btn.style.color = v === val ? 'white' : color;
  });
}

async function addSupplierFromContacts() {
  try {
    const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
    if (contacts?.length) {
      const c = contacts[0];
      const name = c.name?.[0] || '';
      const phone = c.tel?.[0] || '';
      if (name) document.getElementById('new-sup-name').value = name;
      if (phone) document.getElementById('new-sup-phone').value = phone;
    }
  } catch {
    showToast('לא ניתן לגשת לאנשי הקשר');
  }
}

async function saveNewSupplier() {
  const name = document.getElementById('new-sup-name')?.value.trim();
  const phone = document.getElementById('new-sup-phone')?.value.trim();
  if (!name)       { showToast('שם ספק הוא שדה חובה'); return; }
  if (!phone)      { showToast('טלפון הוא שדה חובה'); return; }
  if (!_newSupTerm){ showToast('יש לבחור הסדר תשלומים'); return; }

  await DB.insert('suppliers', {
    user_id: Auth.userId,
    name,
    phone,
    payment_terms: _newSupTerm,
    total_amount: 0,
    invoice_count: 0,
    created_at: new Date().toISOString()
  });

  _newSupTerm = null;
  showToast('הספק נוסף בהצלחה');
  renderSuppliersList();
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('he-IL', {day:'numeric', month:'short'});
}

// ── Payment Forecast (120 days) ───────────────────────────────

function calcPaymentDueDate(invoiceDateStr, terms) {
  const inv = new Date(invoiceDateStr + 'T00:00:00');
  // end of the invoice's month
  const eom = new Date(inv.getFullYear(), inv.getMonth() + 1, 0);
  const addDays = n => { const d = new Date(eom); d.setDate(d.getDate() + n); return d; };
  switch (terms) {
    case 'cash_delivery': return null; // already paid on delivery
    case 'order_time':    return null; // already paid at order time
    case 'cash_eom':      return eom;
    case 'net30':         return addDays(30);
    case 'net60':         return addDays(60);
    case 'net90':         return addDays(90);
    default:              return addDays(30);
  }
}

async function showPaymentForecast() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)';
  modal.setAttribute('data-forecast-modal', '');
  modal.innerHTML = `
    <div style="background:white;border-radius:28px 28px 0 0;width:100%;max-width:480px;max-height:88vh;display:flex;flex-direction:column">
      <div style="padding:20px 20px 0;display:flex;justify-content:space-between;align-items:center;flex-shrink:0">
        <div>
          <div style="font-size:18px;font-weight:800">תשלומים צפויים</div>
          <div style="font-size:12px;color:var(--on-surface-3);margin-top:2px">120 יום קדימה — לפי הסדרי תשלום לפי ספק</div>
        </div>
        <button onclick="this.closest('[data-forecast-modal]').remove()" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--on-surface-3);line-height:1">×</button>
      </div>
      <div style="margin:10px 20px 0;background:rgba(107,53,184,0.07);border-radius:10px;padding:10px 12px;font-size:11px;color:var(--on-surface-2);line-height:1.6;flex-shrink:0">
        ⭐ <b>שוטף+30</b> = תשלום 30 יום מסוף החודש שבו נצברו החשבוניות. לדוגמה: חשבוניות מאי → תשלום 30 ביוני. כך גם לגבי שוטף+60 ושוטף+90. מזומן בקבלת סחורה / בזמן הזמנה — אינם מוצגים (שולמו כבר).
      </div>
      <div id="forecast-body" style="overflow-y:auto;flex:1;padding:16px 20px 32px">
        <div style="text-align:center;padding:40px 0;color:var(--on-surface-3)">טוען נתונים...</div>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  // Fetch last 4 months of invoices + all suppliers (for payment terms)
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const fromStr = from.toISOString().split('T')[0];
  const maxDate = new Date(today); maxDate.setDate(maxDate.getDate() + 120);

  const [invoices, suppliers] = await Promise.all([
    DB.get('invoices', `?select=*&date=gte.${fromStr}&order=date.asc`),
    DB.get('suppliers', `?select=name,payment_terms`)
  ]);

  // Build supplier → payment terms map
  const supTerms = {};
  (suppliers || []).forEach(s => { supTerms[s.name] = s.payment_terms || 'net30'; });

  // Calculate due dates, filter to today → today+120
  const payments = [];
  (invoices || []).forEach(inv => {
    const terms = supTerms[inv.supplier_name] || 'net30';
    const amount = parseFloat(inv.total_amount || inv.total || 0);
    if (!amount) return;
    const due = calcPaymentDueDate(inv.date, terms);
    if (!due) return; // already paid
    if (due < today || due > maxDate) return;
    payments.push({ due, supplier: inv.supplier_name, amount, terms });
  });

  // Group by due date string, merge same supplier on same date
  const groups = {};
  payments.forEach(p => {
    const key = p.due.toISOString().split('T')[0];
    if (!groups[key]) groups[key] = { date: p.due, bySupplier: {}, total: 0 };
    groups[key].bySupplier[p.supplier] = (groups[key].bySupplier[p.supplier] || 0) + p.amount;
    groups[key].total += p.amount;
  });

  const sorted = Object.values(groups).sort((a, b) => a.date - b.date);

  const body = document.getElementById('forecast-body');
  if (!body) return;

  if (!sorted.length) {
    body.innerHTML = `<div style="text-align:center;padding:40px 0">
      <div style="font-size:40px;margin-bottom:12px">✅</div>
      <div style="font-size:15px;font-weight:700">אין תשלומים צפויים ב-120 הימים הקרובים</div>
      <div style="font-size:12px;color:var(--on-surface-3);margin-top:6px">ודא שהסדרי התשלום הוגדרו לכל ספק</div>
    </div>`;
    return;
  }

  let cumulative = 0;
  const termsLabel = t => PAYMENT_TERMS_LABELS[t] || t;
  const fmtDate = d => d.toLocaleDateString('he-IL', { weekday:'short', day:'numeric', month:'long', year:'numeric' });
  const fmtMoney = n => '₪' + Math.round(n).toLocaleString('he-IL');

  body.innerHTML = sorted.map(g => {
    cumulative += g.total;
    const daysFromNow = Math.round((g.date - today) / 86400000);
    const urgency = daysFromNow <= 14 ? 'var(--error)' : daysFromNow <= 30 ? '#D97706' : 'var(--on-surface-3)';
    const rows = Object.entries(g.bySupplier).map(([name, amt]) =>
      `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600">${name}</div>
        <div style="font-size:13px;font-weight:700">${fmtMoney(amt)}</div>
      </div>`
    ).join('');

    return `
      <div style="margin-bottom:16px;background:white;border:1.5px solid var(--border);border-radius:16px;overflow:hidden">
        <div style="background:var(--surface-low);padding:12px 14px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <div style="font-size:13px;font-weight:800">${fmtDate(g.date)}</div>
            <div style="font-size:11px;color:${urgency};font-weight:700;margin-top:2px">
              ${daysFromNow === 0 ? 'היום' : `בעוד ${daysFromNow} ימים`}
            </div>
          </div>
          <div style="text-align:left">
            <div style="font-size:16px;font-weight:800;color:var(--primary)">${fmtMoney(g.total)}</div>
            <div style="font-size:10px;color:var(--on-surface-3)">תשלום יחיד</div>
          </div>
        </div>
        <div style="padding:10px 14px">${rows}</div>
        <div style="padding:8px 14px;background:linear-gradient(135deg,rgba(107,53,184,0.06),rgba(139,92,246,0.08));display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:11px;color:var(--on-surface-3)">סה"כ מצטבר עד תאריך זה</div>
          <div style="font-size:14px;font-weight:800;color:var(--primary)">${fmtMoney(cumulative)}</div>
        </div>
      </div>`;
  }).join('');
}
