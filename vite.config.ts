import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'
import { readFileSync } from 'node:fs'

// Read once, at config time: the About screen should show the version the
// build was cut from, not a number somebody retyped.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

/**
 * The league endpoints (api/league/*) are Vercel functions. Under
 * `npm run dev:emulator` this serves the same files locally, pointed at
 * the emulators — and only then: plain `npm run dev` talks to production,
 * and no local server may ever write league data there.
 */
function leagueApiUnderEmulator(): Plugin {
  return {
    name: 'league-api-under-emulator',
    apply: 'serve',
    configureServer(server) {
      if (process.env.VITE_USE_EMULATOR !== '1') return
      process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8085'
      process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099'
      process.env.GCLOUD_PROJECT ??= 'demo-maestrotrack'
      server.middlewares.use('/api/league', async (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\/+/, '')
        if (name !== 'ticket' && name !== 'sync') return next()
        try {
          const mod = await server.ssrLoadModule(`/api/league/${name}.js`)
          await mod.default(req, res)
        } catch (e) {
          next(e)
        }
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  plugins: [
    react(),
    tailwindcss(),
    leagueApiUnderEmulator(),
    // Installable, with the app's own files kept on the phone: a repeat
    // open starts from there instead of the network. A new version
    // downloads in the background and is switched to at a safe moment —
    // see src/lib/pwa.ts.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'MaestroTrack',
        short_name: 'MaestroTrack',
        description: 'Practice tracking for musicians.',
        start_url: '/student',
        scope: '/',
        display: 'standalone',
        background_color: '#F1ECF8',
        theme_color: '#F1ECF8',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 3_000_000,
        navigateFallback: '/index.html',
        // Served by the server, never by the app: the league endpoints
        // and the public pages behind shared links.
        navigateFallbackDenylist: [/^\/api\//, /^\/s\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Firestore's Pipeline regex engine, which the app never uses — see
      // the stub for why it is swapped out.
      're2js': path.resolve(__dirname, './src/lib/firebase/re2jsStub.js'),
    },
  },
})
