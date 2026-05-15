// ── עץ מוצר — Product Tree (PRO) ─────────────────────────────

const PT_UNITS = ['ק"ג', 'גרם', 'ליטר', 'מ"ל', 'יחידה'];

// Conversion to base (kg for weight, litre for volume, 1 for count)
const UNIT_BASE = {
  'ק"ג':    { family: 'weight', toBase: 1 },
  'גרם':    { family: 'weight', toBase: 0.001 },
  'ליטר':   { family: 'volume', toBase: 1 },
  'מ"ל':    { family: 'volume', toBase: 0.001 },
  'יחידה':  { family: 'count',  toBase: 1 }
};

// Convert qty from one unit to another (same family)
function convertUnit(qty, fromUnit, toUnit) {
  if (!fromUnit || !toUnit || fromUnit === toUnit) return qty;
  const from = UNIT_BASE[fromUnit], to = UNIT_BASE[toUnit];
  if (!from || !to || from.family !== to.family) return qty; // different family — treat as 1:1
  return qty * from.toBase / to.toBase;
}

// Cost of one ingredient in a recipe, accounting for waste and unit conversion
function calcIngCost(ing, product) {
  if (!product || !ing.quantity) return 0;
  const ingUnit = ing.unit || product.unit;
  const qtyInProductUnit = convertUnit(ing.quantity, ingUnit, product.unit);
  const wasteFactor = Math.max(0.01, 1 - (product.waste_pct || 0) / 100);
  return (product.price_per_unit / wasteFactor) * qtyInProductUnit;
}

function unitSelect(selectedUnit, id, onchange) {
  return `<select class="input" id="${id}" style="padding:8px 4px;font-size:12px" ${onchange ? 'onchange="' + onchange + '"' : ''}>
    ${PT_UNITS.map(u => `<option value="${u}"${u === selectedUnit ? ' selected' : ''}>${u}</option>`).join('')}
  </select>`;
}

let ptCatalog = [];
let ptRecipes = [];
let ptCurrentTab = 'products';
let rbIngredients = [];
let rbRecipeId = null;

function initProductTree() {
  const profile = Auth.profile;
  const isPro = profile.plan === 'pro' && profile.pro_until && new Date(profile.pro_until) > new Date();
  const lockEl = document.getElementById('pt-lock');
  if (lockEl) lockEl.style.display = isPro ? 'none' : 'flex';
  if (!isPro) return;
  ptTab('products');
}

function ptTab(tab) {
  ptCurrentTab = tab;
  document.getElementById('pt-products').style.display = tab === 'products' ? 'block' : 'none';
  document.getElementById('pt-recipes').style.display = tab === 'recipes' ? 'block' : 'none';
  document.querySelectorAll('#pt-tabs .period-btn').forEach(b => b.classList.remove('active'));
  const tabBtn = document.getElementById('pttab-' + tab);
  if (tabBtn) tabBtn.classList.add('active');
  if (tab === 'products') loadCatalog();
  if (tab === 'recipes') loadRecipes();
}

// ── Catalog ──────────────────────────────────────────────────

async function loadCatalog() {
  document.getElementById('catalog-list').innerHTML = '<div style="text-align:center;padding:20px;color:var(--on-surface-3)">טוען...</div>';
  ptCatalog = await DB.get('product_catalog', '?select=*&order=name.asc') || [];
  renderCatalog();
}

