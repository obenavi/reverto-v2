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

function applyManagerRestrictions() {
  // Revenue card → "הוסף Z יומי" (no history, no totals)
  const rc = document.getElementById('dash-revenue-card');
  if (rc) {
    rc.setAttribute('onclick', 'openRevenueModal()');
    const lbl = rc.querySelector('.stat-label');
    if (lbl) lbl.textContent = 'הוסף Z יומי';
  }
  // Hide payments card and forecast
  const pc = document.getElementById('dash-payments-card');
  if (pc) pc.style.display = 'none';
  // openRevenueHistory → goes straight to add modal
  window.openRevenueHistory = () => openRevenueModal();
  // Block payment forecast
  window.showPaymentForecast = () => {};
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

  // Apply manager restrictions before first render
  if (isManager()) applyManagerRestrictions();

  // Set greeting
  const name = profile.business_name || '';
  document.getElementById('dash-greeting').textContent = 'שלום, ' + name + '!';
  document.getElementById('top-biz-name').textContent = name;

  // Set date
  const now = new Date();
  document.getElementById('dash-date').textContent = now.toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long'
  });

  // Load dashboard
  renderDashboard();

  // Onboarding — role-specific for partner/manager, full tour for owner
  if (isManager() || isPartner()) {
    if (!localStorage.getItem('rv_role_welcome_done')) setTimeout(() => showRoleWelcome(), 700);
  } else {
    if (!localStorage.getItem('rv_welcome_done')) setTimeout(showWelcomeTour, 700);
  }
}

function showWelcomeTour() {
  const steps = [
    {
      icon: '🎉',
      title: 'ברוכ/ה הבא/ה ל-Reverto!',
      body: 'ביחד אנחנו בונים קהילה של אנשי מזון שעוזרים אחד לשני לקנות חכם ולנהל חכם את העסק.',
      color: '#4A1F85'
    },
    {
      icon: '📄',
      title: 'הכל מתחיל בסריקה',
      body: 'ככל שתסרוק יותר חשבוניות — תקבל נתונים חכמים יותר על עלויות ומגמות.\nבנוסף, אתה תורם באופן אנונימי לשוק הקהילתי שעוזר לכולם לדעת מה מחיר הוגן.',
      color: '#6B35B8'
    },
    {
      icon: '📊',
      title: 'הדאשבורד שלך',
      body: 'כאן תראה את מחזור ה-Z החודשי, אחוז הפודקוסט, תשלומים צפויים וחשבוניות שממתינות לאישור קבלה.',
      color: '#0891B2'
    },
    {
      icon: '🛒',
      title: 'ספקים ומחירים',
      body: 'רשימת כל הספקים שלך עם ההיסטוריה המלאה.\nמכאן תוכל/י גם לשלוח הזמנה ישירות לספק בוואטסאפ.',
      color: '#059669'
    },
    {
      icon: '🏪',
      title: 'השוק',
      body: 'מחירון קהילתי שמצרף נתונים אנונימיים מכל המשתמשים.\nבנוסף — מחירי ירקות ופירות אוטומטיים מהשוק הסיטונאי, כדי שתדע אם הספק שלך בהסכם.',
      color: '#D97706'
    },
    {
      icon: '👤',
      title: 'פרופיל וReverto',
      body: 'בפרופיל — פרטי עסק, סניפים, קוד לשותף, גישה מוגבלת למנהל ויצוא נתונים לרו"ח.\nבכפתור Reverto — צור קשר, הזמן חבר ושדרג לPRO.',
      color: '#4A1F85'
    }
  ];

  let current = 0;

  const overlay = document.createElement('div');
  overlay.id = 'welcome-tour';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(30,10,60,0.82);z-index:99999;display:flex;align-items:flex-end;justify-content:center';

  const done = () => { overlay.remove(); localStorage.setItem('rv_welcome_done', '1'); setTimeout(requestPushIfConfigured, 800); };

  const render = () => {
    const s = steps[current];
    const isLast = current === steps.length - 1;
    const dots = steps.map((_, i) =>
      `<div style="width:${i === current ? '22px' : '8px'};height:8px;border-radius:4px;background:${i === current ? s.color : '#e0d7f5'};transition:all 0.3s"></div>`
    ).join('');

    overlay.innerHTML = `
      <div style="background:white;border-radius:28px 28px 0 0;width:100%;max-width:480px;padding:32px 28px 52px;position:relative">
        <button onclick="document.getElementById('welcome-tour')._done()"
          style="position:absolute;top:18px;left:20px;background:none;border:none;font-size:13px;color:#bbb;cursor:pointer;font-family:inherit;padding:4px 8px">דלג</button>
        <div style="font-size:11px;color:#bbb;position:absolute;top:22px;right:24px">${current + 1} / ${steps.length}</div>

        <div style="display:flex;justify-content:center;gap:5px;margin-bottom:28px">${dots}</div>

        <div style="text-align:center">
          <div style="font-size:58px;margin-bottom:14px;line-height:1">${s.icon}</div>
          <div style="font-size:21px;font-weight:800;color:${s.color};margin-bottom:14px;line-height:1.3">${s.title}</div>
          <div style="font-size:15px;color:#444;line-height:1.75;white-space:pre-line">${s.body}</div>
        </div>

        <div style="display:flex;gap:10px;margin-top:32px">
          ${current > 0 ? `<button onclick="document.getElementById('welcome-tour')._prev()"
            style="padding:14px 18px;border:1.5px solid #e5e0ef;border-radius:14px;background:white;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;color:#888">←</button>` : ''}
          <button onclick="document.getElementById('welcome-tour')._next()"
            style="flex:1;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#4A1F85,#9B6DD6);color:white;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;letter-spacing:0.3px">
            ${isLast ? 'יאללה, מתחילים! 🚀' : 'הבא ←'}
          </button>
        </div>
      </div>`;

    overlay._next = () => { if (current < steps.length - 1) { current++; render(); } else done(); };
    overlay._prev = () => { if (current > 0) { current--; render(); } };
    overlay._done = done;
  };

  render();
  document.body.appendChild(overlay);
}

