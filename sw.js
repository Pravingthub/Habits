/* Daily Habits — service worker */
const CACHE = "daily-habits-v85";
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
  let d = { title: "Arc", body: "Reminder" };
  try { if (e.data) d = e.data.json(); } catch (_) { try { d.body = e.data.text(); } catch (__) {} }
  const opts = {
    body: d.body || "",
    icon: "./icon-arc-192.png",
    badge: "./icon-arc-192.png",
    tag: d.tag || "arc-reminder",
    renotify: true,
    requireInteraction: true,          // stays until tapped (like a chat message)
    vibrate: [90, 40, 90, 40, 90],
    timestamp: Date.now(),
    data: { url: "./" },
    actions: [
      { action: "open", title: "Log now" },
      { action: "dismiss", title: "Dismiss" }
    ]
  };
  if (d.image) opts.image = d.image;   // optional wide banner if a push ever sends one
  e.waitUntil(self.registration.showNotification(d.title || "Arc", opts));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "dismiss") return;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cl) => {
      for (const c of cl) { if ("focus" in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })
  );
});
