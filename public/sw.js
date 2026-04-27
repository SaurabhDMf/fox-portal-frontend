/* Service Worker — Push Notifications + PWA caching */

// Map notification type → deep-link path
function linkForType(data) {
  if (data.link)    return data.link;
  if (data.roomId)  return `/admin/chat?room=${data.roomId}`;
  const type = data.type || '';
  if (type === 'mention' || type === 'message') return '/admin/chat';
  if (type === 'task')    return '/admin/projects';
  if (type === 'lead')    return '/admin/crm';
  if (type === 'invoice') return '/admin/invoicing';
  if (type === 'ticket')  return '/admin/tickets';
  if (type === 'leave' || type === 'payroll') return '/admin/payroll';
  return '/admin';
}

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title || 'Fox Portal';
  const body  = data.body  || '';
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/favicon.png',
      badge: '/favicon.png',
      tag:   data.type || 'general',   // collapse same-type notifications
      renotify: true,
      data: data.data || data,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = linkForType(event.notification.data || {});
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus existing tab if possible
      for (const client of list) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});

// PWA: cache app shell on install
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
