// ── Reverto App Core ──────────────────────────────────────────

let currentPage = 'dashboard';

function navTo(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Show target
  const page = document.getElementById('page-' + pageId);
  if (!page) return;
  page.classList.add('active');
  currentPage = pageId;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = document.getElementById('nav-' + pageId);
  if (navBtn) navBtn.classList.add('active');

  // Page init
  if (pageId === 'dashboard') renderDashboard();
  if (pageId === 'suppliers') renderSuppliersList();
  if (pageId === 'market') renderMarket();
  if (pageId === 'profile') initProfile();
  if (pageId === 'scanner') scannerReset(true);
  if (pageId === 'admin') initAdmin();
  if (pageId === 'product-tree') initProductTree();
}

function logout() {
  if (confirm('לצאת מהמערכת?')) Auth.logout();
}

async function appInit() {
  // Check auth
  if (!Auth.token) {
    window.location.href = '/';
    return;
  }

  // Load profile
  const profile = await Auth.loadProfile();
  if (!profile) {
    Auth.logout(); // clears both sessionStorage and localStorage — breaks redirect loop
    return;
  }

  // Check onboarding
  if (!profile.onboarding_done) {
    window.location.href = '/onboarding.html';
    return;
  }

  // Show active location in top bar
  updateTopBarLocation();

  // Show admin link if admin
  if (isAdmin()) {
    const wrap = document.getElementById('admin-link-wrap');
    if (wrap) wrap.style.display = 'block';
  }

  // Set greeting
  const name = profile.business_name || '';
  document.getElementById('dash-greeting').textContent = 'שלום, ' + name + '!';
  document.getElementById('top-biz-name').textContent = name;
  document.getElementById('prof-biz-name').value = name;

  // Set date
  const now = new Date();
  document.getElementById('dash-date').textContent = now.toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  // Load dashboard
  renderDashboard();
}

