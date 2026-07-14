// ── Market Prices ─────────────────────────────────────────────

let allMarketPrices = [];
let userPriceAvg = {};
let userPriceHistory = {}; // { productName: [{date, price}] }
let currentMarketCat = 'all';

// ── Category classification ──────────────────────────────────
// Products uploaded via the AI-assisted price-list scan already carry a stored
// category (classified once, correctly, at upload time — see parse-market-pdf.js).
// This regex classifier is only a fallback for legacy rows uploaded before that
// existed. Two prior bugs made vegetables leak into every category: a bare "ים"
// (meant for "פירות ים"/seafood) matches almost any Hebrew plural noun, since ־ים
// is the standard masculine plural suffix (e.g. "ירקות קפואים" was misclassified as
// animal); and a bare "לבן" (meant for dairy/labneh) matches any "white X" product
// (e.g. "בצל לבן"). Both are removed below in favor of more specific terms. "פרי"
// also doesn't match its own plural "פירות" as a substring (Hebrew reorders the
// letters in this word's plural form), so "פירות" is now listed explicitly.
// Order matters — first match wins. animal is checked first so a frozen fish/
// chicken/meat product stays "animal" (per the standing rule: animal-derived
// stays animal regardless of frozen/fresh); drinks and frozen are checked before
// produce/packaged so e.g. "מיץ ענבים" (grape juice) or "ירקות קפואים" (frozen
// vegetables) don't fall into produce just because they share a word with it.
// Additional confirmed collisions (same failure pattern as the ים/לבן bugs above):
// bare "בקר" (beef) matches inside "בקרטון" ("in a carton" — nothing to do with beef);
// bare "עגל" (veal) matches inside "עגלה" (cart/stroller); bare "דג" (fish) matches
// inside "דגן"/"דגנים" (grains/cereal — a very common grocery item); bare "נקטר"
// (meant for nectar drinks) matches inside "נקטרינה" (nectarine, the fruit). Negative
// lookaheads exclude exactly these known false-friend continuations while still
// matching the real word (e.g. "בקר" alone, "דגים", "נקטר מנגו").
const CAT_RULES = {
  animal:   /עוף|בשר|דג(?!ן)|סלמון|פרגית|כבד|ביצ|חלב|גבינ|שמנת|יוגורט|קוטג|מוצרל|פרמז|צ'דר|שרימפ|פירות ים|רכיכות|קלמארי|טונה|אנטריקוט|סינטה|צלע|כתף|פרגי|הודו|ברווז|כבש|טלה|חזיר|בקר(?!טון)|עגל(?!ה)|חזה|פילה|שפונדרה|אסאדו|קבב|קציצ/,
  drinks:   /יין|בירה|וודק|ויסק|קוניאק|ליקר|ערק|רום|ג'ין|טקילה|שמפני|פרוסקו|מיץ|נקטר(?!ינה)|לימונדה|קולה|סודה|משקה קל|מים מינרלי|מי עדן|תוסס|אנרג'י|רד בול|בקבוק יין|פחית משקה/,
  frozen:   /קפוא|גלידה|ארטיק|שרבט/,
  produce:  /ירק|פרי|פירות|עגבני|פלפל|מלפפון|חסה|כרוב|בצל|שום|גזר|תפוח|לימון|אבוקד|עלה|עשב|נענע|פטרוזיל|כוסברה|בזיל|תות|ענב|אפרסק|שזיף|מנגו|אננס|בננ|ארטישוק|שומר|קולרבי|ברוקול|כרובית|תרד|חציל|דלע|קישו|מולוחי|לוביה|שעועית|אפונה|אבטיח|מלון|תמר|תאנ|רימון|פטרי/,
  packaged: /שמן|קמח|סוכר|מלח|אורז|פסטה|עדש|שעורה|כוסמת|קינואה|רוטב|קטשופ|חרדל|מיונז|אכסוס|שמר|אבקה|שוקולד|קפה|תה|קרקר|לחם|לחמניה|פיתה|בגט|טורטי|נאן|עוגי|ביסקוי|ריבה|דבש|סירופ|שוקו|ממרח|חומוס|טחינ|צנים|פיצוח|ממתק|שימור|קופסא|בצק|קינוח/,
  cleaning: /ניקו|סבון|אבקת|שוטף|חיטו|חומר|מגב|ספוג|נייר|שקית|כפפ|ידית|פלסטיק|אלכוהול|כלי חד/
};

