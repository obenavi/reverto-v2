// Sends monthly summary email to all active PRO users
// Called by GitHub Actions on the last day of each month

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
  cash_delivery: 'מזומן בקבלה',
  order_time:    'תשלום בהזמנה',
  cash_eom:      'מזומן סוף חודש',
  net30: 'שוטף+30', net60: 'שוטף+60', net90: 'שוטף+90'
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };

  const secret = event.headers['x-cron-secret'] || '';
  if (secret !== process.env.CRON_SECRET) return { statusCode: 401 };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const SITE_URL = process.env.SITE_URL || 'https://reverto.cloud';
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  const now = new Date();

  // Never send on Shabbat (Saturday UTC) or Friday afternoon (after 12:00 UTC = 15:00 Israel)
  const dayUTC = now.getUTCDay();
  const hourUTC = now.getUTCHours();
  if (dayUTC === 6) return { statusCode: 200, body: JSON.stringify({ skipped: 'Shabbat' }) };
  if (dayUTC === 5 && hourUTC >= 12) return { statusCode: 200, body: JSON.stringify({ skipped: 'Friday afternoon' }) };

  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd     = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
  const monthName    = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

  try {
    const usersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?plan=eq.pro&is_active=eq.true&email=not.is.null&onboarding_done=eq.true&select=id,email,business_name,contact_name`,
      { headers: H }
    );
    const users = await usersRes.json();
    let sent = 0;

    for (const user of (users || [])) {
      if (!user.email) continue;

      // Fetch in parallel: this-month invoices, Z revenues, suppliers, past-90-day invoices for forecast
      const [invRes, revRes, supRes, oldInvRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/invoices?user_id=eq.${user.id}&date=gte.${monthStart}&select=*`, { headers: H }),
        fetch(`${SUPABASE_URL}/rest/v1/daily_revenues?user_id=eq.${user.id}&date=gte.${monthStart}&select=date,amount`, { headers: H }),
        fetch(`${SUPABASE_URL}/rest/v1/suppliers?user_id=eq.${user.id}&select=name,payment_terms`, { headers: H }),
        fetch(`${SUPABASE_URL}/rest/v1/invoices?user_id=eq.${user.id}&date=gte.${threeMonthsAgo}&date=lt.${monthStart}&select=supplier_name,total_amount,date,delivery_status,adjustments`, { headers: H })
      ]);

      const invoices   = await invRes.json();
      if (!invoices?.length) continue;
      const revenues   = (await revRes.json()) || [];
      const suppliers  = (await supRes.json()) || [];
      const oldInvoices = (await oldInvRes.json()) || [];

      // Z revenue + food cost
      const totalRevenue = revenues.reduce((s, r) => s + parseFloat(r.amount || 0), 0);

      // Per-supplier summary for this month (including returned/not_arrived)
      const supMap = {};
      invoices.forEach(inv => {
        const name = inv.supplier_name || '—';
        if (!supMap[name]) supMap[name] = { total: 0, credit: 0, open: 0, returned: 0, not_arrived: 0 };
        supMap[name].total += parseFloat(inv.total_amount || inv.total || 0);
        const adj = inv.adjustments ? (typeof inv.adjustments === 'string' ? JSON.parse(inv.adjustments) : inv.adjustments) : [];
        supMap[name].credit += adj.reduce((s, a) => s + (a.credit_amount || 0), 0);
        if (inv.delivery_status === 'pending')    supMap[name].open++;
        if (inv.delivery_status === 'returned')   supMap[name].returned++;
        if (inv.delivery_status === 'not_arrived') supMap[name].not_arrived++;
      });

      const totalInvoiced = Object.values(supMap).reduce((s, v) => s + v.total, 0);
      const totalCredit   = Object.values(supMap).reduce((s, v) => s + v.credit, 0);
      const totalNet      = totalInvoiced - totalCredit;
      const openCount     = invoices.filter(i => i.delivery_status === 'pending').length;
      const fcPct         = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;

      // Payment forecast: which invoices (this month + past 90 days) are due this month
      const termMap = {};
      suppliers.forEach(s => { if (s.name) termMap[s.name] = s.payment_terms || 'net30'; });

      const payForecastMap = {};
      [...invoices, ...oldInvoices].forEach(inv => {
        const terms = termMap[inv.supplier_name] || 'net30';
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
      const fmt = n => Math.round(n).toLocaleString('he-IL');

      // Supplier table rows
      const supplierRows = Object.entries(supMap)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, s]) => {
          const issues = [
            s.returned > 0   ? `🔄 ${s.returned} הוחזר`   : '',
            s.not_arrived > 0 ? `❌ ${s.not_arrived} לא הגיע` : ''
          ].filter(Boolean).join('<br>');
          return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left">₪${fmt(s.total)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left;color:#16a34a">${s.credit > 0 ? '₪' + s.credit.toFixed(0) : '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left;font-weight:700">₪${fmt(s.total - s.credit)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:${s.open > 0 ? '#D97706' : '#888'}">${s.open > 0 ? `⚠️ ${s.open}` : '✓'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-size:11px;line-height:1.6">${issues || '—'}</td>
          </tr>`;
        }).join('');

      // Payment forecast rows — one row per supplier
      const payForecastRows = Object.entries(payForecastMap)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([supplier, v]) => `
          <tr>
            <td style="padding:7px 12px;border-bottom:1px solid #ede9fe;font-weight:600">${supplier} <span style="font-size:10px;color:#888;font-weight:400">(${TERMS_LABELS[v.terms] || v.terms})</span></td>
            <td style="padding:7px 12px;border-bottom:1px solid #ede9fe;text-align:center;color:#888;font-size:12px">${v.count} חשבוניות</td>
            <td style="padding:7px 12px;border-bottom:1px solid #ede9fe;text-align:left;font-weight:800;color:#4A1F85">₪${fmt(v.total)}</td>
          </tr>`).join('');

      const html = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px;direction:rtl">
<div style="max-width:600px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
  <div style="background:linear-gradient(135deg,#4A1F85,#9B6DD6);padding:28px;text-align:center">
    <div style="font-size:26px;font-weight:800;color:white">Reverto</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:4px">דוח חודשי — ${monthName}</div>
  </div>
  <div style="padding:24px">
    <p style="font-size:15px;color:#333">שלום ${user.contact_name || user.business_name || ''},</p>
    <p style="font-size:14px;color:#555">להלן סיכום ${monthName} עבור <strong>${user.business_name}</strong>:</p>

    ${totalRevenue > 0 ? `
    <div style="display:flex;gap:12px;margin:16px 0">
      <div style="flex:1;background:#f0f9ff;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:12px;color:#666">מחזור Z (חודש)</div>
        <div style="font-size:22px;font-weight:800;color:#0891B2">₪${fmt(totalRevenue)}</div>
      </div>
      <div style="flex:1;background:${fcPct > 33 ? '#fef2f2' : '#f0fdf4'};border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:12px;color:#666">פוד קוסט</div>
        <div style="font-size:22px;font-weight:800;color:${fcPct > 33 ? '#dc2626' : '#16a34a'}">${fcPct.toFixed(1)}%</div>
      </div>
    </div>` : ''}

    <div style="display:flex;gap:12px;margin:16px 0">
      <div style="flex:1;background:#f3effe;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:12px;color:#666">סה"כ חשבוניות</div>
        <div style="font-size:22px;font-weight:800;color:#6B35B8">₪${fmt(totalInvoiced)}</div>
      </div>
      <div style="flex:1;background:#f0fdf4;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:12px;color:#666">זיכויים צפויים</div>
        <div style="font-size:22px;font-weight:800;color:#16a34a">₪${totalCredit.toFixed(0)}</div>
      </div>
      <div style="flex:1;background:#fffbeb;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:12px;color:#666">נטו לתשלום</div>
        <div style="font-size:22px;font-weight:800;color:#D97706">₪${fmt(totalNet)}</div>
      </div>
    </div>

    ${openCount > 0 ? `<a href="${SITE_URL}/app" style="display:block;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#c2410c;text-decoration:none">
      ⚠️ ${openCount} חשבונית${openCount > 1 ? 'ות' : ''} פתוח${openCount > 1 ? 'ות' : 'ה'} לאישור קבלה — <strong>לחץ לסיום מהיר ←</strong>
    </a>` : ''}

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

    ${Object.keys(payForecastMap).length ? `
    <div style="background:#f8f5ff;border-radius:10px;padding:16px;margin-bottom:20px">
      <div style="font-size:15px;font-weight:800;color:#4A1F85;margin-bottom:12px">📅 תשלומים צפויים החודש</div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr>
            <th style="padding:7px 12px;text-align:right;font-size:12px;color:#888;font-weight:700">ספק</th>
            <th style="padding:7px 12px;text-align:center;font-size:12px;color:#888;font-weight:700">חשבוניות</th>
            <th style="padding:7px 12px;text-align:left;font-size:12px;color:#888;font-weight:700">סכום</th>
          </tr>
        </thead>
        <tbody>${payForecastRows}</tbody>
      </table>
      <div style="margin-top:12px;font-size:15px;font-weight:800;color:#4A1F85;padding-top:10px;border-top:2px solid #ede9fe;text-align:left">
        סה"כ יוצא החודש: ₪${fmt(totalPayForecast)}
      </div>
    </div>` : ''}

    <div style="text-align:center;margin:24px 0">
      <a href="${SITE_URL}" style="background:linear-gradient(135deg,#4A1F85,#9B6DD6);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700">כניסה ל-Reverto לדוח מלא</a>
    </div>

    <p style="font-size:11px;color:#aaa;text-align:center">דוח זה נשלח אוטומטית בסוף כל חודש על ידי Reverto</p>
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
            subject: `דוח חודשי ${monthName} — ${user.business_name}`,
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
