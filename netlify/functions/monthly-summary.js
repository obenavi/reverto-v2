// Sends monthly summary email to all active users with PRO plan
// Called by GitHub Actions on the last day of each month

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

  // Never send on Shabbat (Saturday UTC = day 6) or Friday afternoon (day 5 after 12:00 UTC = 15:00 Israel)
  const dayUTC = now.getUTCDay();
  const hourUTC = now.getUTCHours();
  if (dayUTC === 6) return { statusCode: 200, body: JSON.stringify({ skipped: 'Shabbat' }) };
  if (dayUTC === 5 && hourUTC >= 12) return { statusCode: 200, body: JSON.stringify({ skipped: 'Friday afternoon' }) };

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthName = now.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

  try {
    // Get all active users with email
    const usersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?plan=eq.pro&is_active=eq.true&email=not.is.null&onboarding_done=eq.true&select=id,email,business_name,contact_name`,
      { headers: H }
    );
    const users = await usersRes.json();
    let sent = 0;

    for (const user of (users || [])) {
      if (!user.email) continue;

      // Get this user's invoices for the month
      const invRes = await fetch(
        `${SUPABASE_URL}/rest/v1/invoices?user_id=eq.${user.id}&date=gte.${monthStart}&select=*`,
        { headers: H }
      );
      const invoices = await invRes.json();
      if (!invoices?.length) continue;

      // Build per-supplier summary
      const supMap = {};
      invoices.forEach(inv => {
        const name = inv.supplier_name || '—';
        if (!supMap[name]) supMap[name] = { total: 0, credit: 0, open: 0 };
        supMap[name].total += parseFloat(inv.total_amount || inv.total || 0);
        const adj = inv.adjustments ? (typeof inv.adjustments === 'string' ? JSON.parse(inv.adjustments) : inv.adjustments) : [];
        supMap[name].credit += adj.reduce((s, a) => s + (a.credit_amount || 0), 0);
        if (inv.delivery_status === 'pending') supMap[name].open++;
      });

      const totalInvoiced = Object.values(supMap).reduce((s, v) => s + v.total, 0);
      const totalCredit = Object.values(supMap).reduce((s, v) => s + v.credit, 0);
      const totalNet = totalInvoiced - totalCredit;
      const openCount = invoices.filter(i => i.delivery_status === 'pending').length;

      const fmt = n => Math.round(n).toLocaleString('he-IL');

      const supplierRows = Object.entries(supMap)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([name, s]) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left">₪${fmt(s.total)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left;color:#16a34a">${s.credit > 0 ? '₪' + s.credit.toFixed(0) : '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:left;font-weight:700">₪${fmt(s.total - s.credit)}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:${s.open > 0 ? '#D97706' : '#888'}">${s.open > 0 ? `⚠️ ${s.open}` : '✓'}</td>
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

    <div style="display:flex;gap:12px;margin:20px 0">
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

    ${openCount > 0 ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;color:#c2410c">
      ⚠️ ${openCount} חשבוניות עדיין פתוחות לאישור קבלה — יש לסגור לפני תשלום הספק.
    </div>` : ''}

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead>
        <tr style="background:#f8f5ff">
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#666;font-weight:700">ספק</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;font-weight:700">חשבוניות</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;font-weight:700">זיכויים</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#666;font-weight:700">נטו</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#666;font-weight:700">סטטוס</th>
        </tr>
      </thead>
      <tbody>${supplierRows}</tbody>
    </table>

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
