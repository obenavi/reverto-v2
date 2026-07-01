// Enhanced monthly summary email with market comparison & AI analysis
// Triggered by GitHub Actions on the last day of each month

function calcDueDate(invoiceDate, terms) {
  const d = new Date((invoiceDate || '').slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return new Date();
  const eom = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const add = (n) => { const r = new Date(eom); r.setDate(r.getDate() + n); return r; };
  switch (terms) {
    case 'cash_delivery': return d;
    case 'cash_eom':      return eom;
    case 'net30':         return add(30);
    case 'net60':         return add(60);
    case 'net90':         return add(90);
    default:              return add(30);
  }
}

const TERMS_LABELS = {
  cash_delivery: 'מזומן בקבלה', order_time: 'תשלום בהזמנה',
  cash_eom: 'מזומן סוף חודש', net30: 'שוטף+30', net60: 'שוטף+60', net90: 'שוטף+90'
};

const fmt = n => Math.round(n).toLocaleString('he-IL');
const fmtDec = (n, d=1) => (+n).toFixed(d);

// Fuzzy match: does invoice product name relate to a market price name?
function matchMarket(productName, marketPrices) {
  const pn = productName.toLowerCase().trim();
  // Exact match first
  const exact = marketPrices.find(m => m.name.toLowerCase().trim() === pn);
  if (exact) return exact;
  // Keyword overlap: split into words, check if significant words match
  const pWords = pn.split(/[\s\/,]+/).filter(w => w.length > 2);
  let best = null, bestScore = 0;
  for (const m of marketPrices) {
    const mn = m.name.toLowerCase().trim();
    const mWords = mn.split(/[\s\/,]+/).filter(w => w.length > 2);
    const shared = pWords.filter(w => mWords.some(mw => mw.includes(w) || w.includes(mw)));
    const score = shared.length / Math.max(pWords.length, mWords.length);
    if (score > bestScore && score >= 0.5) { best = m; bestScore = score; }
  }
  return best;
}

async function callClaude(systemPrompt, userPrompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (!res.ok) return null;
    const d = await res.json();
    return d.content?.[0]?.text || null;
  } catch { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  const secret = event.headers['x-cron-secret'] || '';
  if (secret !== process.env.CRON_SECRET) return { statusCode: 401 };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const RESEND_KEY   = process.env.RESEND_API_KEY;
  const SITE_URL     = process.env.SITE_URL || 'https://reverto.cloud';
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  const now = new Date();
  const dayUTC = now.getUTCDay(); const hourUTC = now.getUTCHours();
  if (dayUTC === 6) return { statusCode: 200, body: JSON.stringify({ skipped: 'Shabbat' }) };
  if (dayUTC === 5 && hourUTC >= 12) return { statusCode: 200, body: JSON.stringify({ skipped: 'Friday' }) };

  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd     = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
  const monthName    = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

  try {
    // Fetch market prices once for all users
    const mpRes = await fetch(`${SUPABASE_URL}/rest/v1/market_prices?select=name,price,unit&order=updated_at.desc`, { headers: H });
    const allMarket = mpRes.ok ? await mpRes.json() : [];
    // Dedupe market prices by name (keep most recent)
    const marketMap = {};
    for (const m of allMarket) {
      if (!marketMap[m.name]) marketMap[m.name] = m;
    }
    const marketPrices = Object.values(marketMap);

    const usersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?plan=eq.pro&is_active=eq.true&email=not.is.null&onboarding_done=eq.true&select=id,email,business_name,contact_name,category`,
      { headers: H }
    );
    const users = await usersRes.json();
    let sent = 0;

    for (const user of (users || [])) {
      if (!user.email) continue;

      const [invRes, revRes, supRes, oldInvRes, itemsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/invoices?user_id=eq.${user.id}&date=gte.${monthStart}&select=*`, { headers: H }),
        fetch(`${SUPABASE_URL}/rest/v1/daily_revenues?user_id=eq.${user.id}&date=gte.${monthStart}&select=date,amount`, { headers: H }),
        fetch(`${SUPABASE_URL}/rest/v1/suppliers?user_id=eq.${user.id}&select=name,payment_terms`, { headers: H }),
        fetch(`${SUPABASE_URL}/rest/v1/invoices?user_id=eq.${user.id}&date=gte.${threeMonthsAgo}&date=lt.${monthStart}&select=supplier_name,total_amount,date,delivery_status,adjustments`, { headers: H }),
        fetch(`${SUPABASE_URL}/rest/v1/invoice_items?user_id=eq.${user.id}&date=gte.${monthStart}&select=product_name,quantity,unit_price,unit,supplier_name,total_price`, { headers: H })
      ]);

      const invoices    = await invRes.json();
      if (!invoices?.length) continue;
      const revenues    = (await revRes.json()) || [];
      const suppliers   = (await supRes.json()) || [];
      const oldInvoices = (await oldInvRes.json()) || [];
      const items       = (await itemsRes.json()) || [];

      // ── Basic financials ────────────────────────────────────
      const totalRevenue = revenues.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
      const supMap = {};
      invoices.forEach(inv => {
        const name = inv.supplier_name || '—';
        if (!supMap[name]) supMap[name] = { total: 0, credit: 0, open: 0, returned: 0, not_arrived: 0 };
        supMap[name].total += parseFloat(inv.total_amount || inv.total || 0);
        const adj = inv.adjustments ? (typeof inv.adjustments === 'string' ? JSON.parse(inv.adjustments) : inv.adjustments) : [];
        supMap[name].credit += adj.reduce((s, a) => s + (a.credit_amount || 0), 0);
        if (inv.delivery_status === 'pending')     supMap[name].open++;
        if (inv.delivery_status === 'returned')    supMap[name].returned++;
        if (inv.delivery_status === 'not_arrived') supMap[name].not_arrived++;
      });
      const totalInvoiced  = Object.values(supMap).reduce((s, v) => s + v.total, 0);
      const totalCredit    = Object.values(supMap).reduce((s, v) => s + v.credit, 0);
      const totalNet       = totalInvoiced - totalCredit;
      const openCount      = invoices.filter(i => i.delivery_status === 'pending').length;
      const fcPct          = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;

      // ── Payment forecast ────────────────────────────────────
      const termMap = {};
      suppliers.forEach(s => { if (s.name) termMap[s.name] = s.payment_terms || 'net30'; });
      const payForecastMap = {};
      [...invoices, ...oldInvoices].forEach(inv => {
        const terms   = termMap[inv.supplier_name] || 'net30';
        if (terms === 'order_time') return;
        const dueDate = calcDueDate(inv.date, terms).toISOString().slice(0, 10);
        if (dueDate >= monthStart && dueDate <= monthEnd) {
          const adj = inv.adjustments ? (typeof inv.adjustments === 'string' ? JSON.parse(inv.adjustments) : inv.adjustments) : [];
          const credit = adj.reduce((s, a) => s + (a.credit_amount || 0), 0);
          const net = parseFloat(inv.total_amount || inv.total || 0) - credit;
          const key = inv.supplier_name || '—';
          if (!payForecastMap[key]) payForecastMap[key] = { total: 0, count: 0, terms };
          payForecastMap[key].total += net;
          payForecastMap[key].count++;
        }
      });
      const totalPayForecast = Object.values(payForecastMap).reduce((s, v) => s + v.total, 0);

      // ── Market sensitivity analysis ─────────────────────────
      const productAgg = {};
      for (const item of items) {
        const pn = (item.product_name || '').trim();
        if (!pn) continue;
        const qty  = parseFloat(item.quantity  || 0);
        const up   = parseFloat(item.unit_price || 0);
        if (!qty || !up) continue;
        if (!productAgg[pn]) productAgg[pn] = { qty: 0, totalSpent: 0, unit: item.unit || 'יח\'', prices: [] };
        productAgg[pn].qty        += qty;
        productAgg[pn].totalSpent += qty * up;
        productAgg[pn].prices.push(up);
      }

      const savings = [];
      for (const [pn, agg] of Object.entries(productAgg)) {
        const market = matchMarket(pn, marketPrices);
        if (!market) continue;
        const marketPrice = parseFloat((market.price || '0').replace(/[^\d.]/g, ''));
        if (!marketPrice) continue;
        const avgPaid  = agg.totalSpent / agg.qty;
        const diff     = avgPaid - marketPrice;
        if (diff <= 0.05) continue; // only show where we pay MORE than market
        const savingMonth  = diff * agg.qty;
        const savingYear   = savingMonth * 12;
        savings.push({
          product: pn,
          avgPaid: avgPaid.toFixed(2),
          marketPrice: marketPrice.toFixed(2),
          diff: diff.toFixed(2),
          qty: agg.qty.toFixed(1),
          unit: market.unit || agg.unit,
          savingMonth,
          savingYear
        });
      }
      savings.sort((a, b) => b.savingMonth - a.savingMonth);
      const topSavings = savings.slice(0, 7);
      const totalSavingMonth = topSavings.reduce((s, r) => s + r.savingMonth, 0);
      const totalSavingYear  = topSavings.reduce((s, r) => s + r.savingYear,  0);

      // ── AI Analysis ─────────────────────────────────────────
      const AI_SYSTEM = `אתה יועץ כלכלי למסעדות. כתוב ניתוח קצר ומחדד בעברית לבעל מסעדה, בגוף שני, 3-4 משפטים בלבד. חייב לכלול מספרים מדויקים. ללא Markdown.`;

      const aiPrompt = `
מסעדה: ${user.business_name} | קטגוריה: ${user.category || 'מסעדה'}
חודש: ${monthName}
רכש: ₪${fmt(totalInvoiced)} | זיכויים: ₪${fmt(totalCredit)} | FC: ${fmtDec(fcPct)}%
${totalRevenue > 0 ? `מחזור: ₪${fmt(totalRevenue)}` : ''}
${topSavings.length > 0 ? `
הזדמנויות חיסכון:
${topSavings.slice(0,5).map(s => `${s.product}: משלם ₪${s.avgPaid} vs שוק ₪${s.marketPrice} | ${s.qty}${s.unit} = חיסכון פוטנציאלי ₪${fmt(s.savingMonth)}/חודש`).join('\n')}
פוטנציאל כולל: ₪${fmt(totalSavingMonth)}/חודש = ₪${fmt(totalSavingYear)}/שנה` : 'אין נתוני מחירים להשוואה החודש.'}
נסח ניתוח מעורר השראה שמדגיש את ה"אפקט הוואו" של החיסכון.`.trim();

      const aiText = await callClaude(AI_SYSTEM, aiPrompt);

      // ── Build HTML email ────────────────────────────────────
      const supplierRows = Object.entries(supMap)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, s]) => {
          const netBg = s.credit > 0 ? '#f0fdf4' : '#fff';
          return `
          <tr>
            <td style="padding:10px 14px;border-bottom:1px solid #f0edf8;font-weight:600;color:#1C0A2E">${name}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f0edf8;text-align:left;color:#444">₪${fmt(s.total)}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f0edf8;text-align:left;color:#16a34a;font-weight:${s.credit > 0 ? '700' : '400'}">${s.credit > 0 ? '₪' + fmt(s.credit) : '—'}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f0edf8;text-align:left;background:${netBg};font-weight:700;color:#4A1F85">₪${fmt(s.total - s.credit)}</td>
            <td style="padding:10px 14px;border-bottom:1px solid #f0edf8;text-align:center;color:${s.open > 0 ? '#D97706' : '#16a34a'}">
              ${s.open > 0 ? `<span style="background:#fff7ed;padding:2px 8px;border-radius:20px;font-size:11px">⚠ ${s.open} פתוח</span>` : '<span style="color:#16a34a;font-size:13px">✓</span>'}
            </td>
          </tr>`;
        }).join('');

      const savingsRows = topSavings.map((s, i) => `
        <tr style="background:${i % 2 === 0 ? '#fff' : '#faf8ff'}">
          <td style="padding:10px 14px;border-bottom:1px solid #ede9fe;font-weight:600;color:#1C0A2E">${s.product}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #ede9fe;text-align:center;color:#666;font-size:12px">${s.qty} ${s.unit}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #ede9fe;text-align:left;color:#dc2626;font-weight:700">₪${s.avgPaid}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #ede9fe;text-align:left;color:#16a34a;font-weight:700">₪${s.marketPrice}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #ede9fe;text-align:left;color:#D97706;font-weight:700">₪${fmtDec(+s.diff, 2)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #ede9fe;text-align:left;background:#fff7ed;font-weight:800;color:#c2410c">₪${fmt(s.savingMonth)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #ede9fe;text-align:left;background:#fef3c7;font-weight:800;color:#92400E">₪${fmt(s.savingYear)}</td>
        </tr>`).join('');

      const payRows = Object.entries(payForecastMap)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([sup, v]) => `
          <tr>
            <td style="padding:8px 14px;border-bottom:1px solid #ede9fe;color:#1C0A2E;font-weight:600">${sup}<br><span style="font-size:10px;color:#888;font-weight:400">${TERMS_LABELS[v.terms] || v.terms}</span></td>
            <td style="padding:8px 14px;border-bottom:1px solid #ede9fe;text-align:center;color:#888;font-size:12px">${v.count} חשבוניות</td>
            <td style="padding:8px 14px;border-bottom:1px solid #ede9fe;text-align:left;font-weight:800;color:#4A1F85">₪${fmt(v.total)}</td>
          </tr>`).join('');

      const html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{font-family:-apple-system,Arial,sans-serif;background:#F4F2FA;margin:0;padding:24px 12px;direction:rtl}
  .wrap{max-width:620px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(74,31,133,0.12)}
  table{width:100%;border-collapse:collapse}
  th{font-size:11px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.5px}
  .kpi-box{flex:1;border-radius:12px;padding:16px;text-align:center;min-width:0}
  .kpi-label{font-size:11px;color:#888;margin-bottom:6px;font-weight:600}
  .kpi-value{font-size:24px;font-weight:800;line-height:1}
</style>
</head>
<body>

<div class="wrap">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#3D1582,#6B35B8,#9B6DD6);padding:32px 28px;text-align:center">
    <div style="font-size:28px;font-weight:800;color:white;letter-spacing:-1px">Reverto</div>
    <div style="font-size:15px;color:rgba(255,255,255,0.8);margin-top:6px">דוח חודשי — ${monthName}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:2px">${user.business_name}</div>
  </div>

  <div style="padding:28px 24px">

    <p style="font-size:15px;color:#444;margin:0 0 20px">שלום ${user.contact_name || user.business_name || ''},</p>

    <!-- KPI Row -->
    <div style="display:flex;gap:10px;margin-bottom:24px">
      <div class="kpi-box" style="background:#f3effe">
        <div class="kpi-label">רכש נטו</div>
        <div class="kpi-value" style="color:#4A1F85">₪${fmt(totalNet)}</div>
        ${totalCredit > 0 ? `<div style="font-size:11px;color:#16a34a;margin-top:4px;font-weight:600">זיכוי ₪${fmt(totalCredit)}</div>` : ''}
      </div>
      ${totalRevenue > 0 ? `
      <div class="kpi-box" style="background:#f0f9ff">
        <div class="kpi-label">מחזור Z</div>
        <div class="kpi-value" style="color:#0891B2">₪${fmt(totalRevenue)}</div>
      </div>
      <div class="kpi-box" style="background:${fcPct > 33 ? '#fef2f2' : '#f0fdf4'}">
        <div class="kpi-label">Food Cost</div>
        <div class="kpi-value" style="color:${fcPct > 33 ? '#dc2626' : '#16a34a'}">${fmtDec(fcPct)}%</div>
        <div style="font-size:10px;color:${fcPct > 33 ? '#dc2626' : '#16a34a'};margin-top:4px">${fcPct > 33 ? '↑ מעל היעד' : '↓ בתוך היעד'}</div>
      </div>` : ''}
    </div>

    ${openCount > 0 ? `
    <a href="${SITE_URL}/app" style="display:block;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px;margin-bottom:20px;text-decoration:none;color:#c2410c;font-size:13px;font-weight:600">
      ⚠️ ${openCount} חשבונית${openCount > 1 ? 'ות' : ''} פתוח${openCount > 1 ? 'ות' : 'ה'} לאישור קבלה — לחץ לסיום מהיר ←
    </a>` : ''}

    <!-- Supplier table -->
    <div style="font-size:16px;font-weight:800;color:#1C0A2E;margin-bottom:12px">פירוט רכש לפי ספק</div>
    <div style="border-radius:12px;overflow:hidden;border:1px solid #ede9fe;margin-bottom:28px">
      <table>
        <thead style="background:#f8f5ff">
          <tr>
            <th style="padding:10px 14px;text-align:right">ספק</th>
            <th style="padding:10px 14px;text-align:left">חשבוניות</th>
            <th style="padding:10px 14px;text-align:left">זיכויים</th>
            <th style="padding:10px 14px;text-align:left">נטו</th>
            <th style="padding:10px 14px;text-align:center">קבלה</th>
          </tr>
        </thead>
        <tbody>${supplierRows}</tbody>
      </table>
    </div>

    ${topSavings.length > 0 ? `
    <!-- WOW Section: Market sensitivity -->
    <div style="background:linear-gradient(135deg,#1C0A2E,#3D1582);border-radius:16px;padding:24px;margin-bottom:28px">
      <div style="font-size:13px;font-weight:700;color:#C084FC;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">ניתוח חיסכון פוטנציאלי</div>
      <div style="font-size:22px;font-weight:800;color:#fff;margin-bottom:4px">
        תוכל לחסוך ₪${fmt(totalSavingMonth)} בחודש
      </div>
      <div style="font-size:14px;color:rgba(255,255,255,0.65)">
        זה <span style="color:#FCD34D;font-weight:800">₪${fmt(totalSavingYear)} בשנה</span> — אם תקנה ${topSavings.length} מוצרים במחיר השוק
      </div>
    </div>

    <div style="font-size:16px;font-weight:800;color:#1C0A2E;margin-bottom:12px">טבלת רגישות — כמה כסף על השולחן?</div>
    <div style="border-radius:12px;overflow:hidden;border:1px solid #ede9fe;margin-bottom:28px;overflow-x:auto">
      <table style="min-width:560px">
        <thead style="background:#f8f5ff">
          <tr>
            <th style="padding:10px 14px;text-align:right">מוצר</th>
            <th style="padding:10px 14px;text-align:center">כמות</th>
            <th style="padding:10px 14px;text-align:left;color:#dc2626">שילמת</th>
            <th style="padding:10px 14px;text-align:left;color:#16a34a">מחיר שוק</th>
            <th style="padding:10px 14px;text-align:left">הפרש/יח'</th>
            <th style="padding:10px 14px;text-align:left;background:#fff7ed">חיסכון/חודש</th>
            <th style="padding:10px 14px;text-align:left;background:#fef3c7">חיסכון/שנה</th>
          </tr>
        </thead>
        <tbody>${savingsRows}</tbody>
        <tfoot style="background:#1C0A2E">
          <tr>
            <td colspan="5" style="padding:12px 14px;color:rgba(255,255,255,0.7);font-size:12px">סה"כ פוטנציאל חיסכון</td>
            <td style="padding:12px 14px;font-weight:800;color:#FCD34D;font-size:16px">₪${fmt(totalSavingMonth)}</td>
            <td style="padding:12px 14px;font-weight:800;color:#FCD34D;font-size:16px">₪${fmt(totalSavingYear)}</td>
          </tr>
        </tfoot>
      </table>
    </div>` : ''}

    ${aiText ? `
    <!-- AI Analysis -->
    <div style="background:#f8f5ff;border-right:4px solid #6B35B8;border-radius:0 12px 12px 0;padding:18px 20px;margin-bottom:28px">
      <div style="font-size:12px;font-weight:700;color:#6B35B8;letter-spacing:1px;text-transform:uppercase;margin-bottom:10px">
        ✦ ניתוח AI — ${monthName}
      </div>
      <div style="font-size:14px;color:#333;line-height:1.8">${aiText.replace(/\n/g, '<br>')}</div>
    </div>` : ''}

    ${Object.keys(payForecastMap).length ? `
    <!-- Payment forecast -->
    <div style="font-size:16px;font-weight:800;color:#1C0A2E;margin-bottom:12px">תשלומים צפויים החודש</div>
    <div style="border-radius:12px;overflow:hidden;border:1px solid #ede9fe;margin-bottom:28px">
      <table>
        <thead style="background:#f8f5ff">
          <tr>
            <th style="padding:10px 14px;text-align:right">ספק</th>
            <th style="padding:10px 14px;text-align:center">חשבוניות</th>
            <th style="padding:10px 14px;text-align:left">סכום</th>
          </tr>
        </thead>
        <tbody>${payRows}</tbody>
        <tfoot style="background:#f8f5ff">
          <tr>
            <td colspan="2" style="padding:10px 14px;font-weight:700;color:#4A1F85">סה"כ יוצא החודש</td>
            <td style="padding:10px 14px;font-weight:800;font-size:16px;color:#4A1F85">₪${fmt(totalPayForecast)}</td>
          </tr>
        </tfoot>
      </table>
    </div>` : ''}

    <!-- CTA -->
    <div style="text-align:center;margin:28px 0 8px">
      <a href="${SITE_URL}/app.html?goto=invoices" style="display:inline-block;background:linear-gradient(135deg,#3D1582,#6B35B8);color:white;text-decoration:none;padding:14px 36px;border-radius:30px;font-size:15px;font-weight:800;letter-spacing:-0.3px">
        כניסה לדוח המלא ב-Reverto ←
      </a>
    </div>

    <p style="font-size:11px;color:#bbb;text-align:center;margin-top:20px">דוח זה נשלח אוטומטית בסוף כל חודש על ידי Reverto · <a href="${SITE_URL}" style="color:#bbb">reverto.cloud</a></p>
  </div>
</div>
</body></html>`;

      if (RESEND_KEY) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Reverto <noreply@mail.reverto.cloud>',
            to: [user.email],
            subject: `📊 דוח חודשי ${monthName} — ${user.business_name}${totalSavingMonth > 0 ? ` | חיסכון פוטנציאלי ₪${fmt(totalSavingMonth)}/חודש` : ''}`,
            html
          })
        });
        sent++;
      }
    }

    return { statusCode: 200, body: JSON.stringify({ sent, month: monthName }) };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
