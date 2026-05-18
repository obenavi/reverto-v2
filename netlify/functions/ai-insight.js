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

function fcBenchmark(category) {
  const c = (category || '').toLowerCase();
  if (c.includes('בר') || c.includes('bar') || c.includes('פאב')) return { low: 18, high: 24, label: 'בר/פאב' };
  if (c.includes('קפה') || c.includes('cafe') || c.includes('בייקרי') || c.includes('bakery')) return { low: 27, high: 34, label: 'קפה/בייקרי' };
  if (c.includes('יפנית') || c.includes('סושי') || c.includes('אסיאתי')) return { low: 28, high: 36, label: 'מסעדה אסיאתית' };
  if (c.includes('מלון') || c.includes('hotel')) return { low: 25, high: 32, label: 'מלון' };
  if (c.includes('קייטרינג')) return { low: 30, high: 40, label: 'קייטרינג' };
  if (c.includes('המבורגר') || c.includes('פאסט') || c.includes('fast')) return { low: 25, high: 31, label: 'המבורגריה' };
  if (c.includes('פיצה')) return { low: 25, high: 32, label: 'פיצה' };
  if (c.includes('ישראלית') || c.includes('מזרחית')) return { low: 28, high: 35, label: 'מסעדה ישראלית' };
  return { low: 28, high: 35, label: 'מסעדה' };
}

function fmt(n) { return (n || 0).toLocaleString('he-IL', { maximumFractionDigits: 0 }); }

const SYSTEM = `אתה ד"ר דני כהן — יועץ מסעדנות בכיר עם 25 שנות ניסיון, שילוב של רואה חשבון מוסמך, שף בעל כוכב מישלן לשעבר, ובוגר MBA מ-INSEAD. ייעצת למעל 300 מסעדות בישראל ובאירופה.

חוק ברזל — כל משפט שלך חייב להכיל מספר ספציפי מהנתונים שסופקו.
חל איסור מוחלט על: ניסוחים כלליים, עצות ללא מספרים, אמירות שיכולות להתאים לכל עסק.
כתוב בעברית שוטפת, בגוף שני, ללא פיסוק Markdown (אסור: ** * # - — בתחילת שורה).
אורך: 4-5 משפטים בלבד. כל אחד מהם חייב לגרום לבעל העסק להרגיש שאתה מכיר את הספרים שלו.`;

