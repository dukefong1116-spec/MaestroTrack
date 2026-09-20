import { initializeApp, getApps, getApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { initializeFirestore, getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(app)

// No offline persistence — writes go directly to Firestore server.
// experimentalForceLongPolling works around WebSocket issues on some networks.
try {
  initializeFirestore(app, { experimentalForceLongPolling: true })
} catch {
  // Already initialized (HMR hot reload) — safe to ignore
}

export const db = getFirestore(app)
export const storage = getStorage(app)

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
storage.maxUploadRetryTime = 90_000
storage.maxOperationRetryTime = 30_000

/**
 * Local emulator suite, opt-in.
 *
 * Doubly gated: `import.meta.env.DEV` is false in any production build, so
 * even setting the flag by accident cannot point real users at localhost.
 * Start it with `VITE_USE_EMULATOR=1 npm run dev` alongside
 * `firebase emulators:start`. Off, nothing here runs at all.
 */
if (import.meta.env.DEV && import.meta.env.VITE_USE_EMULATOR === '1') {
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
    connectStorageEmulator(storage, '127.0.0.1', 9199)
    console.info('[firebase] using local emulators')
  } catch (e) {
    console.warn('[firebase] emulator connection failed', e)
  }
}

export default app
