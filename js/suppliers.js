// ── Suppliers ─────────────────────────────────────────────────

let allSuppliers = [];
let currentSupplier = null;

async function renderSuppliersList() {
  const userId = Auth.userId;
  if (!userId) return;

  const el = document.getElementById('suppliers-list');
  el.innerHTML = `<div class="card-pad"><div class="skeleton" style="height:48px;margin-bottom:8px"></div><div class="skeleton" style="height:48px;margin-bottom:8px"></div><div class="skeleton" style="height:48px"></div></div>`;

  const suppliers = await DB.get('suppliers', `?user_id=eq.${encodeURIComponent(userId)}&select=*&order=total_amount.desc`);
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
      <div style="font-size:13px;color:var(--on-surface-3);margin-bottom:20px">${sup.invoice_count||0} חשבוניות</div>

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

      <!-- Product Price History -->
      <div class="section-title mb-8">מחירי מוצרים לאורך זמן</div>
      <div class="card mb-12">
        ${Object.entries(productHistory).slice(0,10).map(([name, history]) => {
          history.sort((a,b) => new Date(b.date)-new Date(a.date));
          const latest = history[0]?.price || 0;
          const prev = history[1]?.price;
          const trend = prev ? (latest > prev*1.03 ? 'up' : latest < prev*0.97 ? 'down' : 'stable') : 'stable';
          const trendIcon = trend === 'up'
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--error)" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg>`
            : trend === 'down'
            ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`
            : '';
          return `<div class="list-row">
            <div style="flex:1;font-size:13px;font-weight:600">${name}</div>
            <div style="display:flex;align-items:center;gap:4px">
              ${trendIcon}
              <span style="font-size:14px;font-weight:800">₪${parseFloat(latest).toFixed(2)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>

      <!-- Invoice History -->
      <div class="section-title mb-8">היסטוריית חשבוניות</div>
      <div class="card mb-12">
        ${(invoices||[]).map(inv => `
          <div class="list-row">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700">${formatDate(inv.date)}</div>
              <div style="font-size:11px;color:var(--on-surface-3)">${inv.invoice_number||''}</div>
            </div>
            <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${parseFloat(inv.total_amount||0).toLocaleString('he-IL',{maximumFractionDigits:0})}</div>
          </div>
        `).join('') || '<div class="empty-state"><div class="empty-state-title">אין חשבוניות</div></div>'}
      </div>

      <!-- Service Areas -->
      <div class="section-title mb-8">אזורי שירות</div>
      <div class="card card-pad mb-12">
        <div id="service-areas-chips"></div>
        <div style="display:flex;gap:8px;margin-top:10px">
          <input class="input" id="new-area-input" type="text" placeholder="הוסף עיר / אזור..." style="flex:1" onkeydown="if(event.key==='Enter')addArea()">
          <button onclick="addArea()" class="btn-primary" style="padding:0 18px;flex-shrink:0">+</button>
        </div>
      </div>

      <!-- Phone -->
      <div class="section-title mb-8">פרטי קשר</div>
      <div class="card card-pad mb-12" style="display:flex;gap:8px;align-items:center">
        <input class="input" id="sup-phone-input" type="tel" placeholder="טלפון ספק" value="${escHtml(sup.phone || '')}" style="flex:1">
        <button onclick="saveSupplierPhone()" class="btn-primary" style="padding:0 18px;flex-shrink:0">שמור</button>
        ${sup.phone ? `<a href="https://wa.me/972${formatWANumber(sup.phone)}" target="_blank" style="display:flex;align-items:center;justify-content:center;width:42px;height:42px;background:#25D366;border-radius:var(--radius-md);flex-shrink:0"><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>` : ''}
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