function renderCatalog() {
  const el = document.getElementById('catalog-list');
  const priceChanges = ptCatalog.filter(p => p.previous_price && Math.abs((p.price_per_unit - p.previous_price) / p.previous_price * 100) >= 1);

  let alertHtml = '';
  if (priceChanges.length) {
    alertHtml = `<div style="background:var(--error-bg);border:1px solid var(--error);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:12px">
      <div style="font-size:13px;font-weight:700;color:var(--error);margin-bottom:6px">⚠️ ${priceChanges.length} מוצרים עם שינוי מחיר מהחשבוניות האחרונות</div>
      ${priceChanges.map(p => {
        const chg = ((p.price_per_unit - p.previous_price) / p.previous_price * 100).toFixed(1);
        const up = p.price_per_unit > p.previous_price;
        return `<div style="font-size:12px;margin-bottom:2px">${p.name}: ₪${p.previous_price.toFixed(2)} → ₪${p.price_per_unit.toFixed(2)} <span style="color:${up ? 'var(--error)' : 'var(--success)'}">${up ? '+' : ''}${chg}%</span></div>`;
      }).join('')}
    </div>`;
  }

  if (!ptCatalog.length) {
    el.innerHTML = alertHtml + `<div class="empty-state"><div class="empty-state-title">אין מוצרים</div><div class="empty-state-sub">לחץ "רענן מחירים" לטעינה מחשבוניות</div></div>`;
    return;
  }

  el.innerHTML = alertHtml + `<div class="card">${ptCatalog.map(p => {
    const chg = p.previous_price ? ((p.price_per_unit - p.previous_price) / p.previous_price * 100) : 0;
    const hasChg = Math.abs(chg) >= 1;
    return `<div class="list-row" onclick="editProduct('${p.id}')">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">${p.name}</div>
        <div style="font-size:11px;color:var(--on-surface-3)">${p.unit}${p.waste_pct > 0 ? ` · פחת ${p.waste_pct}%` : ''}${p.category ? ' · ' + p.category : ''}</div>
      </div>
      <div style="text-align:left">
        <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${p.price_per_unit.toFixed(2)}</div>
        ${hasChg ? `<div style="font-size:10px;color:${chg > 0 ? 'var(--error)' : 'var(--success)'}">${chg > 0 ? '↑' : '↓'}${Math.abs(chg).toFixed(0)}%</div>` : ''}
      </div>
    </div>`;
  }).join('')}</div>`;
}

async function buildCatalog() {
  const btn = document.getElementById('build-catalog-btn');
  if (btn) { btn.textContent = 'מעדכן...'; btn.disabled = true; }
  try {
    const res = await fetch('/.netlify/functions/build-catalog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.jwt }
    });
    const data = await res.json();
    showToast(`${data.new} חדשים · ${data.updated} עודכנו · ${data.unchanged} ללא שינוי`);
    await loadCatalog();
  } catch { showToast('שגיאה בעדכון'); }
  finally { if (btn) { btn.textContent = '🔄 רענן מחירים'; btn.disabled = false; } }
}

