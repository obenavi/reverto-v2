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

// Industry FC% benchmarks by category
function fcBenchmark(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('בר') || c.includes('bar')) return { low: 18, high: 24, name: 'בר' };
  if (c.includes('קפה') || c.includes('cafe') || c.includes('בייקרי') || c.includes('סנדוויץ')) return { low: 28, high: 35, name: 'בית קפה/בייקרי' };
  if (c.includes('יפנית') || c.includes('סושי') || c.includes('japanese')) return { low: 28, high: 36, name: 'מסעדה יפנית' };
  if (c.includes('מלון') || c.includes('hotel')) return { low: 26, high: 33, name: 'מלון' };
  if (c.includes('קייטרינג') || c.includes('catering')) return { low: 30, high: 40, name: 'קייטרינג' };
  if (c.includes('פיצה') || c.includes('pizza')) return { low: 25, high: 32, name: 'פיצה' };
  return { low: 28, high: 35, name: 'מסעדה' }; // default
}

const SYSTEM_PROMPT = `You are Israel's leading restaurant business consultant, combining the expertise of a certified public accountant, a seasoned F&B operator, and a McKinsey-level strategist. You specialize in Israeli restaurant economics, supplier markets, and food cost management.

Your analysis methodology:
- Always base insights on actual numbers provided — never guess or generalize
- Reference real industry benchmarks (Israeli and global) appropriate to the specific business type
- Identify anomalies that suggest data gaps (e.g., suspiciously low FC% = likely incomplete invoice scanning)
- Provide specific, actionable recommendations with exact NIS amounts
- Write like you are presenting to the business owner in a face-to-face consulting session
- NEVER use markdown formatting: no asterisks (*), no hashtags (#), no bold markers, no bullet points with dashes
- Write in fluent, professional Hebrew, 4-5 sentences maximum
- Each insight must be grounded in data — no generic advice`;

