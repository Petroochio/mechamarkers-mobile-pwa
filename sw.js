// I really only need this worker to cache basic stuff
const cacheName = 'mm-pwa-v0.1.11';
const basicAppFiles = [
  '/mechamarkers-mobile-pwa',
  '/mechamarkers-mobile-pwa/index.html',
  '/mechamarkers-mobile-pwa/style.css',
  '/mechamarkers-mobile-pwa/build/app.js',
  '/mechamarkers-mobile-pwa/icons/mm-icon-512.png'
];

// // cache that data
// self.addEventListener('install', (e) => {
//   e.waitUntil(
//     caches.open(cacheName).then((cache) => {
//       console.log('[Service Worker] Caching all: app shell and content');
//       return cache.addAll(basicAppFiles);
//     })
//   );
// });

// // Intercept fetches for cached data
// self.addEventListener('fetch', (e) => {
//   console.log(e);

//   e.respondWith(
//     caches.match(e.request).then((r) => {
//       console.log(r);
//       console.log('[Service Worker] Fetching resource: '+e.request.url);

//       return r || fetch(e.request).then((response) => {
//         return response;
//         // Cahce new files
//           // return caches.open(cacheName).then((cache) => {
//           //   console.log('[Service Worker] Caching new resource: '+e.request.url);
//           //   // If statement here for routing webrtc
//           //   cache.put(e.request, response.clone());
//           //   return response;
//           // });
//       });
//     })
//   );
// });

// clear old cache
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if(key !== cacheName) {
          return caches.delete(key);
        }
      }));
    })
  );
});