function showInfoPanel() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:28px 24px 48px;width:100%;max-width:480px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,var(--primary-dark),var(--primary-light));border-radius:12px;display:flex;align-items:center;justify-content:center">
          <svg width="22" height="22" viewBox="0 0 38 38" fill="none"><path d="M8 10 L19 6 L30 10 L30 22 Q30 30 19 34 Q8 30 8 22 Z" fill="white" opacity="0.9"/><path d="M14 18 L17 21 L24 14" stroke="rgba(107,53,184,0.9)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>
        </div>
        <div>
          <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px">Reverto</div>
          <div style="font-size:12px;color:var(--on-surface-3)">ניהול רכש חכם לעסקי מזון</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:2px">
        <div onclick="showContactForm()" style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <div style="width:40px;height:40px;background:linear-gradient(135deg,#6B35B8,#C084FC);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </div>
          <div><div style="font-size:15px;font-weight:700">צור קשר</div><div style="font-size:12px;color:var(--on-surface-3)">שלח לנו הודעה</div></div>
        </div>
        <div onclick="showVision()" style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <div style="width:40px;height:40px;background:var(--surface-low);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </div>
          <div><div style="font-size:15px;font-weight:700">החזון שלנו</div><div style="font-size:12px;color:var(--on-surface-3)">לאן Reverto הולכת</div></div>
        </div>
        <div onclick="shareInvite()" style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);cursor:pointer">
          <div style="width:40px;height:40px;background:var(--surface-low);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </div>
          <div><div style="font-size:15px;font-weight:700">הזמן חבר</div><div style="font-size:12px;color:var(--on-surface-3)">שתף את Reverto עם עסק אחר</div></div>
        </div>
        <div onclick="showPayment()" style="display:flex;align-items:center;gap:14px;padding:14px 0;cursor:pointer">
          <div style="width:40px;height:40px;background:linear-gradient(135deg,#FFD700,#FFA500);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-5.5 4 2-7L3 9h7z"/></svg>
          </div>
          <div><div style="font-size:15px;font-weight:700">שדרג ל-PRO</div><div style="font-size:12px;color:var(--on-surface-3)">מינוי חודשי · ביטול בכל עת</div></div>
        </div>
      </div>
      <button onclick="this.closest('[data-info-modal]').remove()" style="width:100%;margin-top:16px;background:none;border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--on-surface-2)">סגור</button>
    </div>
  `;
  modal.setAttribute('data-info-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function showContactForm() {
  document.querySelector('[data-info-modal]')?.remove();
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:28px 24px 48px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto">
      <div style="font-size:18px;font-weight:800;margin-bottom:6px">צור קשר</div>
      <div style="font-size:13px;color:var(--on-surface-3);margin-bottom:20px">נחזור אליך בהקדם</div>
      <label class="field-label">שם מלא *</label>
      <input class="input mb-12" id="ct-name" type="text" placeholder="ישראל ישראלי">
      <label class="field-label">שם המסעדה *</label>
      <input class="input mb-12" id="ct-rest" type="text" placeholder="מסעדת הים">
      <label class="field-label">טלפון</label>
      <input class="input mb-12" id="ct-phone" type="tel" placeholder="050-0000000">
      <label class="field-label">מייל *</label>
      <input class="input mb-12" id="ct-email" type="email" placeholder="email@example.com">
      <label class="field-label">הודעה *</label>
      <textarea class="input mb-16" id="ct-msg" rows="4" placeholder="כתוב כאן..." style="resize:none;height:100px"></textarea>
      <div id="ct-sent" style="display:none;color:var(--success);font-weight:700;text-align:center;margin-bottom:12px">ההודעה נשלחה! נחזור אליך בקרוב.</div>
      <button onclick="submitContact()" class="btn-primary mb-8">שלח הודעה</button>
      <button onclick="this.closest('[data-contact-modal]').remove()" class="btn-ghost">ביטול</button>
    </div>
  `;
  modal.setAttribute('data-contact-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function submitContact() {
  const name = document.getElementById('ct-name')?.value.trim();
  const restaurant = document.getElementById('ct-rest')?.value.trim();
  const phone = document.getElementById('ct-phone')?.value.trim();
  const email = document.getElementById('ct-email')?.value.trim();
  const message = document.getElementById('ct-msg')?.value.trim();
  if (!name || !email || !message) { showToast('מלא שם, מייל והודעה'); return; }

  const btn = document.querySelector('[data-contact-modal] .btn-primary');
  if (btn) { btn.textContent = 'שולח...'; btn.disabled = true; }

  await fetch('/.netlify/functions/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, restaurant, phone, email, message })
  });

  const sent = document.getElementById('ct-sent');
  if (sent) sent.style.display = 'block';
  if (btn) { btn.textContent = 'נשלח ✓'; btn.disabled = true; }
}

