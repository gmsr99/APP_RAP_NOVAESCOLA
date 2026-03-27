// ==============================================================================
// RAP Nova Escola — Service Worker
// Suporta Web Push Notifications (iOS 16.4+ standalone + Android)
// ==============================================================================

const CACHE_NAME = 'rnebpm-v1';

self.addEventListener('install', (event) => {
  // skipWaiting garante que o SW atualizado ativa imediatamente
  // (necessário para receber pushes sem reiniciar a app)
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Tomar controlo de páginas abertas para que pushes sejam tratados pelo SW novo
  event.waitUntil(self.clients.claim());
});

// ---------------------------------------------------------------------------
// Push: mostra notificação nativa ao receber push do servidor
// ---------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'RAP Nova Escola', body: event.data.text(), url: '/' };
  }

  const title = data.title || 'RAP Nova Escola';
  const options = {
    body: data.body || '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: { url: data.url || '/' },
    // Tag única por notificação para que não se substituam entre si (fix iOS)
    tag: data.tag || `rnebpm-${Date.now()}`,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---------------------------------------------------------------------------
// Click na notificação: abre/foca a app e navega para o link
// ---------------------------------------------------------------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Se a app já está aberta, foca e navega
        for (const client of clientList) {
          if ('focus' in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
        // Senão abre nova janela
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
