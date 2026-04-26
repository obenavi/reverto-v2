// ── Reverto DB Layer ──────────────────────────────────────────
const SUPABASE_URL = 'https://kykfrkoisbcjmipermxy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt5a2Zya29pc2Jjam1pcGVybXh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0NTY4NTcsImV4cCI6MjA5MTAzMjg1N30.bJgulvCBjpAHRy1yTKKHE_N9K3el2YFvaXakiWYCdWs';

const DB = {
  _headers(extra={}) {
    return {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...extra
    };
  },

  async get(table, filter='') {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filter}`, {
        headers: this._headers()
      });
      if (!r.ok) return [];
      return await r.json();
    } catch(e) { return []; }
  },

  async insert(table, data) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: this._headers({'Prefer': 'return=representation'}),
        body: JSON.stringify(data)
      });
      if (!r.ok) return null;
      const res = await r.json();
      return Array.isArray(res) ? res[0] : res;
    } catch(e) { return null; }
  },

  async update(table, filter, data) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filter}`, {
        method: 'PATCH',
        headers: this._headers({'Prefer': 'return=minimal'}),
        body: JSON.stringify(data)
      });
      return r.ok;
    } catch(e) { return false; }
  },

  async delete(table, filter) {
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}${filter}`, {
        method: 'DELETE',
        headers: this._headers()
      });
      return r.ok;
    } catch(e) { return false; }
  }
};

// ── Auth State ────────────────────────────────────────────────
const Auth = {
  get token() { return sessionStorage.getItem('rv_token'); },
  get user() { return JSON.parse(sessionStorage.getItem('rv_user') || '{}'); },
  get profile() { return JSON.parse(sessionStorage.getItem('rv_profile') || '{}'); },
  get userId() { return this.user.id || this.token; },

  async loadProfile() {
    if (!this.token) return null;
    const rows = await DB.get('users', `?id=eq.${encodeURIComponent(this.userId)}&select=*`);
    if (rows && rows[0]) {
      sessionStorage.setItem('rv_profile', JSON.stringify(rows[0]));
      return rows[0];
    }
    return null;
  },

  logout() {
    sessionStorage.clear();
    window.location.href = '/';
  }
};

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, duration=2500) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}
