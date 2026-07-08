// ── Admin Panel ───────────────────────────────────────────────

let adminTab = 'kpis';

function isAdmin() {
  try {
    const jwt = Auth.jwt;
    if (!jwt) return false;
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !!payload.is_admin;
  } catch { return false; }
}

async function adminCall(action, extra = {}) {
  const res = await fetch('/.netlify/functions/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.jwt },
    body: JSON.stringify({ action, ...extra })
  });
  return res.json();
}

async function initAdmin() {
  if (!isAdmin()) {
    document.getElementById('page-admin').innerHTML = `<div class="page-content"><div class="empty-state"><div class="empty-state-title">גישה אסורה</div></div></div>`;
    return;
  }
  renderAdminTabs();
  loadAdminTab('kpis');
}

function renderAdminTabs() {
  const tabs = [
    { id: 'kpis', label: 'KPIs' },
    { id: 'users', label: 'לקוחות' },
    { id: 'codes', label: 'קודים' },
    { id: 'prices', label: 'מחירי שוק' },
    { id: 'marketing', label: 'שיווק' }
  ];
  document.getElementById('admin-tabs').innerHTML = tabs.map(t => `
    <button onclick="loadAdminTab('${t.id}')" id="atab-${t.id}"
      style="padding:8px 16px;border-radius:20px;border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.15s;background:${adminTab === t.id ? 'var(--primary)' : 'var(--surface-low)'};color:${adminTab === t.id ? 'white' : 'var(--on-surface-2)'}">
      ${t.label}
    </button>
  `).join('');
}

async function loadAdminTab(tab) {
  adminTab = tab;
  renderAdminTabs();
  const body = document.getElementById('admin-body');
  body.innerHTML = `<div style="text-align:center;padding:40px;color:var(--on-surface-3)">טוען...</div>`;

  if (tab === 'kpis') await renderKPIs(body);
  if (tab === 'users') await renderUsers(body);
  if (tab === 'codes') await renderCodes(body);
  if (tab === 'prices') renderPricesUpload(body);
  if (tab === 'marketing') await renderMarketing(body);
}

const SEGMENT_LABELS = {
  all: 'כל המשתמשים הפעילים',
  pro: 'לקוחות PRO',
  free: 'לקוחות חינמיים',
  zero_invoices: 'לא סרקו אף חשבונית (הפעלה)',
  inactive_14d: 'לא סרקו מעל 14 יום (סיכון נטישה)',
  active_scanners: 'סורקים פעילים (14 יום אחרונים)'
};

const CAMPAIGN_STATUS_LABELS = { draft: 'טיוטה', scheduled: 'מתוזמן', sending: 'נשלח כעת', sent: 'נשלח', failed: 'נכשל' };
const CAMPAIGN_STATUS_COLORS = { draft: 'var(--on-surface-3)', scheduled: 'var(--warning)', sending: 'var(--warning)', sent: 'var(--success)', failed: 'var(--error)' };

async function renderMarketing(body) {
  const [counts, campaigns] = await Promise.all([
    adminCall('campaign_segment_counts'),
    adminCall('campaign_list')
  ]);

  body.innerHTML = `
    <div class="card card-pad mb-12">
      <div style="font-size:14px;font-weight:800;margin-bottom:12px">קמפיין חדש</div>
      <input class="input mb-8" id="camp-title" type="text" placeholder="כותרת פנימית (למעקב)">
      <input class="input mb-8" id="camp-subject" type="text" placeholder="נושא המייל (ריק = הכותרת הפנימית)">
      <textarea class="input mb-8" id="camp-body" rows="6" placeholder="תוכן ההודעה... (שורה ריקה = פסקה חדשה)" style="resize:vertical;font-family:inherit;width:100%"></textarea>

      <div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--on-surface-2)">קהל יעד</div>
      <select class="input mb-8" id="camp-segment">
        ${Object.entries(SEGMENT_LABELS).map(([id, label]) => `<option value="${id}">${label} (${counts?.[id] ?? 0})</option>`).join('')}
      </select>

      <div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--on-surface-2)">ערוץ</div>
      <select class="input mb-8" id="camp-channel">
        <option value="email">מייל</option>
        <option value="whatsapp" disabled>WhatsApp (יופעל בהמשך)</option>
      </select>

      <div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--on-surface-2)">תזמון (אופציונלי — ריק = שליחה מיידית)</div>
      <input class="input mb-8" id="camp-schedule" type="datetime-local">

      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="sendCampaignTest()" class="btn-ghost" style="flex:1;min-width:120px">שלח בדיקה לעצמי</button>
        <button onclick="createCampaign(false)" class="btn-ghost" style="flex:1;min-width:120px">שמור כטיוטה</button>
        <button onclick="createCampaign(true)" class="btn-primary" style="flex:1;min-width:120px">שלח / תזמן</button>
      </div>
      <div id="camp-result" style="display:none;margin-top:10px;font-size:13px;font-weight:700"></div>
    </div>

    <div style="font-size:14px;font-weight:800;margin:16px 0 8px">היסטוריית קמפיינים</div>
    <div class="card">
      ${(campaigns || []).length ? campaigns.map(c => `
        <div class="list-row">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700">${c.title}</div>
            <div style="font-size:11px;color:var(--on-surface-3)">${SEGMENT_LABELS[c.target_segment] || c.target_segment} · ${(c.created_at || '').slice(0,16).replace('T',' ')}</div>
            ${c.status === 'sent' || c.status === 'failed' ? `<div style="font-size:11px;color:var(--on-surface-3)">נשלח: ${c.stats.sent} · נכשל: ${c.stats.failed}</div>` : ''}
          </div>
          <div style="font-size:11px;font-weight:700;color:${CAMPAIGN_STATUS_COLORS[c.status] || 'var(--on-surface-3)'}">${CAMPAIGN_STATUS_LABELS[c.status] || c.status}</div>
        </div>
      `).join('') : '<div class="card-pad"><div style="color:var(--on-surface-3);font-size:13px">אין קמפיינים עדיין</div></div>'}
    </div>
  `;
}

