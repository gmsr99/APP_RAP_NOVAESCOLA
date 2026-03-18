// ==============================================================================
// RAP Nova Escola — Service Worker
// Suporta Web Push Notifications (iOS 16.4+ standalone + Android)
// ==============================================================================

const CACHE_NAME = 'rnebpm-v1';

self.addEventListener('install', () => {
  // Não chamar skipWaiting() nem clients.claim() — causam ecrã branco em iOS
  // O SW ativa automaticamente na primeira instalação (sem SW anterior)
});

self.addEventListener('activate', () => {
  // Não reclama clientes existentes para evitar reload forçado em iOS
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
    vibrate: [200, 100, 200],
    requireInteraction: false,
    // iOS não suporta actions ainda, mas Android sim
    tag: data.tag || 'rnebpm-notification',
    renotify: true,
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