function showRoleWelcome() {
  const manager = isManager();
  const bizName = Auth.profile.business_name || '';

  const infoStep = {
    _isForm: true,
    icon: manager ? '🪪' : '🤝',
    title: manager ? 'קצת עלייך, מנהל/ת' : 'קצת עלייך, שותף/ה',
    color: '#4A1F85'
  };

  const roleSteps = manager ? [
    {
      icon: '👋',
      title: `ברוכ/ה הבא/ה כמנהל${bizName ? ' של ' + bizName : ''}!`,
      body: 'נכנסת למערכת Reverto עם הרשאות מנהל.\nבוא נעבור על מה שפתוח לך.',
      color: '#4A1F85'
    },
    {
      icon: '✅',
      title: 'מה פתוח לך',
      body: '📄 סריקת חשבוניות\n🛒 ספקים ומחירים\n🏪 השוק\n🌳 עץ מוצר\n📊 הוספת Z יומי וצפייה בפודקוסט',
      color: '#059669'
    },
    {
      icon: '🔒',
      title: 'מה שמור לבעלים',
      body: 'היסטוריית מחזור כוללת ותשלומים לספקים נגישים לבעל/ת העסק בלבד.',
      color: '#D97706'
    }
  ] : [
    {
      icon: '🤝',
      title: `ברוכ/ה הבא/ה כשותף${bizName ? ' של ' + bizName : ''}!`,
      body: 'נכנסת למערכת Reverto עם גישה מלאה לחשבון.\nבוא נעבור על הדברים בקצרה.',
      color: '#4A1F85'
    },
    {
      icon: '📄',
      title: 'הכל מתחיל בסריקה',
      body: 'סרוק חשבוניות כדי לקבל נתונים חכמים על עלויות ומגמות.\nהנתונים תורמים גם לשוק הקהילתי שעוזר לכולם.',
      color: '#6B35B8'
    },
    {
      icon: '📊',
      title: 'גישה מלאה',
      body: 'דאשבורד · ספקים · שוק · עץ מוצר · סריקה · פרופיל.\nכל מה שיש לבעל/ת העסק — פתוח גם לך.',
      color: '#0891B2'
    }
  ];

  const steps = [infoStep, ...roleSteps];

  let current = 0;
  const overlay = document.createElement('div');
  overlay.id = 'role-welcome';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(30,10,60,0.82);z-index:99999;display:flex;align-items:flex-end;justify-content:center';

  const done = () => { overlay.remove(); localStorage.setItem('rv_role_welcome_done', '1'); setTimeout(requestPushIfConfigured, 800); };

  const saveStaffProfile = async () => {
    const name  = (document.getElementById('sw-staff-name')  || {}).value || '';
    const phone = (document.getElementById('sw-staff-phone') || {}).value || '';
    const email = (document.getElementById('sw-staff-email') || {}).value || '';
    const code  = _store.get('rv_access_code') || '';
    if (!name.trim()) { document.getElementById('sw-staff-name').focus(); return false; }
    try {
      await fetch('/.netlify/functions/save-staff-profile', {
        method: 'POST',
        headers: DB._headers(),
        body: JSON.stringify({ code, staff_name: name.trim(), staff_phone: phone.trim(), staff_email: email.trim() })
      });
    } catch {}
    return true;
  };

  const renderFormStep = (s) => {
    const dots = steps.map((_, i) =>
      `<div style="width:${i === current ? '22px' : '8px'};height:8px;border-radius:4px;background:${i === current ? s.color : '#e0d7f5'};transition:all 0.3s"></div>`
    ).join('');
    overlay.innerHTML = `
      <div style="background:white;border-radius:28px 28px 0 0;width:100%;max-width:480px;padding:32px 28px 52px;position:relative">
        <button onclick="document.getElementById('role-welcome')._done()"
          style="position:absolute;top:18px;left:20px;background:none;border:none;font-size:13px;color:#bbb;cursor:pointer;font-family:inherit;padding:4px 8px">דלג</button>
        <div style="font-size:11px;color:#bbb;position:absolute;top:22px;right:24px">${current + 1} / ${steps.length}</div>
        <div style="display:flex;justify-content:center;gap:5px;margin-bottom:24px">${dots}</div>
        <div style="text-align:center;margin-bottom:22px">
          <div style="font-size:48px;margin-bottom:10px;line-height:1">${s.icon}</div>
          <div style="font-size:20px;font-weight:800;color:${s.color};line-height:1.3">${s.title}</div>
          <div style="font-size:13px;color:#888;margin-top:6px">הפרטים יופיעו אצל בעל העסק</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:12px">
          <input id="sw-staff-name" type="text" placeholder="שם מלא *" dir="rtl"
            style="width:100%;padding:13px 14px;border:1.5px solid #e0d7f5;border-radius:12px;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='#4A1F85'" onblur="this.style.borderColor='#e0d7f5'">
          <input id="sw-staff-phone" type="tel" placeholder="טלפון" dir="ltr"
            style="width:100%;padding:13px 14px;border:1.5px solid #e0d7f5;border-radius:12px;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='#4A1F85'" onblur="this.style.borderColor='#e0d7f5'">
          <input id="sw-staff-email" type="email" placeholder="אימייל" dir="ltr"
            style="width:100%;padding:13px 14px;border:1.5px solid #e0d7f5;border-radius:12px;font-size:15px;font-family:inherit;outline:none;box-sizing:border-box"
            onfocus="this.style.borderColor='#4A1F85'" onblur="this.style.borderColor='#e0d7f5'">
        </div>
        <button id="sw-next-btn" onclick="document.getElementById('role-welcome')._nextForm()"
          style="width:100%;margin-top:22px;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#4A1F85,#9B6DD6);color:white;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit">
          הבא ←
        </button>
      </div>`;

    overlay._nextForm = async () => {
      const btn = document.getElementById('sw-next-btn');
      btn.disabled = true; btn.textContent = '...';
      const ok = await saveStaffProfile();
      if (!ok) { btn.disabled = false; btn.textContent = 'הבא ←'; return; }
      current++; render();
    };
    overlay._done = done;
  };

  const render = () => {
    const s = steps[current];
    if (s._isForm) { renderFormStep(s); return; }

    const isLast = current === steps.length - 1;
    const dots = steps.map((_, i) =>
      `<div style="width:${i === current ? '22px' : '8px'};height:8px;border-radius:4px;background:${i === current ? s.color : '#e0d7f5'};transition:all 0.3s"></div>`
    ).join('');

    overlay.innerHTML = `
      <div style="background:white;border-radius:28px 28px 0 0;width:100%;max-width:480px;padding:32px 28px 52px;position:relative">
        <button onclick="document.getElementById('role-welcome')._done()"
          style="position:absolute;top:18px;left:20px;background:none;border:none;font-size:13px;color:#bbb;cursor:pointer;font-family:inherit;padding:4px 8px">דלג</button>
        <div style="font-size:11px;color:#bbb;position:absolute;top:22px;right:24px">${current + 1} / ${steps.length}</div>
        <div style="display:flex;justify-content:center;gap:5px;margin-bottom:28px">${dots}</div>
        <div style="text-align:center">
          <div style="font-size:58px;margin-bottom:14px;line-height:1">${s.icon}</div>
          <div style="font-size:21px;font-weight:800;color:${s.color};margin-bottom:14px;line-height:1.3">${s.title}</div>
          <div style="font-size:15px;color:#444;line-height:1.85;white-space:pre-line">${s.body}</div>
        </div>
        <div style="display:flex;gap:10px;margin-top:32px">
          ${current > 0 ? `<button onclick="document.getElementById('role-welcome')._prev()"
            style="padding:14px 18px;border:1.5px solid #e5e0ef;border-radius:14px;background:white;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;color:#888">←</button>` : ''}
          <button onclick="document.getElementById('role-welcome')._next()"
            style="flex:1;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#4A1F85,#9B6DD6);color:white;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit">
            ${isLast ? 'יאללה, מתחילים! 🚀' : 'הבא ←'}
          </button>
        </div>
      </div>`;

    overlay._next = () => { if (current < steps.length - 1) { current++; render(); } else done(); };
    overlay._prev = () => { if (current > 0) { current--; render(); } };
    overlay._done = done;
  };

  render();
  document.body.appendChild(overlay);
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
        REVERTO היא כלי ניהול שמאפשר לכל עסק לראות במקום אחד ומסודר כמה הוא משלם, איפה הוא חורג, מה השוק מתמחר — מבלי לחשוף את עצמו — ולהבין את הפודקוסט שלו עם יכולות הבינה המלאכותית שמאפשרות לבעלי העסקים הקטנים להגיע לתובנות ותוצאות עסקיות כמו של ה"גדולים", ואפילו — סוף סוף — לסייע בבניית עץ מוצר מקצועי, חכם ומתעדכן.<br><br>
        אנחנו מודים לכל אחת ואחד מכם שהצטרף ל-REVERTO מתוך הבנה שעזרה לנו היא עזרה לכם, ומבקשים לשתף ולצרף חברים בתחום ולהפיץ את הבשורה.<br><br>
        <strong>REVERTO בא לשנות. 🚀</strong>
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

let _profileKosher = false;
let _profileWorkDays = new Set(['א','ב','ג','ד','ה']);

function toggleWorkDay(d) {
  if (_profileWorkDays.has(d)) _profileWorkDays.delete(d);
  else _profileWorkDays.add(d);
  renderWorkDays();
}
function renderWorkDays() {
  ['א','ב','ג','ד','ה','ו','ש'].forEach(d => {
    const btn = document.getElementById('wd-' + d);
    if (!btn) return;
    const on = _profileWorkDays.has(d);
    btn.style.background = on ? 'var(--primary)' : 'transparent';
    btn.style.color = on ? 'white' : 'var(--on-surface-2)';
    btn.style.borderColor = on ? 'var(--primary)' : 'var(--border)';
  });
}
function setKosher(val) {
  _profileKosher = val;
  const yes = document.getElementById('kosher-yes');
  const no = document.getElementById('kosher-no');
  if (yes) { yes.style.background = val ? 'var(--primary)' : 'transparent'; yes.style.color = val ? 'white' : 'var(--on-surface-2)'; yes.style.borderColor = val ? 'var(--primary)' : 'var(--border)'; }
  if (no) { no.style.background = !val ? '#6B7280' : 'transparent'; no.style.color = !val ? 'white' : 'var(--on-surface-2)'; no.style.borderColor = !val ? '#6B7280' : 'var(--border)'; }
}

function toggleSection(id) {
  const body = document.getElementById('body-' + id);
  const arrow = document.getElementById('arrow-' + id);
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  arrow.style.transform = isOpen ? '' : 'rotate(90deg)';
}

function _openSection(id) {
  const body = document.getElementById('body-' + id);
  const arrow = document.getElementById('arrow-' + id);
  if (!body) return;
  body.style.display = 'block';
  arrow.style.transform = 'rotate(90deg)';
}

function _closeSection(id) {
  const body = document.getElementById('body-' + id);
  const arrow = document.getElementById('arrow-' + id);
  if (!body) return;
  body.style.display = 'none';
  arrow.style.transform = '';
}

function initProfile() {
  const profile = Auth.profile;
  const bizLocked = !!localStorage.getItem('rv_biz_locked');
  const opsLocked = !!localStorage.getItem('rv_ops_locked');

  // ── פרטי עסק ──
  const bizBody = document.getElementById('body-biz');
  if (bizLocked) {
    const addr = [profile.address, profile.city].filter(Boolean).join(', ');
    bizBody.innerHTML = `
      <div style="font-size:13px;color:var(--on-surface-2);line-height:2">
        <div id="_bn" style="font-size:14px;font-weight:700"></div>
        <div id="_nm"></div>
        <div id="_ph"></div>
        <div id="_em"></div>
        <div id="_ad"></div>
      </div>`;
    bizBody.querySelector('#_bn').textContent = profile.business_name || '';
    bizBody.querySelector('#_nm').textContent = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    bizBody.querySelector('#_ph').textContent = profile.phone || '';
    bizBody.querySelector('#_em').textContent = profile.email || '';
    bizBody.querySelector('#_ad').textContent = addr;
  } else {
    bizBody.innerHTML = `
      <label class="field-label">שם המסעדה / העסק</label>
      <input class="input mb-10" id="prof-biz-name" type="text">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
        <div><label class="field-label">שם פרטי</label><input class="input" id="prof-first-name" type="text"></div>
        <div><label class="field-label">שם משפחה</label><input class="input" id="prof-last-name" type="text"></div>
      </div>
      <label class="field-label">טלפון</label>
      <input class="input mb-10" id="prof-phone" type="tel">
      <label class="field-label">מייל</label>
      <input class="input mb-10" id="prof-email" type="email">
      <label class="field-label">רחוב ומספר</label>
      <input class="input mb-10" id="prof-address" type="text">
      <label class="field-label">עיר</label>
      <input class="input mb-10" id="prof-city" type="text">
      <button class="btn-primary mt-8" onclick="saveBizDetails()" style="width:100%">שמור פרטי עסק</button>`;
    const g = id => bizBody.querySelector('#' + id);
    g('prof-biz-name').value = profile.business_name || '';
    g('prof-first-name').value = profile.first_name || '';
    g('prof-last-name').value = profile.last_name || '';
    g('prof-phone').value = profile.phone || '';
    g('prof-email').value = profile.email || '';
    g('prof-address').value = profile.address || '';
    g('prof-city').value = profile.city || '';
    if (!profile.business_name) _openSection('biz');
  }

  // ── פרטי תפעול ──
  const days = profile.working_days ? profile.working_days.split(',') : ['א','ב','ג','ד','ה'];
  _profileWorkDays = new Set(days);
  _profileKosher = !!profile.is_kosher;
  const opsBody = document.getElementById('body-ops');
  if (opsLocked) {
    opsBody.innerHTML = `
      <div style="font-size:13px;color:var(--on-surface-2);line-height:2">
        <div>ימי עבודה: <b>${[..._profileWorkDays].join(', ')}</b></div>
        <div>כשרות: <b>${_profileKosher ? 'כשר' : 'לא כשר'}</b></div>
      </div>`;
  } else {
    opsBody.innerHTML = `
      <label class="field-label" style="margin-bottom:8px">ימי עבודה</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
        ${['א','ב','ג','ד','ה','ו','ש'].map(d =>
          `<button id="wd-${d}" onclick="toggleWorkDay('${d}')"
            style="width:38px;height:38px;border-radius:50%;border:2px solid var(--border);font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;background:transparent;color:var(--on-surface-2);transition:all 0.15s">${d}</button>`
        ).join('')}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <div>
          <label class="field-label" style="margin-bottom:2px">כשרות</label>
          <div style="font-size:11px;color:var(--on-surface-3)">משפיע על בנצ'מארק עם עסקים דומים</div>
        </div>
        <div style="display:flex;gap:6px">
          <button id="kosher-no" onclick="setKosher(false)"
            style="padding:6px 14px;border-radius:20px;border:2px solid var(--border);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;background:transparent;color:var(--on-surface-2)">לא כשר</button>
          <button id="kosher-yes" onclick="setKosher(true)"
            style="padding:6px 14px;border-radius:20px;border:2px solid var(--border);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;background:transparent;color:var(--on-surface-2)">כשר</button>
        </div>
      </div>
      <button class="btn-primary" onclick="saveOpsDetails()" style="width:100%">שמור פרטי תפעול</button>`;
    renderWorkDays();
    setKosher(_profileKosher);
    if (!profile.working_days) _openSection('ops');
  }

  loadLocations();
  loadPartnerCodes();

  // Hide owner-only sections from managers
  if (isManager()) {
    document.getElementById('partner-card')?.style.setProperty('display', 'none');
    document.getElementById('manager-card')?.style.setProperty('display', 'none');
  }
}

function _renderCodeRows(codes) {
  return codes.map(c => {
    const staffLine = c.staff_name
      ? `<div style="font-size:12px;color:#555;margin-top:3px;display:flex;gap:10px;flex-wrap:wrap">
           <span style="font-weight:700">${c.staff_name}</span>
           ${c.staff_phone ? `<span style="color:#888">${c.staff_phone}</span>` : ''}
           ${c.staff_email ? `<span style="color:#888">${c.staff_email}</span>` : ''}
         </div>`
      : `<div style="font-size:11px;color:#bbb;margin-top:2px">טרם הוזנו פרטים אישיים</div>`;
    return `
    <div style="padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="flex:1;font-size:14px;font-weight:800;letter-spacing:2px;color:var(--primary)">${c.code}</div>
        <button onclick="navigator.clipboard.writeText('${c.code}').then(()=>showToast('הועתק!'))" style="background:none;border:1px solid var(--border);border-radius:8px;padding:4px 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit">העתק</button>
      </div>
      ${staffLine}
    </div>`;
  }).join('');
}

async function loadPartnerCodes() {
  if (isManager()) return;
  const [partnerCodes, managerCodes] = await Promise.all([
    DB.get('access_codes', '?type=eq.partner&select=code,is_active,created_at,staff_name,staff_phone,staff_email&order=created_at.desc'),
    DB.get('access_codes', '?type=eq.manager&select=code,is_active,created_at,staff_name,staff_phone,staff_email&order=created_at.desc')
  ]);
  const el = document.getElementById('partner-codes-list');
  if (el) el.innerHTML = partnerCodes?.length ? _renderCodeRows(partnerCodes) : `<div style="font-size:12px;color:var(--on-surface-3)">אין קודי שותף עדיין</div>`;
  const mel = document.getElementById('manager-codes-list');
  if (mel) mel.innerHTML = managerCodes?.length ? _renderCodeRows(managerCodes) : `<div style="font-size:12px;color:var(--on-surface-3)">אין קודי מנהל עדיין</div>`;
}

async function _generateCode(role) {
  const label = role === 'manager' ? 'קוד מנהל' : 'קוד שותף';
  const btnText = role === 'manager' ? 'קוד מנהל חדש' : 'קוד שותף חדש';
  const btnReset = role === 'manager' ? '+ צור קוד מנהל חדש' : '+ צור קוד שותף חדש';

  const btns = document.querySelectorAll('#page-profile button');
  const genBtn = Array.from(btns).find(b => b.textContent.includes(btnText));
  if (genBtn) { genBtn.textContent = 'יוצר...'; genBtn.disabled = true; }

  if (!Auth.jwt) { showToast('שגיאה: לא מחובר'); if (genBtn) { genBtn.textContent = btnReset; genBtn.disabled = false; } return; }

  try {
    const res = await fetch('/.netlify/functions/add-partner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.jwt },
      body: JSON.stringify({ role })
    });
    const data = await res.json();
    if (genBtn) { genBtn.textContent = btnReset; genBtn.disabled = false; }
    if (data.code) {
      showToast(label + ' נוצר: ' + data.code);
      loadPartnerCodes();
    } else {
      showToast('שגיאה: ' + (data.error || 'נסה שנית'), 4000);
    }
  } catch (e) {
    if (genBtn) { genBtn.textContent = btnReset; genBtn.disabled = false; }
    showToast('שגיאת תקשורת — נסה שנית');
  }
}

