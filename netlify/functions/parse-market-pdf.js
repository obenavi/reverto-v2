// Scans a price list PDF/image using Azure OCR + Claude
// Returns structured {name, price, unit} array for editing before saving

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
  if (!jwt.is_admin) return { statusCode: 403, body: JSON.stringify({ error: 'Admin only' }) };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { base64, mimeType } = parsed;
  if (!base64) return { statusCode: 400, body: JSON.stringify({ error: 'Missing base64' }) };

  const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT;
  const AZURE_KEY = process.env.AZURE_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  try {
    // Step 1: Extract text with Azure prebuilt-read (better than invoice for price lists)
    const submitRes = await fetch(
      `${AZURE_ENDPOINT}formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`,
      {
        method: 'POST',
        headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Source: base64 })
      }
    );
    if (!submitRes.ok) return { statusCode: 502, body: JSON.stringify({ error: 'Azure OCR error' }) };

    const operationLocation = submitRes.headers.get('Operation-Location');
    if (!operationLocation) return { statusCode: 502, body: JSON.stringify({ error: 'No operation location' }) };

    // Poll for result
    let rawText = '';
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(operationLocation, { headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY } });
      const pollData = await pollRes.json();
      if (pollData.status === 'succeeded') {
        rawText = pollData.analyzeResult?.content || '';
        break;
      }
      if (pollData.status === 'failed') return { statusCode: 502, body: JSON.stringify({ error: 'OCR failed' }) };
    }
    if (!rawText) return { statusCode: 504, body: JSON.stringify({ error: 'OCR timeout' }) };

    // Step 2: Parse with Claude — extract price table from Hebrew document
    const prompt = `אתה מחלץ רשימת מחירים מתקליט מחירים ממשלתי ישראלי.
המסמך בעברית ומכיל טבלת מחירים של ירקות ופירות.

חלץ את כל המוצרים עם המחירים והיחידות שלהם.
- שם המוצר: שם מלא בעברית
- מחיר: מחיר לק"ג / ליטר / יחידה (מספר בלבד)
- יחידה: ק"ג / ליטר / יחידה / צרור וכדומה

החזר JSON בלבד (ללא הסבר):
[{"name":"שם מוצר","price":8.50,"unit":"ק\"ג"}]

טקסט המסמך:
${rawText.slice(0, 5000)}`;

    const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!aiRes.ok) return { statusCode: 500, body: JSON.stringify({ error: 'AI error' }) };
    const aiData = await aiRes.json();
    const text = aiData.content?.[0]?.text || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const products = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    const valid = products
      .filter(p => p.name && p.price > 0)
      .map(p => ({ name: String(p.name).trim(), price: parseFloat(p.price), unit: p.unit || 'ק"ג' }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: valid, raw_length: rawText.length })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
