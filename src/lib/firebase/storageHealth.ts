import { storage } from './config'

/**
 * Is a Storage bucket actually there?
 *
 * Cloud Storage has to be switched on for a Firebase project before its
 * bucket exists. Until it is, every upload 404s — and the SDK treats a 404
 * as retryable, so it grinds through its whole retry budget before
 * surfacing `storage/retry-limit-exceeded`. With the default budget of ten
 * minutes, and uploads once being awaited inside the finish handler, that
 * presented as "saving a session hangs forever".
 *
 * A missing bucket is not a transient fault and will not fix itself, so it
 * is worth one cheap request to find out and then say so plainly. The
 * recordings themselves stay queued on disk: the moment Storage is enabled
 * they upload on their own.
 */

export type StorageHealth = 'ok' | 'not-configured' | 'unknown'

let cached: StorageHealth | null = null
let inFlight: Promise<StorageHealth> | null = null

export function cachedStorageHealth(): StorageHealth | null {
  return cached
}

/** Forget the cached answer — used after someone enables the bucket. */
export function resetStorageHealth(): void {
  cached = null
  inFlight = null
}

export async function checkStorageHealth(): Promise<StorageHealth> {
  if (cached) return cached
  if (inFlight) return inFlight

  const bucket = storage.app.options.storageBucket
  if (!bucket) {
    cached = 'not-configured'
    return cached
  }

  inFlight = (async (): Promise<StorageHealth> => {
    try {
      const res = await fetch(
        `https://firebasestorage.googleapis.com/v0/b/${bucket}/o?maxResults=1`,
        { method: 'GET' }
      )
      // 404 means the bucket is absent. 403 is the healthy answer for an
      // anonymous read against a real bucket with sensible rules, so it
      // counts as working.
      if (res.status === 404) return 'not-configured'
      return 'ok'
    } catch {
      // Offline, or the check itself was blocked. Not evidence of anything,
      // so let the upload go ahead and fail on its own terms.
      return 'unknown'
    }
  })()

  cached = await inFlight
  inFlight = null
  return cached
}
