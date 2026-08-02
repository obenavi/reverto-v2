// ── Scanner ───────────────────────────────────────────────────

const AZURE_ENDPOINT = 'https://reverto.cognitiveservices.azure.com/';
const AZURE_KEY = ''; // יוגדר דרך Netlify Function

let scannerData = null;
let batchQueue = [];

function scannerReset(autoOpen = false) {
  document.getElementById('scanner-idle').style.display = 'block';
  document.getElementById('scanner-loading').style.display = 'none';
  document.getElementById('scanner-error').style.display = 'none';
  document.getElementById('scanner-results').style.display = 'none';
  document.getElementById('scanner-results').innerHTML = '';
  ['scan-file', 'scan-file-gallery', 'scan-file-pdf'].forEach(id => {
    const f = document.getElementById(id);
    if (f) f.value = '';
  });
  scannerData = null;
  batchQueue = [];
  // Nav button auto-open → straight to rear camera
  if (autoOpen) setTimeout(() => document.getElementById('scan-file')?.click(), 100);
}

function scannerShowActionSheet() {
  const sheet = document.createElement('div');
  sheet.id = 'scan-action-sheet';
  sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9999;display:flex;align-items:flex-end;justify-content:center';
  sheet.innerHTML = `
    <div style="background:var(--surface,#fff);border-radius:24px 24px 0 0;padding:20px 16px 40px;width:100%;max-width:480px">
      <div style="width:36px;height:4px;background:var(--border,#e0e0e0);border-radius:2px;margin:0 auto 20px"></div>
      <button onclick="_scanPick('scan-file')" style="display:flex;align-items:center;gap:14px;width:100%;background:none;border:none;padding:14px 8px;cursor:pointer;font-family:inherit;border-radius:var(--radius-md,12px);margin-bottom:4px" onmouseenter="this.style.background='var(--surface-low,#f5f5f5)'" onmouseleave="this.style.background='none'">
        <span class="mi" style="font-size:26px;color:var(--primary,#6b35b8)">photo_camera</span>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:var(--on-surface,#111)">מצלמה</div>
          <div style="font-size:12px;color:var(--on-surface-3,#888)">אפשר לצלם כמה חשבוניות ברצף</div>
        </div>
      </button>
      <button onclick="_scanPick('scan-file-gallery')" style="display:flex;align-items:center;gap:14px;width:100%;background:none;border:none;padding:14px 8px;cursor:pointer;font-family:inherit;border-radius:var(--radius-md,12px);margin-bottom:4px" onmouseenter="this.style.background='var(--surface-low,#f5f5f5)'" onmouseleave="this.style.background='none'">
        <span class="mi" style="font-size:26px;color:var(--primary,#6b35b8)">image</span>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:var(--on-surface,#111)">גלריה</div>
          <div style="font-size:12px;color:var(--on-surface-3,#888)">אפשר לבחור כמה תמונות ביחד</div>
        </div>
      </button>
      <button onclick="_scanPick('scan-file-pdf')" style="display:flex;align-items:center;gap:14px;width:100%;background:none;border:none;padding:14px 8px;cursor:pointer;font-family:inherit;border-radius:var(--radius-md,12px);margin-bottom:16px" onmouseenter="this.style.background='var(--surface-low,#f5f5f5)'" onmouseleave="this.style.background='none'">
        <span class="mi" style="font-size:26px;color:var(--primary,#6b35b8)">picture_as_pdf</span>
        <div style="text-align:right">
          <div style="font-size:16px;font-weight:700;color:var(--on-surface,#111)">PDF</div>
          <div style="font-size:12px;color:var(--on-surface-3,#888)">אפשר להעלות כמה קבצים ביחד</div>
        </div>
      </button>
      <button onclick="document.getElementById('scan-action-sheet')?.remove()" style="width:100%;background:none;border:1px solid var(--border,#e0e0e0);border-radius:var(--radius-md,12px);padding:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;color:var(--on-surface-2,#555)">ביטול</button>
    </div>
  `;
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.remove(); });
  document.body.appendChild(sheet);
}

