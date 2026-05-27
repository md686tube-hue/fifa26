// ⚽ FIFA World Cup 2026 – Service Worker
const CACHE_NAME = "wc2026-v1";
const STATIC_ASSETS = ["/", "/index.html", "/favicon.ico"];

// ── Install: cache static assets ──────────────────────────────
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

// ── Activate: clear old caches ────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first, fallback to cache ───────────────────
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(e.request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ── Push Notification ─────────────────────────────────────────
self.addEventListener("push", (e) => {
  const data = e.data ? e.data.json() : {};
  const options = {
    body: data.body || "ম্যাচ শুরু হতে চলেছে!",
    icon: data.icon || "/favicon.ico",
    badge: "/favicon.ico",
    tag: data.tag || "wc2026-match",
    requireInteraction: true,
    data: { url: data.url || "/" },
  };
  e.waitUntil(self.registration.showNotification(data.title || "⚽ FIFA World Cup 2026", options));
});

// ── Notification Click: focus app ─────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && "focus" in client) return client.focus();
      }
      return clients.openWindow(e.notification.data?.url || "/");
    })
  );
});
