// netlify/functions/ocr.js
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { base64, isPDF, mimeType } = JSON.parse(event.body || '{}');
  if (!base64) return { statusCode: 400, body: 'Missing base64' };

  const AZURE_ENDPOINT = process.env.AZURE_ENDPOINT;
  const AZURE_KEY = process.env.AZURE_KEY;

  try {
    // Submit document
    const submitRes = await fetch(
      `${AZURE_ENDPOINT}formrecognizer/documentModels/prebuilt-invoice:analyze?api-version=2023-07-31`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base64Source: base64
        })
      }
    );

    if (!submitRes.ok) {
      const err = await submitRes.text();
      return { statusCode: 502, body: JSON.stringify({ error: err }) };
    }

    const operationLocation = submitRes.headers.get('Operation-Location');
    if (!operationLocation) {
      return { statusCode: 502, body: JSON.stringify({ error: 'No operation location' }) };
    }

    // Poll for result
    let result = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollRes = await fetch(operationLocation, {
        headers: { 'Ocp-Apim-Subscription-Key': AZURE_KEY }
      });
      const pollData = await pollRes.json();
      if (pollData.status === 'succeeded') {
        result = pollData;
        break;
      }
      if (pollData.status === 'failed') {
        return { statusCode: 502, body: JSON.stringify({ error: 'OCR failed' }) };
      }
    }

    if (!result) {
      return { statusCode: 504, body: JSON.stringify({ error: 'OCR timeout' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(result)
    };
  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