async function generatePartnerCode() { await _generateCode('partner'); }
async function generateManagerCode() { await _generateCode('manager'); }

async function saveBizDetails() {
  const body = document.getElementById('body-biz');
  const name = body.querySelector('#prof-biz-name')?.value.trim();
  if (!name) { showToast('שם עסק הוא שדה חובה'); return; }
  const btn = body.querySelector('.btn-primary');
  if (btn) { btn.textContent = 'שומר...'; btn.disabled = true; }
  const updates = {
    business_name: name,
    first_name: body.querySelector('#prof-first-name')?.value.trim() || null,
    last_name: body.querySelector('#prof-last-name')?.value.trim() || null,
    phone: body.querySelector('#prof-phone')?.value.trim() || null,
    email: body.querySelector('#prof-email')?.value.trim() || null,
    address: body.querySelector('#prof-address')?.value.trim() || null,
    city: body.querySelector('#prof-city')?.value.trim() || null,
  };
  const ok = await DB.update('users', '', updates);
  if (ok) {
    const profile = Auth.profile;
    Object.assign(profile, updates);
    _store.set('rv_profile', JSON.stringify(profile));
    localStorage.setItem('rv_biz_locked', '1');
    document.getElementById('top-biz-name').textContent = name;
    document.getElementById('dash-greeting').textContent = 'שלום, ' + name + '!';
    showToast('פרטי עסק נשמרו ✓');
    initProfile();
    _closeSection('biz');
  } else {
    showToast('שגיאה בשמירה');
    if (btn) { btn.textContent = 'שמור פרטי עסק'; btn.disabled = false; }
  }
}

