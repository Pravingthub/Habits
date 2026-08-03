/* Daily Habits — service worker */
const CACHE = "daily-habits-v71";
const SHELL = [
  "./",
  "./index.html",
  "./supabase.min.js",
  "./manifest.json",
  "./icon-arc-192.png",
  "./icon-arc-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Only manage our own origin (app shell). Let Supabase / fonts / CDNs pass straight through.
  if (url.origin !== self.location.origin) return;

  // App navigations: network first, fall back to cached shell (offline).
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put("./index.html", copy)); }
        return res;
      }).catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Static assets: cache first, then network (cache only OK responses).
  e.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => hit)
    )
  );
});

/* ── push reminders ── */
self.addEventListener("push", (e) => {
  let data = { title: "Arc", body: "Reminder" };
  try { if (e.data) data = e.data.json(); } catch (_) { try { data.body = e.data.text(); } catch (__) {} }
  e.waitUntil(self.registration.showNotification(data.title || "Arc", {
    body: data.body || "",
    icon: "./icon-arc-192.png",
    badge: "./icon-arc-192.png",
    tag: data.tag || "arc-reminder",
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: "./" }
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cl) => {
      for (const c of cl) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
