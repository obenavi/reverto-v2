// ── Scanner ───────────────────────────────────────────────────

const AZURE_ENDPOINT = 'https://reverto.cognitiveservices.azure.com/';
const AZURE_KEY = ''; // יוגדר דרך Netlify Function

let scannerData = null;

function scannerReset() {
  document.getElementById('scanner-idle').style.display = 'block';
  document.getElementById('scanner-loading').style.display = 'none';
  document.getElementById('scanner-error').style.display = 'none';
  document.getElementById('scanner-results').style.display = 'none';
  document.getElementById('scanner-results').innerHTML = '';
  document.getElementById('scan-file').value = '';
  document.getElementById('scan-file-gallery').value = '';
  scannerData = null;
}

async function scannerHandleFile(file) {
  if (!file) return;
  document.getElementById('scanner-idle').style.display = 'none';
  document.getElementById('scanner-loading').style.display = 'block';
  document.getElementById('scanner-loading-text').textContent = 'שולח לניתוח...';

  try {
    await scannerRun(file, 1);
  } catch(e) {
    scannerShowError('שגיאה', e.message || 'שגיאה לא ידועה');
  }
}

async function scannerRun(file, attempt) {
  const base64 = await fileToBase64(file);
  const isPDF = file.type === 'application/pdf';

  document.getElementById('scanner-loading-text').textContent = 'מנתח עם Azure OCR...';

  // Call via Netlify function to protect API key
  const res = await fetch('/.netlify/functions/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, isPDF, mimeType: file.type })
  });

  if (!res.ok) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 2000));
      return scannerRun(file, attempt + 1);
    }
    throw new Error('שגיאת OCR — נסה שוב');
  }

  const data = await res.json();
  document.getElementById('scanner-loading-text').textContent = 'מעבד תוצאות...';

  const fields = parseInvoiceFields(data);
  const items = parseLineItems(data);

  scannerData = { fields, items, raw: data };
  scannerShowResults(fields, items);
}

function parseInvoiceFields(data) {
  const fields = {};
  const doc = data?.analyzeResult?.documents?.[0];
  const docFields = doc?.fields || {};

  // Vendor name
  fields.vendorName = docFields.VendorName?.valueString
    || docFields.SupplierName?.valueString
    || docFields.vendor_name?.valueString
    || extractVendorFromContent(data)
    || '';

  // Invoice number
  fields.invoiceNumber = docFields.InvoiceId?.valueString
    || docFields.InvoiceNumber?.valueString
    || '';

  // Date
  fields.date = docFields.InvoiceDate?.valueDate
    || docFields.Date?.valueDate
    || new Date().toISOString().slice(0,10);

  // Total
  const totalVal = docFields.InvoiceTotal?.valueCurrency
    || docFields.Total?.valueCurrency
    || docFields.AmountDue?.valueCurrency;
  fields.total = totalVal?.amount || 0;

  // Phone
  fields.vendorPhone = docFields.VendorPhone?.valuePhoneNumber
    || docFields.SupplierPhone?.valueString
    || '';

  // Is credit note
  const content = data?.analyzeResult?.content || '';
  fields.isCreditNote = /זיכוי|credit.?note|CC/i.test(content);

  return fields;
}

function extractVendorFromContent(data) {
  const content = data?.analyzeResult?.content || '';
  const lines = content.split('\n').filter(l => l.trim().length > 2);
  return lines[0]?.trim() || '';
}

function parseLineItems(data) {
  const items = [];
  const doc = data?.analyzeResult?.documents?.[0];
  const rawItems = doc?.fields?.Items?.valueArray || [];

  rawItems.forEach(item => {
    const f = item.valueObject || {};
    const desc = f.Description?.valueString || f.ProductName?.valueString || '';
    const qty = parseFloat(f.Quantity?.valueNumber || f.Quantity?.valueString || 1);
    const unitPrice = parseFloat(f.UnitPrice?.valueCurrency?.amount || f.UnitPrice?.valueNumber || 0);
    const amount = parseFloat(f.Amount?.valueCurrency?.amount || f.Amount?.valueNumber || 0);

    if (!desc) return;

    const finalUnitPrice = unitPrice > 0 ? unitPrice : (qty > 0 ? amount / qty : 0);

    items.push({
      product_name: desc.trim(),
      quantity: qty,
      unit_price: parseFloat(finalUnitPrice.toFixed(2)),
      total_price: amount || (finalUnitPrice * qty)
    });
  });

  return items;
}

function scannerShowError(title, msg) {
  document.getElementById('scanner-loading').style.display = 'none';
  document.getElementById('scanner-error').style.display = 'block';
  document.getElementById('scanner-error-title').textContent = title;
  document.getElementById('scanner-error-msg').textContent = msg;
}

