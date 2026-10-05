const CACHE = "imhotep-v1";
const ASSETS = [
  "./", "./index.html", "./pricing.html", "./capabilities.html",
  "./about.html", "./safety.html", "./dashboard.html", "./faq.html",
  "./style.css", "./app.js", "./config.js"
];

self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) { return c.addAll(ASSETS).catch(function(){}); }));
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; })
      .map(function(k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

self.addEventListener("fetch", function(e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function(r) {
      return r || fetch(e.request).then(function(res) {
        if (res.ok && e.request.url.indexOf(self.location.origin) === 0) {
          const clone = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        }
        return res;
      }).catch(function() { return caches.match("./index.html"); });
    })
  );
});