function _scanPick(inputId) {
  document.getElementById('scan-action-sheet')?.remove();
  setTimeout(() => document.getElementById(inputId)?.click(), 80);
}

// Entry point for all three file inputs (camera/gallery/pdf). A single file keeps
// the exact single-invoice review flow; more than one routes into the batch flow.
async function scannerHandleFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  if (files.length === 1) return scannerHandleFile(files[0]);
  await scannerRunBatch(files);
}

async function scannerHandleFile(file) {
  if (!file) return;
  document.getElementById('scanner-idle').style.display = 'none';
  document.getElementById('scanner-loading').style.display = 'block';
  document.getElementById('scanner-loading-text').textContent = 'שולח לניתוח...';

  try {
    const detected = await scannerExtract(file, 1);

    if (detected.length > 1) {
      // A single uploaded file (typically a multi-page scanned PDF) contained more
      // than one invoice — route into the same per-invoice review flow as a batch
      // upload instead of merging every supplier's items into one record.
      document.getElementById('scanner-loading-text').textContent = `זוהו ${detected.length} חשבוניות בקובץ — מעבד...`;
      batchQueue = [];
      for (const inv of detected) await scannerQueueInvoice(file, inv.fields, inv.items);
      showBatchSummary(1);
      return;
    }

    const { fields, items } = detected[0] || { fields: {}, items: [] };
    document.getElementById('scanner-loading-text').textContent = 'מוכן לעריכה';
    scannerData = { fields, items, raw: null };
    scannerShowResults(fields, items);
  } catch(e) {
    scannerShowError('שגיאה', e.message || 'שגיאה לא ידועה');
  }
}

// Runs OCR (Azure) for one file and returns an array of { fields, items } — one
// entry per invoice Azure's prebuilt-invoice model detected *within that file*.
// Most uploads contain exactly one invoice, but a single multi-page PDF (e.g. a
// stack of paper invoices run through an office scanner) can contain several,
// each from a different supplier — those must stay separate, not merge into one.
// `silent` skips the per-step status text (used in batch mode, where several
// files run concurrently and would otherwise race to overwrite the same line).
async function scannerExtract(file, attempt = 1, silent = false) {
  const isPDF = file.type === 'application/pdf';
  const base64 = await fileToBase64(file);
  const mimeType = isPDF ? 'application/pdf' : 'image/jpeg';

  if (!silent) document.getElementById('scanner-loading-text').textContent = 'מנתח עם Azure OCR...';

  const res = await fetch('/.netlify/functions/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64, isPDF, mimeType })
  });

  if (!res.ok) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 2000));
      return scannerExtract(file, attempt + 1, silent);
    }
    throw new Error('שגיאת OCR — נסה שוב');
  }

  const data = await res.json();
  if (!silent) document.getElementById('scanner-loading-text').textContent = 'מנתח עם AI...';

  const rawInvoices = parseAllInvoices(data);
  if (!rawInvoices.length) return [];
  const invoices = mergeContinuationPages(rawInvoices);

  // Claude's Israeli-invoice-math enhancement (קר'×יח', הנחה%, etc.) reads the whole
  // file's raw text in one shot. That's reliable when the file holds exactly one
  // invoice, but would blend line items from different suppliers together when it
  // holds several — so it's only applied in the single-invoice case; multi-invoice
  // files rely on Azure's own per-document item extraction instead.
  if (invoices.length === 1) {
    try {
      const rawText = data?.analyzeResult?.content || '';
      if (rawText.length > 100 && Auth.jwt) {
        const claudeRes = await fetch('/.netlify/functions/parse-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + Auth.jwt },
          body: JSON.stringify({ text: rawText })
        });
        if (claudeRes.ok) {
          const claudeData = await claudeRes.json();
          if (claudeData.items?.length > 0) {
            // Claude's total_price already accounts for discount_pct, but unit_price is the
            // pre-discount list price — recompute unit_price so it reflects the actual net
            // price paid (used downstream for catalog/community pricing, not just this invoice).
            invoices[0].items = claudeData.items.map(item => {
              if (item.discount_pct > 0 && item.quantity > 0) {
                return { ...item, unit_price: parseFloat((item.total_price / item.quantity).toFixed(2)) };
              }
              return item;
            });
          }
          // Azure's structured VendorPhone/VendorEmail/VendorAddress fields often come
          // up empty for less-standard invoice layouts — Claude reading the raw text
          // is a more robust fallback, used only to fill in whatever Azure missed.
          const v = claudeData.vendor;
          if (v) {
            const f = invoices[0].fields;
            if (!f.vendorPhone && v.phone) f.vendorPhone = v.phone;
            if (!f.vendorEmail && v.email) f.vendorEmail = v.email;
            if (!f.vendorAddress && v.address) f.vendorAddress = v.address;
          }
        }
      }
    } catch(e) {
      console.log('Claude parse fallback to Azure:', e.message);
    }
  }

  return invoices;
}

