// ── Scanner ───────────────────────────────────────────────────

const AZURE_ENDPOINT = 'https://reverto.cognitiveservices.azure.com/';
const AZURE_KEY = ''; // יוגדר דרך Netlify Function

let scannerData = null;

function scannerReset(autoOpen = false) {
  document.getElementById('scanner-idle').style.display = 'block';
  document.getElementById('scanner-loading').style.display = 'none';
  document.getElementById('scanner-error').style.display = 'none';
  document.getElementById('scanner-results').style.display = 'none';
  document.getElementById('scanner-results').innerHTML = '';
  const f = document.getElementById('scan-file');
  if (f) f.value = '';
  scannerData = null;
  if (autoOpen && f) setTimeout(() => f.click(), 100);
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
  const supplierPhone = await upsertSupplier(userId, vendorName, total, date, scannerData.fields.vendorPhone || '');

  showToast('החשבונית נשמרה בהצלחה');
  if (supplierPhone) {
    setTimeout(() => showWhatsAppPrompt(vendorName, supplierPhone), 800);
  } else {
    setTimeout(() => { navTo('dashboard'); }, 1500);
  }
}

async function upsertSupplier(userId, supplierName, amount, date, phone) {
  const existing = await DB.get('suppliers', `?user_id=eq.${encodeURIComponent(userId)}&name=eq.${encodeURIComponent(supplierName)}&select=id,total_amount,invoice_count,phone`);
  if (existing && existing[0]) {
    const sup = existing[0];
    await DB.update('suppliers', `?id=eq.${sup.id}`, {
      total_amount: (parseFloat(sup.total_amount) || 0) + amount,
      invoice_count: (parseInt(sup.invoice_count) || 0) + 1,
      last_invoice_date: date
    });
    return sup.phone || phone || '';
  } else {
    await DB.insert('suppliers', {
      user_id: userId,
      name: supplierName,
      phone: phone || null,
      total_amount: amount,
      invoice_count: 1,
      last_invoice_date: date,
      created_at: new Date().toISOString()
    });
    return phone || '';
  }
}

function showWhatsAppPrompt(supplierName, phone) {
  const waNumber = formatWANumber(phone);
  const bizName = Auth.profile.business_name || '';
  const msg = encodeURIComponent(`שלום, ${bizName ? bizName + ' כאן. ' : ''}תודה על החשבונית האחרונה!`);

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  modal.innerHTML = `
    <div style="background:white;border-radius:24px 24px 0 0;padding:28px 24px 40px;width:100%;max-width:480px">
      <div style="font-size:16px;font-weight:800;margin-bottom:6px">צור קשר עם ${escHtml(supplierName)}?</div>
      <div style="font-size:13px;color:var(--on-surface-3);margin-bottom:20px">החשבונית נשמרה. רוצה לשלוח הודעה לספק?</div>
      <a href="https://wa.me/${waNumber}?text=${msg}" target="_blank" onclick="dismissWAModal()"
        style="display:flex;align-items:center;justify-content:center;gap:8px;background:#25D366;color:white;border-radius:var(--radius-md);padding:14px;font-size:15px;font-weight:700;text-decoration:none;margin-bottom:10px">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        שלח WhatsApp
      </a>
      <button onclick="dismissWAModal()"
        style="width:100%;background:none;border:1px solid var(--border);border-radius:var(--radius-md);padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--on-surface-2)">
        דלג
      </button>
    </div>
  `;
  modal.id = 'wa-prompt-modal';
  document.body.appendChild(modal);
}

function dismissWAModal() {
  document.getElementById('wa-prompt-modal')?.remove();
  navTo('dashboard');
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
