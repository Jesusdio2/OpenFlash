sw.js: self.addEventListener('install', (event) => {
  console.log('OpenFlash Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('OpenFlash Service Worker activado');
  // Reclamar el control de las pestañas inmediatamente
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});