async function saveOpsDetails() {
  const body = document.getElementById('body-ops');
  const btn = body.querySelector('.btn-primary');
  if (btn) { btn.textContent = 'שומר...'; btn.disabled = true; }
  const updates = {
    working_days: [..._profileWorkDays].join(','),
    is_kosher: _profileKosher
  };
  const ok = await DB.update('users', '', updates);
  if (ok) {
    const profile = Auth.profile;
    Object.assign(profile, updates);
    _store.set('rv_profile', JSON.stringify(profile));
    localStorage.setItem('rv_ops_locked', '1');
    showToast('פרטי תפעול נשמרו ✓');
    initProfile();
    _closeSection('ops');
  } else {
    showToast('שגיאה בשמירה');
    if (btn) { btn.textContent = 'שמור פרטי תפעול'; btn.disabled = false; }
  }
}

// ── Push Notifications ────────────────────────────────────────

const VAPID_PUBLIC_KEY = 'BKY5wqGE2gQHVSlUuj7TBWzfUHqSR7ixPsRYobU9raiAEyLIfG8Y1jKVZjYo1nK2PzyWqXD0IxFQyn2uAwSUOqQ';

function _urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (await reg.pushManager.getSubscription()) return;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: _urlB64ToUint8(VAPID_PUBLIC_KEY)
    });
    await fetch('/.netlify/functions/save-push-sub', {
      method: 'POST',
      headers: DB._headers(),
      body: JSON.stringify({ sub: sub.toJSON() })
    });
  } catch (e) { console.log('Push subscribe error:', e); }
}

