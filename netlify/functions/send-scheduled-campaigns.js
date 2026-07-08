// Sends any marketing campaign whose scheduled_at has arrived.
// Triggered by GitHub Actions on a recurring schedule (see .github/workflows/marketing-campaigns.yml).

const { sendCampaignEmail } = require('./_shared/campaign-email');
const { getUsersWithStats, filterSegment } = require('./_shared/campaign-segments');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405 };
  const secret = event.headers['x-cron-secret'] || '';
  if (secret !== process.env.CRON_SECRET) return { statusCode: 401 };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;
  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' };

  const dueRes = await fetch(
    `${SUPABASE_URL}/rest/v1/marketing_campaigns?status=eq.scheduled&scheduled_at=lte.${encodeURIComponent(new Date().toISOString())}`,
    { headers: H }
  );
  const due = dueRes.ok ? await dueRes.json() : [];

  const summary = [];
  for (const campaign of due) {
    const users = await getUsersWithStats(SUPABASE_URL, H);
    const audience = filterSegment(users, campaign.target_segment);
    let sentCount = 0, failedCount = 0;
    for (const u of audience) {
      if (!u.email) continue;
      const name = u.contact_name || u.business_name || '';
      const sent = await sendCampaignEmail(u.email, name, campaign.subject || campaign.title, campaign.body);
      if (sent) sentCount++; else failedCount++;
      await fetch(`${SUPABASE_URL}/rest/v1/marketing_campaign_sends`, {
        method: 'POST',
        headers: { ...H, 'Prefer': 'return=minimal' },
        body: JSON.stringify({ campaign_id: campaign.id, user_id: u.id, channel: 'email', status: sent ? 'sent' : 'failed', error: sent ? null : 'send_failed' })
      });
    }
    await fetch(`${SUPABASE_URL}/rest/v1/marketing_campaigns?id=eq.${encodeURIComponent(campaign.id)}`, {
      method: 'PATCH',
      headers: { ...H, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: sentCount > 0 ? 'sent' : 'failed', sent_at: new Date().toISOString() })
    });
    summary.push({ campaign_id: campaign.id, sentCount, failedCount });
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ processed: summary.length, summary }) };
};
