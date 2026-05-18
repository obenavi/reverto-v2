// ── Suppliers ─────────────────────────────────────────────────

let allSuppliers = [];
let currentSupplier = null;

async function renderSuppliersList() {
  const userId = Auth.userId;
  if (!userId) return;

  // Restore page structure if it was replaced by viewSupplier
  const page = document.getElementById('page-suppliers');
  if (!document.getElementById('suppliers-list')) {
    page.innerHTML = `<div class="page-content">
      <div style="font-size:22px;font-weight:800;margin-bottom:16px">ספקים</div>
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

  const userId = Auth.userId;
  const invoices = await DB.get('invoices', `?supplier_name=eq.${encodeURIComponent(sup.name)}&select=*&order=date.desc`);
  const items = await DB.get('invoice_items', `?supplier_name=eq.${encodeURIComponent(sup.name)}&select=*&order=date.desc`);

  // Price history per product
  const productHistory = {};
  (items||[]).forEach(item => {
    if (!productHistory[item.product_name]) productHistory[item.product_name] = [];
    productHistory[item.product_name].push({ price: item.unit_price, date: item.date });
  });

  const el = document.getElementById('page-suppliers');
  el.innerHTML = `
    <div class="page-content">
      <button onclick="renderSuppliersList();navTo('suppliers')" style="background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:6px;color:var(--primary);font-weight:700;font-size:14px;margin-bottom:16px;font-family:inherit">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>
        חזרה לספקים
      </button>

      <div style="font-size:22px;font-weight:800;margin-bottom:4px">${sup.name}</div>
      <div style="font-size:13px;color:var(--on-surface-3);margin-bottom:2px">${sup.invoice_count||0} חשבוניות</div>
      ${sup.address ? `<div style="font-size:12px;color:var(--on-surface-3);margin-bottom:2px">📍 ${sup.address}</div>` : ''}
      ${sup.email ? `<div style="font-size:12px;color:var(--on-surface-3);margin-bottom:2px">✉️ ${sup.email}</div>` : ''}
      ${sup.tax_id ? `<div style="font-size:12px;color:var(--on-surface-3);margin-bottom:2px">עוסק: ${sup.tax_id}</div>` : ''}
      <div style="margin-bottom:20px"></div>

      <!-- Stats -->
      <div class="stat-grid mb-12">
        <div class="stat-card">
          <div class="stat-label">סה"כ רכש</div>
          <div class="stat-value">₪${parseFloat(sup.total_amount||0).toLocaleString('he-IL',{maximumFractionDigits:0})}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">ממוצע לחשבונית</div>
          <div class="stat-value">₪${sup.invoice_count ? Math.round(sup.total_amount/sup.invoice_count).toLocaleString('he-IL') : 0}</div>
        </div>
      </div>

      <!-- Order Button -->
      <button onclick="openOrderForm()" class="btn-primary mb-12" style="width:100%;background:linear-gradient(135deg,#10B981,#059669);display:flex;align-items:center;justify-content:center;gap:8px">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
        הזמנת סחורה
      </button>

      <!-- Product Price History -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="section-title">מחירי מוצרים</div>
        <div style="font-size:10px;color:var(--on-surface-3);background:var(--surface-low);padding:3px 8px;border-radius:12px">לפני מע"מ 18%</div>
      </div>
      <div class="card mb-12">
        ${Object.entries(productHistory).slice(0,15).map(([name, history]) => {
          history.sort((a,b) => new Date(b.date)-new Date(a.date));
          const latest = history[0]?.price || 0;
          const latestDate = history[0]?.date ? new Date(history[0].date + 'T00:00:00').toLocaleDateString('he-IL', {day:'numeric',month:'short'}) : '';
          const prev = history[1]?.price;
          const prevDate = history[1]?.date ? new Date(history[1].date + 'T00:00:00').toLocaleDateString('he-IL', {day:'numeric',month:'short'}) : '';
          const trend = prev ? (latest > prev*1.03 ? 'up' : latest < prev*0.97 ? 'down' : 'stable') : 'stable';
          const trendIcon = trend === 'up'
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>`
            : trend === 'down'
            ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`
            : '';
          const pctChange = prev ? (((latest - prev) / prev) * 100).toFixed(0) : null;
          const safeId = name.replace(/[^a-zA-Z0-9]/g, '_');
          return `
          <div id="prod-row-${safeId}" style="border-bottom:1px solid var(--border)">
            <!-- View mode -->
            <div id="prod-view-${safeId}" style="display:grid;grid-template-columns:1fr 100px 36px;gap:6px;align-items:center;padding:10px 14px">
              <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name}</div>
              <div style="text-align:left">
                <div style="display:flex;align-items:center;gap:4px;justify-content:flex-start">
                  ${trendIcon}
                  <span style="font-size:14px;font-weight:800;white-space:nowrap">₪${parseFloat(latest).toFixed(2)}</span>
                  ${pctChange && pctChange !== '0' ? `<span style="font-size:10px;color:${trend==='up'?'var(--error)':'var(--success)'};">${trend==='up'?'+':''}${pctChange}%</span>` : ''}
                </div>
                <div style="font-size:10px;color:var(--on-surface-3)">${latestDate}${prev ? ` | ₪${parseFloat(prev).toFixed(2)} (${prevDate})` : ''}</div>
              </div>
              <button onclick="startEditProduct('${safeId}','${name.replace(/'/g,'\\\'') }',${parseFloat(latest).toFixed(2)})"
                style="background:none;border:1px solid var(--border);border-radius:8px;padding:4px 6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--on-surface-2)">✏️</button>
            </div>
            <!-- Edit mode (hidden) -->
            <div id="prod-edit-${safeId}" style="display:none;padding:10px 14px;background:var(--surface-low)">
              <div style="display:flex;gap:6px;margin-bottom:8px">
                <input class="input" id="prod-name-${safeId}" type="text" value="${name}" style="flex:2;font-size:13px;padding:6px 10px">
                <input class="input" id="prod-price-${safeId}" type="number" step="0.01" value="${parseFloat(latest).toFixed(2)}" style="flex:1;font-size:13px;padding:6px 10px">
              </div>
              <div style="display:flex;gap:6px">
                <button onclick="saveEditProduct('${safeId}','${name.replace(/'/g,'\\\'')}')" class="btn-primary" style="flex:1;font-size:12px;padding:7px">שמור</button>
                <button onclick="cancelEditProduct('${safeId}')" class="btn-ghost" style="flex:1;font-size:12px;padding:7px">ביטול</button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Invoice History -->
      <div class="section-title mb-8">היסטוריית חשבוניות</div>
      <div class="card mb-12">
        ${(invoices||[]).map((inv, ii) => {
          const invItems = inv.items ? (typeof inv.items === 'string' ? JSON.parse(inv.items) : inv.items) : [];
          return `
          <div>
            <div class="list-row" style="cursor:pointer" onclick="toggleInvDetail(${ii})">
              <div style="flex:1">
                <div style="font-size:13px;font-weight:700">${formatDate(inv.date)}</div>
                <div style="font-size:11px;color:var(--on-surface-3)">${inv.invoice_number||'—'}</div>
              </div>
              <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${parseFloat(inv.total_amount||inv.total||0).toLocaleString('he-IL',{maximumFractionDigits:0})}</div>
              <svg id="inv-arr-${ii}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--on-surface-3)" stroke-width="2" stroke-linecap="round" style="margin-right:4px;transition:transform 0.2s"><polyline points="6 9 12 15 18 9"/></svg>
            </div>
            <div id="inv-detail-${ii}" style="display:none;padding:10px 14px;background:var(--surface-low);border-bottom:1px solid var(--border)">
              ${invItems.length ? invItems.map(it => `
                <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
                  <span>${it.product_name||'—'}</span>
                  <span style="color:var(--on-surface-3)">${it.quantity||''} × ₪${parseFloat(it.unit_price||0).toFixed(2)} = <strong>₪${parseFloat(it.total_price||0).toFixed(2)}</strong></span>
                </div>`).join('') : '<div style="font-size:12px;color:var(--on-surface-3)">אין פרטי פריטים</div>'}
            </div>
          </div>`;
        }).join('') || '<div class="empty-state"><div class="empty-state-title">אין חשבוניות</div></div>'}
      </div>

      <!-- Payment Terms -->
      <div class="section-title mb-4">הסדר תשלומים</div>
      <div style="font-size:11px;color:var(--on-surface-3);margin-bottom:8px;background:rgba(107,53,184,0.05);border-radius:8px;padding:8px 10px;line-height:1.5">
        💡 בעזרת נתון זה נוכל לעדכן אותך בסוף כל חודש על העלויות הצפויות לרדת לפי הסדרי התשלום שלך עם כל ספק.
      </div>
      <div class="card card-pad mb-12">
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px" id="payment-terms-btns">
          ${[
            ['cash_delivery','מזומן בקבלת סחורה','#059669'],
            ['cash_eom','מזומן סוף חודש','#0891B2'],
            ['net30','שוטף+30','#7C3AED'],
            ['net60','שוטף+60','#D97706'],
            ['net90','שוטף+90','#DC2626']
          ].map(([val, label, color]) => {
            const isActive = (sup.payment_terms || 'net30') === val;
            return `<button onclick="setPaymentTerms('${sup.id}','${val}')"
              style="padding:6px 12px;border-radius:20px;border:2px solid ${color};font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;background:${isActive ? color : 'transparent'};color:${isActive ? 'white' : color};transition:all 0.15s"
              id="pt-${val}">${label}</button>`;
          }).join('')}
        </div>
        ${sup.payment_terms ? `<div style="font-size:12px;color:var(--on-surface-3)">
          תשלום על חשבוניות החודש: <strong>${paymentDueDateLabel(sup.payment_terms)}</strong>
        </div>` : ''}
      </div>

      <!-- Phone / Contact -->
      <div class="section-title mb-8">פרטי קשר</div>
      <div class="card card-pad mb-12">
        <input class="input mb-8" id="sup-phone-input" type="tel" placeholder="טלפון ספק" value="${escHtml(sup.phone || '')}">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="saveSupplierPhone()" class="btn-primary" style="flex:1;min-width:80px">שמור</button>
          ${'contacts' in navigator && navigator.contacts ? `<button onclick="supContactPicker()" class="btn-ghost" style="color:var(--primary);border-color:var(--primary)">מאנשי קשר</button>` : ''}
          ${sup.phone ? `<a href="https://wa.me/${formatWANumber(sup.phone)}" target="_blank" style="display:flex;align-items:center;justify-content:center;gap:5px;background:#25D366;color:white;border-radius:var(--radius-md);padding:0 14px;font-size:13px;font-weight:700;text-decoration:none"><svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</a>` : ''}
        </div>
      </div>
    </div>
  `;

  renderServiceAreas(sup.service_areas || []);
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

async function saveSupplierPhone() {
  if (!currentSupplier) return;
  const phone = document.getElementById('sup-phone-input')?.value.trim();
  await DB.update('suppliers', `?id=eq.${currentSupplier.id}`, { phone: phone || null });
  currentSupplier.phone = phone;
  const sup = allSuppliers.find(s => s.id === currentSupplier.id);
  if (sup) sup.phone = phone;
  showToast('טלפון עודכן');
}

function showAddSupplier() {
  const el = document.getElementById('suppliers-list');
  const hasContacts = 'contacts' in navigator && navigator.contacts;
  el.innerHTML = `
    <div class="card-pad">
      <div style="font-size:16px;font-weight:800;margin-bottom:16px">ספק חדש</div>
      ${hasContacts ? `
        <button onclick="addSupplierFromContacts()" class="btn-ghost mb-12" style="width:100%;border-color:var(--primary);color:var(--primary);display:flex;align-items:center;justify-content:center;gap:8px">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
          הוסף מאנשי הקשר
        </button>` : ''}
      <label class="field-label">שם ספק</label>
      <input class="input mb-12" id="new-sup-name" type="text" placeholder="שם הספק">
      <label class="field-label">טלפון (אופציונלי)</label>
      <input class="input mb-16" id="new-sup-phone" type="tel" placeholder="050-0000000">
      <button class="btn-primary mb-8" onclick="saveNewSupplier()">הוסף ספק</button>
      <button class="btn-ghost" onclick="renderSuppliersList()">ביטול</button>
    </div>
  `;
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
  if (!name) return;

  await DB.insert('suppliers', {
    user_id: Auth.userId,
    name,
    phone: phone || null,
    total_amount: 0,
    invoice_count: 0,
    created_at: new Date().toISOString()
  });

  showToast('הספק נוסף בהצלחה');
  renderSuppliersList();
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('he-IL', {day:'numeric', month:'short'});
}
