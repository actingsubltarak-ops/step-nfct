importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Security Fix: Dynamic initialization instead of hardcoded credentials
self.addEventListener('message', (event) => {
  if (event.data?.type === 'INIT_FIREBASE' && event.data.config) {
    if (!firebase.apps.length) {
      firebase.initializeApp(event.data.config);
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