// Adds one detected invoice to the batch queue and either auto-saves it (vendor
// name + at least one item found) or marks it for manual review.
async function scannerQueueInvoice(file, fields, items) {
  const entry = { file, status: 'processing', fields, items };
  batchQueue.push(entry);
  if (fields.vendorName && items.length) {
    const result = await saveInvoiceData(fields.vendorName, fields.date, fields.invoiceNumber, fields.isCreditNote ? -Math.abs(fields.total) : fields.total, items, fields);
    entry.status = result ? 'saved' : 'error';
    if (!result) entry.errorMsg = 'שגיאה בשמירה';
  } else {
    entry.status = 'needs_review';
  }
  return entry;
}

// ── Batch scanning (multiple invoices in one go) ────────────────
// Processes up to BATCH_CONCURRENCY files in parallel instead of one at a time —
// each file's OCR call spends most of its time waiting on Azure, so running a few
// at once cuts total wall-clock time roughly by that factor instead of adding load
// that scales with count.
const BATCH_CONCURRENCY = 3;

async function scannerRunBatch(files) {
  document.getElementById('scanner-idle').style.display = 'none';
  document.getElementById('scanner-error').style.display = 'none';
  document.getElementById('scanner-results').style.display = 'none';
  document.getElementById('scanner-loading').style.display = 'block';

  // batchQueue holds one entry per *detected invoice*, not per uploaded file — a
  // single file (e.g. a multi-page scan) can expand into several entries, each
  // reviewed/approved independently.
  batchQueue = [];
  let filesCompleted = 0;
  const updateProgress = () => {
    document.getElementById('scanner-loading-text').textContent = `מעבד קבצים... (${filesCompleted} מתוך ${files.length} הושלמו)`;
  };
  updateProgress();

  async function processFile(file) {
    try {
      const detected = await scannerExtract(file, 1, true);
      if (!detected.length) {
        batchQueue.push({ file, status: 'needs_review', fields: null, items: [] });
      } else {
        for (const inv of detected) await scannerQueueInvoice(file, inv.fields, inv.items);
      }
    } catch (e) {
      batchQueue.push({ file, status: 'error', fields: null, items: [], errorMsg: e.message || 'שגיאת ניתוח' });
    }
    filesCompleted++;
    updateProgress();
  }

  let nextIndex = 0;
  async function worker() {
    while (nextIndex < files.length) {
      const file = files[nextIndex++];
      await processFile(file);
    }
  }
  await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, files.length) }, worker));

  showBatchSummary(files.length);
}

