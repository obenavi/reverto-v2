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
    window.location.href = '/';
    return;
  }

  // Check onboarding
  if (!profile.onboarding_done) {
    window.location.href = '/onboarding.html';
    return;
  }

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
        <a href="https://wa.me/972XXXXXXXXX?text=שלום%20Reverto" target="_blank" style="display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--border);text-decoration:none;color:var(--on-surface)">
          <div style="width:40px;height:40px;background:#25D366;border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </div>
          <div><div style="font-size:15px;font-weight:700">צור קשר</div><div style="font-size:12px;color:var(--on-surface-3)">שלח לנו WhatsApp</div></div>
        </a>
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

function showVision() {
  document.querySelector('[data-info-modal]')?.remove();
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;padding:28px">
      <div style="font-size:20px;font-weight:800;margin-bottom:16px">החזון שלנו</div>
      <div style="font-size:14px;line-height:1.8;color:var(--on-surface-2)">
        Reverto נולדה מתוך הבנה שבעלי מסעדות ועסקי מזון מנהלים את הרכש שלהם בצורה עיוורת.<br><br>
        אנחנו בונים את כלי הניהול החכם הראשון שמאפשר לכל עסק לראות בדיוק כמה הוא משלם, איפה הוא חורג, ומה השוק עושה — בלי לחשוף את עצמו.<br><br>
        בעתיד: שוק ספקים תחרותי שבו הספקים מתחרים על ההזמנה שלך — לא להיפך.
      </div>
      <button onclick="this.closest('[data-vision-modal]').remove()" class="btn-primary" style="margin-top:20px;width:100%">הבנתי</button>
    </div>
  `;
  modal.setAttribute('data-vision-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function shareInvite() {
  const text = 'גילית אפליקציה שמנהלת את הרכש של המסעדה שלי — Reverto. שווה לנסות!';
  if (navigator.share) {
    navigator.share({ title: 'Reverto', text, url: window.location.origin }).catch(() => {});
  } else {
    const msg = encodeURIComponent(text + ' ' + window.location.origin);
    window.open('https://wa.me/?text=' + msg, '_blank');
  }
}

function showPayment() {
  document.querySelector('[data-info-modal]')?.remove();
  showProModal();
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
