// Contact form — sends email to revertoo.ino@gmail.com via Resend

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { name, restaurant, phone, email, message } = parsed;
  if (!name || !email || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) {
    console.warn('RESEND_API_KEY not set — contact form submission dropped');
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Reverto Contact <noreply@mail.reverto.cloud>',
        to: ['revertoo.ino@gmail.com'],
        reply_to: email,
        subject: `פנייה חדשה: ${name} — ${restaurant || 'ללא שם מסעדה'}`,
        html: `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:12px;padding:28px">
  <h2 style="font-size:20px;font-weight:800;color:#1C1428;margin:0 0 20px;border-bottom:2px solid #6B35B8;padding-bottom:12px">פנייה חדשה מ-Reverto</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:8px 0;font-weight:700;color:#555;width:30%">שם:</td><td style="padding:8px 0">${name}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;color:#555">מסעדה:</td><td style="padding:8px 0">${restaurant || '—'}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;color:#555">טלפון:</td><td style="padding:8px 0">${phone || '—'}</td></tr>
    <tr><td style="padding:8px 0;font-weight:700;color:#555">מייל:</td><td style="padding:8px 0"><a href="mailto:${email}">${email}</a></td></tr>
  </table>
  <div style="margin-top:20px;background:#f8f5ff;border-radius:8px;padding:16px">
    <div style="font-weight:700;color:#555;margin-bottom:8px">הודעה:</div>
    <div style="font-size:15px;line-height:1.7;color:#1C1428">${message.replace(/\n/g, '<br>')}</div>
  </div>
</div>
</body></html>`
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
    }
  } catch (e) {
    console.error('Contact send failed:', e.message);
  }

  return { statusCode: 200, body: JSON.stringify({ ok: true }) };
};
