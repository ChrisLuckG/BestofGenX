// Service Worker for Push Notifications - Best of GenX
// Version: 2.1.0 - iOS push improvements

const SW_VERSION = '2.1.0';

self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event);
  
  // Default fallback - iOS REQUIRES title and body to be set, otherwise it shows generic browser notification
  let data = { 
    title: 'BOGX', 
    body: 'You have a new notification' 
  };
  
  try {
    if (event.data) {
      // Try JSON first, fallback to text
      try {
        data = event.data.json();
      } catch {
        const text = event.data.text();
        if (text) data.body = text;
      }
    }
  } catch (e) {
    console.error('[SW] Could not parse push data:', e);
  }

  // Ensure title and body always set (iOS shows blank notification otherwise)
  const title = data.title || 'BOGX';
  const body = data.body || 'You have a new notification';

  const options = {
    body: body,
    icon: data.icon || '/images/genxlogo1.png',
    badge: data.badge || '/images/genxlogo1.png',
    image: data.image,
    vibrate: [200, 100, 200],
    tag: data.tag || 'bogx-' + Date.now(),
    renotify: true,
    requireInteraction: false,
    data: {
      url: data.url || '/mobile',
    }
  };

  // CRITICAL for iOS: must call showNotification synchronously inside waitUntil
  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // Notify any open windows
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        clientList.forEach(client => {
          try {
            client.postMessage({ type: 'NEW_NOTIFICATION', data: data });
          } catch (e) {
            console.error('[SW] postMessage error:', e);
          }
        });
      });
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  const url = event.notification.data?.url || '/mobile';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Find existing window from same origin
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Try to navigate to the target URL
          if ('navigate' in client) {
            return client.navigate(url).then(() => client.focus()).catch(() => client.focus());
          }
          return client.focus();
        }
      }
      
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

self.addEventListener('install', function(event) {
  console.log('[SW] Installed, version:', SW_VERSION);
  // Force immediate activation - critical for iOS
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[SW] Activated, version:', SW_VERSION);
  event.waitUntil(self.clients.claim());
});

// Minimal fetch handler - required for PWA installability criteria
// Don't intercept; let the browser handle natively
self.addEventListener('fetch', function() {
  // No-op: this empty handler is just to satisfy PWA install criteria
});