const PROMPTS = {

  spending: (data) => `נתוני הרכש של ${data.category || 'העסק'}${data.city ? ' ב' + data.city : ''} לחודש הנוכחי:
רכש כולל: ₪${(data.monthly_purchases || 0).toLocaleString('he-IL')} | חשבוניות: ${data.invoice_count} | שינוי לעומת חודש קודם: ${data.change_vs_last_month} | ספק מוביל: ${data.top_supplier ? data.top_supplier.name + ' — ₪' + data.top_supplier.amount?.toLocaleString('he-IL') : 'לא זוהה'}

נתח את הנתונים: (1) האם קצב הרכש ביחס לחודש קודם הגיוני לעונה? (2) ריכוז יתר אצל ספק אחד — מהו אחוז הספק המוביל מסך הרכש ומה הסיכון? (3) מה ₪-המלצה אחת ספציפית לחיסכון מיידי השבוע?`,

  foodcost: (data) => {
    const bench = fcBenchmark(data.category);
    const fc = parseFloat(data.food_cost_pct);
    const hasRevenue = data.monthly_revenue > 0;
    const hasPurchases = data.monthly_purchases > 0;

    let dataContext = '';
    if (!hasRevenue) {
      dataContext = 'מחזור החודש: לא הוזן עדיין.';
    } else if (!hasPurchases) {
      dataContext = `מחזור: ₪${data.monthly_revenue?.toLocaleString('he-IL')} | רכש: לא נסרקו חשבוניות החודש — FC לא ניתן לחישוב.`;
    } else {
      dataContext = `מחזור: ₪${data.monthly_revenue?.toLocaleString('he-IL')} | רכש: ₪${data.monthly_purchases?.toLocaleString('he-IL')} | Food Cost מחושב: ${fc.toFixed(1)}% | בנצ'מארק תקני ל${bench.name}: ${bench.low}%–${bench.high}%`;
    }

    return `${dataContext}

הנחיות לניתוח — שים לב לכללים הבאים:
1. FC של ${bench.low}%–${bench.high}% הוא תקין ל${bench.name}.
2. FC מתחת ל-15% בכל קטגוריה = כמעט בוודאות חוסר בחשבוניות סרוקות, לא ביצועים מדהימים — זה המסר הראשון שיש לתת.
3. FC גבוה מ-${bench.high}% = בעיה אמיתית הדורשת פעולה מיידית עם חישוב ₪ ספציפי.
4. FC בטווח התקין = כיוונים לשיפור.

ספק ניתוח מדויק ומבוסס מחקר ל${data.category || 'העסק'}, עם המלצה אחת פרקטית ומספרים.`;
  },

  alerts: (data) => {
    const bench = fcBenchmark(data.category);
    const items = data.price_increases || [];
    return `עסק: ${data.category || ''}${data.city ? ' ב' + data.city : ''} | רכש חודשי: ₪${(data.monthly_purchases || 0).toLocaleString('he-IL')}
מוצרים שהתייקרו החודש: ${items.length > 0 ? items.map(a => `${a.product} עלה ${a.pct}% (₪${a.prev?.toFixed(2)} → ₪${a.current_price?.toFixed(2) || a.latest?.toFixed(2)})`).join(' | ') : 'לא זוהו התייקרויות משמעותיות'}

בנצ'מארק FC ל${bench.name}: ${bench.low}%–${bench.high}%.

נתח: (1) מה ההשפעה הכלכלית של ההתייקרויות בשקלים על בסיס כמויות ממוצעות? (2) אילו מוצרים ניתן להחליף/לנהל משא ומתן עליהם? (3) איזה שינוי בתפריט או במתכון יאפשר לספוג את ההתייקרות מבלי לפגוע ב-FC?`;
  },

  savings: (data) => {
    const bench = fcBenchmark(data.category);
    const suppliers = data.top_suppliers || [];
    return `עסק: ${data.category || ''}${data.city ? ' ב' + data.city : ''} | רכש חודשי כולל: ₪${(data.monthly_purchases || 0).toLocaleString('he-IL')}
ספקים מובילים: ${suppliers.map(s => `${s.name} — ₪${s.amount?.toLocaleString('he-IL')}`).join(' | ') || 'לא זוהו'}
בנצ'מארק FC ל${bench.name}: ${bench.low}%–${bench.high}%

נתח: (1) האם פיזור הרכש בין הספקים בריא — מה אחוז הריכוז? (2) מה פוטנציאל החיסכון בשקלים מניהול משא ומתן עם הספק הגדול ביותר (חשב הפחתה של 5% ו-10%)? (3) האם יש סיכן שרשרת אספקה שמצריך ספק גיבוי?`;
  },

  overview: (data) => {
    const bench = fcBenchmark(data.category);
    const fc = parseFloat(data.food_cost_pct);
    const fcStatus = !fc ? 'לא ניתן לחישוב (חסרות חשבוניות או מחזור)' :
      fc < 15 ? `${fc.toFixed(1)}% — נמוך חריג, ככל הנראה חשבוניות לא סרוקות במלואן` :
      fc < bench.low ? `${fc.toFixed(1)}% — מתחת לבנצ'מארק, ביצועים טובים` :
      fc <= bench.high ? `${fc.toFixed(1)}% — בטווח התקין` :
      `${fc.toFixed(1)}% — גבוה מהבנצ'מארק, דורש טיפול`;

    return `סיכום ביצועי ${data.category || 'העסק'}${data.city ? ' ב' + data.city : ''}:
רכש החודש: ₪${(data.monthly_purchases || 0).toLocaleString('he-IL')} (${data.invoice_count} חשבוניות) | מחזור: ${data.monthly_revenue > 0 ? '₪' + data.monthly_revenue.toLocaleString('he-IL') : 'לא הוזן'}
Food Cost: ${fcStatus} | בנצ'מארק ל${bench.name}: ${bench.low}%–${bench.high}%
שינוי לעומת חודש קודם: ${data.change_vs_last_month} | ספק מוביל: ${data.top_supplier ? data.top_supplier.name + ' — ₪' + data.top_supplier.amount?.toLocaleString('he-IL') : 'לא זוהה'} | התייקרויות: ${data.alerts_count} מוצרים

ספק ניתוח אסטרטגי מלא בסגנון יועץ מחזיק McKinsey + ניסיון 20 שנה בתחום המסעדנות:
(1) הערכת בריאות עסקית כוללת — מה המספרים אומרים באמת?
(2) הממצא הקריטי ביותר שדורש פעולה מיידית — עם ₪ ספציפיים
(3) שתי המלצות אסטרטגיות מבוססות מחקר עם ROI משוער
(4) אם FC חריג נמוך — חייב לציין שזה כנראה מצביע על חוסר בסריקת חשבוניות ולא על ביצועים מושלמים`;
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = (event.headers['authorization'] || '').replace('Bearer ', '');
  let jwt;
  try { jwt = verifyJWT(authHeader, process.env.JWT_SECRET); }
  catch { return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }; }

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
        max_tokens: 450,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: promptFn(data) }]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Claude error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'AI unavailable' }) };
    }

    const result = await res.json();
    let insight = result.content?.[0]?.text || '';

    // Strip any markdown that slipped through
    insight = insight
      .replace(/\*\*/g, '').replace(/\*/g, '')
      .replace(/^#+\s*/gm, '').replace(/^-\s+/gm, '• ')
      .trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insight })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
