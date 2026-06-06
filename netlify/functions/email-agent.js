// Hourly email agent — checks Gmail for invoice attachments per user
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;

const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

const INVOICE_SUBJECT_PATTERNS = [
  /חשבונית/i, /תעודת\s*משלוח/i, /הזמנה/i,
  /invoice/i, /receipt/i, /statement/i, /order\s*confirm/i, /delivery/i
];

const PERSONAL_DOMAINS = new Set([
  'gmail.com','yahoo.com','hotmail.com','outlook.com','walla.co.il',
  'walla.com','bezeqint.net','012.net.il','netvision.net.il','live.com'
]);

async function refreshAccessToken(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.access_token || null;
}

function looksLikeInvoice(subject, filename) {
  const subjectMatch = INVOICE_SUBJECT_PATTERNS.some(p => p.test(subject || ''));
  const hasInvoiceFile = /\.(pdf|jpg|jpeg|png|tiff?)$/i.test(filename || '');
  return hasInvoiceFile && (subjectMatch || true); // any PDF/image attachment qualifies
}

function matchSupplier(senderEmail, senderName, suppliers) {
  const senderDomain = (senderEmail.split('@')[1] || '').toLowerCase();

  for (const sup of suppliers) {
    // Exact email match
    if (sup.email && sup.email.toLowerCase() === senderEmail.toLowerCase()) return sup;

    // Domain array match
    if (sup.email_domains && sup.email_domains.includes(senderDomain)) return sup;

    // Fuzzy name match
    if (sup.name && senderName) {
      const a = sup.name.toLowerCase().replace(/\s+/g, '');
      const b = (senderName).toLowerCase().replace(/\s+/g, '');
      if (a.length > 2 && b.includes(a)) return sup;
      if (b.length > 2 && a.includes(b)) return sup;
    }
  }
  return null;
}

function isPersonalDomain(email) {
  const domain = (email.split('@')[1] || '').toLowerCase();
  return PERSONAL_DOMAINS.has(domain);
}

