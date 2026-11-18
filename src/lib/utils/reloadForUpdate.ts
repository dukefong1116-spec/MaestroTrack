/**
 * Recovering a tab that was open across a deploy.
 *
 * Page files are named by content, so each deploy renames them. A tab
 * opened earlier still asks for the old names, and the import fails. A
 * reload fetches the new names. See AppErrorBoundary.
 */

const RELOADED_AT = 'maestro_reloaded_for_update'

/** The browsers' words for "that page's file did not load". */
export function isStaleChunk(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|text\/html/i.test(msg)
}

/**
 * Reload to pick up the new deploy — at most once a minute, so a page
 * that is genuinely broken cannot reload forever. Returns false when it
 * did not reload.
 */
export function reloadForUpdate(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
  } catch {
    // Storage unavailable (private mode): reloading without the guard
    // risks a loop, so offer the button instead.
    return false
  }
  void freshReload()
  return true
}

/**
 * A reload that really fetches the new version.
 *
 * A plain reload is answered by the service worker from the copy saved on
 * the phone — the same old page that just failed, so it failed again,
 * and after one try the app gave up on an error screen. So: if the new
 * version is already downloaded and waiting, switch to it; otherwise let
 * go of the saved copy entirely, so the reload goes to the network. The
 * service worker registers itself again on the next start.
 */
export async function freshReload(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg?.waiting) {
      const done = new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
        setTimeout(resolve, 3000)
      })
      reg.waiting.postMessage({ type: 'SKIP_WAITING' })
      await done
    } else if (reg) {
      await reg.unregister()
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k.startsWith('workbox-precache')).map((k) => caches.delete(k)))
    }
  } catch {
    // Nothing more to try than the reload itself.
  }
  window.location.reload()
}
