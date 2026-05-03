exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { code } = JSON.parse(event.body || '{}');
  if (!code) return { statusCode: 400, body: 'Missing code' };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const codeUpper = code.toUpperCase();

  // Code → PRO duration mapping
  const PRO_CODES = {
    'REVERTO03': 3,
    'REVERTO06': 6
  };

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?code=eq.${encodeURIComponent(codeUpper)}&select=*`,
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

    // Auto-activate PRO based on code prefix (REVERTO03 / REVERTO06)
    const proMonths = PRO_CODES[codeUpper] || (codeUpper.startsWith('REVERTO') ? parseInt(codeUpper.replace('REVERTO','')) : 0);
    if (proMonths > 0 && !user.pro_until) {
      const proUntil = new Date();
      proUntil.setMonth(proUntil.getMonth() + proMonths);
      await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(user.id)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ plan: 'pro', pro_until: proUntil.toISOString(), code_duration_months: proMonths })
      });
      user.plan = 'pro';
      user.pro_until = proUntil.toISOString();
    }

    // Pilot codes get unlimited PRO
    if (codeUpper.startsWith('PILOT')) {
      user.plan = 'pro';
      user.pro_until = '2099-12-31T00:00:00Z';
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