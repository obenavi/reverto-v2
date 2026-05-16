// ── Reverto DB Layer ──────────────────────────────────────────

const DB = {
  _headers() {
    const jwt = sessionStorage.getItem('rv_jwt');
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
