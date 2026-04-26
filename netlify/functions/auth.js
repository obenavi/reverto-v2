// netlify/functions/auth.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { code } = JSON.parse(event.body || '{}');
  if (!code) return { statusCode: 400, body: 'Missing code' };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?code=eq.${encodeURIComponent(code.toUpperCase())}&select=*`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    );
    const users = await res.json();
    if (!users || !users.length) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid code' }) };
    }
    const user = users[0];
    if (user.is_active === false) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Account suspended' }) };
    }
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user)
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
