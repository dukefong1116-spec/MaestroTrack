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
  window.location.reload()
  return true
}
