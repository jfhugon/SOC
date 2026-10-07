// Service worker minimal : rend l'application installable et ouvre l'écran d'accueil hors ligne.
// Les données (Supabase) ne sont jamais mises en cache : pièces et messages restent confidentiels.
const CACHE = 'centaure-v1'
const SHELL = ['/', '/index.html', '/icon.svg', '/manifest.webmanifest']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))))
  self.clients.claim()
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')))
    return
  }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const cible = e.notification.data?.url || '/'
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => {
    const c = cs.find((x) => 'focus' in x)
    if (c) { c.navigate(cible); return c.focus() }
    return self.clients.openWindow(cible)
  }))
})
