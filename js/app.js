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
  if (pageId === 'scanner') scannerReset();
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
}

// Start
appInit();