function showVision() {
  document.querySelector('[data-info-modal]')?.remove();
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;padding:28px">
      <div style="font-size:20px;font-weight:800;margin-bottom:16px">החזון שלנו</div>
      <div style="font-size:14px;line-height:1.9;color:var(--on-surface-2)">
        REVERTO נולדה מתוך ניסיון של מעל 20 שנה בתחום ומתוך רצון לשנות מציאות שבה עסקים בתחום נאבקים יומיום בניהול העסק ולא מצליחים לייצר מערכת נתמכת נתונים שתסייע בקבלת החלטות מקצועית.<br><br>
        אנחנו מאמינים שכולנו חלק מקהילה אחת שיכולה לתמוך ולהיתמך אחד בשנייה — ע"י שיתוף נתונים שמאפשרים לקבל תמונה אמינה של המחירים ועל היכולת להוזילם ע"י חשיפה לשוק ספקים תחרותי שבו הספקים יתחרו על כל הזמנה שלך ולא להפיך.<br><br>
        להבדיל מכל המתחרים המכובדים בשוק — <strong>REVERTO היא היחידה בעולם</strong> שבאה לפזר את מסך הערפל סביב מחירי הסחורות, לבנות בנצ'מארק אמיתי למחירי השוק, ולראשונה לבנות NETWORK חזק של מסעדנים שבעצם הצטרפותם תומכים זה בזה.<br><br>
        REVERTO היא כלי ניהול שמאפשר לכל עסק לראות במקום אחד ומסודר כמה הוא משלם, איפה הוא חורג, מה השוק מתמחר — מבלי לחשוף את עצמו — ולהבין את הפודקוסט שלו עם יכולות הבינה המלאכותית שמאפשרות לבעלי העסקים הקטנים להגיע לתובנות ותוצאות עסקיות כמו של ה"גדולים".
      </div>
      <button onclick="this.closest('[data-vision-modal]').remove()" class="btn-primary" style="margin-top:20px;width:100%">הבנתי</button>
    </div>
  `;
  modal.setAttribute('data-vision-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function shareInvite() {
  const url = 'https://reverto.cloud';
  const text = `גילית אפליקציה שמנהלת את הרכש של המסעדה שלי — Reverto. שווה לנסות!\n${url}\n\n📱 פתח בדפדפן והוסף לדף הבית`;
  if (navigator.share) {
    navigator.share({ title: 'Reverto', text, url }).catch(() => {});
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }
}

function showPayment() {
  document.querySelector('[data-info-modal]')?.remove();
  showProModal();
}

// ── Location helpers ──────────────────────────────────────────
function getActiveLocation() {
  try { return JSON.parse(sessionStorage.getItem('rv_location') || 'null'); } catch { return null; }
}

function setActiveLocation(loc) {
  if (loc) sessionStorage.setItem('rv_location', JSON.stringify(loc));
  else sessionStorage.removeItem('rv_location');
  updateTopBarLocation();
  if (currentPage === 'dashboard') renderDashboard();
}

function updateTopBarLocation() {
  const loc = getActiveLocation();
  const el = document.getElementById('top-location');
  if (!el) return;
  if (loc) { el.textContent = '📍 ' + loc.name; el.style.display = 'block'; }
  else el.style.display = 'none';
}

async function loadLocations() {
  const el = document.getElementById('locations-list');
  const countEl = document.getElementById('location-count');
  if (!el) return;
  const locs = await DB.get('locations', '?select=*&order=created_at.asc&is_active=eq.true');
  const activeLoc = getActiveLocation();
  if (countEl) countEl.textContent = (locs?.length || 0) + ' / 20';
  if (!locs?.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--on-surface-3)">אין סניפים — הנתונים מוצגים עבור כל העסק</div>`;
    return;
  }
  el.innerHTML = `
    <div onclick="setActiveLocation(null)" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--radius-md);cursor:pointer;margin-bottom:4px;background:${!activeLoc ? 'var(--surface-low)' : 'transparent'};border:1.5px solid ${!activeLoc ? 'var(--primary)' : 'var(--border)'}">
      <div style="flex:1;font-size:13px;font-weight:700">כל הסניפים</div>
      ${!activeLoc ? '<div style="font-size:11px;color:var(--primary);font-weight:700">פעיל</div>' : ''}
    </div>
    ${locs.map(l => `
      <div onclick="setActiveLocation({id:'${l.id}',name:'${escHtml(l.name)}'})" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:var(--radius-md);cursor:pointer;margin-bottom:4px;background:${activeLoc?.id===l.id?'var(--surface-low)':'transparent'};border:1.5px solid ${activeLoc?.id===l.id?'var(--primary)':'var(--border)'}">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700">${escHtml(l.name)}</div>
          ${l.city ? `<div style="font-size:11px;color:var(--on-surface-3)">${escHtml(l.city)}</div>` : ''}
        </div>
        ${activeLoc?.id===l.id ? '<div style="font-size:11px;color:var(--primary);font-weight:700">פעיל</div>' : ''}
        <button onclick="event.stopPropagation();deleteLocation('${l.id}')" style="background:none;border:none;color:var(--on-surface-3);cursor:pointer;font-size:16px;padding:0 4px">×</button>
      </div>
    `).join('')}
  `;
}

