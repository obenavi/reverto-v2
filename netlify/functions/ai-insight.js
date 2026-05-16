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

const PROMPTS = {
  spending: (data) => `אתה יועץ עסקי לעסקי מזון בישראל. דבר ישירות לבעל העסק בגוף שני, בעברית שוטפת, 3-4 משפטים.

נתוני רכש חודשי:
- עסק: ${data.category}${data.city ? ' ב' + data.city : ''}
- רכש החודש: ₪${data.monthly_purchases?.toLocaleString()}
- מספר חשבוניות: ${data.invoice_count}
- לעומת חודש שעבר: ${data.change_vs_last_month}
- ספק מוביל: ${data.top_supplier ? data.top_supplier.name + ' — ₪' + data.top_supplier.amount?.toLocaleString() : 'לא ידוע'}

נתח: מה המגמה, מה מדאיג, והמלצה אחת ספציפית בשקלים.`,

  foodcost: (data) => `אתה יועץ עסקי לעסקי מזון בישראל. דבר ישירות לבעל העסק בגוף שני, בעברית שוטפת, 3-4 משפטים.

נתוני Food Cost:
- עסק: ${data.category}${data.city ? ' ב' + data.city : ''}
- רכש החודש: ₪${data.monthly_purchases?.toLocaleString()}
- מחזור החודש: ${data.monthly_revenue > 0 ? '₪' + data.monthly_revenue?.toLocaleString() : 'לא הוזן'}
- Food Cost: ${data.food_cost_pct ? data.food_cost_pct + '%' : 'לא ניתן לחשב — אין מחזור'}
- יעד ענפי: 28–32%

${data.food_cost_pct ? 'נתח: האם ה-Food Cost תקין, מה הסיכון, ומה לעשות.' : 'הסבר למה חשוב להזין מחזור יומי וכיצד הדבר יעזור לניהול העסק.'}`,

  alerts: (data) => `אתה יועץ עסקי לעסקי מזון בישראל. דבר ישירות לבעל העסק בגוף שני, בעברית שוטפת, 3-4 משפטים.

התייקרויות מחירים שזוהו:
${data.price_increases?.length
  ? data.price_increases.map(a => `- ${a.product}: עלה מ-₪${a.prev_price} ל-₪${a.current_price} (+${a.pct})`).join('\n')
  : '- לא זוהו התייקרויות משמעותיות'}
- עסק: ${data.category}${data.city ? ' ב' + data.city : ''}

נתח: מה ההשפעה הכלכלית, אילו מוצרים לעקוב, והמלצה.`,

  savings: (data) => `אתה יועץ עסקי לעסקי מזון בישראל. דבר ישירות לבעל העסק בגוף שני, בעברית שוטפת, 3-4 משפטים.

ספקים מובילים החודש:
${data.top_suppliers?.map(s => `- ${s.name}: ₪${s.amount?.toLocaleString()}`).join('\n') || 'אין נתונים'}
- עסק: ${data.category}${data.city ? ' ב' + data.city : ''}
- רכש כולל: ₪${data.monthly_purchases?.toLocaleString()}

נתח: האם הפיזור בין ספקים בריא, איפה יש פוטנציאל למשא ומתן, והמלצה ספציפית.`,

  overview: (data) => `אתה יועץ עסקי בכיר לעסקי מזון בישראל. דבר ישירות לבעל העסק בגוף שני, בעברית שוטפת, 5-6 משפטים.

ניתוח עסקי כולל — ${data.category}${data.city ? ' ב' + data.city : ''}:
- רכש החודש: ₪${data.monthly_purchases?.toLocaleString()} (${data.invoice_count} חשבוניות, ${data.change_vs_last_month} לעומת חודש קודם)
- מחזור החודש: ${data.monthly_revenue > 0 ? '₪' + data.monthly_revenue?.toLocaleString() : 'לא הוזן'}
- Food Cost: ${data.food_cost_pct ? data.food_cost_pct + '%' : 'לא ניתן לחשב'} (יעד ענפי: 28–32%)
- ספק מוביל: ${data.top_supplier ? data.top_supplier.name + ' — ₪' + data.top_supplier.amount?.toLocaleString() : 'לא זוהה'}
- מוצרים שהתייקרו: ${data.alerts_count}
- שינוי לעומת חודש קודם: ${data.change_vs_last_month}

ספק ניתוח אסטרטגי מקיף: (1) הערכת מצב בריאות עסקי כוללת, (2) הבעיה או ההזדמנות הגדולה ביותר שזיהית, (3) 2 המלצות אסטרטגיות ספציפיות עם מספרים בשקלים, (4) פוטנציאל חיסכון חודשי אם תבצע את ההמלצות. היה ספציפי וממוקד — לא כללי.`
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = (event.headers['authorization'] || '').replace('Bearer ', '');
  let jwt;
  try {
    jwt = verifyJWT(authHeader, process.env.JWT_SECRET);
  } catch {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  if (jwt.plan !== 'pro') {
    return { statusCode: 403, body: JSON.stringify({ error: 'PRO required' }) };
  }

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { topic, data } = parsed;
  if (!topic || !data) return { statusCode: 400, body: JSON.stringify({ error: 'Missing topic or data' }) };

  const promptFn = PROMPTS[topic];
  if (!promptFn) return { statusCode: 400, body: JSON.stringify({ error: 'Unknown topic' }) };

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
        max_tokens: 350,
        messages: [{ role: 'user', content: promptFn(data) }]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Claude error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'AI unavailable' }) };
    }

    const result = await res.json();
    const insight = result.content?.[0]?.text || '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insight })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