async function sendCampaignTest() {
  const subject = document.getElementById('camp-subject')?.value.trim();
  const bodyText = document.getElementById('camp-body')?.value.trim();
  if (!bodyText) { showToast('כתוב תוכן קודם'); return; }
  const res = await adminCall('campaign_send_test', { subject, body: bodyText });
  const result = document.getElementById('camp-result');
  if (result) {
    result.style.display = 'block';
    result.textContent = res.sent ? 'נשלחה בדיקה למייל שלך' : 'שליחת הבדיקה נכשלה';
    result.style.color = res.sent ? 'var(--success)' : 'var(--error)';
  }
}

async function createCampaign(dispatch) {
  const title = document.getElementById('camp-title')?.value.trim();
  const subject = document.getElementById('camp-subject')?.value.trim();
  const bodyText = document.getElementById('camp-body')?.value.trim();
  const target_segment = document.getElementById('camp-segment')?.value;
  const channel = document.getElementById('camp-channel')?.value;
  const scheduleVal = document.getElementById('camp-schedule')?.value;

  if (!title || !bodyText) { showToast('חסר כותרת או תוכן'); return; }

  const payload = { title, subject, body: bodyText, channel, target_segment };
  if (dispatch) {
    if (scheduleVal) payload.scheduled_at = new Date(scheduleVal).toISOString();
    else payload.send_now = true;
  }

  const res = await adminCall('campaign_create', payload);
  if (res.error) { showToast(res.error); return; }
  showToast(dispatch ? (scheduleVal ? 'הקמפיין תוזמן' : 'הקמפיין נשלח') : 'נשמר כטיוטה');
  loadAdminTab('marketing');
}

async function renderKPIs(body) {
  const data = await adminCall('kpis');
  body.innerHTML = `
    <div class="stat-grid mb-12">
      <div class="stat-card"><div class="stat-label">משתמשים</div><div class="stat-value">${data.total_users}</div><div class="stat-sub">${data.new_this_month} החודש</div></div>
      <div class="stat-card"><div class="stat-label">PRO פעיל</div><div class="stat-value text-success">${data.pro_users}</div><div class="stat-sub">${data.free_users} חינמי</div></div>
    </div>
    <div class="stat-grid mb-12">
      <div class="stat-card"><div class="stat-label">חשבוניות</div><div class="stat-value">${data.total_invoices}</div><div class="stat-sub">סה"כ נסרקו</div></div>
      <div class="stat-card"><div class="stat-label">שווי רכש</div><div class="stat-value">₪${(data.total_invoice_value || 0).toLocaleString('he-IL', {maximumFractionDigits:0})}</div><div class="stat-sub">מכל החשבוניות</div></div>
    </div>
    <div class="stat-grid mb-12">
      <div class="stat-card"><div class="stat-label">השלימו הרשמה</div><div class="stat-value">${data.onboarded}</div><div class="stat-sub">מתוך ${data.total_users}</div></div>
      <div class="stat-card"><div class="stat-label">מחזור שהוזן</div><div class="stat-value">₪${(data.total_revenue_entered || 0).toLocaleString('he-IL', {maximumFractionDigits:0})}</div><div class="stat-sub">כולל כל הלקוחות</div></div>
    </div>
  `;
}

