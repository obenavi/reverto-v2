// Detects duplicate/similar product names using Claude Haiku
// Returns groups of similar names for user to review and merge

const crypto = require('crypto');

function verifyJWT(token, secret) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error('Invalid signature');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) throw new Error('Token expired');
  return payload;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = (event.headers['authorization'] || '').replace('Bearer ', '');
  let jwt;
  try { jwt = verifyJWT(authHeader, process.env.JWT_SECRET); }
  catch { return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };
  const userId = jwt.user_id;

  try {
    // Fetch unique product names from invoice_items + product_catalog
    const [items, catalog] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/invoice_items?user_id=eq.${encodeURIComponent(userId)}&select=product_name`, { headers: H }).then(r => r.json()),
      fetch(`${SUPABASE_URL}/rest/v1/product_catalog?user_id=eq.${encodeURIComponent(userId)}&select=name`, { headers: H }).then(r => r.json())
    ]);

    const names = [
      ...new Set([
        ...(items || []).map(i => i.product_name?.trim()).filter(Boolean),
        ...(catalog || []).map(c => c.name?.trim()).filter(Boolean)
      ])
    ].sort();

    if (names.length < 2) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groups: [] }) };
    }

    // Ask Claude Haiku to find similar groups
    const prompt = `אתה מנתח רשימת שמות מוצרי מזון מחשבוניות של מסעדה בישראל.
זהה קבוצות של שמות שמתייחסות לאותו מוצר בדיוק (שגיאות כתיב, שינויי ניסוח, קיצורים).

כללים חשובים:
- "עגבניות שרי" ו-"עגבניות" = מוצרים שונים
- "שמן זית" ו-"שמן זית כתית" = ייתכן שונים — אל תמזג
- "בשר טחון" ו-"בשר טחון בקר" = ייתכן שונים
- "עגבניה" ו-"עגבניות" = אותו מוצר (שגיאת כתיב)
- "שמן" ו-"שמן קנולה" = שונים
- "עוף שלם" ו-"עוף שלם טרי" = ייתכן אותו מוצר
היה שמרני — מזג רק כשבטוח מאוד.

רשימת שמות:
${names.join('\n')}

החזר JSON בלבד (ללא הסבר):
[{"canonical":"השם הטוב ביותר","alternatives":["שם אחר","שם נוסף"]}]
אם אין קבוצות ברורות, החזר: []`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!aiRes.ok) {
      return { statusCode: 500, body: JSON.stringify({ error: 'AI error' }) };
    }

    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text || '[]';

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const groups = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Filter out empty groups
    const validGroups = groups.filter(g => g.canonical && g.alternatives?.length > 0);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groups: validGroups, total_names: names.length })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
