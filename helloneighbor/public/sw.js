/* HelloNeighbor service worker — push notifications only.
 *
 * Deliberately does not cache anything. Bookings, messages and availability
 * are live data, and a stale cached page here would be worse than a slow one.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'HelloNeighbor', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'HelloNeighbor', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: payload.tag || 'helloneighbor',
      data: { url: payload.url || '/' },
      renotify: Boolean(payload.tag),
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Focus an existing tab on the same origin rather than opening a new one.
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
