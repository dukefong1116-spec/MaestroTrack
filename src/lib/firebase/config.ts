import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { initializeFirestore, getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import type { FirebaseStorage } from 'firebase/storage'

const USING_EMULATOR =
  import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === '1'

/**
 * The project the emulators actually run as — `.firebaserc`'s default.
 *
 * The app must use this id, not the real one, whenever it is pointed at
 * the emulators. The emulator watches firestore.rules and reloads it for
 * the project it was configured with, and *only* that one. Connecting
 * under any other id gets a ruleset snapshotted the first time that id is
 * seen, which then never updates — so every later edit to firestore.rules
 * is silently ignored while the tests, which run as this project, pass.
 *
 * That cost half an evening once: a rules fix verified green by the suite
 * and still failing in the browser, because the browser was the only
 * thing running the stale copy.
 */
const EMULATOR_PROJECT_ID = 'demo-maestrotrack'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: USING_EMULATOR ? EMULATOR_PROJECT_ID : import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)

// No offline persistence — writes go directly to Firestore server.
//
// The connection is left to detect itself (the SDK's own default). Forcing
// long polling — every update fetched by asking again — worked round
// networks that break streaming, but made every network pay for it: live
// updates (messages, sessions, assignments) arrived later, over more
// requests. Auto-detect streams where it can and falls back to long
// polling by itself where it cannot, so those networks are still covered.
try {
  initializeFirestore(app, { experimentalAutoDetectLongPolling: true })
} catch {
  // Already initialized (HMR hot reload) — safe to ignore
}

export const db = getFirestore(app)

/**
 * Firebase Storage, loaded the first time something is uploaded or played.
 *
 * Its SDK is only needed for recordings, photos and share images, so it is
 * not part of the download every start pays for. The first call fetches
 * it; every later call gets the same instance.
 */
let storageKit: Promise<typeof import('firebase/storage') & { storage: FirebaseStorage }> | null = null
export function loadStorage() {
  storageKit ??= import('firebase/storage').then((sdk) => {
    const storage = sdk.getStorage(app)
    configureStorage(storage)
    if (USING_EMULATOR) {
      try {
        sdk.connectStorageEmulator(storage, window.location.hostname, 9199)
      } catch (e) {
        console.warn('[firebase] storage emulator connection failed', e)
      }
    }
    return { ...sdk, storage }
  }).catch((e) => {
    // Offline when first needed: let the next attempt fetch it again.
    storageKit = null
    throw e
  })
  return storageKit
}

/**
 * Fail in a reasonable time rather than hanging.
 *
 * The SDK defaults to retrying a failing upload for ten minutes
 * (maxUploadRetryTime 600_000) and other operations for two. That default
 * assumes a failure is worth waiting out silently. Here it was the opposite:
 * uploads were awaited inside the finish-session handler, so a rejected
 * upload left the button reading "Saving…" for up to ten minutes before it
 * surfaced anything at all.
 *
 * Uploads no longer block finishing, and pending takes are kept on disk and
 * retried on the next visit — so giving up quickly is now strictly better
 * than grinding. A slow-but-progressing upload is unaffected; this bounds
 * retries after a failure, not transfer time.
 */
function configureStorage(storage: FirebaseStorage) {
  storage.maxUploadRetryTime = 90_000
  storage.maxOperationRetryTime = 30_000
}

/**
 * Local emulator suite, opt-in.
 *
 * Doubly gated: `import.meta.env.DEV` is false in any production build, so
 * even setting the flag by accident cannot point real users at localhost.
 * Start it with `npm run dev:emulator` alongside `npm run emulate`. Off,
 * nothing here runs at all.
 *
 * The host is taken from whatever served this page rather than hard-coded:
 * `localhost` on this machine, and the computer's LAN address when a phone
 * opens it over Wi-Fi. A literal 127.0.0.1 pointed the phone at itself, so
 * testing on a real device was impossible.
 */
if (USING_EMULATOR) {
  const host = window.location.hostname
  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true })
    connectFirestoreEmulator(db, host, 8085) // 8080 is commonly taken; see firebase.json
    console.info(`[firebase] using local emulators at ${host} as ${EMULATOR_PROJECT_ID}`)
  } catch (e) {
    console.warn('[firebase] emulator connection failed', e)
  }
}

export default app