function showBatchSummary(fileCount) {
  document.getElementById('scanner-loading').style.display = 'none';
  document.getElementById('scanner-results').style.display = 'block';

  const savedCount = batchQueue.filter(e => e.status === 'saved').length;
  const reviewCount = batchQueue.length - savedCount;
  const statusLabels = { saved: 'נשמר', needs_review: 'דורש בדיקה', error: 'שגיאה' };
  const statusColors = { saved: 'var(--success)', needs_review: 'var(--warning)', error: 'var(--error)' };

  // Multiple detected invoices can share the same uploaded file (a multi-invoice
  // scan) — number them so it's clear they're distinct invoices, not duplicates.
  const fileOccurrence = new Map();
  const fileTotal = new Map();
  batchQueue.forEach(e => fileTotal.set(e.file, (fileTotal.get(e.file) || 0) + 1));

  const headerLine = (fileCount != null && batchQueue.length !== fileCount)
    ? `הועלו ${fileCount === 1 ? 'קובץ אחד' : fileCount + ' קבצים'} · זוהו ${batchQueue.length} חשבוניות · ${savedCount} נשמרו`
    : `${savedCount} מתוך ${batchQueue.length} חשבוניות נשמרו`;

  document.getElementById('scanner-results').innerHTML = `
    <div class="card card-pad mb-12" style="text-align:center">
      <div style="font-size:16px;font-weight:800;margin-bottom:6px">${headerLine}</div>
      ${reviewCount
        ? `<div style="font-size:13px;color:var(--warning);font-weight:700">${reviewCount} דורשות בדיקה ידנית — פרטים לא זוהו במלואם</div>`
        : `<div style="font-size:13px;color:var(--success);font-weight:700">הכל תקין!</div>`}
    </div>
    <div class="card mb-12">
      ${batchQueue.map((e, i) => {
        const total = fileTotal.get(e.file) || 1;
        const occ = (fileOccurrence.get(e.file) || 0) + 1;
        fileOccurrence.set(e.file, occ);
        const baseLabel = e.fields?.vendorName || e.file.name;
        const label = total > 1 ? `${baseLabel} (חשבונית ${occ} מתוך ${total} בקובץ)` : baseLabel;
        return `
        <div class="list-row">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(label)}</div>
            <div style="font-size:11px;color:var(--on-surface-3)">${e.fields?.date || ''}${e.fields?.total ? ' · ₪' + e.fields.total : ''}</div>
          </div>
          <div style="text-align:left;flex-shrink:0">
            <div style="font-size:12px;font-weight:700;color:${statusColors[e.status] || 'var(--on-surface-3)'}">${statusLabels[e.status] || e.status}</div>
            ${e.status !== 'saved' ? `<button onclick="reviewBatchItem(${i})" style="font-size:11px;border:none;background:none;color:var(--primary);font-weight:700;cursor:pointer;font-family:inherit;padding:2px 0">לבדיקה</button>` : ''}
          </div>
        </div>`;
      }).join('')}
    </div>
    <button class="btn-primary mb-12" onclick="scannerReset()">סיום</button>
  `;
}

// Opens the standard single-invoice edit screen pre-filled with a batch item's
// (possibly partial) extracted data, so the user can fix and save it manually.
function reviewBatchItem(i) {
  const entry = batchQueue[i];
  if (!entry) return;
  const fields = { vendorName: '', date: new Date().toISOString().slice(0, 10), invoiceNumber: '', total: 0, isCreditNote: false, ...(entry.fields || {}) };
  scannerData = { fields, items: entry.items || [], raw: null, batchIndex: i };
  document.getElementById('scanner-loading').style.display = 'none';
  document.getElementById('scanner-error').style.display = 'none';
  document.getElementById('scanner-results').style.display = 'block';
  scannerShowResults(scannerData.fields, scannerData.items);
}

// Azure's prebuilt-invoice model can detect more than one invoice within a single
// submitted file (e.g. a multi-page PDF from an office scanner holding several
// suppliers' invoices) — analyzeResult.documents is an array, one entry per
// detected invoice. Returns one { fields, items } per entry instead of assuming
// there's only ever one.
function parseAllInvoices(data) {
  const docs = data?.analyzeResult?.documents || [];
  return docs.map(doc => ({
    fields: parseInvoiceFieldsForDoc(doc, data, docs.length === 1),
    items: parseLineItemsForDoc(doc)
  }));
}