function getProductCat(product) {
  // product may be a plain string (legacy call sites) or a row object with a
  // stored category from the upload flow.
  if (typeof product === 'object' && product) {
    if (product.category) return product.category;
    return getProductCat(product.name);
  }
  const n = (product || '').toLowerCase();
  for (const [cat, re] of Object.entries(CAT_RULES)) {
    if (re.test(n)) return cat;
  }
  return 'other';
}

async function renderMarket() {
  const el = document.getElementById('market-list');
  el.innerHTML = `<div class="card-pad"><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px;margin-bottom:8px"></div><div class="skeleton" style="height:44px"></div></div>`;

  const [prices, items] = await Promise.all([
    DB.get('market_prices', '?select=*&order=name.asc'),
    DB.get('invoice_items', '?select=product_name,unit_price,date&unit_price=gt.0&order=date.asc')
  ]);
  allMarketPrices = prices || [];

  // User average + history per product
  const priceMap = {};
  userPriceHistory = {};
  (items || []).forEach(item => {
    const name = (item.product_name || '').trim();
    if (!name || !item.unit_price) return;
    const p = parseFloat(item.unit_price);
    if (!priceMap[name]) priceMap[name] = [];
    priceMap[name].push(p);
    if (!userPriceHistory[name]) userPriceHistory[name] = [];
    userPriceHistory[name].push({ date: item.date, price: p });
  });
  userPriceAvg = {};
  Object.entries(priceMap).forEach(([name, arr]) => {
    userPriceAvg[name] = arr.reduce((s, p) => s + p, 0) / arr.length;
  });

  displayMarket(allMarketPrices);
  renderCommunityBench();
}

