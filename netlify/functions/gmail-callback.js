const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'https://reverto.cloud/.netlify/functions/gmail-callback';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function verifyState(state) {
  const [data, sig] = state.split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
  if (expected !== sig) return null;
  const { userId, ts } = JSON.parse(Buffer.from(data, 'base64url').toString());
  if (Date.now() - ts > 10 * 60 * 1000) return null; // 10 min expiry
  return userId;
}

exports.handler = async (event) => {
  const { code, state, error } = event.queryStringParameters || {};

  if (error) {
    return { statusCode: 302, headers: { Location: '/app.html?gmail=denied' } };
  }
  if (!code || !state) {
    return { statusCode: 400, body: 'Missing parameters' };
  }

  const userId = verifyState(state);
  if (!userId) {
    return { statusCode: 302, headers: { Location: '/app.html?gmail=error' } };
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    })
  });

  if (!tokenRes.ok) {
    return { statusCode: 302, headers: { Location: '/app.html?gmail=error' } };
  }

  const tokens = await tokenRes.json();
  if (!tokens.refresh_token) {
    return { statusCode: 302, headers: { Location: '/app.html?gmail=no_refresh_token' } };
  }

  // Get user email address
  const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });
  const profile = profileRes.ok ? await profileRes.json() : {};
  const emailAddress = profile.email || '';

  // Store in Supabase
  const H = {
    'apikey': SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates'
  };

  await fetch(`${SUPABASE_URL}/rest/v1/email_integrations`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      user_id: userId,
      email_address: emailAddress,
      refresh_token: tokens.refresh_token,
      active: true,
      last_checked_at: new Date(0).toISOString() // start from beginning to catch recent invoices
    })
  });

  return { statusCode: 302, headers: { Location: '/app.html?gmail=connected' } };
};
