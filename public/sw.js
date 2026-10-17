self.addEventListener('install', (event) => {
  console.log('OpenFlash Service Worker instalado');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('OpenFlash Service Worker activado');
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});