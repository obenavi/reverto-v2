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

  const prompt = `אתה מומחה לניתוח חשבוניות ספקים ישראליות — כולל חשבוניות ריכוז של ספקי ירקות/פירות שמתמחרות לפי משקל.

דפוסים נפוצים בחשבוניות ישראליות שחייב לזהות (יש להבחין ביניהם — הם לא מתחלפים):

1. תמחור לפי משקל — נפוץ מאוד אצל ספקי ירקות/פירות/שוק סיטונאי. העמודות הן בדרך כלל:
   תאריך | תוצרת | כמות (מספר קרטונים/אריזות — בד"כ 1-8, ערך שולי של אריזה בלבד) | משקל (ק"ג בפועל שנשקל) | מחיר (מחיר מודפס ליחידת משקל) | סה"כ תוצרת (=משקל × מחיר)
   בדפוס הזה: quantity = ערך המשקל, unit = "ק\\"ג" (או יחידת המשקל שמופיעה), unit_price = הערך המודפס בעמודת ה"מחיר" בדיוק כפי שהוא — אל תחשב אותו מחדש, total_price = הערך המודפס בעמודת ה"סה"כ" בדיוק כפי שהוא.
   אזהרה קריטית: עמודת ה"כמות" (מספר קרטונים) אינה בסיס לחישוב מחיר! לעולם אל תחשב unit_price = total_price ÷ כמות(קרטונים) — זה מנפח את המחיר פי 10-20 מהמחיר האמיתי, כי אתה מחלק לפי מספר קרטונים ולא לפי המשקל שבאמת נמכר.
   דוגמה מדויקת: שורה עם כמות=1, משקל=20.6, מחיר=3.50, סה"כ=72.10 → quantity=20.6, unit="ק\\"ג", unit_price=3.50, total_price=72.10. (לא unit_price=72.10, ולא unit_price=72.10÷1=72.10!)

2. חישוב כמות בדפוס "קרטון × יחידות בקרטון" — נפוץ במוצרים ארוזים/יבשים, שונה לגמרי מדפוס המשקל:
   עמודות של "קר' × יח'" = קרטון × יחידות בקרטון = כמות כוללת. דוגמה: "2 X 24 = 48 יח'" → כמות = 48 (לא 2 ולא 24). חפש דפוסים כמו "N קר' M יח'" / "NxM יח'" / "N X M".
   אם יש בחשבונית עמודת "משקל" נפרדת — כנראה מדובר בדפוס 1 (משקל), לא בדפוס הזה. אל תבלבל ביניהם.

3. הנחה%: מאוד נפוץ. מחיר נטו = מחיר × (1 - הנחה/100). בדוק: אם מחיר×כמות×(1-הנחה/100) ≈ סה"כ → הנחה נכונה.

4. מחיר ליחידה: תמיד מחיר ליחידה הבסיסית (יח', ק"ג, ליטר) לא לקרטון.

5. שמות מוצרים: תיאור מלא בעברית כולל מותג, גודל, וריאנט.

לכל שורת מוצר, חלץ:
- product_name: שם המוצר המלא בעברית
- quantity: כמות כוללת (המשקל בדפוס משקל; קרטון×יחידות בדפוס האחר)
- unit: יחידת מידה לפי מה שבאמת נמדד (ק"ג, יח', ליטר, בקבוק וכדומה)
- unit_price: המחיר המודפס בעמודת ה"מחיר" ליחידה, בדיוק כפי שמופיע במסמך
- total_price: סה"כ לשורה, בדיוק כפי שמופיע בעמודת הסה"כ
- discount_pct: אחוז הנחה (0 אם אין)

בדיקת שפיות חובה — קריטי, בצע לפני החזרת כל שורה:
ודא ש- unit_price × quantity × (1 - discount_pct/100) ≈ total_price (בטווח ±5%). אם הבדיקה נכשלת, כנראה בלבלת בין עמודות (למשל כמות-קרטונים עם משקל, או מחיר עם סה"כ) — חזור לטקסט, זהה מחדש איזו עמודה היא באמת ה"מחיר" ואיזו ה"משקל"/"כמות", ותקן. מחיר לק"ג של ירק/פרי טרי הוא כמעט תמיד ₪1.5–₪45 — אם יצא לך unit_price גבוה משמעותית מזה (למשל מעל ₪50), כמעט בטוח שיש בלבול עמודות; חשב מחדש מהטקסט המקורי לפני שאתה מחזיר את השורה.

כללי חשובים:
- התעלם משורות ריקות, כותרות, סיכומים, מע"מ
- אל תכלול שורות עם מחיר 0 אלא אם זה פיקדון

בנוסף לפריטים, חלץ גם פרטי קשר של המשרד/הספק עצמו (לא של סוכן מכירות מסוים) אם הם מופיעים בטקסט — בדרך כלל בכותרת/לוגו העליון של המסמך: טלפון, מייל, כתובת. אם שדה מסוים לא מופיע בבירור, השאר אותו ריק ("").

החזר JSON בלבד (ללא הסבר), במבנה הבא בדיוק:
{"items":[{"product_name":"...","quantity":N,"unit":"יח'","unit_price":N,"total_price":N,"discount_pct":N}],"vendor":{"phone":"","email":"","address":""}}

טקסט החשבונית:
${text.slice(0, 12000)}`;

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
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Claude error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'AI error' }) };
    }

    const aiData = await res.json();
    const rawText = aiData.content?.[0]?.text || '{}';
    // Expect {"items":[...],"vendor":{...}}, but fall back to a bare array in
    // case the model doesn't follow the wrapping-object format.
    const jsonMatch = rawText.match(/[\{\[][\s\S]*[\}\]]/);
    let parsedResp = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    const items = Array.isArray(parsedResp) ? parsedResp : (Array.isArray(parsedResp.items) ? parsedResp.items : []);
    const vendor = Array.isArray(parsedResp) ? {} : (parsedResp.vendor || {});

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
      body: JSON.stringify({
        items: validItems,
        vendor: {
          phone: (vendor.phone || '').trim(),
          email: (vendor.email || '').trim(),
          address: (vendor.address || '').trim()
        }
      })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
