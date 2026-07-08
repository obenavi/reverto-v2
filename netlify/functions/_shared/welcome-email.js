// Shared welcome email — sent to every new user on signup (code or Google)
// No emoji anywhere in this template — clean typography only (see project memory: no-emojis rule).
// English brand/product names embedded in Hebrew text are wrapped in dir="ltr" spans to avoid
// bidi (right-to-left/left-to-right mixing) reordering glitches in email clients.

const BRAND = '<span dir="ltr" style="unicode-bidi:isolate">Reverto</span>';
const DOMAIN = '<span dir="ltr" style="unicode-bidi:isolate">revertoapp.com</span>';
const FOOD_COST = '<span dir="ltr" style="unicode-bidi:isolate">FOOD COST</span>';
const WHATSAPP = '<span dir="ltr" style="unicode-bidi:isolate">WhatsApp</span>';
// Official WhatsApp glyph (simple-icons project), base64-encoded so it renders as an inline
// image without depending on an external host — a real brand logo, not a decorative emoji.
const WHATSAPP_LOGO_B64 = 'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iIzI1RDM2NiI+PHBhdGggZD0iTTE3LjQ3MiAxNC4zODJjLS4yOTctLjE0OS0xLjc1OC0uODY3LTIuMDMtLjk2Ny0uMjczLS4wOTktLjQ3MS0uMTQ4LS42Ny4xNS0uMTk3LjI5Ny0uNzY3Ljk2Ni0uOTQgMS4xNjQtLjE3My4xOTktLjM0Ny4yMjMtLjY0NC4wNzUtLjI5Ny0uMTUtMS4yNTUtLjQ2My0yLjM5LTEuNDc1LS44ODMtLjc4OC0xLjQ4LTEuNzYxLTEuNjUzLTIuMDU5LS4xNzMtLjI5Ny0uMDE4LS40NTguMTMtLjYwNi4xMzQtLjEzMy4yOTgtLjM0Ny40NDYtLjUyLjE0OS0uMTc0LjE5OC0uMjk4LjI5OC0uNDk3LjA5OS0uMTk4LjA1LS4zNzEtLjAyNS0uNTItLjA3NS0uMTQ5LS42NjktMS42MTItLjkxNi0yLjIwNy0uMjQyLS41NzktLjQ4Ny0uNS0uNjY5LS41MS0uMTczLS4wMDgtLjM3MS0uMDEtLjU3LS4wMS0uMTk4IDAtLjUyLjA3NC0uNzkyLjM3Mi0uMjcyLjI5Ny0xLjA0IDEuMDE2LTEuMDQgMi40NzkgMCAxLjQ2MiAxLjA2NSAyLjg3NSAxLjIxMyAzLjA3NC4xNDkuMTk4IDIuMDk2IDMuMiA1LjA3NyA0LjQ4Ny43MDkuMzA2IDEuMjYyLjQ4OSAxLjY5NC42MjUuNzEyLjIyNyAxLjM2LjE5NSAxLjg3MS4xMTguNTcxLS4wODUgMS43NTgtLjcxOSAyLjAwNi0xLjQxMy4yNDgtLjY5NC4yNDgtMS4yODkuMTczLTEuNDEzLS4wNzQtLjEyNC0uMjcyLS4xOTgtLjU3LS4zNDdtLTUuNDIxIDcuNDAzaC0uMDA0YTkuODcgOS44NyAwIDAxLTUuMDMxLTEuMzc4bC0uMzYxLS4yMTQtMy43NDEuOTgyLjk5OC0zLjY0OC0uMjM1LS4zNzRhOS44NiA5Ljg2IDAgMDEtMS41MS01LjI2Yy4wMDEtNS40NSA0LjQzNi05Ljg4NCA5Ljg4OC05Ljg4NCAyLjY0IDAgNS4xMjIgMS4wMyA2Ljk4OCAyLjg5OGE5LjgyNSA5LjgyNSAwIDAxMi44OTMgNi45OTRjLS4wMDMgNS40NS00LjQzNyA5Ljg4NC05Ljg4NSA5Ljg4NG04LjQxMy0xOC4yOTdBMTEuODE1IDExLjgxNSAwIDAwMTIuMDUgMEM1LjQ5NSAwIC4xNiA1LjMzNS4xNTcgMTEuODkyYzAgMi4wOTYuNTQ3IDQuMTQyIDEuNTg4IDUuOTQ1TC4wNTcgMjRsNi4zMDUtMS42NTRhMTEuODgyIDExLjg4MiAwIDAwNS42ODMgMS40NDhoLjAwNWM2LjU1NCAwIDExLjg5LTUuMzM1IDExLjg5My0xMS44OTNhMTEuODIxIDExLjgyMSAwIDAwLTMuNDgtOC40MTNaIi8+PC9zdmc+';

