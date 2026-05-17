// Public endpoint — checks if email already has an account (no auth needed)
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  const { email } = JSON.parse(event.body || '{}');
  if (!email) return { statusCode: 400, body: JSON.stringify({ exists: false }) };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=ilike.${encodeURIComponent(email)}&select=id`,
      { headers: H }
    );
    const data = await r.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exists: Array.isArray(data) && data.length > 0 })
    };
  } catch {
    return { statusCode: 200, body: JSON.stringify({ exists: false }) };
  }
};