function editProduct(id) {
  const p = ptCatalog.find(x => x.id === id);
  if (!p) return;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:28px 24px 48px;width:100%;max-width:480px">
      <div style="font-size:16px;font-weight:800;margin-bottom:20px">${p.name}</div>
      <label class="field-label">מחיר ל-${p.unit} (₪)</label>
      <input class="input mb-12" id="ep-price" type="number" step="0.01" value="${p.price_per_unit}">
      <label class="field-label">אחוז פחת % (איבוד בבישול)</label>
      <input class="input mb-12" id="ep-waste" type="number" step="0.5" min="0" max="99" value="${p.waste_pct}">
      <label class="field-label">קטגוריה</label>
      <input class="input mb-12" id="ep-cat" type="text" placeholder="ירקות, בשר, ים..." value="${p.category || ''}">
      <label class="field-label">יחידת מידה</label>
      <div class="mb-16">${unitSelect(p.unit, 'ep-unit')}</div>
      <button onclick="saveProduct('${id}')" class="btn-primary mb-8">שמור</button>
      <button onclick="this.closest('[data-ep-modal]').remove()" class="btn-ghost">ביטול</button>
    </div>`;
  modal.setAttribute('data-ep-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function saveProduct(id) {
  const price = parseFloat(document.getElementById('ep-price')?.value) || 0;
  const waste = parseFloat(document.getElementById('ep-waste')?.value) || 0;
  const category = document.getElementById('ep-cat')?.value.trim() || null;
  const unit = document.getElementById('ep-unit')?.value.trim() || 'ק"ג';
  await DB.update('product_catalog', `?id=eq.${id}`, { price_per_unit: price, waste_pct: waste, category, unit });
  document.querySelector('[data-ep-modal]')?.remove();
  showToast('מוצר עודכן');
  const idx = ptCatalog.findIndex(p => p.id === id);
  if (idx >= 0) ptCatalog[idx] = { ...ptCatalog[idx], price_per_unit: price, waste_pct: waste, category, unit };
  renderCatalog();
}

async function addProductManually() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:28px 24px 48px;width:100%;max-width:480px">
      <div style="font-size:16px;font-weight:800;margin-bottom:20px">מוצר חדש</div>
      <label class="field-label">שם מוצר *</label>
      <input class="input mb-12" id="np-name" type="text" placeholder="שמן זית">
      <label class="field-label">יחידת מידה</label>
      <div class="mb-12">${unitSelect('ק"ג', 'np-unit')}</div>
      <label class="field-label">מחיר ליחידה (₪) *</label>
      <input class="input mb-12" id="np-price" type="number" step="0.01" placeholder="0.00">
      <label class="field-label">אחוז פחת % (אופציונלי)</label>
      <input class="input mb-16" id="np-waste" type="number" value="0" min="0" max="99">
      <button onclick="saveNewProduct()" class="btn-primary mb-8">הוסף מוצר</button>
      <button onclick="this.closest('[data-np-modal]').remove()" class="btn-ghost">ביטול</button>
    </div>`;
  modal.setAttribute('data-np-modal', '');
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function saveNewProduct() {
  const name = document.getElementById('np-name')?.value.trim();
  const price = parseFloat(document.getElementById('np-price')?.value) || 0;
  const unit = document.getElementById('np-unit')?.value.trim() || 'ק"ג';
  const waste = parseFloat(document.getElementById('np-waste')?.value) || 0;
  if (!name) return;
  const result = await DB.insert('product_catalog', { name, price_per_unit: price, unit, waste_pct: waste });
  document.querySelector('[data-np-modal]')?.remove();
  if (result) { ptCatalog.push(result); ptCatalog.sort((a, b) => a.name.localeCompare(b.name, 'he')); }
  renderCatalog();
  showToast('מוצר נוסף');
}

// ── Recipe calculations ───────────────────────────────────────

function catalogMap() {
  return Object.fromEntries(ptCatalog.map(p => [p.name, p]));
}

function calcRecipe(recipe) {
  const cm = catalogMap();
  let totalCost = 0;
  const breakdown = (recipe.ingredients || []).map(ing => {
    const p = cm[ing.product_name];
    const cost = p ? calcIngCost(ing, p) : 0;
    totalCost += cost;
    const priceChanged = p?.previous_price && Math.abs((p.price_per_unit - p.previous_price) / p.previous_price * 100) >= 1;
    return { ...ing, cost, priceChanged };
  });

  const menuPrice = recipe.menu_price || 0;
  const targetFc = recipe.target_fc_pct || 30;
  const oltPct = recipe.olt_commission_pct || 0;
  const fcPct = menuPrice > 0 ? (totalCost / menuPrice * 100) : 0;
  const recommendedPrice = totalCost > 0 ? Math.ceil(totalCost / (targetFc / 100)) : 0;
  const grossProfit = menuPrice - totalCost;
  const grossProfitPct = menuPrice > 0 ? (grossProfit / menuPrice * 100) : 0;
  const oltDeduction = menuPrice * oltPct / 100;
  const netProfit = grossProfit - oltDeduction;
  const netProfitPct = menuPrice > 0 ? (netProfit / menuPrice * 100) : 0;
  const hasAlert = breakdown.some(i => i.priceChanged);
  const fcColor = fcPct === 0 ? 'var(--on-surface-3)' : fcPct <= 28 ? 'var(--success)' : fcPct <= 35 ? '#F59E0B' : 'var(--error)';

  return { totalCost, breakdown, fcPct, targetFc, recommendedPrice, grossProfit, grossProfitPct, netProfit, netProfitPct, hasAlert, fcColor, oltDeduction };
}

// ── Recipes list ──────────────────────────────────────────────

async function loadRecipes() {
  document.getElementById('recipes-list').innerHTML = '<div style="text-align:center;padding:20px;color:var(--on-surface-3)">טוען...</div>';
  if (!ptCatalog.length) ptCatalog = await DB.get('product_catalog', '?select=*&order=name.asc') || [];
  const [recipes, ingredients] = await Promise.all([
    DB.get('recipes', '?select=*&order=name.asc'),
    DB.get('recipe_ingredients', '?select=*')
  ]);
  ptRecipes = (recipes || []).map(r => ({
    ...r, ingredients: (ingredients || []).filter(i => i.recipe_id === r.id)
  }));
  renderRecipes();
}

function renderRecipes() {
  const el = document.getElementById('recipes-list');
  if (!ptRecipes.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-title">אין מתכונים</div><div class="empty-state-sub">לחץ + כדי להוסיף מנה ראשונה</div></div>';
    return;
  }

  const calcs = ptRecipes.map(r => ({ r, c: calcRecipe(r) }));
  const alerts = calcs.filter(({ c }) => c.hasAlert);

  let alertBanner = '';
  if (alerts.length) {
    alertBanner = `<div style="background:var(--error-bg);border:1px solid var(--error);border-radius:var(--radius-md);padding:10px 14px;margin-bottom:12px;font-size:13px;font-weight:700;color:var(--error)">⚠️ ${alerts.length} מנות מושפעות משינוי מחיר — FC% השתנה</div>`;
  }

  el.innerHTML = alertBanner + calcs.map(({ r, c }) => `
    <div class="card card-pad mb-10" onclick="openRecipeBuilder('${r.id}')">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-size:15px;font-weight:800">${r.name}${c.hasAlert ? ' ⚠️' : ''}</div>
          ${r.category ? `<div style="font-size:11px;color:var(--on-surface-3)">${r.category}</div>` : ''}
        </div>
        <div style="text-align:left">
          <div style="font-size:14px;font-weight:800;color:${c.fcColor}">${c.fcPct > 0 ? c.fcPct.toFixed(1) + '% FC' : '—'}</div>
          ${c.fcPct > c.targetFc + 1 ? `<div style="font-size:10px;color:var(--error)">יעד: ${c.targetFc}%</div>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
        <div style="background:var(--surface-low);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:10px;color:var(--on-surface-3)">עלות מנה</div>
          <div style="font-size:13px;font-weight:800">₪${c.totalCost.toFixed(2)}</div>
        </div>
        <div style="background:var(--surface-low);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:10px;color:var(--on-surface-3)">מחיר תפריט</div>
          <div style="font-size:13px;font-weight:800">${r.menu_price ? '₪' + parseFloat(r.menu_price).toFixed(2) : '—'}</div>
        </div>
        <div style="background:var(--surface-low);border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:10px;color:var(--on-surface-3)">רווח גולמי</div>
          <div style="font-size:13px;font-weight:800;color:${c.grossProfit >= 0 ? 'var(--success)' : 'var(--error)'}">${r.menu_price ? '₪' + c.grossProfit.toFixed(2) : '—'}</div>
        </div>
      </div>
      ${r.olt_commission_pct > 0 && r.menu_price ? `
        <div style="font-size:12px;color:var(--on-surface-3)">רווח נטו אחרי ${r.olt_commission_pct}% עמלה: <strong style="color:${c.netProfit >= 0 ? 'var(--success)' : 'var(--error)'}">₪${c.netProfit.toFixed(2)}</strong></div>` : ''}
      ${c.recommendedPrice > 0 && r.menu_price && Math.abs(c.recommendedPrice - r.menu_price) > 1 ? `
        <div style="margin-top:6px;font-size:12px;color:var(--primary);font-weight:700">💡 מחיר מומלץ ל-${c.targetFc}% FC: ₪${c.recommendedPrice}</div>` : ''}
    </div>
  `).join('');
}

// ── Recipe Builder ────────────────────────────────────────────

async function openRecipeBuilder(recipeId = null) {
  rbRecipeId = recipeId;
  const recipe = recipeId ? ptRecipes.find(r => r.id === recipeId) : null;
  rbIngredients = recipe ? recipe.ingredients.map(i => ({ ...i })) : [];
  if (!ptCatalog.length) ptCatalog = await DB.get('product_catalog', '?select=*&order=name.asc') || [];

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:white;z-index:9999;overflow-y:auto;display:flex;flex-direction:column';
  modal.setAttribute('data-rb-modal', '');
  modal.innerHTML = `
    <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;position:sticky;top:0;background:white;z-index:1">
      <button onclick="this.closest('[data-rb-modal]').remove()" style="background:none;border:none;cursor:pointer;font-size:24px;color:var(--on-surface-3);padding:0;line-height:1">←</button>
      <div style="font-size:18px;font-weight:800">${recipe ? recipe.name : 'מתכון חדש'}</div>
    </div>
    <div style="padding:20px;flex:1;max-width:600px;width:100%;margin:0 auto">

      <label class="field-label">שם המנה *</label>
      <input class="input mb-12" id="rb-name" type="text" placeholder="שניצל ירושלמי" value="${recipe?.name || ''}">

      <label class="field-label">קטגוריה</label>
      <input class="input mb-12" id="rb-cat" type="text" placeholder="עיקריות, ראשונות, קינוח..." value="${recipe?.category || ''}">

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
        <div>
          <label class="field-label">מחיר תפריט ₪</label>
          <input class="input" id="rb-price" type="number" step="0.5" placeholder="0" value="${recipe?.menu_price || ''}" oninput="rbRecalc()">
        </div>
        <div>
          <label class="field-label">FC% יעד</label>
          <input class="input" id="rb-target-fc" type="number" min="1" max="99" value="${recipe?.target_fc_pct || 30}" oninput="rbRecalc()">
        </div>
        <div>
          <label class="field-label">עמלת משלוחים % *</label>
          <input class="input" id="rb-olt" type="number" min="0" max="50" value="${recipe?.olt_commission_pct || 0}" oninput="rbRecalc()">
        </div>
      </div>

      <div style="font-size:11px;color:var(--on-surface-3);margin-bottom:14px">* עמלת משלוחים — Wolt / תן ביס / קובי / משלוחה (אחוז שהפלטפורמה לוקחת מהמחיר)</div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:14px;font-weight:800">רכיבים</div>
        <button onclick="rbAddIngredient()" style="background:var(--primary);color:white;border:none;border-radius:20px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ הוסף</button>
      </div>
      <div id="rb-ingredients" style="margin-bottom:12px"></div>

      <!-- Live calculation panel -->
      <div id="rb-calc" style="background:var(--surface-low);border-radius:var(--radius-md);padding:16px;margin-bottom:20px"></div>

      <button onclick="saveRecipe()" class="btn-primary mb-8">שמור מתכון</button>
      ${recipe ? `<button onclick="deleteRecipe('${recipe.id}')" class="btn-ghost" style="color:var(--error);border-color:var(--error);margin-top:4px">מחק מתכון</button>` : ''}
    </div>`;
  document.body.appendChild(modal);
  rbRenderIngredients();
  rbRecalc();
}

function rbRenderIngredients() {
  const el = document.getElementById('rb-ingredients');
  if (!el) return;
  if (!rbIngredients.length) {
    el.innerHTML = '<div style="font-size:13px;color:var(--on-surface-3);text-align:center;padding:12px 0">לחץ "+ הוסף" לבחירת רכיב מהמוצרים</div>';
    return;
  }
  const cm = catalogMap();
  el.innerHTML = rbIngredients.map((ing, i) => {
    const p = cm[ing.product_name];
    const ingUnit = ing.unit || (p?.unit || 'ק"ג');
    const cost = p ? calcIngCost({ ...ing, unit: ingUnit }, p) : 0;
    return `
      <div style="background:var(--surface-card);border-radius:var(--radius-md);padding:10px 12px;margin-bottom:8px;border:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div style="font-size:13px;font-weight:700;color:var(--primary)">${ing.product_name}</div>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="font-size:13px;font-weight:800;color:var(--on-surface)" id="rbi-cost-${i}">₪${cost.toFixed(2)}</div>
            <button onclick="rbIngredients.splice(${i},1);rbRenderIngredients();rbRecalc()" style="background:none;border:none;color:var(--error);cursor:pointer;font-size:18px;padding:0;line-height:1">×</button>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <input style="flex:1" class="input" type="number" step="0.001" placeholder="כמות"
            value="${ing.quantity || ''}" id="rbq-${i}"
            oninput="rbIngredients[${i}].quantity=parseFloat(this.value)||0;rbUpdateIngCost(${i});rbRecalc()">
          <div style="flex:1">${unitSelect(ingUnit, 'rbu-' + i, 'rbIngredients[' + i + '].unit=this.value;rbUpdateIngCost(' + i + ');rbRecalc()')}</div>
          ${p ? `<div style="font-size:10px;color:var(--on-surface-3);white-space:nowrap">₪${p.price_per_unit.toFixed(2)}/${p.unit}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function rbUpdateIngCost(i) {
  const cm = catalogMap();
  const ing = rbIngredients[i];
  if (!ing) return;
  const p = cm[ing.product_name];
  const cost = p ? calcIngCost(ing, p) : 0;
  const el = document.getElementById('rbi-cost-' + i);
  if (el) el.textContent = '₪' + cost.toFixed(2);
}

function rbAddIngredient() {
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center';
  modal.setAttribute('data-ing-modal', '');
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:24px;width:100%;max-width:480px;max-height:75vh;display:flex;flex-direction:column">
      <div style="font-size:16px;font-weight:800;margin-bottom:12px">בחר מוצר</div>
      <input class="input mb-12" id="ing-search" type="text" placeholder="חפש מוצר..." oninput="rbFilterSearch(this.value)" autofocus>
      <div id="ing-list" style="overflow-y:auto;flex:1;margin:0 -24px;padding:0 24px"></div>
      <button onclick="this.closest('[data-ing-modal]').remove()" class="btn-ghost mt-8">ביטול</button>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  rbFilterSearch('');
  setTimeout(() => document.getElementById('ing-search')?.focus(), 100);
}

function rbFilterSearch(q) {
  const el = document.getElementById('ing-list');
  if (!el) return;
  const filtered = ptCatalog.filter(p => !q || p.name.includes(q));
  const addManualBtn = `
    <div onclick="rbAddProductInline('${q.replace(/'/g, "\\'")}')" style="display:flex;align-items:center;gap:10px;padding:12px 0;cursor:pointer;border-top:1px solid var(--border);margin-top:4px">
      <div style="width:36px;height:36px;background:var(--surface-low);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:18px;font-weight:700;color:var(--primary)">+</div>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--primary)">${q ? `הוסף "${q}" ידנית` : 'הוסף מוצר חדש ידנית'}</div>
        <div style="font-size:11px;color:var(--on-surface-3)">יצירה ושמירה בקטלוג + הוספה למתכון</div>
      </div>
    </div>`;
  el.innerHTML = (filtered.map(p => `
    <div onclick="rbSelectIngredient('${p.id}')" class="list-row" style="cursor:pointer">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:700">${p.name}</div>
        <div style="font-size:11px;color:var(--on-surface-3)">${p.unit}${p.waste_pct > 0 ? ` · פחת ${p.waste_pct}%` : ''}</div>
      </div>
      <div style="font-size:13px;font-weight:800;color:var(--primary)">₪${p.price_per_unit.toFixed(2)}</div>
    </div>`).join('') || '<div style="padding:12px 0;text-align:center;color:var(--on-surface-3);font-size:13px">לא נמצאו מוצרים</div>') + addManualBtn;
}

function rbAddProductInline(prefillName) {
  document.querySelector('[data-ing-modal]')?.remove();
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:flex-end;justify-content:center';
  modal.setAttribute('data-inline-product-modal', '');
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:24px 24px 48px;width:100%;max-width:480px">
      <div style="font-size:16px;font-weight:800;margin-bottom:6px">מוצר חדש</div>
      <div style="font-size:12px;color:var(--on-surface-3);margin-bottom:16px">יישמר בקטלוג ויתווסף למתכון</div>
      <label class="field-label">שם מוצר *</label>
      <input class="input mb-12" id="ipm-name" type="text" placeholder="שם המוצר" value="${prefillName}">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div>
          <label class="field-label">מחיר ליחידה (₪) *</label>
          <input class="input" id="ipm-price" type="number" step="0.01" placeholder="0.00">
        </div>
        <div>
          <label class="field-label">יחידת מידה</label>
          ${unitSelect('ק"ג', 'ipm-unit')}
        </div>
      </div>
      <label class="field-label">אחוז פחת % (אופציונלי)</label>
      <input class="input mb-16" id="ipm-waste" type="number" value="0" min="0" max="99">
      <button onclick="rbSaveInlineProduct()" class="btn-primary mb-8">הוסף למתכון ולקטלוג</button>
      <button onclick="this.closest('[data-inline-product-modal]').remove()" class="btn-ghost">ביטול</button>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  setTimeout(() => document.getElementById('ipm-price')?.focus(), 100);
}

async function rbSaveInlineProduct() {
  const name = document.getElementById('ipm-name')?.value.trim();
  const price = parseFloat(document.getElementById('ipm-price')?.value) || 0;
  const unit = document.getElementById('ipm-unit')?.value || 'ק"ג';
  const waste = parseFloat(document.getElementById('ipm-waste')?.value) || 0;
  if (!name) { showToast('הכנס שם מוצר'); return; }

  // Save to catalog
  const result = await DB.insert('product_catalog', { name, price_per_unit: price, unit, waste_pct: waste });
  if (result) {
    ptCatalog.push(result);
    ptCatalog.sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }

  // Add to recipe
  const newIng = { product_name: name, unit, quantity: 0, product_id: result?.id || null };
  rbIngredients.push(newIng);
  document.querySelector('[data-inline-product-modal]')?.remove();
  rbRenderIngredients();
  rbRecalc();
  showToast(`"${name}" נוסף לקטלוג ולמתכון`);
}

function rbSelectIngredient(productId) {
  const p = ptCatalog.find(x => x.id === productId);
  if (!p) return;
  if (rbIngredients.find(i => i.product_name === p.name)) {
    showToast('מוצר כבר קיים במתכון');
    document.querySelector('[data-ing-modal]')?.remove();
    return;
  }
  // Default recipe unit = product base unit (user can change to compatible unit)
  rbIngredients.push({ product_name: p.name, unit: p.unit || 'ק"ג', quantity: 0, product_id: p.id });
  document.querySelector('[data-ing-modal]')?.remove();
  rbRenderIngredients();
  rbRecalc();
}

function rbRecalc() {
  const el = document.getElementById('rb-calc');
  if (!el) return;
  const menuPrice = parseFloat(document.getElementById('rb-price')?.value) || 0;
  const targetFc = parseFloat(document.getElementById('rb-target-fc')?.value) || 30;
  const oltPct = parseFloat(document.getElementById('rb-olt')?.value) || 0;
  const cm = catalogMap();
  let totalCost = 0;
  rbIngredients.forEach(ing => {
    const p = cm[ing.product_name];
    if (p) totalCost += calcIngCost(ing, p);
  });
  const fcPct = menuPrice > 0 ? (totalCost / menuPrice * 100) : 0;
  const recommendedPrice = totalCost > 0 ? Math.ceil(totalCost / (targetFc / 100)) : 0;
  const grossProfit = menuPrice - totalCost;
  const grossProfitPct = menuPrice > 0 ? (grossProfit / menuPrice * 100) : 0;
  const netProfit = grossProfit - (menuPrice * oltPct / 100);
  const netProfitPct = menuPrice > 0 ? (netProfit / menuPrice * 100) : 0;
  const fcColor = fcPct === 0 ? 'var(--on-surface-3)' : fcPct <= 28 ? 'var(--success)' : fcPct <= 35 ? '#F59E0B' : 'var(--error)';

  const rows = [
    { label: 'עלות כוללת', value: `₪${totalCost.toFixed(2)}`, big: true, color: 'var(--on-surface)' },
    { label: 'FC% בפועל', value: fcPct > 0 ? fcPct.toFixed(1) + '%' : '—', big: true, color: fcColor },
    { label: 'רווח גולמי', value: menuPrice ? `₪${grossProfit.toFixed(2)} (${grossProfitPct.toFixed(0)}%)` : '—', color: grossProfit >= 0 ? 'var(--success)' : 'var(--error)' },
    ...(oltPct > 0 && menuPrice ? [{ label: `רווח נטו אחרי ${oltPct}% OLT`, value: `₪${netProfit.toFixed(2)} (${netProfitPct.toFixed(0)}%)`, color: netProfit >= 0 ? 'var(--success)' : 'var(--error)' }] : [])
  ];

  el.innerHTML = `
    <div style="border-bottom:2px solid var(--primary);padding-bottom:12px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--on-surface-3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">סיכום מחירים</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        ${rows.map(r => `
          <div style="background:white;border-radius:8px;padding:10px;border:1px solid var(--border)">
            <div style="font-size:10px;color:var(--on-surface-3)">${r.label}</div>
            <div style="font-size:${r.big ? '20px' : '15px'};font-weight:800;color:${r.color}">${r.value}</div>
          </div>`).join('')}
      </div>
    </div>
    ${recommendedPrice > 0 ? `
      <div style="background:rgba(107,53,184,0.06);border-radius:8px;padding:12px;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:13px;color:var(--on-surface-2)">💡 מחיר מומלץ ל-<strong>${targetFc}%</strong> FC</div>
        <div style="font-size:20px;font-weight:800;color:var(--primary)">₪${recommendedPrice}
          ${oltPct > 0 ? `<span style="font-size:12px;color:var(--on-surface-3)"> / ₪${Math.ceil(recommendedPrice/(1-oltPct/100))} +OLT</span>` : ''}
        </div>
      </div>` : ''}`;
}

async function saveRecipe() {
  const name = document.getElementById('rb-name')?.value.trim();
  if (!name) { showToast('הכנס שם מנה'); return; }
  const recipeData = {
    name,
    category: document.getElementById('rb-cat')?.value.trim() || null,
    menu_price: parseFloat(document.getElementById('rb-price')?.value) || null,
    target_fc_pct: parseFloat(document.getElementById('rb-target-fc')?.value) || 30,
    olt_commission_pct: parseFloat(document.getElementById('rb-olt')?.value) || 0
  };
  let recipeId = rbRecipeId;
  if (recipeId) {
    await DB.update('recipes', `?id=eq.${recipeId}`, recipeData);
  } else {
    const r = await DB.insert('recipes', recipeData);
    recipeId = r?.id;
  }
  if (!recipeId) { showToast('שגיאה בשמירה'); return; }
  await DB.delete('recipe_ingredients', `?recipe_id=eq.${recipeId}`);
  for (const ing of rbIngredients) {
    if (!ing.quantity) continue;
    await DB.insert('recipe_ingredients', { recipe_id: recipeId, product_name: ing.product_name, product_id: ing.product_id || null, quantity: ing.quantity, unit: ing.unit || null });
  }
  document.querySelector('[data-rb-modal]')?.remove();
  showToast('המתכון נשמר');
  await loadRecipes();
}

async function deleteRecipe(id) {
  if (!confirm('למחוק מתכון זה?')) return;
  await DB.delete('recipe_ingredients', `?recipe_id=eq.${id}`);
  await DB.delete('recipes', `?id=eq.${id}`);
  ptRecipes = ptRecipes.filter(r => r.id !== id);
  document.querySelector('[data-rb-modal]')?.remove();
  renderRecipes();
  showToast('מתכון נמחק');
}
