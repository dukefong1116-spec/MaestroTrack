#!/usr/bin/env node
/**
 * Writes the open-source credits the About screen shows.
 *
 * Generated rather than hand-maintained: a list typed by hand is wrong the
 * first time a dependency is added, and nobody notices because nobody
 * reads it until it matters.
 *
 * Only direct dependencies — the full transitive tree runs to hundreds of
 * packages and is noise on a phone. Reads each package's own package.json;
 * no extra dependency needed to do it.
 *
 *   node scripts/licenses.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const names = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).sort()
const out = []

for (const name of names) {
  const manifest = join(root, 'node_modules', name, 'package.json')
  if (!existsSync(manifest)) {
    console.warn(`[licenses] not installed, skipped: ${name}`)
    continue
  }
  try {
    const m = JSON.parse(readFileSync(manifest, 'utf8'))
    const license =
      typeof m.license === 'string' ? m.license
        : m.license?.type ?? (Array.isArray(m.licenses) ? m.licenses.map((l) => l.type ?? l).join(', ') : 'See package')
    out.push({
      name,
      version: m.version ?? '',
      license,
      homepage:
        m.homepage ||
        (typeof m.repository === 'string' ? m.repository : m.repository?.url) ||
        '',
    })
  } catch (e) {
    console.warn(`[licenses] unreadable, skipped: ${name} — ${e.message}`)
  }
}

const dir = join(root, 'src', 'generated')
mkdirSync(dir, { recursive: true })
writeFileSync(join(dir, 'licenses.json'), JSON.stringify(out, null, 2) + '\n')
console.log(`[licenses] wrote ${out.length} packages to src/generated/licenses.json`)
