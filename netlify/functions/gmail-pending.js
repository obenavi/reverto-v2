// Returns pending invoice emails + handles approve/reject
const crypto = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

function verifyJwt(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const [h, b, s] = token.split('.');
  if (!h || !b || !s) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
  if (expected !== s) return null;
  const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
  if (payload.exp < Date.now() / 1000) return null;
  return payload;
}

exports.handler = async (event) => {
  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  // GET — list pending items
  if (event.httpMethod === 'GET') {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/pending_invoice_emails?user_id=eq.${payload.user_id}&status=eq.pending&select=id,sender_email,sender_name,subject,attachment_name,created_at&order=created_at.desc`,
      { headers: H }
    );
    const items = r.ok ? await r.json() : [];
    return { statusCode: 200, body: JSON.stringify(items) };
  }

  // POST — approve or reject
  if (event.httpMethod === 'POST') {
    let body;
    try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Bad JSON' }; }

    const { id, action, supplier_id, supplier_name } = body;
    if (!id || !['approve', 'reject'].includes(action)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'id and action (approve|reject) required' }) };
    }

    // Verify this pending item belongs to user
    const itemRes = await fetch(
      `${SUPABASE_URL}/rest/v1/pending_invoice_emails?id=eq.${id}&user_id=eq.${payload.user_id}&select=*`,
      { headers: H }
    );
    const items = itemRes.ok ? await itemRes.json() : [];
    if (!items.length) return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    const item = items[0];

    if (action === 'reject') {
      await fetch(`${SUPABASE_URL}/rest/v1/pending_invoice_emails?id=eq.${id}`, {
        method: 'PATCH', headers: H, body: JSON.stringify({ status: 'rejected' })
      });
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }

    // approve — optionally save sender to supplier's email list
    if (supplier_id) {
      // Fetch supplier's current email_domains
      const supRes = await fetch(
        `${SUPABASE_URL}/rest/v1/suppliers?id=eq.${supplier_id}&user_id=eq.${payload.user_id}&select=email,email_domains`,
        { headers: H }
      );
      const sups = supRes.ok ? await supRes.json() : [];
      if (sups.length) {
        const sup = sups[0];
        const senderDomain = item.sender_email.split('@')[1];
        const domains = sup.email_domains || [];
        if (!domains.includes(senderDomain)) domains.push(senderDomain);
        await fetch(`${SUPABASE_URL}/rest/v1/suppliers?id=eq.${supplier_id}`, {
          method: 'PATCH', headers: H,
          body: JSON.stringify({ email_domains: domains, email: sup.email || item.sender_email })
        });
      }
    }

    // Send to OCR
    await fetch(`${process.env.URL}/.netlify/functions/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base64: item.attachment_base64,
        isPDF: (item.attachment_name || '').toLowerCase().endsWith('.pdf'),
        mimeType: (item.attachment_name || '').toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
        userId: payload.user_id,
        supplierId: supplier_id || null,
        supplierName: supplier_name || item.sender_name,
        source: 'email'
      })
    }).catch(() => {});

    await fetch(`${SUPABASE_URL}/rest/v1/pending_invoice_emails?id=eq.${id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ status: 'approved' })
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};