// Some invoices span multiple pages — a continuation page usually has no letterhead
// (so vendor name comes back blank) and repeats the same invoice/receipt number and
// date as the page before it, sometimes with a "X מתוך Y" page marker. Azure's own
// document splitting mostly handles this, but as a safety net: any detected "document"
// that shares an invoice number with the previous one, or has a blank vendor name
// while sharing the same date, is treated as a continuation of the same invoice and
// folded into it — not saved as a second, mostly-empty invoice.
function mergeContinuationPages(invoices) {
  const merged = [];
  for (const inv of invoices) {
    const prev = merged[merged.length - 1];
    const isContinuation = prev && (
      (inv.fields.invoiceNumber && prev.fields.invoiceNumber && inv.fields.invoiceNumber === prev.fields.invoiceNumber) ||
      (!inv.fields.vendorName && inv.fields.date && inv.fields.date === prev.fields.date)
    );
    if (isContinuation) {
      prev.items = prev.items.concat(inv.items);
      // The grand total often prints only on the last page, not the first — take
      // whichever page actually has a nonzero total, preferring a later one.
      if (inv.fields.total) prev.fields.total = inv.fields.total;
      const fillFields = ['vendorName','invoiceNumber','vendorPhone','vendorAddress','vendorEmail','vendorTaxId','customerName','customerAddress'];
      fillFields.forEach(k => { if (!prev.fields[k] && inv.fields[k]) prev.fields[k] = inv.fields[k]; });
      prev.fields.isCreditNote = prev.fields.isCreditNote || inv.fields.isCreditNote;
    } else {
      merged.push(inv);
    }
  }
  return merged;
}

function parseInvoiceFieldsForDoc(doc, data, useContentFallback) {
  const fields = {};
  const docFields = doc?.fields || {};

  // Vendor name. The whole-file text fallback only makes sense when the file
  // holds a single invoice — with several invoices in one file it would guess
  // the same name for all of them.
  fields.vendorName = docFields.VendorName?.valueString
    || docFields.SupplierName?.valueString
    || docFields.vendor_name?.valueString
    || (useContentFallback ? extractVendorFromContent(data) : '')
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

  // Extended vendor info
  fields.vendorAddress = docFields.VendorAddress?.content
    || docFields.VendorAddress?.valueAddress?.road || '';
  fields.vendorEmail = docFields.VendorEmail?.content || '';
  fields.vendorTaxId = docFields.VendorTaxId?.content
    || docFields.VendorTaxId?.valueString || '';

  // Customer (the restaurant) info — useful for cross-reference
  fields.customerName = docFields.CustomerName?.content
    || docFields.CustomerName?.valueString || '';
  fields.customerAddress = docFields.CustomerAddress?.content || '';

  // Is credit note
  const content = data?.analyzeResult?.content || '';
  fields.isCreditNote = /זיכוי|credit.?note|CC/i.test(content);

  return fields;
}

function extractVendorFromContent(data) {
  const content = data?.analyzeResult?.content || '';
  const lines = content.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 60);
  // Reject lines that are just a timestamp/date/number rather than an actual business name
  const looksLikeName = l =>
    /[א-ת]{2,}|[A-Za-z]{2,}/.test(l) &&
    !/^\d{1,2}:\d{2}(:\d{2})?$/.test(l) &&
    !/^\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}$/.test(l);
  return lines.find(looksLikeName) || '';
}

