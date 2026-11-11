import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
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
  plugins: [react(), tailwindcss(), leagueApiUnderEmulator()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
