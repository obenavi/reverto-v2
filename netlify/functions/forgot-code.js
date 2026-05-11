// Forgot personal code — looks up by email and resends code
// Always returns 200 regardless of whether email was found (prevents enumeration)

function codeEmailHtml(businessName, personalCode, siteUrl) {
  return `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1)">
  <div style="background:linear-gradient(135deg,#4A1F85,#9B6DD6);padding:28px;text-align:center">
    <div style="font-size:26px;font-weight:800;color:white;letter-spacing:-1px">Reverto</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:4px">ניהול רכש חכם</div>
  </div>
  <div style="padding:28px;text-align:right">
    <h2 style="font-size:20px;font-weight:800;color:#1C1428;margin:0 0 12px">שחזור קוד גישה</h2>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 20px">שלום ${businessName || ''},<br>קיבלנו בקשה לשחזור הקוד האישי שלך:</p>
    <div style="background:#F3EFFE;border:2px solid #6B35B8;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px">
      <div style="font-size:30px;font-weight:800;letter-spacing:6px;color:#6B35B8;font-family:monospace">${personalCode}</div>
      <div style="font-size:12px;color:#9889AE;margin-top:8px">הזן אותו במסך הכניסה של Reverto</div>
    </div>
    <a href="${siteUrl}" style="display:block;background:linear-gradient(135deg,#4A1F85,#9B6DD6);color:white;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:700">כניסה למערכת</a>
    <p style="font-size:12px;color:#aaa;margin-top:16px;text-align:center">לא ביקשת זאת? התעלם מהמייל הזה.</p>
  </div>
</div>
</body></html>`;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { email } = parsed;
  if (!email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email' }) };
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=business_name,personal_code,is_active`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    );
    const users = await r.json();

    // Always respond with the same message regardless of whether user was found
    if (users?.length && users[0].personal_code && users[0].is_active !== false && RESEND_KEY) {
      const user = users[0];
      const siteUrl = process.env.SITE_URL || 'https://reverto-v2.netlify.app';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Reverto <noreply@reverto.cloud>',
          to: [email],
          subject: 'הקוד האישי שלך ל-Reverto',
          html: codeEmailHtml(user.business_name, user.personal_code, siteUrl)
        })
      });
    }
  } catch (e) {
    console.error('forgot-code error:', e.message);
  }

  // Always return success — don't reveal if email exists
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true })
  };
};
