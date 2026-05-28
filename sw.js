// Reverto Service Worker — push notifications

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'Reverto', body: 'יש לך תזכורת' };
  event.waitUntil(
    self.registration.showNotification(data.title || 'Reverto', {
      body: data.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      dir: 'rtl',
      lang: 'he',
      vibrate: [200, 100, 200],
      tag: data.tag || 'reverto-reminder',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ((client.url.includes('/app') || client.url.includes('/dashboard')) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/app.html');
    })
  );
});
