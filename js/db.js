// ── Reverto DB Layer ──────────────────────────────────────────

const DB = {
  _headers() {
    const jwt = _store.get('rv_jwt');
    const h = { 'Content-Type': 'application/json' };
    if (jwt) h['Authorization'] = 'Bearer ' + jwt;
    return h;
  },

  async get(table, filter = '') {
    try {
      const r = await fetch('/.netlify/functions/db-read', {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ table, filter })
      });
      if (!r.ok) return [];
      return await r.json();
    } catch (e) { return []; }
  },

  async insert(table, data) {
    try {
      const r = await fetch('/.netlify/functions/db-write', {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ table, action: 'insert', data })
      });
      if (!r.ok) return null;
      const res = await r.json();
      return Array.isArray(res) ? res[0] : res;
    } catch (e) { return null; }
  },

  async update(table, filter, data) {
    try {
      const r = await fetch('/.netlify/functions/db-write', {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ table, action: 'update', filter, data })
      });
      return r.ok;
    } catch (e) { return false; }
  },

  async delete(table, filter) {
    try {
      const r = await fetch('/.netlify/functions/db-write', {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ table, action: 'delete', filter })
      });
      return r.ok;
    } catch (e) { return false; }
  }
};

// ── Auth State ────────────────────────────────────────────────
const _store = {
  get: (k) => sessionStorage.getItem(k) || localStorage.getItem(k),
  set: (k, v) => { sessionStorage.setItem(k, v); localStorage.setItem(k, v); },
  clear: () => {
    ['rv_token','rv_jwt','rv_user','rv_profile'].forEach(k => {
      sessionStorage.removeItem(k); localStorage.removeItem(k);
    });
  }
};

const Auth = {
  get token() { return _store.get('rv_token'); },
  get jwt() { return _store.get('rv_jwt'); },
  get user() { return JSON.parse(_store.get('rv_user') || '{}'); },
  get profile() { return JSON.parse(_store.get('rv_profile') || '{}'); },
  get userId() { return this.user.id || this.token; },

  async loadProfile() {
    if (!this.jwt) return null;
    const rows = await DB.get('users', '?select=*');
    if (rows && rows[0]) {
      _store.set('rv_profile', JSON.stringify(rows[0]));
      return rows[0];
    }
    return null;
  },

  logout() {
    _store.clear();
    window.location.href = '/';
  }
};

function isManager() {
  try {
    const jwt = _store.get('rv_jwt');
    if (!jwt) return false;
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'manager';
  } catch { return false; }
}

// ── Payment terms ─────────────────────────────────────────────
const PAYMENT_TERMS_LABELS = {
  cash_delivery: 'מזומן בקבלת סחורה',
  order_time:    'תשלום בזמן הזמנה',
  cash_eom:      'מזומן סוף חודש',
  net30: 'שוטף+30', net60: 'שוטף+60', net90: 'שוטף+90'
};

const PAYMENT_TERMS_LIST = [
  { val: 'cash_delivery', label: 'מזומן בקבלת סחורה', color: '#059669' },
  { val: 'order_time',    label: 'תשלום בזמן הזמנה',  color: '#0891B2' },
  { val: 'cash_eom',      label: 'מזומן סוף חודש',    color: '#6B35B8' },
  { val: 'net30',         label: 'שוטף+30',            color: '#7C3AED' },
  { val: 'net60',         label: 'שוטף+60',            color: '#D97706' },
  { val: 'net90',         label: 'שוטף+90',            color: '#DC2626' },
];

function calcDueDate(invoiceDate, terms) {
  const d = new Date((invoiceDate || '').slice(0,10) + 'T00:00:00');
  if (isNaN(d)) return new Date();
  const eom = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const add = (n) => { const r = new Date(eom); r.setDate(r.getDate() + n); return r; };
  switch (terms) {
    case 'cash_delivery': return d;
    case 'cash_eom': return eom;
    case 'net30': return add(30);
    case 'net60': return add(60);
    case 'net90': return add(90);
    default: return add(30);
  }
}

// ── WhatsApp ──────────────────────────────────────────────────
function formatWANumber(phone) {
  const digits = (phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return '972' + digits;
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
