// Password reset — step 1: send reset link, step 2: set new password
const crypto = require('crypto');

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, hash) => {
      if (err) reject(err);
      else resolve(`${salt}:${hash.toString('hex')}`);
    });
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const RESEND_KEY = process.env.RESEND_API_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  // ── Step 1: Request reset (email) ─────────────────────────
  if (parsed.action === 'request') {
    const { email } = parsed;
    if (!email) return { statusCode: 400, body: JSON.stringify({ error: 'Missing email' }) };

    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/users?email=ilike.${encodeURIComponent(email)}&select=id,business_name,auth_type`,
        { headers: H }
      );
      const users = await r.json();

      // Always return 200 (don't reveal if email exists)
      if (users?.length && users[0].auth_type === 'password') {
        const token = crypto.randomBytes(32).toString('hex');
        const exp = new Date(Date.now() + 3600000).toISOString(); // 1 hour

        await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${users[0].id}`, {
          method: 'PATCH',
          headers: { ...H, 'Prefer': 'return=minimal' },
          body: JSON.stringify({ reset_token: token, reset_token_exp: exp })
        });

        const siteUrl = process.env.SITE_URL || 'https://reverto.cloud';
        const resetUrl = `${siteUrl}/reset-password.html?token=${token}`;

        if (RESEND_KEY) {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Reverto <noreply@mail.reverto.cloud>',
              to: [email],
              subject: 'איפוס סיסמה — Reverto',
              html: `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
<div style="max-width:480px;margin:0 auto;background:white;border-radius:16px;padding:28px">
  <h2 style="font-size:20px;font-weight:800;color:#1C1428;margin:0 0 16px">איפוס סיסמה</h2>
  <p style="font-size:14px;color:#555;margin:0 0 24px">קיבלנו בקשה לאיפוס הסיסמה של ${users[0].business_name || ''}. הקישור תקף לשעה אחת.</p>
  <a href="${resetUrl}" style="display:block;background:linear-gradient(135deg,#4A1F85,#9B6DD6);color:white;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-size:15px;font-weight:700">איפוס סיסמה</a>
  <p style="font-size:12px;color:#aaa;margin-top:16px;text-align:center">לא ביקשת זאת? התעלם מהמייל הזה.</p>
</div></body></html>`
            })
          });
        }
      }
    } catch (e) { console.error(e); }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  // ── Step 2: Set new password (token + newPassword) ────────
  if (parsed.action === 'set') {
    const { token, newPassword } = parsed;
    if (!token || !newPassword) return { statusCode: 400, body: JSON.stringify({ error: 'Missing data' }) };

    // Validate password strength
    const strong = newPassword.length >= 10 &&
      /[A-Z]/.test(newPassword) &&
      /[0-9]/.test(newPassword) &&
      /[a-zA-Z]/.test(newPassword);
    if (!strong) return { statusCode: 400, body: JSON.stringify({ error: 'weak_password' }) };

    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/users?reset_token=eq.${encodeURIComponent(token)}&select=id,reset_token_exp`,
        { headers: H }
      );
      const users = await r.json();
      if (!users?.length) return { statusCode: 400, body: JSON.stringify({ error: 'invalid_token' }) };

      const user = users[0];
      if (new Date(user.reset_token_exp) < new Date()) return { statusCode: 400, body: JSON.stringify({ error: 'token_expired' }) };

      const hash = await hashPassword(newPassword);
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { ...H, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ password_hash: hash, reset_token: null, reset_token_exp: null })
      });

      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    } catch (e) {
      return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
};
