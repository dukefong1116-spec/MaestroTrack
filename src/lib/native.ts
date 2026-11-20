import { Capacitor } from '@capacitor/core'

/**
 * Running inside the iPhone app (Capacitor), rather than in a browser.
 *
 * The app's own files ship inside it, served from capacitor://localhost —
 * so anything that assumed "this page's address is the website's" needs
 * the real one: the league API on Vercel, and every link meant for other
 * people (invites, shared pages).
 */
export const isNativeApp = Capacitor.isNativePlatform()

/** The website, where the API and public links live. */
export const WEB_ORIGIN = 'https://maestro-track.vercel.app'

/** Where a link meant for someone else should point. */
export function publicOrigin(): string {
  if (isNativeApp || typeof window === 'undefined') return WEB_ORIGIN
  return window.location.origin
}

/** An API path, made absolute inside the app. */
export function apiUrl(path: string): string {
  return isNativeApp ? `${WEB_ORIGIN}${path}` : path
}

/**
 * An app does not zoom. Safari zooms into any text box whose text is under
 * 16px, and lets a pinch or double-tap scale the page — right for a web
 * page, wrong for an app, where the layout is the screen. Inside the app
 * only; the website keeps zoom for anyone who needs it.
 */
export function lockNativeZoom(): void {
  if (!isNativeApp || typeof document === 'undefined') return
  const meta = document.querySelector('meta[name="viewport"]')
  meta?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
}
