const webPush = require('web-push');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const cronSecret = event.headers['x-cron-secret'] || '';
  if (cronSecret !== process.env.CRON_SECRET) return { statusCode: 401, body: 'Unauthorized' };

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  webPush.setVapidDetails(
    'mailto:' + (process.env.VAPID_SUBJECT || 'revertoo.ino@gmail.com'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Israel hour + day (respects DST automatically)
  const nowIL = new Date().toLocaleString('en-US', { timeZone: 'Asia/Jerusalem' });
  const dateIL = new Date(nowIL);
  const israelHour = dateIL.getHours();
  const israelDayNum = dateIL.getDay(); // 0=Sun, 6=Sat
  const dayLetters = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  const hebrewDay = dayLetters[israelDayNum];

  const H = { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY };

  // Fetch all subscriptions joined with user notification_prefs + working_days
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth,user_id,users!user_id(working_days,notification_prefs)`,
    { headers: H }
  );
  if (!r.ok) return { statusCode: 500, body: 'DB error' };
  const subs = await r.json();
  if (!Array.isArray(subs) || !subs.length) return { statusCode: 200, body: '{"sent":0}' };

  const staleEndpoints = [];
  let sent = 0;

  for (const sub of subs) {
    const user = sub.users;
    if (!user) continue;

    // Check working day
    const workDays = (user.working_days || 'א,ב,ג,ד,ה').split(',').map(d => d.trim());
    if (!workDays.includes(hebrewDay)) continue;

    const prefs = user.notification_prefs || {};
    const messages = [];

    if (prefs.z_hour === israelHour) {
      const label = prefs.z_timing === 'next_day' ? 'של אתמול' : 'של היום';
      messages.push({ title: '📊 Reverto — Z יומי', body: `אל תשכח להזין את המחזור ${label}`, tag: 'z-daily' });
    }
    if (prefs.scan_hour === israelHour) {
      messages.push({ title: '📄 Reverto — סריקה', body: 'יש חשבוניות לסרוק? עשה את זה עכשיו!', tag: 'scan' });
    }
    if (prefs.returns_hour === israelHour) {
      messages.push({ title: '🔄 Reverto — החזרות', body: 'יש החזרות לספק לעדכן?', tag: 'returns' });
    }

    for (const msg of messages) {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(msg),
          { TTL: 3600 }
        );
        sent++;
      } catch (e) {
        if (e.statusCode === 410 || e.statusCode === 404) {
          staleEndpoints.push(sub.endpoint);
        }
      }
    }
  }

  // Clean up expired subscriptions
  for (const endpoint of staleEndpoints) {
    await fetch(
      `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
      { method: 'DELETE', headers: H }
    ).catch(() => {});
  }

  return { statusCode: 200, body: JSON.stringify({ sent, stale: staleEndpoints.length, hour: israelHour, day: hebrewDay }) };
};
