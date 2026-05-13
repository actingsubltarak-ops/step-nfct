importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Security Fix: Dynamic initialization instead of hardcoded credentials
let isInitialized = false;

// Register listeners at top level to satisfy browser requirements
self.addEventListener('push', (event) => {
  console.log('[firebase-messaging-sw.js] Push event received');
  if (!isInitialized) {
    console.warn('[firebase-messaging-sw.js] Push received but Firebase not yet initialized');
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FIREBASE' && event.data.config) {
    if (!firebase.apps.length) {
      firebase.initializeApp(event.data.config);
      isInitialized = true;
      const messaging = firebase.messaging();

      messaging.onBackgroundMessage((payload) => {
        console.log('[firebase-messaging-sw.js] Received background message ', payload);
        const notificationTitle = payload.notification?.title || 'แจ้งเตือนใหม่';
        const notificationOptions = {
          body: payload.notification?.body || '',
          icon: '/firebase-logo.png',
          data: payload.data
        };

        self.registration.showNotification(notificationTitle, notificationOptions);
      });
    }
  }
});