async function renderUsers(body) {
  const users = await adminCall('users');
  if (!users?.length) { body.innerHTML = `<div class="empty-state"><div class="empty-state-title">אין משתמשים</div></div>`; return; }

  const now = new Date();
  body.innerHTML = `
    <div style="margin-bottom:12px;display:flex;gap:8px;justify-content:flex-end">
      <button onclick="exportUsers()" class="btn-ghost" style="font-size:12px;padding:6px 14px">ייצוא CSV</button>
    </div>
    <div class="card">
      ${users.map(u => {
        const isPro = u.plan === 'pro' && u.pro_until && new Date(u.pro_until) > now;
        const proLabel = isPro
          ? (new Date(u.pro_until) > new Date('2090-01-01') ? 'PILOT' : 'PRO עד ' + u.pro_until?.slice(0,10))
          : 'חינמי';
        return `
          <div class="list-row" style="${u.is_active === false ? 'opacity:0.5' : ''}">
            <div class="list-avatar" style="background:${isPro ? 'linear-gradient(135deg,#FFD700,#FFA500)' : 'var(--surface-low)'}">
              ${(u.business_name || '?')[0]}
            </div>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${u.business_name || '—'}</div>
              <div style="font-size:11px;color:var(--on-surface-3)">${u.city || ''} · ${u.category || ''} · ${u.invoice_count} חשבוניות</div>
              <div style="font-size:11px;color:var(--on-surface-3)">${u.personal_code || ''} · ${u.email || ''}</div>
              <div style="font-size:10px;margin-top:2px;color:${u.gmail_consent ? 'var(--success)' : 'var(--on-surface-3)'};font-weight:${u.gmail_consent ? '700' : '400'}">
                ${u.gmail_consent ? '✓ אישר חיבור Gmail' : 'לא אישר Gmail'}
              </div>
              <div style="font-size:10px;margin-top:2px;color:${u.welcome_email_sent_at ? 'var(--success)' : 'var(--warning)'};font-weight:${u.welcome_email_sent_at ? '700' : '400'}">
                ${u.welcome_email_sent_at ? '✓ נשלח מייל ברוכים הבאים' : '⚠ מייל ברוכים הבאים לא נשלח'}
              </div>
            </div>
            <div style="text-align:left;flex-shrink:0">
              <div style="font-size:11px;font-weight:700;color:${isPro ? 'var(--success)' : 'var(--on-surface-3)'}">${proLabel}</div>
              <button onclick="toggleUser('${u.id}', ${!u.is_active})"
                style="font-size:10px;border:none;background:none;cursor:pointer;color:${u.is_active === false ? 'var(--success)' : 'var(--error)'};font-weight:700;font-family:inherit;padding:2px 0">
                ${u.is_active === false ? 'הפעל' : 'השהה'}
              </button>
            </div>
          </div>`;
      }).join('')}
    </div>
  `;
}

async function renderCodes(body) {
  const codes = await adminCall('codes');
  body.innerHTML = `
    <!-- Create new code -->
    <div class="card card-pad mb-12">
      <div style="font-size:14px;font-weight:800;margin-bottom:12px">קוד גישה חדש</div>
      <div style="display:flex;gap:8px;margin-bottom:8px">
        <input class="input" id="new-code-val" type="text" placeholder="REVERTO12" style="flex:1;text-transform:uppercase" oninput="this.value=this.value.toUpperCase()">
        <input class="input" id="new-code-months" type="number" min="1" max="24" placeholder="חודשים" style="width:90px">
      </div>
      <button onclick="createCode()" class="btn-primary" style="width:100%">צור קוד</button>
    </div>

    <!-- Existing codes -->
    <div class="card">
      ${(codes || []).map(c => `
        <div class="list-row" style="${!c.is_active ? 'opacity:0.45' : ''}">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:800;letter-spacing:1px">${c.code}</div>
            <div style="font-size:11px;color:var(--on-surface-3)">${c.type} · ${c.duration_months || 0} חודשים · ${c.created_at?.slice(0,10)}</div>
          </div>
          ${c.type !== 'personal' ? `
            <button onclick="toggleCode('${c.code}', ${!c.is_active})"
              style="font-size:12px;font-weight:700;border:none;background:none;cursor:pointer;color:${c.is_active ? 'var(--error)' : 'var(--success)'};font-family:inherit">
              ${c.is_active ? 'בטל' : 'הפעל'}
            </button>` : ''}
        </div>
      `).join('') || '<div class="card-pad"><div style="color:var(--on-surface-3);font-size:13px">אין קודים</div></div>'}
    </div>
  `;
}