function parseLineItemsForDoc(doc) {
  const items = [];
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

  document.getElementById('scanner-results').innerHTML = `
    ${creditBanner}
    <div class="card card-pad mb-12">
      <div class="section-title mb-12">פרטי חשבונית</div>
      <label class="field-label">שם ספק</label>
      <input class="input mb-12" id="res-vendor" value="${escHtml(fields.vendorName)}">
      <label class="field-label">תאריך</label>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input class="input" id="res-date" type="date" value="${fields.date}" style="flex:1">
        <button onclick="document.getElementById('res-date').value=new Date().toISOString().slice(0,10)" style="background:none;border:1px solid var(--primary);color:var(--primary);border-radius:var(--radius-sm);padding:0 10px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;flex-shrink:0">היום</button>
      </div>
      <label class="field-label">מספר חשבונית</label>
      <input class="input mb-12" id="res-invnum" value="${escHtml(fields.invoiceNumber)}">
      <label class="field-label">סה"כ (₪)</label>
      <input class="input" id="res-total" type="number" step="0.01" value="${fields.isCreditNote ? -Math.abs(fields.total) : fields.total}">
    </div>

    <div class="card mb-12">
      <div style="padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div class="section-title">פריטים (<span id="items-count">${items.length}</span>)</div>
        <button onclick="addManualItem()" style="background:var(--primary);color:white;border:none;border-radius:20px;padding:5px 12px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit">+ הוסף ידני</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 58px 68px 68px 28px;gap:3px;padding:6px 10px;background:var(--surface-low);border-bottom:1px solid var(--border)">
        <div style="font-size:10px;font-weight:700;color:var(--on-surface-3)">שם פריט</div>
        <div style="font-size:10px;font-weight:700;color:var(--on-surface-3);text-align:center">כמות</div>
        <div style="font-size:10px;font-weight:700;color:var(--on-surface-3);text-align:center">מחיר/יח׳</div>
        <div style="font-size:10px;font-weight:700;color:var(--on-surface-3);text-align:center">סה"כ</div>
        <div></div>
      </div>
      <div id="res-items-list"></div>
    </div>

    <button class="btn-primary mb-12" onclick="handleSaveInvoice()">שמור חשבונית</button>
    <button class="btn-ghost" onclick="scannerReset()">ביטול</button>
  `;

  renderItemsList();
}

function renderItemsList() {
  const el = document.getElementById('res-items-list');
  if (!el || !scannerData) return;
  const items = scannerData.items;
  const countEl = document.getElementById('items-count');
  if (countEl) countEl.textContent = items.length;

  if (!items.length) {
    el.innerHTML = '<div style="padding:14px;text-align:center;color:var(--on-surface-3);font-size:13px">אין פריטים — לחץ "+ הוסף ידני"</div>';
    return;
  }

  el.innerHTML = items.map((item, i) => `
    <div style="padding:6px 10px;border-bottom:1px solid var(--border);display:grid;grid-template-columns:1fr 58px 68px 68px 28px;gap:3px;align-items:center">
      <input class="input" style="font-size:12px;padding:5px 6px;font-weight:600"
        id="pn-${i}" value="${escHtml(item.product_name)}" placeholder="שם פריט"
        onchange="scannerData.items[${i}].product_name=this.value">
      <input class="input" style="font-size:12px;padding:5px 3px;text-align:center"
        type="number" step="0.001" id="qty-${i}" value="${item.quantity}"
        oninput="scannerData.items[${i}].quantity=parseFloat(this.value)||0;recalcItem(${i})">
      <input class="input" style="font-size:12px;padding:5px 3px;text-align:center"
        type="number" step="0.01" id="up-${i}" value="${item.unit_price}"
        oninput="scannerData.items[${i}].unit_price=parseFloat(this.value)||0;recalcItem(${i})">
      <input class="input" style="font-size:12px;padding:5px 3px;text-align:center;background:var(--surface-low);color:var(--on-surface-2)"
        type="number" step="0.01" id="tp-${i}" value="${(item.total_price||0).toFixed(2)}" readonly>
      <button onclick="removeItem(${i})"
        style="background:none;border:none;color:var(--error);cursor:pointer;font-size:18px;padding:0;line-height:1;text-align:center">×</button>
    </div>
  `).join('');
}

function addManualItem() {
  if (!scannerData) scannerData = { fields: {}, items: [], raw: null };
  scannerData.items.push({ product_name: '', quantity: 1, unit_price: 0, total_price: 0 });
  renderItemsList();
  const lastIdx = scannerData.items.length - 1;
  setTimeout(() => document.getElementById('pn-' + lastIdx)?.focus(), 80);
}

function removeItem(i) {
  if (!scannerData) return;
  scannerData.items.splice(i, 1);
  renderItemsList();
}

function recalcItem(i) {
  const qty = parseFloat(document.getElementById('qty-'+i)?.value) || 0;
  const up = parseFloat(document.getElementById('up-'+i)?.value) || 0;
  const total = qty * up;
  const tp = document.getElementById('tp-'+i);
  if (tp) tp.value = total.toFixed(2);
  if (scannerData?.items[i]) scannerData.items[i].total_price = total;
}

