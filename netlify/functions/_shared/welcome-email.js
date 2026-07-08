// Shared welcome email — sent to every new user on signup (code or Google)

function welcomeEmailHtml(businessName, personalCode, siteUrl) {
  const codeBlock = personalCode ? `
    <div style="background:#F3EFFE;border:2px solid #6B35B8;border-radius:12px;padding:18px;text-align:center;margin:0 0 24px">
      <div style="font-size:12px;color:#9889AE;margin-bottom:6px">הקוד האישי שלך לכניסה</div>
      <div style="font-size:28px;font-weight:800;letter-spacing:5px;color:#6B35B8;font-family:monospace">${personalCode}</div>
      <div style="font-size:12px;color:#9889AE;margin-top:6px">שמור אותו — תצטרך אותו לכניסות עתידיות</div>
    </div>` : '';

  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">

  <div style="background:linear-gradient(135deg,#4A1F85,#9B6DD6);padding:32px;text-align:center">
    <div style="font-size:28px;font-weight:800;color:white;letter-spacing:-1px">Reverto</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:6px">ברוכים הבאים! 🎉</div>
  </div>

  <div style="padding:28px;text-align:right">
    <h2 style="font-size:20px;font-weight:800;color:#1C1428;margin:0 0 12px">שלום ${businessName || ''},</h2>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px">
      איזה כיף שהצטרפת ל-Reverto!<br>
      מהיום, כל חשבונית ספק שנכנסת לעסק שלך היא <strong>מקור מידע — לא רק הוצאה</strong>.
    </p>

    ${codeBlock}

    <div style="background:#FAF8FF;border-radius:12px;padding:18px 20px;margin-bottom:24px">
      <div style="font-size:14px;font-weight:800;color:#4A1F85;margin-bottom:12px">כבר אחרי 2–3 חשבוניות תתחיל לראות:</div>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;color:#555;line-height:1.6">
        <tr><td style="padding:4px 0;text-align:right">📊 כמה אתה משלם על כל מוצר — ואיך זה משתנה לאורך זמן</td></tr>
        <tr><td style="padding:4px 0;text-align:right">💡 השוואה למחירי השוק — איפה אתה משלם יותר מדי</td></tr>
        <tr><td style="padding:4px 0;text-align:right">🤝 השוואה אנונימית לעסקים דומים בקהילה</td></tr>
      </table>
    </div>

    <p style="font-size:13px;color:#777;line-height:1.7;margin:0 0 24px;background:#FFF9F0;border-radius:10px;padding:12px 16px">
      <strong style="color:#B8860B">💪 וזה החלק החשוב:</strong> ככל שיותר עסקים סורקים, המידע של כולנו מדויק יותר.
      כל חשבונית שאתה סורק מחזקת את כוח המיקוח של כל הקהילה — וגם את שלך.
    </p>

    <a href="${siteUrl}/app?goto=scanner" style="display:block;background:linear-gradient(135deg,#4A1F85,#9B6DD6);color:white;text-decoration:none;text-align:center;padding:16px;border-radius:10px;font-size:16px;font-weight:700">
      📸 סרוק את החשבונית הראשונה שלך
    </a>
    <p style="font-size:12px;color:#aaa;margin-top:8px;text-align:center">לוקח פחות מ-30 שניות — צלם או העלה קובץ</p>

    <p style="font-size:13px;color:#777;margin-top:24px;text-align:center;border-top:1px solid #eee;padding-top:16px">
      יש שאלה? פשוט השב למייל הזה — אנחנו כאן.<br>
      <span style="color:#9889AE">צוות Reverto · reverto.cloud</span>
    </p>
  </div>
</div>
</body></html>`;
}

async function sendWelcomeEmail(toEmail, businessName, personalCode) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !toEmail) return;
  const siteUrl = process.env.SITE_URL || 'https://reverto.cloud';
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Reverto <noreply@mail.reverto.cloud>',
        to: [toEmail],
        reply_to: 'revertoo.ino@gmail.com',
        subject: 'ברוכים הבאים ל-Reverto — החשבונית הראשונה שלך שווה כסף 💰',
        html: welcomeEmailHtml(businessName, personalCode, siteUrl)
      })
    });
  } catch (e) {
    console.error('Welcome email send failed:', e.message);
  }
}

module.exports = { sendWelcomeEmail, welcomeEmailHtml };