function showAddLocation() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:28px 24px 48px;width:100%;max-width:480px">
      <div style="font-size:18px;font-weight:800;margin-bottom:20px">סניף חדש</div>
      <label class="field-label">שם הסניף *</label>
      <input class="input mb-12" id="loc-name" type="text" placeholder="סניף תל אביב">
      <label class="field-label">עיר</label>
      <input class="input mb-12" id="loc-city" type="text" placeholder="תל אביב">
      <label class="field-label">כתובת</label>
      <input class="input mb-16" id="loc-address" type="text" placeholder="רחוב הרצל 1">
      <button onclick="saveNewLocation()" class="btn-primary mb-8">הוסף סניף</button>
      <button onclick="this.closest('[data-loc-modal]').remove()" class="btn-ghost">ביטול</button>
    </div>
  `;
  modal.setAttribute('data-loc-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function saveNewLocation() {
  const name = document.getElementById('loc-name')?.value.trim();
  if (!name) return;
  const locs = await DB.get('locations', '?select=id&is_active=eq.true');
  if ((locs?.length || 0) >= 20) { showToast('מקסימום 20 סניפים'); return; }
  const city = document.getElementById('loc-city')?.value.trim();
  const address = document.getElementById('loc-address')?.value.trim();
  await DB.insert('locations', { name, city: city||null, address: address||null });
  document.querySelector('[data-loc-modal]')?.remove();
  showToast('הסניף נוסף');
  loadLocations();
}

async function deleteLocation(id) {
  if (!confirm('למחוק סניף זה?')) return;
  await DB.update('locations', `?id=eq.${id}`, { is_active: false });
  const active = getActiveLocation();
  if (active?.id === id) setActiveLocation(null);
  loadLocations();
}

function escHtml(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// ── Data Export ───────────────────────────────────────────────

function csvEscape(v) {
  const s = (v === null || v === undefined) ? '' : String(v);
  return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g,'""')}"` : s;
}

