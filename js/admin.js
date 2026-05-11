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
    { id: 'codes', label: 'קודים' }
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
              <div style="font-size:11px;color:var(--on-surface-3)">${u.personal_code || ''}</div>
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