async function handleSaveInvoice() {
  if (!Auth.userId) return;

  const vendorName = document.getElementById('res-vendor').value.trim();
  const date = document.getElementById('res-date').value;
  const invoiceNumber = document.getElementById('res-invnum').value.trim();
  const total = parseFloat(document.getElementById('res-total').value) || 0;

  if (!vendorName) {
    alert('חסר שם ספק');
    return;
  }

  // Collect items from scannerData (source of truth, updated via oninput/onchange)
  const items = (scannerData?.items || [])
    .map((item, i) => ({
      product_name: (document.getElementById('pn-'+i)?.value || item.product_name || '').trim(),
      quantity: parseFloat(document.getElementById('qty-'+i)?.value) || item.quantity || 0,
      unit_price: parseFloat(document.getElementById('up-'+i)?.value) || item.unit_price || 0,
      total_price: parseFloat(document.getElementById('tp-'+i)?.value) || item.total_price || 0,
      unit: item.unit || null
    }))
    .filter(item => item.product_name);

  const btn = document.querySelector('#scanner-results .btn-primary');
  if (btn) { btn.textContent = 'שומר...'; btn.disabled = true; }

  const invFields = scannerData?.fields || {};
  const result = await saveInvoiceData(vendorName, date, invoiceNumber, total, items, invFields);

  if (!result) {
    showToast('שגיאה בשמירה — נסה שוב');
    if (btn) { btn.textContent = 'שמור חשבונית'; btn.disabled = false; }
    return;
  }

  // If this save came from the batch-review screen, go back to the batch summary
  // instead of the normal single-invoice exit (dashboard / WhatsApp prompt).
  if (scannerData?.batchIndex != null) {
    batchQueue[scannerData.batchIndex].status = 'saved';
    showToast('החשבונית נשמרה בהצלחה');
    showBatchSummary();
    return;
  }

  showToast('החשבונית נשמרה בהצלחה');
  if (result.phone) {
    setTimeout(() => showWhatsAppPrompt(vendorName, result.phone), 800);
  } else {
    setTimeout(() => { navTo('dashboard'); }, 1500);
  }
}

// Persists one invoice + its items + supplier upsert. Returns { phone } on success,
// null on failure. Shared by the single-invoice save and the batch auto-save loop.
async function saveInvoiceData(vendorName, date, invoiceNumber, total, items, invFields = {}) {
  const userId = Auth.userId;
  if (!userId || !vendorName) return null;

  const activeLocation = getActiveLocation();
  const invoice = await DB.insert('invoices', {
    user_id: userId,
    supplier_name: vendorName,
    date,
    invoice_number: invoiceNumber,
    total_amount: total,
    items: JSON.stringify(items),
    location_id: activeLocation?.id || null,
    created_at: new Date().toISOString()
  });

  if (!invoice) return null;

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
        unit: item.unit || null,
        date
      });
    }
  }

  const supplierPhone = await upsertSupplier(userId, vendorName, total, date, invFields.vendorPhone || '', {
    address: invFields.vendorAddress,
    email: invFields.vendorEmail,
    tax_id: invFields.vendorTaxId
  });

  return { invoice, phone: supplierPhone || '' };
}

async function upsertSupplier(userId, supplierName, amount, date, phone, extraInfo = {}) {
  const existing = await DB.get('suppliers', `?user_id=eq.${encodeURIComponent(userId)}&name=eq.${encodeURIComponent(supplierName)}&select=id,total_amount,invoice_count,phone`);
  if (existing && existing[0]) {
    const sup = existing[0];
    const update = {
      total_amount: (parseFloat(sup.total_amount) || 0) + amount,
      invoice_count: (parseInt(sup.invoice_count) || 0) + 1,
      last_invoice_date: date
    };
    // Fill in contact info if we found it and it's not set yet
    if (phone && !sup.phone) update.phone = phone;
    if (extraInfo.address) update.address = extraInfo.address;
    if (extraInfo.email) update.email = extraInfo.email;
    if (extraInfo.tax_id) update.tax_id = extraInfo.tax_id;
    await DB.update('suppliers', `?id=eq.${sup.id}`, update);
    return sup.phone || phone || '';
  } else {
    await DB.insert('suppliers', {
      user_id: userId,
      name: supplierName,
      phone: phone || null,
      address: extraInfo.address || null,
      email: extraInfo.email || null,
      tax_id: extraInfo.tax_id || null,
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
  if (file.type === 'application/pdf') {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result.split(',')[1]);
      r.onerror = () => rej(new Error('שגיאת קריאת קובץ'));
      r.readAsDataURL(file);
    });
  }
  // Compress images before upload — Netlify Functions has a 6MB body limit
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 2000;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
        else { width = Math.round(width * MAX / height); height = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      res(dataUrl.split(',')[1]);
    };
    img.onerror = () => rej(new Error('שגיאת קריאת קובץ'));
    img.src = url;
  });
}