function welcomeEmailHtml(name, personalCode, siteUrl) {
  const codeBlock = personalCode ? `
    <div style="background:#F3EFFE;border:2px solid #6B35B8;border-radius:12px;padding:18px;text-align:center;margin:0 0 24px">
      <div style="font-size:12px;color:#9889AE;margin-bottom:6px">הקוד האישי שלך לכניסה</div>
      <div dir="ltr" style="font-size:28px;font-weight:800;letter-spacing:5px;color:#6B35B8;font-family:monospace;unicode-bidi:isolate">${personalCode}</div>
      <div style="font-size:12px;color:#9889AE;margin-top:6px">שמור אותו — תצטרך אותו לכניסות עתידיות</div>
    </div>` : '';

  const scanUrl = `${siteUrl}/app?goto=scanner`;
  const waUrl = 'https://chat.whatsapp.com/FzCRKLJF8GR7arWNqjfoXD';

  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:520px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">

  <div style="background:linear-gradient(135deg,#5B0EA6,#8B21E8,#C026D3,#EC4899);padding:32px;text-align:center">
    <div dir="ltr" style="font-size:28px;font-weight:800;color:white;letter-spacing:-1px;unicode-bidi:isolate">Reverto</div>
    <div style="font-size:14px;color:rgba(255,255,255,0.85);margin-top:6px">ברוכים הבאים</div>
  </div>

  <div style="padding:28px;text-align:right">
    <h2 style="font-size:20px;font-weight:800;color:#1C1428;margin:0 0 12px">שלום ${name || ''},</h2>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px">
      איזה כיף שהצטרפת ל-${BRAND}!<br>
      מהיום, כל חשבונית ספק שנכנסת לעסק שלך היא <strong>מקור מידע — לא רק הוצאה</strong>.
      תוכל ללמוד ממנה על ה-${FOOD_COST} שלך, על צפי ההוצאות, על שינויי המחירים וכמובן אם המחיר שאתה משלם הגיוני.
    </p>

    ${codeBlock}

    <div style="background:#FAF8FF;border-radius:12px;padding:18px 20px;margin-bottom:24px">
      <div style="font-size:14px;font-weight:800;color:#6B35B8;margin-bottom:12px">כבר אחרי 2–3 חשבוניות תתחיל לראות:</div>
      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:13px;color:#555;line-height:1.6">
        <tr><td style="padding:4px 0;text-align:right">• כמה אתה משלם על כל מוצר — ואיך זה משתנה לאורך זמן</td></tr>
        <tr><td style="padding:4px 0;text-align:right">• השוואה למחירי השוק — איפה אתה משלם יותר מדי</td></tr>
        <tr><td style="padding:4px 0;text-align:right">• השוואה אנונימית לעסקים דומים בקהילה</td></tr>
      </table>
    </div>

    <p style="font-size:13px;color:#777;line-height:1.7;margin:0 0 24px;background:#FFF9F0;border-radius:10px;padding:12px 16px">
      <strong style="color:#B8860B">וזה החלק החשוב:</strong> ככל שיותר עסקים סורקים, המידע של כולנו מדויק יותר.
      כל חשבונית שאתה סורק מחזקת את כוח המיקוח של כל הקהילה — וגם את שלך.
    </p>

    <a href="${scanUrl}" style="display:block;background:linear-gradient(135deg,#8B21E8,#C026D3,#EC4899);color:white;text-decoration:none;text-align:center;padding:16px;border-radius:10px;font-size:16px;font-weight:700">
      סרוק את החשבונית הראשונה שלך
    </a>
    <p style="font-size:12px;color:#aaa;margin-top:8px;text-align:center">לוקח פחות מ-30 שניות — צלם או העלה קובץ</p>

    <p style="font-size:13px;color:#555;line-height:1.7;margin:24px 0 6px">מזמינים אתכם להצטרף לקבוצת ה-${WHATSAPP} לתמיכה באפליקציה ולבניית המערכת לטובת כולנו:</p>
    <a href="${waUrl}" style="display:flex;align-items:center;justify-content:center;gap:8px;font-size:13px;color:#25D366;font-weight:700;text-decoration:none">
      <img src="data:image/svg+xml;base64,${WHATSAPP_LOGO_B64}" width="18" height="18" alt="" style="display:inline-block;vertical-align:middle">
      <span>הצטרפות לקבוצת הוואטסאפ</span>
    </a>

    <p style="font-size:13px;color:#777;margin-top:24px;text-align:center;border-top:1px solid #eee;padding-top:16px">
      יש שאלה? פשוט השב למייל הזה — אנחנו כאן.<br>
      <span style="color:#9889AE">צוות ${BRAND} · ${DOMAIN}</span>
    </p>
  </div>
</div>
</body></html>`;
}

async function sendWelcomeEmail(toEmail, name, personalCode, opts = {}) {
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
        subject: subjectPrefix + 'ברוכים הבאים ל-Reverto — החשבונית הראשונה שלך שווה כסף',
        html: welcomeEmailHtml(name, personalCode, siteUrl)
      })
    });
    return res.ok;
  } catch (e) {
    console.error('Welcome email send failed:', e.message);
    return false;
  }
}

module.exports = { sendWelcomeEmail, welcomeEmailHtml };
