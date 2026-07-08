// Marketing campaign email — free-text title+body composed in the admin panel,
// rendered inside the same branded shell as the welcome email.
// No emoji anywhere in this template (see project memory: no-emojis rule).

function campaignEmailHtml(name, bodyText, siteUrl) {
  const greeting = name ? `שלום ${name},` : 'שלום,';
  const bodyHtml = (bodyText || '')
    .split(/\n{2,}/)
    .map(para => `<p style="font-size:14px;color:#444;line-height:1.8;margin:0 0 16px">${para.replace(/\n/g, '<br>')}</p>`)
    .join('');

  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">

  <div style="background:linear-gradient(135deg,#5B0EA6,#8B21E8,#C026D3,#EC4899);padding:32px;text-align:center">
    <div dir="ltr" style="font-size:28px;font-weight:800;color:white;letter-spacing:-1px;unicode-bidi:isolate">Reverto</div>
  </div>

  <div style="padding:28px;text-align:right">
    <h2 style="font-size:18px;font-weight:800;color:#1C1428;margin:0 0 16px">${greeting}</h2>
    ${bodyHtml}
    <a href="${siteUrl}/app?goto=scanner" style="display:block;background:linear-gradient(135deg,#8B21E8,#C026D3,#EC4899);color:white;text-decoration:none;text-align:center;padding:16px;border-radius:10px;font-size:16px;font-weight:700;margin-top:8px">
      כניסה לאפליקציה
    </a>

    <p style="font-size:13px;color:#777;margin-top:24px;text-align:center;border-top:1px solid #eee;padding-top:16px">
      יש שאלה? פשוט השב למייל הזה — אנחנו כאן.<br>
      <span style="color:#9889AE">צוות <span dir="ltr" style="unicode-bidi:isolate">Reverto</span></span>
    </p>
  </div>
</div>
</body></html>`;
}

async function sendCampaignEmail(toEmail, name, subject, bodyText, opts = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !toEmail) return false;
  const siteUrl = process.env.SITE_URL || 'https://revertoapp.com';
  const subjectPrefix = opts.isTest ? '[בדיקה] ' : '';
  const bcc = opts.isTest ? ['revertoo.ino@gmail.com'] : undefined;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Reverto <noreply@mail.reverto.cloud>',
        to: [toEmail],
        ...(bcc ? { bcc } : {}),
        reply_to: 'revertoo.ino@gmail.com',
        subject: subjectPrefix + subject,
        html: campaignEmailHtml(name, bodyText, siteUrl)
      })
    });
    return res.ok;
  } catch (e) {
    console.error('Campaign email send failed:', e.message);
    return false;
  }
}

module.exports = { sendCampaignEmail, campaignEmailHtml };
