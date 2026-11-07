/* Registro del service worker (PWA). */

if ('serviceWorker' in navigator)
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
