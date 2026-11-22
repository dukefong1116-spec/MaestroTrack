import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The iPhone app: the same React app, built by Vite into dist/ and shipped
 * inside a native shell. `npm run ios` builds it and opens Xcode.
 *
 * The web version keeps deploying to Vercel as before; the app talks to
 * the same Firebase project and the same API (see src/lib/native.ts).
 */
const config: CapacitorConfig = {
  appId: 'com.mutiftrack.app',
  appName: 'Femata',
  webDir: 'dist',
  ios: {
    // The app draws under the status bar and home indicator itself
    // (viewport-fit=cover and the safe-area insets in the CSS).
    contentInset: 'never',
    // White behind the page while it loads, matching the app's own page.
    backgroundColor: '#FFFFFF',
    // Long-press link previews belong to a browser, not an app.
    allowsLinkPreview: false,
    scrollEnabled: true,
  },
}

export default config