async function requestPushIfConfigured() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const profile = Auth.profile;
  if (!profile.notification_prefs) return;
  if (Notification.permission === 'denied') return;
  if (Notification.permission === 'granted') { await subscribePush(); return; }

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(30,10,60,0.82);z-index:99999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:28px 28px 0 0;width:100%;max-width:480px;padding:32px 28px 52px;text-align:center">
      <div style="font-size:52px;margin-bottom:14px">🔔</div>
      <div style="font-size:21px;font-weight:800;color:#4A1F85;margin-bottom:12px">אפשר תזכורות?</div>
      <div style="font-size:14px;color:#555;line-height:1.7;margin-bottom:24px">
        הגדרת תזכורות במהלך ההגדרה הראשונית.<br>
        כדי לשלוח אותן לטלפון — נצטרך את רשותך.
      </div>
      <button id="push-allow-btn" style="display:block;width:100%;padding:14px;border:none;border-radius:14px;background:linear-gradient(135deg,#4A1F85,#9B6DD6);color:white;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:10px">
        אפשר תזכורות
      </button>
      <button onclick="this.closest('div[style*=fixed]').remove()" style="display:block;width:100%;padding:12px;border:none;background:none;font-size:14px;color:#bbb;cursor:pointer;font-family:inherit">
        לא עכשיו
      </button>
    </div>`;

  document.body.appendChild(modal);
  modal.querySelector('#push-allow-btn').addEventListener('click', async () => {
    modal.remove();
    const perm = await Notification.requestPermission();
    if (perm === 'granted') await subscribePush();
  });
}

// Register service worker on load (non-blocking)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// Start
appInit();