function scannerShowResults(fields, items) {
  document.getElementById('scanner-loading').style.display = 'none';
  document.getElementById('scanner-results').style.display = 'block';

  const creditBanner = fields.isCreditNote
    ? `<div style="background:var(--warning-bg);border:1px solid var(--warning);border-radius:var(--radius-md);padding:12px 14px;margin-bottom:12px;font-size:13px;font-weight:700;color:var(--warning)">חשבונית זיכוי — הסכום יירשם כשלילי</div>`
    : '';

  const html = `
    ${creditBanner}
    <div class="card card-pad mb-12">
      <div class="section-title mb-12">פרטי חשבונית</div>
      <label class="field-label">שם ספק</label>
      <input class="input mb-12" id="res-vendor" value="${escHtml(fields.vendorName)}">
      <label class="field-label">תאריך</label>
      <input class="input mb-12" id="res-date" type="date" value="${fields.date}">
      <label class="field-label">מספר חשבונית</label>
      <input class="input mb-12" id="res-invnum" value="${escHtml(fields.invoiceNumber)}">
      <label class="field-label">סה"כ (₪)</label>
      <input class="input" id="res-total" type="number" step="0.01" value="${fields.isCreditNote ? -Math.abs(fields.total) : fields.total}">
    </div>

    <div class="card mb-12">
      <div class="card-pad" style="border-bottom:1px solid var(--border)">
        <div class="section-title">פריטים (${items.length})</div>
      </div>
      <div id="res-items-list">
        ${items.map((item, i) => `
          <div style="padding:12px 14px;border-bottom:1px solid var(--border)">
            <div style="font-size:13px;font-weight:700;margin-bottom:6px">${escHtml(item.product_name)}</div>
            <div style="display:flex;gap:8px">
              <input style="flex:1" class="input" placeholder="כמות" type="number" step="0.001" value="${item.quantity}" id="qty-${i}" oninput="recalcItem(${i})">
              <input style="flex:1" class="input" placeholder="מחיר יחידה" type="number" step="0.01" value="${item.unit_price}" id="up-${i}" oninput="recalcItem(${i})">
              <input style="flex:1" class="input" placeholder="סה״כ" type="number" step="0.01" value="${item.total_price.toFixed(2)}" id="tp-${i}" readonly style="background:var(--surface-low)">
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <button class="btn-primary mb-12" onclick="handleSaveInvoice()">שמור חשבונית</button>
    <button class="btn-ghost" onclick="scannerReset()">ביטול</button>
  `;

  document.getElementById('scanner-results').innerHTML = html;
}

function recalcItem(i) {
  const qty = parseFloat(document.getElementById('qty-'+i)?.value) || 0;
  const up = parseFloat(document.getElementById('up-'+i)?.value) || 0;
  const tp = document.getElementById('tp-'+i);
  if (tp) tp.value = (qty * up).toFixed(2);
}

async function handleSaveInvoice() {
  const userId = Auth.userId;
  if (!userId) return;

  const vendorName = document.getElementById('res-vendor').value.trim();
  const date = document.getElementById('res-date').value;
  const invoiceNumber = document.getElementById('res-invnum').value.trim();
  const total = parseFloat(document.getElementById('res-total').value) || 0;

  if (!vendorName) {
    alert('חסר שם ספק');
    return;
  }

  // Collect items
  const items = [];
  const itemEls = document.querySelectorAll('#res-items-list > div');
  itemEls.forEach((el, i) => {
    const name = el.querySelector('div')?.textContent?.trim();
    const qty = parseFloat(document.getElementById('qty-'+i)?.value) || 0;
    const up = parseFloat(document.getElementById('up-'+i)?.value) || 0;
    const tp = parseFloat(document.getElementById('tp-'+i)?.value) || 0;
    if (name) items.push({ product_name: name, quantity: qty, unit_price: up, total_price: tp });
  });

  const btn = document.querySelector('#scanner-results .btn-primary');
  if (btn) { btn.textContent = 'שומר...'; btn.disabled = true; }

  // Save invoice to Supabase
  const invoice = await DB.insert('invoices', {
    user_id: userId,
    supplier_name: vendorName,
    date,
    invoice_number: invoiceNumber,
    total_amount: total,
    items: JSON.stringify(items),
    created_at: new Date().toISOString()
  });

  if (!invoice) {
    showToast('שגיאה בשמירה — נסה שוב');
    if (btn) { btn.textContent = 'שמור חשבונית'; btn.disabled = false; }
    return;
  }

  // Save items to invoice_items
  if (items.length && invoice.id) {
    for (const item of items) {
      await DB.insert('invoice_items', {
        user_id: userId,
        invoice_id: invoice.id,
        supplier_name: vendorName,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
        date
      });
    }
  }

  // Update supplier in suppliers table
  await upsertSupplier(userId, vendorName, total, date);

  showToast('החשבונית נשמרה בהצלחה');
  setTimeout(() => { navTo('dashboard'); }, 1500);
}

async function upsertSupplier(userId, supplierName, amount, date) {
  const existing = await DB.get('suppliers', `?user_id=eq.${encodeURIComponent(userId)}&name=eq.${encodeURIComponent(supplierName)}&select=id,total_amount,invoice_count`);
  if (existing && existing[0]) {
    const sup = existing[0];
    await DB.update('suppliers', `?id=eq.${sup.id}`, {
      total_amount: (parseFloat(sup.total_amount)||0) + amount,
      invoice_count: (parseInt(sup.invoice_count)||0) + 1,
      last_invoice_date: date
    });
  } else {
    await DB.insert('suppliers', {
      user_id: userId,
      name: supplierName,
      total_amount: amount,
      invoice_count: 1,
      last_invoice_date: date,
      created_at: new Date().toISOString()
    });
  }
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('שגיאת קריאת קובץ'));
    r.readAsDataURL(file);
  });
}

function escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