function downloadCSV(headers, rows, filename) {
  const csv = '﻿' + [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function exportData(type, btn) {
  const orig = btn?.textContent;
  if (btn) { btn.textContent = 'מייצא...'; btn.disabled = true; }
  try {
    if (type === 'all') {
      await exportData('invoices'); await exportData('items');
      await exportData('suppliers'); await exportData('revenues');
      await exportData('products'); await exportData('recipes');
      return;
    }
    if (type === 'invoices') {
      const d = await DB.get('invoices', '?select=*&order=date.desc') || [];
      downloadCSV(['תאריך','ספק','מספר חשבונית','סה"כ (₪)','זיכוי'],
        d.map(r => [r.date, r.supplier_name, r.invoice_number, r.total_amount||r.total, r.is_credit_note?'כן':'לא']),
        'reverto-invoices.csv');
    }
    if (type === 'items') {
      const d = await DB.get('invoice_items', '?select=*&order=date.desc') || [];
      downloadCSV(['תאריך','ספק','מוצר','כמות','יחידה','מחיר יחידה','סה"כ'],
        d.map(r => [r.date, r.supplier_name, r.product_name, r.quantity, r.unit, r.unit_price, r.total_price]),
        'reverto-invoice-items.csv');
    }
    if (type === 'suppliers') {
      const d = await DB.get('suppliers', '?select=*&order=name.asc') || [];
      downloadCSV(['שם ספק','טלפון','מייל','כתובת','עוסק מורשה','סה"כ רכש','חשבוניות','ספקה אחרונה'],
        d.map(r => [r.name, r.phone, r.email, r.address, r.tax_id, r.total_amount, r.invoice_count, r.last_invoice_date]),
        'reverto-suppliers.csv');
    }
    if (type === 'revenues') {
      const d = await DB.get('daily_revenues', '?select=*&order=date.desc') || [];
      downloadCSV(['תאריך','מחזור (₪)'],
        d.map(r => [r.date, r.amount]),
        'reverto-revenues.csv');
    }
    if (type === 'products') {
      const d = await DB.get('product_catalog', '?select=*&order=name.asc') || [];
      downloadCSV(['מוצר','יחידה','מחיר (₪)','פחת %','קטגוריה','עדכון אחרון'],
        d.map(r => [r.name, r.unit, r.price_per_unit, r.waste_pct, r.category, r.price_updated_at?.slice(0,10)]),
        'reverto-products.csv');
    }
    if (type === 'recipes') {
      const recipes = await DB.get('recipes', '?select=*&order=name.asc') || [];
      const ings = await DB.get('recipe_ingredients', '?select=*') || [];
      const rows = [];
      recipes.forEach(r => {
        const ri = ings.filter(i => i.recipe_id === r.id);
        if (!ri.length) { rows.push([r.name, r.category, r.menu_price, r.target_fc_pct, '', '', '']); }
        else ri.forEach(i => rows.push([r.name, r.category, r.menu_price, r.target_fc_pct, i.product_name, i.quantity, i.unit]));
      });
      downloadCSV(['מנה','קטגוריה','מחיר תפריט','FC% יעד','רכיב','כמות','יחידה'], rows, 'reverto-recipes.csv');
    }
    showToast('הקובץ הורד ✓');
  } catch { showToast('שגיאה בייצוא'); }
  finally { if (btn) { btn.textContent = orig; btn.disabled = false; } }
}

function initProfile() {
  const profile = Auth.profile;
  const nameEl = document.getElementById('prof-biz-name');
  if (nameEl) nameEl.value = profile.business_name || '';
  loadLocations();
  loadPartnerCodes();
}

async function loadPartnerCodes() {
  const el = document.getElementById('partner-codes-list');
  if (!el) return;
  const codes = await DB.get('access_codes', '?type=eq.partner&select=code,is_active,created_at&order=created_at.desc');
  if (!codes?.length) {
    el.innerHTML = `<div style="font-size:12px;color:var(--on-surface-3)">אין קודי שותף עדיין</div>`;
    return;
  }
  el.innerHTML = codes.map(c => `
    <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;font-size:14px;font-weight:800;letter-spacing:2px;color:var(--primary)">${c.code}</div>
      <button onclick="navigator.clipboard.writeText('${c.code}').then(()=>showToast('הועתק!'))" style="background:none;border:1px solid var(--border);border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">העתק</button>
    </div>
  `).join('');
}

async function generatePartnerCode() {
  const btns = document.querySelectorAll('#page-profile button');
  const genBtn = Array.from(btns).find(b => b.textContent.includes('קוד שותף'));
  if (genBtn) { genBtn.textContent = 'יוצר...'; genBtn.disabled = true; }

  const res = await fetch('/.netlify/functions/add-partner', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.jwt }
  });
  const data = await res.json();
  if (genBtn) { genBtn.textContent = '+ צור קוד שותף חדש'; genBtn.disabled = false; }
  if (data.code) {
    showToast('קוד שותף נוצר: ' + data.code);
    loadPartnerCodes();
  }
}

async function saveProfile() {
  const name = document.getElementById('prof-biz-name').value.trim();
  if (!name) return;
  const btn = document.querySelector('#page-profile .btn-primary');
  btn.textContent = 'שומר...';
  btn.disabled = true;
  await DB.update('users', '', { business_name: name });
  document.getElementById('top-biz-name').textContent = name;
  document.getElementById('dash-greeting').textContent = 'שלום, ' + name + '!';
  showToast('הפרופיל עודכן');
  btn.textContent = 'שמור שינויים';
  btn.disabled = false;
}

// Start
appInit();
