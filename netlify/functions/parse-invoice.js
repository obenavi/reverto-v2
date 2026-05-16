// Claude-powered Israeli invoice parser
// Handles: קר' × יח' = כמות, הנחה%, and other Israeli supplier invoice patterns

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
  try { verifyJWT(authHeader, process.env.JWT_SECRET); }
  catch { return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }; }

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { text } = parsed;
  if (!text || text.length < 20) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No text' }) };
  }

  const prompt = `אתה מומחה לניתוח חשבוניות ספקים ישראליות.

דפוסים נפוצים בחשבוניות ישראליות שחייב לזהות:

1. חישוב כמות: עמודות של "קר' × יח'" = קרטון × יחידות בקרטון = כמות כוללת
   דוגמה: "2 X 24 = 48 יח'" → כמות = 48 (לא 2 ולא 24)
   חפש דפוסים כמו: "N קר' M יח'" / "NxM יח'" / "N X M"

2. הנחה%: מאוד נפוץ. מחיר נטו = מחיר × (1 - הנחה/100)
   בדוק: אם מחיר×כמות×(1-הנחה/100) ≈ סה"כ → הנחה נכונה

3. מחיר ליחידה: תמיד מחיר ליחידה הבסיסית (יח', ק"ג, ליטר) לא לקרטון

4. שמות מוצרים: תיאור מלא בעברית כולל מותג, גודל, וריאנט

לכל שורת מוצר, חלץ:
- product_name: שם המוצר המלא בעברית
- quantity: כמות כוללת TOTAL (לאחר חישוב קרטון × יחידות)
- unit: יחידת מידה (יח', ק"ג, ליטר, בקבוק, וכדומה)
- unit_price: מחיר ליחידה בסיסית (ש"ח)
- total_price: סה"כ לשורה (כפי שמופיע בחשבונית)
- discount_pct: אחוז הנחה (0 אם אין)

כללי חשובים:
- התעלם משורות ריקות, כותרות, סיכומים, מע"מ
- אל תכלול שורות עם מחיר 0 אלא אם זה פיקדון
- ודא שהחשבון: unit_price × quantity × (1 - discount_pct/100) ≈ total_price

החזר JSON בלבד (ללא הסבר):
[{"product_name":"...","quantity":N,"unit":"יח'","unit_price":N,"total_price":N,"discount_pct":N}]

טקסט החשבונית:
${text.slice(0, 4000)}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Claude error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'AI error' }) };
    }

    const aiData = await res.json();
    const rawText = aiData.content?.[0]?.text || '[]';
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    const items = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    const validItems = items
      .filter(i => i.product_name && (i.total_price > 0 || i.product_name.includes('פיקדון')))
      .map(i => ({
        product_name: i.product_name,
        quantity: parseFloat(i.quantity) || 1,
        unit_price: parseFloat(i.unit_price) || 0,
        total_price: parseFloat(i.total_price) || 0,
        unit: i.unit || 'יח\'',
        discount_pct: parseFloat(i.discount_pct) || 0
      }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: validItems })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
