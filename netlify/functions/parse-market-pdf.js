// Scans a price list image/PDF using Claude Vision (images) or Azure+Claude (PDFs)

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

const PRICE_PROMPT = `אתה מחלץ רשימת מחירים מתקליט מחירים ישראלי.
חלץ את כל המוצרים עם המחירים והיחידות.
- שם המוצר: שם מלא בעברית
- מחיר: מספר בלבד (ללא סימן ₪)
- יחידה: ק"ג / ליטר / יחידה / צרור / קרטון

החזר JSON בלבד ללא כל טקסט אחר:
[{"name":"שם מוצר","price":8.50,"unit":"ק\\"ג"}]`;

async function parseWithClaude(content, mimeType, apiKey) {
  const isImage = mimeType && mimeType.startsWith('image/');

  const messages = isImage ? [{
    role: 'user',
    content: [
      { type: 'image', source: { type: 'base64', media_type: mimeType, data: content } },
      { type: 'text', text: PRICE_PROMPT }
    ]
  }] : [{
    role: 'user',
    content: `${PRICE_PROMPT}\n\nטקסט המסמך:\n${content.slice(0, 5000)}`
  }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 2000, messages })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || '[]';
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON in Claude response');

  return JSON.parse(jsonMatch[0]);
}

async function getTextFromAzure(base64, azureEndpoint, azureKey) {
  const submitRes = await fetch(
    `${azureEndpoint}formrecognizer/documentModels/prebuilt-read:analyze?api-version=2023-07-31`,
    {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': azureKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Source: base64 })
    }
  );
  if (!submitRes.ok) throw new Error(`Azure submit error ${submitRes.status}`);

  const operationLocation = submitRes.headers.get('Operation-Location');
  if (!operationLocation) throw new Error('No operation location from Azure');

  for (let i = 0; i < 15; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollRes = await fetch(operationLocation, { headers: { 'Ocp-Apim-Subscription-Key': azureKey } });
    const pollData = await pollRes.json();
    if (pollData.status === 'succeeded') return pollData.analyzeResult?.content || '';
    if (pollData.status === 'failed') throw new Error('Azure OCR failed');
  }
  throw new Error('Azure OCR timeout');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const authHeader = (event.headers['authorization'] || '').replace('Bearer ', '');
  let jwt;
  try { jwt = verifyJWT(authHeader, process.env.JWT_SECRET); }
  catch (e) { return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized: ' + e.message }) }; }
  if (!jwt.is_admin) return { statusCode: 403, body: JSON.stringify({ error: 'Admin only' }) };

  let parsed;
  try { parsed = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { base64, mimeType } = parsed;
  if (!base64) return { statusCode: 400, body: JSON.stringify({ error: 'Missing base64' }) };

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };

  try {
    let products;
    const isPDF = mimeType === 'application/pdf';

    if (isPDF) {
      // PDF: use Azure OCR to extract text, then Claude to parse
      const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT;
      const AZURE_KEY = process.env.AZURE_KEY;
      if (!AZURE_ENDPOINT || !AZURE_KEY) return { statusCode: 500, body: JSON.stringify({ error: 'Azure not configured' }) };
      const text = await getTextFromAzure(base64, AZURE_ENDPOINT, AZURE_KEY);
      products = await parseWithClaude(text, null, ANTHROPIC_KEY);
    } else {
      // Image: send directly to Claude Vision (fast, no Azure needed)
      products = await parseWithClaude(base64, mimeType, ANTHROPIC_KEY);
    }

    const valid = products
      .filter(p => p.name && parseFloat(p.price) > 0)
      .map(p => ({ name: String(p.name).trim(), price: parseFloat(p.price), unit: p.unit || 'ק"ג' }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: valid })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
