// One-shot demo email sender — uses Netlify env vars already configured
// DELETE this file after the demo is confirmed

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const SITE_URL   = process.env.SITE_URL || 'https://reverto.cloud';
  const to         = (JSON.parse(event.body || '{}').to) || 'revertoo.ino@gmail.com';

  if (!RESEND_KEY) return { statusCode: 500, body: 'Missing RESEND_API_KEY' };

  function calcDueDate(invoiceDate, terms) {
    const d = new Date((invoiceDate || '').slice(0, 10) + 'T00:00:00');
    if (isNaN(d)) return new Date();
    const eom = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const add = (n) => { const r = new Date(eom); r.setDate(r.getDate() + n); return r; };
    switch (terms) {
      case 'cash_delivery': return d;
      case 'cash_eom':      return eom;
      case 'net30': return add(30);
      case 'net60': return add(60);
      case 'net90': return add(90);
      default:      return add(30);
    }
  }

  const TERMS_LABELS = {
    cash_delivery: 'מזומן בקבלה', cash_eom: 'מזומן סוף חודש',
    net30: 'שוטף+30', net60: 'שוטף+60', net90: 'שוטף+90'
  };

  const now      = new Date();
  const thisMonth = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
  const mStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const mEnd     = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const m1 = new Date(now.getFullYear(), now.getMonth() - 1, 10).toISOString().slice(0, 10);
  const m2 = new Date(now.getFullYear(), now.getMonth() - 2, 10).toISOString().slice(0, 10);
  const m3 = new Date(now.getFullYear(), now.getMonth() - 3, 10).toISOString().slice(0, 10);
  const d  = mStart.slice(0, 7);

  const revenues = [18400, 21300, 19800, 17500];
  const totalRevenue = revenues.reduce((s, v) => s + v, 0);

  const invoices = [
    { supplier_name: 'ירקות טריים בע"מ', total_amount: 4200, date: `${d}-03`, delivery_status: 'closed',      credit: 320 },
    { supplier_name: 'ירקות טריים בע"מ', total_amount: 3800, date: `${d}-17`, delivery_status: 'closed',      credit: 0   },
    { supplier_name: 'בשר פרמיום',        total_amount: 9600, date: `${d}-02`, delivery_status: 'closed',      credit: 0   },
    { supplier_name: 'בשר פרמיום',        total_amount: 8900, date: `${d}-16`, delivery_status: 'pending',     credit: 0   },
    { supplier_name: 'דגים ופירות ים',    total_amount: 5500, date: `${d}-10`, delivery_status: 'returned',    credit: 0   },
    { supplier_name: 'דגים ופירות ים',    total_amount: 5100, date: `${d}-24`, delivery_status: 'closed',      credit: 150 },
    { supplier_name: 'שמן ותבלינים',      total_amount: 2100, date: `${d}-08`, delivery_status: 'not_arrived', credit: 0   },
    { supplier_name: 'מוצרי חלב',         total_amount: 3300, date: `${d}-11`, delivery_status: 'closed',      credit: 0   },
  ];

  const oldInvoices = [
    { supplier_name: 'ירקות טריים בע"מ', total_amount: 7800,  date: m1, credit: 200, terms: 'net30' },
    { supplier_name: 'מוצרי חלב',         total_amount: 3200,  date: m1, credit: 0,   terms: 'net30' },
    { supplier_name: 'בשר פרמיום',        total_amount: 10200, date: m2, credit: 400, terms: 'net60' },
    { supplier_name: 'שמן ותבלינים',      total_amount: 2400,  date: m2, credit: 0,   terms: 'net60' },
    { supplier_name: 'דגים ופירות ים',    total_amount: 6100,  date: m3, credit: 250, terms: 'net90' },
  ];

  const termMap = {
    'ירקות טריים בע"מ': 'net30', 'בשר פרמיום': 'net60',
    'דגים ופירות ים': 'net90', 'שמן ותבלינים': 'net60', 'מוצרי חלב': 'net30'
  };

  const supMap = {};
  invoices.forEach(inv => {
    const n = inv.supplier_name;
    if (!supMap[n]) supMap[n] = { total: 0, credit: 0, open: 0, returned: 0, not_arrived: 0 };
    supMap[n].total += inv.total_amount;
    supMap[n].credit += inv.credit;
    if (inv.delivery_status === 'pending')     supMap[n].open++;
    if (inv.delivery_status === 'returned')    supMap[n].returned++;
    if (inv.delivery_status === 'not_arrived') supMap[n].not_arrived++;
  });

  const totalInvoiced = Object.values(supMap).reduce((s, v) => s + v.total, 0);
  const totalCredit   = Object.values(supMap).reduce((s, v) => s + v.credit, 0);
  const totalNet      = totalInvoiced - totalCredit;
  const openCount     = invoices.filter(i => i.delivery_status === 'pending').length;
  const fcPct         = (totalNet / totalRevenue) * 100;

  const payForecastMap = {};
  [...invoices.map(i => ({ ...i, terms: termMap[i.supplier_name] || 'net30' })), ...oldInvoices].forEach(inv => {
    const terms = inv.terms || termMap[inv.supplier_name] || 'net30';
    const dueDate = calcDueDate(inv.date, terms).toISOString().slice(0, 10);
    if (dueDate >= mStart && dueDate <= mEnd) {
      const net = inv.total_amount - (inv.credit || 0);
      if (!payForecastMap[terms]) payForecastMap[terms] = { total: 0, count: 0 };
      payForecastMap[terms].total += net;
      payForecastMap[terms].count++;
    }
  });

  const totalPayForecast = Object.values(payForecastMap).reduce((s, v) => s + v.total, 0);
  const fmt = n => Math.round(n).toLocaleString('he-IL');

  const supplierRows = Object.entries(supMap)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([name, s]) => {
      const issues = [
        s.returned    > 0 ? `🔄 ${s.returned} הוחזר`    : '',
        s.not_arrived > 0 ? `❌ ${s.not_arrived} לא הגיע` : ''
      ].filter(Boolean).join('<br>');
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${name}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left">₪${fmt(s.total)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left;color:#16a34a">${s.credit > 0 ? '₪' + s.credit : '—'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left;font-weight:700">₪${fmt(s.total - s.credit)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:${s.open > 0 ? '#D97706' : '#888'}">${s.open > 0 ? `⚠️ ${s.open}` : '✓'}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:11px;line-height:1.6">${issues || '—'}</td>
      </tr>`;
    }).join('');

  const payForecastRows = Object.entries(payForecastMap)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([terms, v]) => `<tr>
      <td style="padding:7px 12px;border-bottom:1px solid #ede9fe">${TERMS_LABELS[terms] || terms}</td>
      <td style="padding:7px 12px;border-bottom:1px solid #ede9fe;text-align:center;color:#888;font-size:12px">${v.count} חשבוניות</td>
      <td style="padding:7px 12px;border-bottom:1px solid #ede9fe;text-align:left;font-weight:800;color:#4A1F85">₪${fmt(v.total)}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;direction:rtl">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
  <div style="background:linear-gradient(135deg,#4A1F85,#9B6DD6);padding:28px;text-align:center">
    <div style="font-size:26px;font-weight:800;color:white">Reverto</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px">דוח חודשי — ${thisMonth}</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.55);margin-top:6px">⚙️ דוגמה — לא נתונים אמיתיים</div>
  </div>
  <div style="padding:24px">
    <p style="font-size:15px;color:#333">שלום עומרי,</p>
    <p style="font-size:14px;color:#555">להלן סיכום ${thisMonth} עבור <strong>מסעדת הדמו</strong>:</p>

    <div style="display:flex;gap:12px;margin:16px 0">
      <div style="flex:1;background:#f0f9ff;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:12px;color:#666">מחזור Z (חודש)</div>
        <div style="font-size:22px;font-weight:800;color:#0891B2">₪${fmt(totalRevenue)}</div>
      </div>
      <div style="flex:1;background:${fcPct > 33 ? '#fef2f2' : '#f0fdf4'};border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:12px;color:#666">פוד קוסט</div>
        <div style="font-size:22px;font-weight:800;color:${fcPct > 33 ? '#dc2626' : '#16a34a'}">${fcPct.toFixed(1)}%</div>
      </div>
    </div>

    <div style="display:flex;gap:12px;margin:16px 0">
      <div style="flex:1;background:#f3effe;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:12px;color:#666">סה"כ חשבוניות</div>
        <div style="font-size:22px;font-weight:800;color:#6B35B8">₪${fmt(totalInvoiced)}</div>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:12px;color:#666">זיכויים צפויים</div>
        <div style="font-size:22px;font-weight:800;color:#16a34a">₪${totalCredit}</div>
      </div>
      <div style="flex:1;background:#fffbeb;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:12px;color:#666">נטו לתשלום</div>
        <div style="font-size:22px;font-weight:800;color:#D97706">₪${fmt(totalNet)}</div>
      </div>
    </div>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#c2410c">
      ⚠️ ${openCount} חשבונית עדיין פתוחה לאישור קבלה — יש לסגור לפני תשלום הספק.
    </div>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead>
        <tr style="background:#f8f5ff">
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;font-weight:700">ספק</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;font-weight:700">חשבוניות</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;font-weight:700">זיכויים</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;font-weight:700">נטו</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#666;font-weight:700">קבלה</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#666;font-weight:700">הוחזר / לא הגיע</th>
        </tr>
      </thead>
      <tbody>${supplierRows}</tbody>
    </table>

    <div style="background:#f8f5ff;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:15px;font-weight:800;color:#4A1F85;margin-bottom:12px">📅 תשלומים צפויים החודש</div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr>
          <th style="padding:7px 12px;text-align:right;font-size:12px;color:#888;font-weight:700">הסדר תשלום</th>
          <th style="padding:7px 12px;text-align:center;font-size:12px;color:#888;font-weight:700">חשבוניות</th>
          <th style="padding:7px 12px;text-align:left;font-size:12px;color:#888;font-weight:700">סכום</th>
        </tr></thead>
        <tbody>${payForecastRows}</tbody>
      </table>
      <div style="margin-top:12px;font-size:15px;font-weight:800;color:#4A1F85;padding-top:10px;border-top:2px solid #ede9fe;text-align:left">
        סה"כ יוצא החודש: ₪${fmt(totalPayForecast)}
      </div>
    </div>

    <div style="text-align:center;margin:24px 0">
      <a href="${SITE_URL}" style="background:linear-gradient(135deg,#4A1F85,#9B6DD6);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700">כניסה ל-Reverto לדוח מלא</a>
    </div>
    <p style="font-size:11px;color:#aaa;text-align:center">דוח זה נשלח אוטומטית בסוף כל חודש על ידי Reverto</p>
  </div>
</div>
</body></html>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Reverto <noreply@mail.reverto.cloud>',
      to: [to],
      subject: `[דמו] דוח חודשי ${thisMonth} — מסעדת הדמו`,
      html
    })
  });

  const data = await r.json();
  return {
    statusCode: r.ok ? 200 : 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  };
};