function setMarketCat(cat, btn) {
  currentMarketCat = cat;
  document.querySelectorAll('.market-cat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  const search = document.getElementById('market-search')?.value || '';
  applyMarketFilters(search);
}

function filterMarket(q) {
  applyMarketFilters(q);
}

function applyMarketFilters(q) {
  let filtered = allMarketPrices;
  if (currentMarketCat !== 'all') {
    filtered = filtered.filter(p => getProductCat(p) === currentMarketCat);
  }
  if (q) {
    filtered = filtered.filter(p => (p.name || '').includes(q));
  }
  displayMarket(filtered);
}

function displayMarket(prices) {
  const el = document.getElementById('market-list');
  if (!prices.length) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-state-title">אין מוצרים בקטגוריה זו</div>
      <div class="empty-state-sub">נסה קטגוריה אחרת או חיפוש שונה</div>
    </div>`;
    return;
  }

  // Use latest price per product
  const byName = {};
  prices.forEach(p => {
    if (!byName[p.name] || (p.date || '') > (byName[p.name].date || '')) {
      byName[p.name] = p;
    }
  });
  const latest = Object.values(byName).filter(p => p.name && p.price != null && !isNaN(parseFloat(p.price)));
  latest.sort((a, b) => a.name.localeCompare(b.name, 'he'));

  const latestDate = latest.reduce((max, p) => {
    const d = p.date || p.updated_at?.slice(0, 10) || '';
    return d > max ? d : max;
  }, '');
  const aboveCount = latest.filter(p => {
    const u = userPriceAvg[p.name];
    return u && ((u - parseFloat(p.price)) / parseFloat(p.price) * 100) > 5;
  }).length;

  el.innerHTML = `
    <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
      <div style="font-size:11px;color:var(--on-surface-3);font-weight:700">
        עדכון: ${latestDate ? new Date(latestDate + 'T12:00:00').toLocaleDateString('he-IL') : 'לא ידוע'} · ${latest.length} מוצרים
      </div>
      ${aboveCount > 0 ? `<div style="font-size:11px;font-weight:700;color:var(--error)">⚠️ משלם יותר ב-${aboveCount} מוצרים</div>` : ''}
    </div>
    <div style="display:grid;grid-template-columns:1fr auto auto auto;gap:0;font-size:10px;font-weight:700;color:var(--on-surface-3);padding:6px 14px;background:var(--surface-low);border-bottom:1px solid var(--border)">
      <div>מוצר</div>
      <div style="text-align:center;padding:0 8px">מחיר שוק</div>
      <div style="text-align:center;padding:0 8px">המחיר שלך</div>
      <div></div>
    </div>
    ${latest.map(p => {
      const mktPrice = parseFloat(p.price);
      const userPrice = userPriceAvg[p.name];
      const diff = userPrice ? ((userPrice - mktPrice) / mktPrice * 100) : null;
      const diffColor = diff === null ? 'var(--on-surface-3)' : diff > 10 ? 'var(--error)' : diff > 0 ? '#F59E0B' : 'var(--success)';
      const diffText = diff === null ? '' : (diff > 0 ? '+' : '') + diff.toFixed(0) + '%';
      return `
        <div onclick="showPriceHistory('${escHtml(p.name)}')"
          style="display:grid;grid-template-columns:1fr auto auto auto;gap:0;padding:10px 14px;border-bottom:1px solid var(--border);align-items:center;cursor:pointer;transition:background 0.15s"
          onmouseenter="this.style.background='var(--surface-low)'" onmouseleave="this.style.background=''">
          <div>
            <div style="font-size:13px;font-weight:700">${p.name}</div>
            ${p.unit ? `<div style="font-size:10px;color:var(--on-surface-3)">${p.unit}</div>` : ''}
          </div>
          <div style="text-align:center;padding:0 10px">
            <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${mktPrice.toFixed(2)}</div>
          </div>
          <div style="text-align:center;padding:0 8px;min-width:70px">
            ${userPrice ? `
              <div style="font-size:13px;font-weight:700">₪${userPrice.toFixed(2)}</div>
              <div style="font-size:11px;font-weight:700;color:${diffColor}">${diffText}</div>`
            : `<div style="font-size:11px;color:var(--on-surface-3)">—</div>`}
          </div>
          <div style="color:var(--on-surface-3);padding-right:2px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </div>
        </div>`;
    }).join('')}
  `;
}

// ── Price History Modal ─────────────────────────────────────
async function showPriceHistory(productName) {
  const modal = document.getElementById('price-history-modal');
  const content = document.getElementById('price-history-content');
  modal.style.display = 'flex';

  content.innerHTML = `<div style="text-align:center;padding:20px;color:var(--on-surface-3)">טוען...</div>`;

  // Fetch all market price history for this product (market_prices only ever holds
  // the current/latest price — the append-only history log is a separate table)
  const history = await DB.get('market_price_history', `?name=eq.${encodeURIComponent(productName)}&order=date.asc&select=price,date`);

  const mktHistory = (history || [])
    .filter(h => h.date && h.price)
    .map(h => ({ date: h.date, price: parseFloat(h.price) }))
    .sort((a, b) => a.date > b.date ? 1 : -1);

  const userHistory = (userPriceHistory[productName] || [])
    .filter(h => h.date && h.price)
    .sort((a, b) => a.date > b.date ? 1 : -1);

  const currentMarket = mktHistory.length ? mktHistory[mktHistory.length - 1].price : null;
  const currentUser   = userPriceAvg[productName] || null;

  // All dates combined for X axis
  const allDates = [...new Set([...mktHistory.map(h => h.date), ...userHistory.map(h => h.date)])].sort();
  const hasMkt  = mktHistory.length > 0;
  const hasUser = userHistory.length > 0;

  // Chart dimensions
  const W = 320, H = 120, PAD = { t: 12, r: 12, b: 24, l: 44 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;

  let svgChart = '';
  if (allDates.length > 0 && (hasMkt || hasUser)) {
    const allPrices = [...mktHistory.map(h => h.price), ...userHistory.map(h => h.price)];
    const minP = Math.min(...allPrices) * 0.95;
    const maxP = Math.max(...allPrices) * 1.05;
    const xScale = i => PAD.l + (i / Math.max(allDates.length - 1, 1)) * chartW;
    const yScale = p => PAD.t + chartH - ((p - minP) / (maxP - minP)) * chartH;

    // Market line
    let mktPath = '', mktArea = '';
    if (hasMkt) {
      const pts = mktHistory.map(h => {
        const xi = allDates.indexOf(h.date);
        return [xScale(xi), yScale(h.price)];
      });
      mktPath = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
      mktArea = `${mktPath} L${pts[pts.length-1][0]},${PAD.t+chartH} L${pts[0][0]},${PAD.t+chartH} Z`;
    }

    // User line
    let userPath = '';
    if (hasUser) {
      const pts = userHistory.map(h => {
        const xi = allDates.indexOf(h.date);
        return [xScale(xi), yScale(h.price)];
      });
      userPath = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
    }

    // Y axis labels
    const yLabels = [minP, (minP+maxP)/2, maxP].map(p => ({
      y: yScale(p), label: '₪' + p.toFixed(0)
    }));

    // X axis labels (first, middle, last)
    const xLabelIdx = allDates.length > 2
      ? [0, Math.floor(allDates.length/2), allDates.length-1]
      : allDates.map((_, i) => i);
    const xLabels = [...new Set(xLabelIdx)].map(i => ({
      x: xScale(i),
      label: new Date(allDates[i] + 'T12:00:00').toLocaleDateString('he-IL', { month: 'short', day: 'numeric' })
    }));

    svgChart = `
      <svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;direction:ltr">
        <defs>
          <linearGradient id="mktGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--primary)" stop-opacity="0.15"/>
            <stop offset="100%" stop-color="var(--primary)" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <!-- Grid -->
        ${yLabels.map(l => `
          <line x1="${PAD.l}" y1="${l.y}" x2="${W-PAD.r}" y2="${l.y}" stroke="var(--border)" stroke-width="1"/>
          <text x="${PAD.l-4}" y="${l.y+4}" text-anchor="end" font-size="9" fill="var(--on-surface-3)" font-family="inherit">${l.label}</text>
        `).join('')}
        <!-- Market area -->
        ${mktArea ? `<path d="${mktArea}" fill="url(#mktGrad)"/>` : ''}
        <!-- Market line -->
        ${mktPath ? `<path d="${mktPath}" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
        <!-- User line -->
        ${userPath ? `<path d="${userPath}" fill="none" stroke="#F59E0B" stroke-width="2" stroke-dasharray="5,3" stroke-linecap="round" stroke-linejoin="round"/>` : ''}
        <!-- Dots at latest points -->
        ${hasMkt && mktHistory.length ? `<circle cx="${xScale(allDates.indexOf(mktHistory[mktHistory.length-1].date))}" cy="${yScale(mktHistory[mktHistory.length-1].price)}" r="4" fill="var(--primary)"/>` : ''}
        ${hasUser && userHistory.length ? `<circle cx="${xScale(allDates.indexOf(userHistory[userHistory.length-1].date))}" cy="${yScale(userHistory[userHistory.length-1].price)}" r="4" fill="#F59E0B"/>` : ''}
        <!-- X labels -->
        ${xLabels.map(l => `<text x="${l.x}" y="${H-4}" text-anchor="middle" font-size="9" fill="var(--on-surface-3)" font-family="inherit">${l.label}</text>`).join('')}
      </svg>`;
  }

  const diffPct = currentUser && currentMarket
    ? ((currentUser - currentMarket) / currentMarket * 100)
    : null;
  const diffColor = diffPct === null ? 'var(--on-surface-3)' : diffPct > 5 ? 'var(--error)' : diffPct < -5 ? 'var(--success)' : '#F59E0B';

  content.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-size:18px;font-weight:800;color:var(--on-surface)">${productName}</div>
        <div style="font-size:12px;color:var(--on-surface-3);margin-top:2px">היסטוריית מחירים</div>
      </div>
      <button onclick="closePriceHistory()" style="background:var(--surface-low);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;font-family:inherit;color:var(--on-surface-3)">×</button>
    </div>

    <!-- Summary cards -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:var(--surface-low);border-radius:var(--radius-md);padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--on-surface-3);margin-bottom:4px">מחיר שוק עכשיו</div>
        <div style="font-size:20px;font-weight:800;color:var(--primary)">${currentMarket ? '₪' + currentMarket.toFixed(2) : '—'}</div>
        ${mktHistory.length > 1 ? (() => {
          const trend = mktHistory[mktHistory.length-1].price - mktHistory[0].price;
          return `<div style="font-size:11px;font-weight:700;color:${trend > 0 ? 'var(--error)' : 'var(--success)'};margin-top:2px">${trend > 0 ? '↑' : '↓'} ${Math.abs(trend).toFixed(2)} מהתחלה</div>`;
        })() : ''}
      </div>
      <div style="background:var(--surface-low);border-radius:var(--radius-md);padding:12px">
        <div style="font-size:10px;font-weight:700;color:var(--on-surface-3);margin-bottom:4px">המחיר שלך</div>
        <div style="font-size:20px;font-weight:800;color:${diffColor}">${currentUser ? '₪' + currentUser.toFixed(2) : '—'}</div>
        ${diffPct !== null ? `<div style="font-size:11px;font-weight:700;color:${diffColor};margin-top:2px">${diffPct > 0 ? '+' : ''}${diffPct.toFixed(0)}% vs שוק</div>` : ''}
      </div>
    </div>

    <!-- Chart -->
    ${svgChart ? `
    <div style="margin-bottom:12px">
      ${svgChart}
    </div>
    <!-- Legend -->
    <div style="display:flex;gap:16px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:24px;height:2.5px;background:var(--primary);border-radius:2px"></div>
        <span style="font-size:11px;color:var(--on-surface-3);font-weight:600">מחיר שוק</span>
      </div>
      ${hasUser ? `<div style="display:flex;align-items:center;gap:6px">
        <div style="width:24px;height:2px;background:#F59E0B;border-radius:2px;border-top:2px dashed #F59E0B;background:transparent"></div>
        <span style="font-size:11px;color:var(--on-surface-3);font-weight:600">המחיר שלך</span>
      </div>` : ''}
    </div>` : `
    <div style="text-align:center;padding:24px;color:var(--on-surface-3)">
      <div style="font-size:13px">אין נתוני היסטוריה עדיין</div>
      <div style="font-size:11px;margin-top:4px">נתונים יצטברו עם הזמן</div>
    </div>`}

    ${diffPct !== null && diffPct > 0 && currentUser && currentMarket ? `
    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:var(--radius-md);padding:12px;margin-top:8px">
      <div style="font-size:12px;font-weight:700;color:var(--error)">פוטנציאל חיסכון</div>
      <div style="font-size:12px;color:var(--on-surface-2);margin-top:4px;line-height:1.6">
        אם תקנה במחיר השוק — תחסוך <strong>₪${((currentUser - currentMarket)).toFixed(2)}</strong> לכל יחידה.
        ב-100 יחידות לחודש = <strong style="color:var(--error)">₪${Math.round((currentUser - currentMarket) * 100 * 12).toLocaleString('he-IL')} לשנה</strong>.
      </div>
    </div>` : ''}
  `;
}

function closePriceHistory() {
  document.getElementById('price-history-modal').style.display = 'none';
}

function escHtml(str) {
  return (str || '').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}

async function renderCommunityBench() {
  const el = document.getElementById('community-bench');
  if (!el) return;

  el.innerHTML = `<div class="card-pad"><div class="skeleton" style="height:40px;margin-bottom:8px"></div><div class="skeleton" style="height:40px"></div></div>`;

  try {
    const jwt = Auth.jwt;
    if (!jwt) { el.innerHTML = ''; return; }

    const res = await fetch('/.netlify/functions/community-bench', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt }
    });
    const data = await res.json();

    if (!Array.isArray(data) || !data.length) {
      el.innerHTML = `<div class="card-pad" style="text-align:center;padding:20px">
        <div style="font-size:13px;font-weight:700;margin-bottom:6px">בנצ'מרק קהילתי</div>
        <div style="font-size:12px;color:var(--on-surface-3);line-height:1.6">הנתונים יופיעו כאשר לפחות 5 עסקים סרקו חשבוניות עם אותו מוצר.</div>
      </div>`;
      return;
    }

    el.innerHTML = `
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--on-surface-3);font-weight:700">
        ממוצע שוק — ${data[0]?.period || ''} · ${data.length} מוצרים
      </div>
      ${data.map(p => {
        const userPrice = userPriceAvg[p.product_name];
        const avgPrice  = parseFloat(p.avg_price);
        const diff = userPrice ? ((userPrice - avgPrice) / avgPrice * 100) : null;
        const diffColor = diff === null ? 'var(--on-surface-3)' : diff > 5 ? 'var(--error)' : diff < -5 ? 'var(--success)' : '#F59E0B';
        return `<div class="list-row">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:700">${p.product_name}</div>
            <div style="font-size:11px;color:var(--on-surface-3)">${p.sample_count} עסקים · ₪${parseFloat(p.min_price).toFixed(2)}–₪${parseFloat(p.max_price).toFixed(2)}</div>
          </div>
          <div style="text-align:left">
            <div style="font-size:14px;font-weight:800;color:var(--primary)">₪${avgPrice.toFixed(2)}</div>
            ${userPrice ? `<div style="font-size:11px;font-weight:700;color:${diffColor}">${diff > 0 ? '+' : ''}${diff?.toFixed(0)}% שלך</div>` : ''}
          </div>
        </div>`;
      }).join('')}`;
  } catch { el.innerHTML = ''; }
}