function renderPricesUpload(body) {
  body.innerHTML = `
    <div class="card card-pad mb-12">
      <div style="font-size:14px;font-weight:800;margin-bottom:8px">העלאת מחירי שוק מ-CSV</div>
      <div style="font-size:12px;color:var(--on-surface-3);margin-bottom:12px;line-height:1.6">
        פורמט קובץ: שלוש עמודות — <strong>שם,מחיר,יחידה</strong><br>
        דוגמה: <code style="background:var(--surface-low);padding:2px 6px;border-radius:4px">עגבניות,8.50,ק"ג</code><br>
        שורה ראשונה יכולה להיות כותרת (תידלג אוטומטית)
      </div>
      <input type="file" id="csv-file" accept=".csv,.txt" style="display:none" onchange="handleCSVUpload(this)">
      <button onclick="document.getElementById('csv-file').click()" class="btn-primary mb-8">בחר קובץ CSV</button>
      <div id="csv-preview" style="display:none">
        <div id="csv-preview-text" style="font-size:12px;color:var(--on-surface-3);margin-bottom:8px"></div>
        <button onclick="uploadPrices()" class="btn-primary">העלה מחירים</button>
      </div>
      <div id="csv-result" style="display:none;margin-top:12px;font-size:13px;font-weight:700;color:var(--success)"></div>
    </div>
  `;
}

let parsedPrices = [];

function handleCSVUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const lines = e.target.result.split('\n').map(l => l.trim()).filter(l => l);
    parsedPrices = [];
    let skipped = 0;
    lines.forEach((line, i) => {
      const parts = line.split(',').map(p => p.trim().replace(/^"|"$/g, ''));
      if (parts.length < 2) { skipped++; return; }
      const name = parts[0];
      const price = parseFloat(parts[1]);
      const unit = parts[2] || 'ק"ג';
      if (!name || isNaN(price) || price <= 0) { skipped++; return; }
      parsedPrices.push({ name, price, unit });
    });
    const preview = document.getElementById('csv-preview');
    const previewText = document.getElementById('csv-preview-text');
    if (parsedPrices.length) {
      previewText.textContent = `נמצאו ${parsedPrices.length} מוצרים${skipped ? ` (${skipped} שורות דולגו)` : ''}`;
      preview.style.display = 'block';
    } else {
      previewText.textContent = 'לא נמצאו שורות תקינות בקובץ';
      preview.style.display = 'block';
    }
  };
  reader.readAsText(file, 'UTF-8');
}

async function uploadPrices() {
  if (!parsedPrices.length) return;
  const btn = document.querySelector('#admin-body .btn-primary:last-of-type');
  if (btn) { btn.textContent = 'מעלה...'; btn.disabled = true; }

  const res = await fetch('/.netlify/functions/upload-market-prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.jwt },
    body: JSON.stringify({ prices: parsedPrices })
  });
  const data = await res.json();
  const result = document.getElementById('csv-result');
  if (result) {
    result.style.display = 'block';
    result.textContent = res.ok ? `✓ הועלו ${data.uploaded} מחירים בהצלחה` : `שגיאה: ${data.error}`;
    result.style.color = res.ok ? 'var(--success)' : 'var(--error)';
  }
  if (btn) { btn.textContent = 'העלה מחירים'; btn.disabled = false; }
  parsedPrices = [];
}

async function createCode() {
  const code = document.getElementById('new-code-val')?.value.trim().toUpperCase();
  const months = parseInt(document.getElementById('new-code-months')?.value);
  if (!code || !months) return;
  await adminCall('create_code', { code, duration_months: months });
  showToast('קוד נוצר');
  loadAdminTab('codes');
}

async function toggleCode(code, is_active) {
  await adminCall('toggle_code', { code, is_active });
  loadAdminTab('codes');
}

async function toggleUser(user_id, is_active) {
  await adminCall('toggle_user', { user_id, is_active });
  loadAdminTab('users');
}

async function exportUsers() {
  const res = await fetch('/.netlify/functions/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.jwt },
    body: JSON.stringify({ action: 'export_users' })
  });
  const csv = await res.text();
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'reverto-users.csv'; a.click();
  URL.revokeObjectURL(url);
}
