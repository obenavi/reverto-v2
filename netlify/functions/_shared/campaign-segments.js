// Audience segmentation for marketing campaigns, based on invoice-scanning
// behavior (the core retention signal — see project memory: most users who
// churn are the ones who never scanned a single invoice).

const SEGMENTS = ['all', 'pro', 'free', 'zero_invoices', 'inactive_14d', 'active_scanners'];

async function getUsersWithStats(SUPABASE_URL, H) {
  const [usersRes, invRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/users?select=id,email,phone,contact_name,business_name,plan,pro_until&is_active=eq.true`, { headers: H }),
    fetch(`${SUPABASE_URL}/rest/v1/invoices?select=user_id,date`, { headers: H })
  ]);
  const users = usersRes.ok ? await usersRes.json() : [];
  const invoices = invRes.ok ? await invRes.json() : [];

  const invByUser = {};
  invoices.forEach(i => {
    const rec = invByUser[i.user_id] || (invByUser[i.user_id] = { count: 0, lastDate: null });
    rec.count++;
    if (!rec.lastDate || i.date > rec.lastDate) rec.lastDate = i.date;
  });

  const now = Date.now();
  return users.map(u => {
    const inv = invByUser[u.id] || { count: 0, lastDate: null };
    const isPro = u.plan === 'pro' && u.pro_until && new Date(u.pro_until).getTime() > now;
    const daysSinceLast = inv.lastDate ? (now - new Date(inv.lastDate).getTime()) / 86400000 : Infinity;
    return { ...u, invoice_count: inv.count, last_invoice_date: inv.lastDate, is_pro: isPro, days_since_last_invoice: daysSinceLast };
  });
}

function filterSegment(users, segment) {
  switch (segment) {
    case 'pro': return users.filter(u => u.is_pro);
    case 'free': return users.filter(u => !u.is_pro);
    case 'zero_invoices': return users.filter(u => u.invoice_count === 0);
    case 'inactive_14d': return users.filter(u => u.invoice_count > 0 && u.days_since_last_invoice > 14);
    case 'active_scanners': return users.filter(u => u.invoice_count > 0 && u.days_since_last_invoice <= 14);
    case 'all':
    default: return users;
  }
}

module.exports = { SEGMENTS, getUsersWithStats, filterSegment };