function escHtml(str) {
  return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Pending email invoices ───────────────────────────────────────
async function loadPendingEmails() {
  const jwt = sessionStorage.getItem('rv_jwt') || localStorage.getItem('rv_jwt');
  if (!jwt) return;
  try {
    const r = await fetch('/.netlify/functions/gmail-pending', {
      headers: { 'Authorization': 'Bearer ' + jwt }
    });
    if (!r.ok) return;
    const items = await r.json();
    const section = document.getElementById('pending-emails-section');
    const list = document.getElementById('pending-emails-list');
    if (!section || !list) return;
    if (!items.length) { section.style.display = 'none'; return; }
    section.style.display = 'block';
    list.innerHTML = items.map(item => `
      <div id="pem-${escHtml(item.id)}" style="background:var(--surface);border:1.5px solid var(--border);border-radius:var(--radius-md);padding:14px;margin-bottom:10px">
        <div style="font-size:13px;font-weight:700;color:var(--on-surface);margin-bottom:2px">${escHtml(item.sender_name || item.sender_email)}</div>
        <div style="font-size:11px;color:var(--on-surface-3);margin-bottom:6px">${escHtml(item.sender_email)} · ${escHtml(item.attachment_name || '')}</div>
        <div style="font-size:12px;color:var(--on-surface-2);margin-bottom:10px">${escHtml(item.subject || '')}</div>
        <div style="display:flex;gap:8px">
          <button onclick="pendingEmailApprove('${escHtml(item.id)}','${escHtml(item.sender_name||item.sender_email)}')"
            style="flex:1;background:var(--primary);border:none;color:white;border-radius:var(--radius-sm);padding:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            אשר וסרוק
          </button>
          <button onclick="pendingEmailReject('${escHtml(item.id)}')"
            style="flex:1;background:none;border:1.5px solid var(--border);color:var(--on-surface-2);border-radius:var(--radius-sm);padding:9px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit">
            התעלם
          </button>
        </div>
      </div>
    `).join('');
  } catch(e) { /* silent */ }
}

async function pendingEmailApprove(id, senderName) {
  const jwt = sessionStorage.getItem('rv_jwt') || localStorage.getItem('rv_jwt');
  // Ask which supplier (simple prompt for now)
  const supplierName = prompt(`מאיזה ספק הגיעה החשבונית?\n(ברירת מחדל: ${senderName})`) ?? senderName;
  if (supplierName === null) return;

  const r = await fetch('/.netlify/functions/gmail-pending', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'approve', supplier_name: supplierName })
  });
  if (r.ok) {
    document.getElementById('pem-' + id)?.remove();
    showToast('החשבונית נשלחה לעיבוד OCR');
    if (!document.getElementById('pending-emails-list')?.children.length) {
      document.getElementById('pending-emails-section').style.display = 'none';
    }
  }
}

async function pendingEmailReject(id) {
  const jwt = sessionStorage.getItem('rv_jwt') || localStorage.getItem('rv_jwt');
  const r = await fetch('/.netlify/functions/gmail-pending', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, action: 'reject' })
  });
  if (r.ok) {
    document.getElementById('pem-' + id)?.remove();
    if (!document.getElementById('pending-emails-list')?.children.length) {
      document.getElementById('pending-emails-section').style.display = 'none';
    }
  }
}
