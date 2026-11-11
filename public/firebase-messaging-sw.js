/* Service worker para Firebase Cloud Messaging (push en segundo plano) */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCipjbj_Sy2t5hZYR6a-ctGzP8tUodmpz0',
  authDomain: 'tamalescastro-ca1bf.firebaseapp.com',
  projectId: 'tamalescastro-ca1bf',
  storageBucket: 'tamalescastro-ca1bf.firebasestorage.app',
  messagingSenderId: '122126152237',
  appId: '1:122126152237:web:1e5d68e0ee2793aa42fea4',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = (payload.notification && payload.notification.title) || 'Nuevo reparto';
  const body = (payload.notification && payload.notification.body) || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: (payload.data && payload.data.deliveryId) || 'delivery',
  });
});