async function processUser(integration) {
  const { user_id, refresh_token, last_checked_at } = integration;

  const accessToken = await refreshAccessToken(refresh_token);
  if (!accessToken) {
    // Refresh token revoked — deactivate integration
    await fetch(`${SUPABASE_URL}/rest/v1/email_integrations?user_id=eq.${user_id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ active: false })
    });
    return 0;
  }

  const GH = { 'Authorization': `Bearer ${accessToken}` };

  // Fetch this user's suppliers
  const supRes = await fetch(
    `${SUPABASE_URL}/rest/v1/suppliers?user_id=eq.${user_id}&select=id,name,email,email_domains`,
    { headers: H }
  );
  const suppliers = supRes.ok ? await supRes.json() : [];

  // Search Gmail for emails with attachments since last_checked_at
  const afterTs = Math.floor(new Date(last_checked_at).getTime() / 1000);
  const query = encodeURIComponent(`has:attachment after:${afterTs}`);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=50`,
    { headers: GH }
  );
  if (!listRes.ok) return 0;

  const listData = await listRes.json();
  const messages = listData.messages || [];
  let processed = 0;

  for (const { id: msgId } of messages) {
    // Check if already seen
    const seenRes = await fetch(
      `${SUPABASE_URL}/rest/v1/pending_invoice_emails?user_id=eq.${user_id}&gmail_message_id=eq.${msgId}&select=id`,
      { headers: H }
    );
    const seen = seenRes.ok ? await seenRes.json() : [];
    if (seen.length) continue;

    // Get message details
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
      { headers: GH }
    );
    if (!msgRes.ok) continue;
    const msg = await msgRes.json();

    const headers = msg.payload?.headers || [];
    const subject = headers.find(h => h.name === 'Subject')?.value || '';
    const fromHeader = headers.find(h => h.name === 'From')?.value || '';

    // Parse sender: "Name <email>" or "email"
    const emailMatch = fromHeader.match(/<(.+?)>/) || fromHeader.match(/(\S+@\S+)/);
    const senderEmail = emailMatch ? emailMatch[1] : fromHeader;
    const senderName = fromHeader.replace(/<.+>/, '').replace(/"/g, '').trim() || senderEmail;

    // Skip personal email senders
    if (isPersonalDomain(senderEmail)) continue;

    // Find PDF/image attachments
    const parts = msg.payload?.parts || (msg.payload ? [msg.payload] : []);
    const attachments = findAttachments(parts);

    for (const att of attachments) {
      if (!looksLikeInvoice(subject, att.filename)) continue;

      // Download attachment
      let attBase64 = att.data;
      if (!attBase64 && att.attachmentId) {
        const attRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${att.attachmentId}`,
          { headers: GH }
        );
        if (attRes.ok) {
          const attData = await attRes.json();
          attBase64 = attData.data;
        }
      }
      if (!attBase64) continue;
      // Gmail uses URL-safe base64
      attBase64 = attBase64.replace(/-/g, '+').replace(/_/g, '/');

      const matchedSupplier = matchSupplier(senderEmail, senderName, suppliers);

      if (matchedSupplier) {
        // Known supplier — auto-submit to OCR via internal call
        await fetch(`${process.env.URL}/.netlify/functions/ocr`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-internal-agent': CRON_SECRET },
          body: JSON.stringify({
            base64: attBase64,
            isPDF: att.filename.toLowerCase().endsWith('.pdf'),
            mimeType: att.mimeType,
            userId: user_id,
            supplierId: matchedSupplier.id,
            supplierName: matchedSupplier.name,
            source: 'email'
          })
        }).catch(() => {});
      } else {
        // Unknown supplier — create pending approval record
        await fetch(`${SUPABASE_URL}/rest/v1/pending_invoice_emails`, {
          method: 'POST',
          headers: { ...H, 'Prefer': 'resolution=ignore-duplicates' },
          body: JSON.stringify({
            user_id,
            gmail_message_id: msgId,
            sender_email: senderEmail,
            sender_name: senderName,
            subject,
            attachment_name: att.filename,
            attachment_base64: attBase64,
            status: 'pending'
          })
        });

        // Send push notification
        await fetch(`${process.env.URL}/.netlify/functions/send-push`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
          body: JSON.stringify({
            user_id,
            title: '📧 חשבונית ממייל לא מוכר',
            body: `${senderName} — אשר או בטל`,
            tag: 'email-agent'
          })
        }).catch(() => {});
      }
      processed++;
      break; // one attachment per email is enough
    }
  }

  // Update last_checked_at
  await fetch(`${SUPABASE_URL}/rest/v1/email_integrations?user_id=eq.${user_id}`, {
    method: 'PATCH', headers: H,
    body: JSON.stringify({ last_checked_at: new Date().toISOString() })
  });

  return processed;
}

function findAttachments(parts, result = []) {
  for (const part of parts) {
    const filename = part.filename || '';
    if (filename && /\.(pdf|jpg|jpeg|png|tiff?)$/i.test(filename)) {
      result.push({
        filename,
        mimeType: part.mimeType,
        attachmentId: part.body?.attachmentId,
        data: part.body?.data
      });
    }
    if (part.parts) findAttachments(part.parts, result);
  }
  return result;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const secret = event.headers['x-cron-secret'] || '';
  if (secret !== CRON_SECRET) return { statusCode: 401, body: 'Unauthorized' };

  // Fetch all active integrations
  const intRes = await fetch(
    `${SUPABASE_URL}/rest/v1/email_integrations?active=eq.true&select=user_id,refresh_token,last_checked_at`,
    { headers: H }
  );
  if (!intRes.ok) return { statusCode: 500, body: 'DB error' };
  const integrations = await intRes.json();

  let totalProcessed = 0;
  for (const integration of integrations) {
    totalProcessed += await processUser(integration);
  }

  return { statusCode: 200, body: JSON.stringify({ processed: totalProcessed, users: integrations.length }) };
};