const PROMPTS = {

  spending: (d) => {
    const topPct = d.top_supplier && d.monthly_purchases > 0
      ? Math.round(d.top_supplier.amount / d.monthly_purchases * 100) : null;
    const lastMonthNIS = d.change_vs_last_month && d.change_vs_last_month !== 'אין נתון קודם'
      ? d.change_vs_last_month : null;
    const bench = fcBenchmark(d.category);

    return `נתוני ${d.category || 'העסק'}${d.city ? ' ב' + d.city : ''} — חודש נוכחי:
רכש: ₪${fmt(d.monthly_purchases)} | חשבוניות: ${d.invoice_count} | שינוי: ${d.change_vs_last_month}
ספק מוביל: ${d.top_supplier ? d.top_supplier.name + ' — ₪' + fmt(d.top_supplier.amount) + (topPct ? ' (' + topPct + '% מסך הרכש)' : '') : 'לא זוהה'}
ספקים מובילים נוספים: ${d.top_suppliers ? d.top_suppliers.map(s => s.name + ' ₪' + fmt(s.amount)).join(' | ') : 'אין'}
FC בנצ'מארק ל${bench.label}: ${bench.low}%–${bench.high}%

נתח: (1) ${topPct ? 'ריכוז של ' + topPct + '% אצל ספק אחד — מה הסיכון האמיתי וכמה ₪ בסכנה?' : 'פיזור הספקים — בריא?'} (2) שינוי של ${d.change_vs_last_month} — עונתי או סימן אזהרה? (3) אם חישוב 5% הנחה מהספק המוביל — כמה ₪ לשנה?`;
  },

  foodcost: (d) => {
    const bench = fcBenchmark(d.category);
    const fc = parseFloat(d.food_cost_pct) || 0;
    const rev = d.monthly_revenue || 0;
    const pur = d.monthly_purchases || 0;

    if (!rev) return `${d.category || 'העסק'} — מחזור לא הוזן החודש.
לא ניתן לחשב Food Cost ללא נתוני מחזור. הזן מחזור יומי דרך כרטיס המחזור בדשבורד.
בנצ'מארק FC תקני ל${bench.label}: ${bench.low}%–${bench.high}%. ברגע שתזין מחזור, תקבל ניתוח FC מדויק.`;

    if (!pur) return `${d.category || 'העסק'} — מחזור ₪${fmt(rev)} | חשבוניות: לא סרוקו החודש.
FC מחושב: 0% — אבל זה לא אומר שאין עלויות. זה אומר שהחשבוניות של החודש עדיין לא הועלו למערכת.
סרוק את חשבוניות ${d.category?.includes('בר') ? 'המשקאות והאלכוהול' : 'הסחורה'} של החודש — בנצ'מארק ל${bench.label} הוא ${bench.low}%–${bench.high}%.`;

    const fcStatus = fc < 15 ? `חריג נמוך (${fc.toFixed(1)}%) — כמעט בוודאות חסרות חשבוניות`
      : fc < bench.low ? `טוב מהבנצ'מארק (${fc.toFixed(1)}% מול ${bench.low}%–${bench.high}% תקני)`
      : fc <= bench.high ? `בטווח התקין (${fc.toFixed(1)}% בתוך ${bench.low}%–${bench.high}%)`
      : `גבוה מהבנצ'מארק (${fc.toFixed(1)}% לעומת ${bench.low}%–${bench.high}% תקני)`;

    const targetFC = (bench.low + bench.high) / 2 / 100;
    const targetPurchases = Math.round(rev * targetFC);
    const gap = pur - targetPurchases;

    return `${d.category || 'העסק'} — מחזור: ₪${fmt(rev)} | רכש: ₪${fmt(pur)} | FC: ${fcStatus}
בנצ'מארק ל${bench.label}: ${bench.low}%–${bench.high}% | ממוצע מטרה: ${((bench.low + bench.high)/2).toFixed(0)}% = ₪${fmt(targetPurchases)} רכש
${fc < 15 ? 'חשוב: FC מתחת ל-15% כמעט תמיד מצביע על חשבוניות חסרות, לא על ביצועים מושלמים.' : gap > 0 ? 'פער מהיעד: ₪' + fmt(gap) + ' לחודש = ₪' + fmt(gap * 12) + ' לשנה.' : 'אתה מתחת ליעד — שמור על זה.'}

${fc >= bench.high ? 'פרט היכן בדיוק נמצאת ההוצאה העיקרית מעל הנורמה, וחשב כמה ₪ ייחסך הפחתה של 3% ב-FC לחודש ולשנה.' : fc < 15 ? 'אומד את מספר החשבוניות החסרות לפי הפער בין הרכש הנוכחי לבנצ\'מארק, ומה ה-FC האמיתי הסביר.' : 'ספק שני כיוון לשיפור — האחד: הקטנת עלות בהוצאה הגדולה ביותר; השני: העלאת מחיר מנה אחת עם FC גבוה.'}`;
  },

  alerts: (d) => {
    const bench = fcBenchmark(d.category);
    const items = d.price_increases || [];
    const totalImpact = items.reduce((s, a) => s + (((a.latest || a.current_price || 0) - (a.prev || 0))), 0);

    return `${d.category || 'העסק'}${d.city ? ' ב' + d.city : ''} — רכש: ₪${fmt(d.monthly_purchases)} | התייקרויות שזוהו: ${items.length}
${items.length > 0 ? items.slice(0,4).map(a => `${a.product || a.name}: +${a.pct}% (₪${parseFloat(a.prev||0).toFixed(2)} → ₪${parseFloat(a.latest||a.current_price||0).toFixed(2)})`).join(' | ') : 'לא זוהו התייקרויות'}
${items.length > 0 ? 'השפעה מצטברת על FC לחודש — חשב ₪.' : ''}
בנצ'מארק FC ל${bench.label}: ${bench.low}%–${bench.high}%

${items.length > 0 ? 'לגבי המוצר עם ההתייקרות הגדולה ביותר: (1) חשב את ההשפעה בשקלים על בסיס כמות ממוצעת חודשית; (2) האם ניתן לנהל משא ומתן — וכמה ₪ חיסכון צפוי? (3) האם ישנה חלופה זולה שתשמר את איכות המנה?' : 'אין התייקרויות — ציין זאת בצורה חיובית עם השוואה לממוצע הענפי, ותן עצה פרואקטיבית למניעת הפתעות.'}`;
  },

  savings: (d) => {
    const bench = fcBenchmark(d.category);
    const suppliers = d.top_suppliers || [];
    const top = suppliers[0];
    const topPct = top && d.monthly_purchases > 0 ? Math.round(top.amount / d.monthly_purchases * 100) : null;
    const saving5 = top ? Math.round(top.amount * 0.05) : 0;
    const saving10 = top ? Math.round(top.amount * 0.10) : 0;

    return `${d.category || 'העסק'}${d.city ? ' ב' + d.city : ''} — רכש: ₪${fmt(d.monthly_purchases)}
ספקים: ${suppliers.map(s => s.name + ' ₪' + fmt(s.amount)).join(' | ') || 'לא זוהו'}
${topPct ? 'ריכוז: ' + topPct + '% מהרכש אצל ספק אחד (' + (top?.name || '') + ')' : ''}
${saving5 ? 'פוטנציאל חיסכון אם מנהל משא ומתן עם ' + (top?.name || 'הספק המוביל') + ': 5% הנחה = ₪' + fmt(saving5) + '/חודש (₪' + fmt(saving5*12) + '/שנה) | 10% = ₪' + fmt(saving10) + '/חודש' : ''}
בנצ'מארק: ${bench.low}%–${bench.high}%

(1) הערך את סיכון הריכוז בספק ${top?.name || 'המוביל'} ומה יקרה לעסק אם הספק יעלה מחיר ב-15%? (2) האם קיימים ספקים אלטרנטיביים בישראל לאותן קטגוריות — ומה טווח החיסכון? (3) תן טקטיקת משא ומתן אחת ספציפית שעובדת טוב עם ספקי ${d.category?.includes('בר') ? 'אלכוהול ומשקאות' : 'מזון'} בישראל.`;
  },

  overview: (d) => {
    const bench = fcBenchmark(d.category);
    const fc = parseFloat(d.food_cost_pct) || 0;
    const rev = d.monthly_revenue || 0;
    const pur = d.monthly_purchases || 0;
    const top = d.top_supplier;
    const topPct = top && pur > 0 ? Math.round(top.amount / pur * 100) : null;
    const targetFC = (bench.low + bench.high) / 2 / 100;
    const targetPurchases = rev > 0 ? Math.round(rev * targetFC) : 0;
    const fcGap = pur - targetPurchases;
    const saving5 = top ? Math.round(top.amount * 0.05 * 12) : 0;

    return `ניתוח מקיף — ${d.category || 'העסק'}${d.city ? ' ב' + d.city : ''}:

מחזור: ${rev > 0 ? '₪' + fmt(rev) : 'לא הוזן'} | רכש: ₪${fmt(pur)} (${d.invoice_count} חשבוניות) | שינוי: ${d.change_vs_last_month}
FC מחושב: ${fc > 0 ? fc.toFixed(1) + '%' : 'לא ניתן לחישוב'} | בנצ'מארק ל${bench.label}: ${bench.low}%–${bench.high}%
ספק מוביל: ${top ? top.name + ' — ₪' + fmt(top.amount) + (topPct ? ' (' + topPct + '% מהרכש)' : '') : 'לא זוהה'} | התייקרויות: ${d.alerts_count} מוצרים
${targetPurchases > 0 ? 'רכש יעד ל-FC תקני: ₪' + fmt(targetPurchases) + ' | פער נוכחי: ' + (fcGap > 0 ? '+₪' + fmt(fcGap) + ' (יקר מהיעד)' : '₪' + fmt(Math.abs(fcGap)) + ' (זול מהיעד)') : ''}
${saving5 > 0 ? 'פוטנציאל חיסכון שנתי מ-5% הנחה אצל ' + top?.name + ': ₪' + fmt(saving5) : ''}

ספק ניתוח אסטרטגי מלא — 5 משפטים, כל אחד עם מספרים ספציפיים מהנתונים:
(1) אבחון בריאות עסקית: מה המספרים אומרים — האם העסק בנתיב רווחי?
(2) ממצא קריטי: הדבר הכי חשוב שרואה יועץ בכיר בנתונים אלה — עם ₪ מדויקים
(3) הזדמנות מיידית: פעולה אחת שניתן לבצע השבוע עם ₪ ROI ספציפי
(4) סיכון נסתר: מה עלול להפתיע את העסק ב-3 החודשים הקרובים?
(5) KPI אחד למעקב — עם ערך יעד ומועד בדיקה`;
  }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = (event.headers['authorization'] || '').replace('Bearer ', '');
  let jwt;
  try { jwt = verifyJWT(authHeader, process.env.JWT_SECRET); }
  catch { return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }; }

  if (jwt.plan !== 'pro') return { statusCode: 403, body: JSON.stringify({ error: 'PRO required' }) };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { topic, data } = parsed;
  if (!topic || !data) return { statusCode: 400, body: JSON.stringify({ error: 'Missing data' }) };
  if (!PROMPTS[topic]) return { statusCode: 400, body: JSON.stringify({ error: 'Unknown topic' }) };

  // Use Sonnet for overview (best quality), Haiku for quick insights
  const model = topic === 'overview' ? 'claude-sonnet-4-6' : 'claude-haiku-4-5-20251001';
  const maxTokens = topic === 'overview' ? 600 : 400;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        system: SYSTEM,
        messages: [{ role: 'user', content: PROMPTS[topic](data) }]
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Claude error:', err);
      return { statusCode: 500, body: JSON.stringify({ error: 'AI unavailable' }) };
    }

    const result = await res.json();
    let insight = result.content?.[0]?.text || '';

    // Strip markdown
    insight = insight
      .replace(/\*\*/g, '').replace(/\*/g, '')
      .replace(/^#+\s*/gm, '').replace(/^---+$/gm, '')
      .replace(/^-\s+/gm, '').trim();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ insight, model })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
