/*
 * Web Push in the service worker (loaded by the generated one: see
 * workbox.importScripts in vite.config.ts). Shows what the server sent,
 * and a click opens that page — in the tab already open, if there is one.
 * The server's words are shown as they are: nothing here decides them.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = {} }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Femata'
  const path = typeof data.url === 'string' && /^\/(student|teacher)(\/|$)/.test(data.url) ? data.url : '/'
  event.waitUntil(self.registration.showNotification(title, {
    body: typeof data.body === 'string' ? data.body : '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: typeof data.tag === 'string' ? data.tag : undefined,
    silent: !!data.silent,
    data: { path },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const path = (event.notification.data && event.notification.data.path) || '/'
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const tab of tabs) {
      if (new URL(tab.url).origin === self.location.origin) {
        await tab.focus()
        return tab.navigate(path)
      }
    }
    return self.clients.openWindow(path)
  })())
})
