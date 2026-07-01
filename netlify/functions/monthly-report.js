// GET /.netlify/functions/monthly-report?month=2026-06
// Returns full monthly report data for the authenticated user
const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const JWT_SECRET   = process.env.JWT_SECRET;

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

function calcDueDate(invoiceDate, terms) {
  const d = new Date((invoiceDate || '').slice(0, 10) + 'T00:00:00');
  if (isNaN(d)) return new Date();
  const eom = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const add = (n) => { const r = new Date(eom); r.setDate(r.getDate() + n); return r; };
  switch (terms) {
    case 'cash_delivery': return d;
    case 'cash_eom':      return eom;
    case 'net30':         return add(30);
    case 'net60':         return add(60);
    case 'net90':         return add(90);
    default:              return add(30);
  }
}

function matchMarket(productName, marketPrices) {
  const pn = productName.toLowerCase().trim();
  const exact = marketPrices.find(m => m.name.toLowerCase().trim() === pn);
  if (exact) return exact;
  const pWords = pn.split(/[\s\/,]+/).filter(w => w.length > 2);
  let best = null, bestScore = 0;
  for (const m of marketPrices) {
    const mWords = m.name.toLowerCase().split(/[\s\/,]+/).filter(w => w.length > 2);
    const shared = pWords.filter(w => mWords.some(mw => mw.includes(w) || w.includes(mw)));
    const score = shared.length / Math.max(pWords.length, mWords.length);
    if (score > bestScore && score >= 0.5) { best = m; bestScore = score; }
  }
  return best;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode: 405 };

  const payload = verifyJwt(event.headers['authorization']);
  if (!payload) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };

  // Parse month param: YYYY-MM
  const monthParam = event.queryStringParameters?.month || '';
  const match = monthParam.match(/^(\d{4})-(\d{2})$/);
  if (!match) return { statusCode: 400, body: JSON.stringify({ error: 'month param required (YYYY-MM)' }) };

  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1; // 0-indexed
  const monthStart = new Date(year, month, 1).toISOString().slice(0, 10);
  const monthEnd   = new Date(year, month + 1, 0).toISOString().slice(0, 10);
  const prevMonthStart = new Date(year, month - 3, 1).toISOString().slice(0, 10);
  const userId = payload.user_id;

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  const [userRes, invRes, revRes, supRes, oldInvRes, itemsRes, mpRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=business_name,contact_name,category,email&limit=1`, { headers: H }),
    fetch(`${SUPABASE_URL}/rest/v1/invoices?user_id=eq.${userId}&date=gte.${monthStart}&date=lte.${monthEnd}&select=*`, { headers: H }),
    fetch(`${SUPABASE_URL}/rest/v1/daily_revenues?user_id=eq.${userId}&date=gte.${monthStart}&date=lte.${monthEnd}&select=date,amount`, { headers: H }),
    fetch(`${SUPABASE_URL}/rest/v1/suppliers?user_id=eq.${userId}&select=name,payment_terms`, { headers: H }),
    fetch(`${SUPABASE_URL}/rest/v1/invoices?user_id=eq.${userId}&date=gte.${prevMonthStart}&date=lt.${monthStart}&select=supplier_name,total_amount,date,delivery_status,adjustments`, { headers: H }),
    fetch(`${SUPABASE_URL}/rest/v1/invoice_items?user_id=eq.${userId}&date=gte.${monthStart}&date=lte.${monthEnd}&select=product_name,quantity,unit_price,unit,supplier_name,total_price`, { headers: H }),
    fetch(`${SUPABASE_URL}/rest/v1/market_prices?select=name,price,unit&order=updated_at.desc`, { headers: H })
  ]);

  const [users, invoices, revenues, suppliers, oldInvoices, items, allMarket] = await Promise.all([
    userRes.json(), invRes.json(), revRes.json(), supRes.json(),
    oldInvRes.json(), itemsRes.json(), mpRes.json()
  ]);

  const user = users?.[0] || {};

  // Dedupe market prices
  const marketMap = {};
  for (const m of (allMarket || [])) if (!marketMap[m.name]) marketMap[m.name] = m;
  const marketPrices = Object.values(marketMap);

  // Financials
  const totalRevenue = (revenues || []).reduce((s, r) => s + parseFloat(r.amount || 0), 0);
  const supMap = {};
  for (const inv of (invoices || [])) {
    const name = inv.supplier_name || '—';
    if (!supMap[name]) supMap[name] = { total: 0, credit: 0, open: 0, returned: 0, not_arrived: 0 };
    supMap[name].total += parseFloat(inv.total_amount || inv.total || 0);
    const adj = inv.adjustments ? (typeof inv.adjustments === 'string' ? JSON.parse(inv.adjustments) : inv.adjustments) : [];
    supMap[name].credit += adj.reduce((s, a) => s + (a.credit_amount || 0), 0);
    if (inv.delivery_status === 'pending')     supMap[name].open++;
    if (inv.delivery_status === 'returned')    supMap[name].returned++;
    if (inv.delivery_status === 'not_arrived') supMap[name].not_arrived++;
  }
  const totalInvoiced = Object.values(supMap).reduce((s, v) => s + v.total, 0);
  const totalCredit   = Object.values(supMap).reduce((s, v) => s + v.credit, 0);
  const totalNet      = totalInvoiced - totalCredit;
  const fcPct         = totalRevenue > 0 ? (totalNet / totalRevenue) * 100 : 0;
  const openCount     = (invoices || []).filter(i => i.delivery_status === 'pending').length;

  // Payment forecast
  const termMap = {};
  for (const s of (suppliers || [])) if (s.name) termMap[s.name] = s.payment_terms || 'net30';
  const payForecastMap = {};
  for (const inv of [...(invoices || []), ...(oldInvoices || [])]) {
    const terms = termMap[inv.supplier_name] || 'net30';
    if (terms === 'order_time') continue;
    const dueDate = calcDueDate(inv.date, terms).toISOString().slice(0, 10);
    if (dueDate >= monthStart && dueDate <= monthEnd) {
      const adj = inv.adjustments ? (typeof inv.adjustments === 'string' ? JSON.parse(inv.adjustments) : inv.adjustments) : [];
      const credit = adj.reduce((s, a) => s + (a.credit_amount || 0), 0);
      const net = parseFloat(inv.total_amount || inv.total || 0) - credit;
      const key = inv.supplier_name || '—';
      if (!payForecastMap[key]) payForecastMap[key] = { total: 0, count: 0, terms };
      payForecastMap[key].total += net;
      payForecastMap[key].count++;
    }
  }

  // Market sensitivity
  const productAgg = {};
  for (const item of (items || [])) {
    const pn = (item.product_name || '').trim();
    if (!pn) continue;
    const qty = parseFloat(item.quantity || 0);
    const up  = parseFloat(item.unit_price || 0);
    if (!qty || !up) continue;
    if (!productAgg[pn]) productAgg[pn] = { qty: 0, totalSpent: 0, unit: item.unit || 'יח\'' };
    productAgg[pn].qty += qty;
    productAgg[pn].totalSpent += qty * up;
  }

  const savings = [];
  for (const [pn, agg] of Object.entries(productAgg)) {
    const market = matchMarket(pn, marketPrices);
    if (!market) continue;
    const mp = parseFloat((market.price || '0').replace(/[^\d.]/g, ''));
    if (!mp) continue;
    const avgPaid = agg.totalSpent / agg.qty;
    const diff = avgPaid - mp;
    if (diff <= 0.05) continue;
    savings.push({
      product: pn, avgPaid: +avgPaid.toFixed(2), marketPrice: mp,
      diff: +diff.toFixed(2), qty: +agg.qty.toFixed(1), unit: market.unit || agg.unit,
      savingMonth: +(diff * agg.qty).toFixed(0),
      savingYear: +(diff * agg.qty * 12).toFixed(0)
    });
  }
  savings.sort((a, b) => b.savingMonth - a.savingMonth);

  // Revenue by day for chart
  const revenueByDay = {};
  for (const r of (revenues || [])) revenueByDay[r.date] = parseFloat(r.amount || 0);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user, monthStart, monthEnd, monthParam,
      totalRevenue, totalInvoiced, totalCredit, totalNet, fcPct, openCount,
      suppliers: Object.entries(supMap).map(([name, v]) => ({ name, ...v })).sort((a,b) => b.total - a.total),
      payForecast: Object.entries(payForecastMap).map(([name, v]) => ({ name, ...v, terms: termMap[name] || 'net30' })).sort((a,b) => b.total - a.total),
      totalPayForecast: Object.values(payForecastMap).reduce((s, v) => s + v.total, 0),
      savings: savings.slice(0, 10),
      totalSavingMonth: savings.slice(0,10).reduce((s,r) => s + r.savingMonth, 0),
      totalSavingYear:  savings.slice(0,10).reduce((s,r) => s + r.savingYear, 0),
      revenueByDay,
      invoiceCount: (invoices || []).length
    })
  };
};
