import { plural, type ShareFields } from './fields'
import type { ShareKind } from './link'

/**
 * Femata's share cards, drawn on a canvas in three shapes:
 *
 *  - story   1080×1920, for Instagram/TikTok Stories and WhatsApp Status.
 *            Everything that matters sits inside the middle, clear of the
 *            platforms' own buttons along the top and bottom.
 *  - post    1080×1350 (4:5), for feeds.
 *  - sticker see-through, to lay over your own photo (Strava's trick):
 *            only the words and Femata, with a soft shadow to read on
 *            anything.
 *
 * Like the first card renderer (card.ts) it is given ShareFields and
 * nothing else, so it cannot draw something private by mistake; and it
 * draws nothing fetched from anywhere, only the device's font and the
 * app's own artwork (passed in, already an image).
 */

export type CardFormat = 'story' | 'post' | 'sticker'
export type CardTheme = 'sunset' | 'sky' | 'night' | 'mint' | 'violet'

export const FORMATS: { id: CardFormat; label: string }[] = [
  { id: 'story', label: 'Story' },
  { id: 'post', label: 'Post' },
  { id: 'sticker', label: 'Sticker' },
]

const SIZE: Record<CardFormat, [number, number]> = { story: [1080, 1920], post: [1080, 1350], sticker: [1080, 760] }

interface Palette { top: string; bottom: string; ink: string; soft: string; chip: string; chipInk: string; bar: string; barOff: string }
export const THEMES: Record<CardTheme, Palette & { label: string }> = {
  sunset: { label: 'Sunset', top: '#FF9A3D', bottom: '#F2405C', ink: '#FFFFFF', soft: 'rgba(255,255,255,.82)', chip: 'rgba(255,255,255,.22)', chipInk: '#FFFFFF', bar: '#FFFFFF', barOff: 'rgba(255,255,255,.28)' },
  sky: { label: 'Sky', top: '#EAF7FE', bottom: '#C9EAFB', ink: '#0E1626', soft: '#3E6E8F', chip: '#FFFFFF', chipInk: '#16658F', bar: '#3DB5F5', barOff: '#D7ECF8' },
  night: { label: 'Night', top: '#18233A', bottom: '#0B111E', ink: '#F5F7FB', soft: '#9AA8C0', chip: 'rgba(61,181,245,.18)', chipInk: '#7FD0FA', bar: '#3DB5F5', barOff: '#25324D' },
  mint: { label: 'Mint', top: '#5DCAA5', bottom: '#0F6E56', ink: '#FFFFFF', soft: 'rgba(255,255,255,.82)', chip: 'rgba(255,255,255,.2)', chipInk: '#FFFFFF', bar: '#FFFFFF', barOff: 'rgba(255,255,255,.28)' },
  violet: { label: 'Violet', top: '#8F86E6', bottom: '#3C3489', ink: '#FFFFFF', soft: 'rgba(255,255,255,.82)', chip: 'rgba(255,255,255,.2)', chipInk: '#FFFFFF', bar: '#FFFFFF', barOff: 'rgba(255,255,255,.28)' },
}

/** Which colours suit each moment, the first being its own. */
export const THEMES_FOR: Record<ShareKind, CardTheme[]> = {
  session: ['sky', 'sunset', 'night'],
  streak: ['sunset', 'night', 'sky'],
  badge: ['night', 'violet', 'sky'],
  league: ['mint', 'night', 'sky'],
  week: ['sky', 'violet', 'night'],
  recap: ['violet', 'night', 'sunset'],
  piece: ['night', 'sunset', 'sky'],
}

const SANS = '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif'
const SITE = 'femataus.com'

/** What a card says, worked out from the moment and its fields. */
export interface CardWords {
  kicker: string
  /** The big thing: a number ("45") or words ("Night Owl"). */
  hero: string
  /** Under a number: its unit ("minutes", "day streak"). */
  unit?: string
  line?: string
  chips: string[]
  week?: number[]
  /** The bars' day letters; Monday first unless the moment says otherwise. */
  days?: string[]
}

export function wordsFor(kind: ShareKind, f: ShareFields): CardWords {
  const first = f.name?.trim().split(/\s+/)[0]
  const chips: string[] = []
  switch (kind) {
    case 'streak':
      return {
        kicker: first ? `${first} is on fire` : 'On fire',
        hero: String(f.streakDays ?? 1),
        unit: (f.streakDays ?? 1) === 1 ? 'day practice streak' : 'day practice streak',
        line: f.dateLabel || undefined,
        chips: f.minutes ? [`${f.minutes} min today`] : [],
      }
    case 'badge':
      return { kicker: 'New badge', hero: f.badgeLabel ?? 'Badge', line: f.subline, chips: f.dateLabel ? [f.dateLabel] : [] }
    case 'league':
      return { kicker: "This week's league", hero: f.headline ?? 'League', line: f.subline, chips: f.streakDays ? [`🔥 ${f.streakDays} days`] : [] }
    case 'week':
      if (f.streakDays) chips.push(`🔥 ${plural(f.streakDays, 'day')}`)
      // The last seven days, today last: the letters follow from the date
      // range's last day, which is today.
      return { kicker: first ? `${first}'s week of practice` : 'My week of practice', hero: String(f.minutes), unit: f.minutes === 1 ? 'minute' : 'minutes', line: f.dateLabel || undefined, chips, week: f.week, days: lastSevenLetters() }
    case 'recap':
      if (f.minutes) chips.push(`${f.minutes} min`)
      if (f.streakDays) chips.push(`🔥 best ${f.streakDays} days`)
      if (f.pieceTitle) chips.push(f.pieceTitle)
      return { kicker: f.dateLabel ? `My ${f.dateLabel} in music` : 'My month in music', hero: f.headline ?? 'Musician', line: f.subline, chips }
    case 'piece':
      return { kicker: f.headline ?? 'Piece learned', hero: f.pieceTitle ?? 'A new piece', line: f.subline, chips: f.dateLabel ? [f.dateLabel] : [] }
    default:
      if (f.streakDays) chips.push(`🔥 ${f.streakDays}-day streak`)
      if (f.pieceTitle) chips.push(f.pieceTitle)
      return { kicker: "Today's practice", hero: String(f.minutes), unit: f.minutes === 1 ? 'minute' : 'minutes', line: f.dateLabel || undefined, chips, week: f.week }
  }
}

export interface RenderInput {
  kind: ShareKind
  fields: ShareFields
  format: CardFormat
  theme: CardTheme
  /** The picture in the middle: Femata, or a badge's own art. */
  art?: HTMLImageElement | null
}

export async function renderMomentCard({ kind, fields, format, theme, art }: RenderInput): Promise<Blob> {
  try { await document.fonts.ready } catch { /* draw anyway */ }
  const [W, H] = SIZE[format]
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable on this device')
  const words = wordsFor(kind, fields)

  if (format === 'sticker') drawSticker(ctx, W, H, words, art)
  else drawCard(ctx, W, H, format, THEMES[theme], words, art, fields)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not build the image'))), 'image/png')
  })
}

/* ── story and post ───────────────────────────────────────────────── */

function drawCard(
  ctx: CanvasRenderingContext2D, W: number, H: number, format: CardFormat,
  p: Palette, w: CardWords, art: HTMLImageElement | null | undefined, f: ShareFields,
) {
  const g = ctx.createLinearGradient(0, 0, W * 0.35, H)
  g.addColorStop(0, p.top)
  g.addColorStop(1, p.bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Soft circles and faint stave lines: the app's own backdrop.
  ctx.globalAlpha = 0.12
  disc(ctx, W * 0.92, H * 0.08, W * 0.36, '#FFFFFF')
  disc(ctx, W * 0.04, H * 0.92, W * 0.3, '#FFFFFF')
  ctx.globalAlpha = 0.07
  ctx.strokeStyle = p.ink
  ctx.lineWidth = 3
  for (let i = 0; i < 5; i++) {
    const y = H * 0.5 + (i - 2) * 46
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  ctx.globalAlpha = 1

  const story = format === 'story'
  // The safe area: stories lose ~250px top and bottom to the platform.
  const top = story ? 300 : 110
  const bottom = story ? H - 440 : H - 200
  const cx = W / 2

  // Lay out top to bottom, then centre the block in the safe area. When it
  // all does not fit (a week's chart as well as Femata and the number),
  // Femata gets smaller first, then the number — never into the footer.
  let artH = art ? (story ? 470 : 360) : 0
  const isNumber = /^\d+$/.test(w.hero)
  let heroSize = isNumber ? (story ? 300 : 250) : fit(ctx, w.hero, W - 160, story ? 120 : 104, '800')
  const heroLines = isNumber ? [w.hero] : wrap(ctx, w.hero, W - 160, heroSize, '800').slice(0, 3)
  const measure = () =>
    56 /* kicker */ + 40 +
    (art ? artH + 36 : 0) +
    heroLines.length * heroSize * 0.98 +
    (w.unit ? 70 : 0) +
    (w.line ? 64 : 0) +
    (w.chips.length ? 120 : 0) +
    (w.week ? 260 : 0)
  const room = bottom - top
  if (measure() > room && art) artH = Math.max(170, artH - (measure() - room))
  if (measure() > room && isNumber) heroSize = Math.max(150, heroSize - (measure() - room))
  const block = measure()
  let y = Math.max(top, top + (room - block) / 2)

  text(ctx, w.kicker.toUpperCase(), cx, y + 40, 38, '800', p.soft, 'center', 6)
  y += 96

  if (art) {
    const aw = artH * (art.naturalWidth && art.naturalHeight ? art.naturalWidth / art.naturalHeight : 7 / 6)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,.18)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 18
    ctx.drawImage(art, cx - aw / 2, y, aw, artH)
    ctx.restore()
    y += artH + 36
  }

  for (const line of heroLines) {
    y += heroSize * 0.82
    text(ctx, line, cx, y, heroSize, '800', p.ink, 'center')
    y += heroSize * 0.16
  }
  if (w.unit) { y += 56; text(ctx, w.unit, cx, y, 50, '700', p.soft, 'center') }
  if (w.line) { y += 64; text(ctx, w.line, cx, y, 38, '500', p.soft, 'center') }

  if (w.chips.length) {
    y += 50
    chipsRow(ctx, w.chips.slice(0, 3), cx, y, W - 140, p)
    y += 70
  }
  if (w.week) {
    y += 40
    weekBars(ctx, cx, y + 170, w.week, p, w.days)
    y += 200
  }

  // The footer: who, and where to find Femata.
  const fy = story ? H - 340 : H - 118
  wordmark(ctx, cx, fy, p, f.name)
}

/* ── sticker ──────────────────────────────────────────────────────── */

function drawSticker(ctx: CanvasRenderingContext2D, W: number, H: number, w: CardWords, art: HTMLImageElement | null | undefined) {
  ctx.clearRect(0, 0, W, H)
  ctx.shadowColor = 'rgba(0,0,0,.45)'
  ctx.shadowBlur = 22
  ctx.shadowOffsetY = 4
  const left = art ? 330 : 80
  if (art) {
    const h = 250
    const aw = h * (art.naturalWidth && art.naturalHeight ? art.naturalWidth / art.naturalHeight : 7 / 6)
    ctx.drawImage(art, 60, 150, aw, h)
  }
  text(ctx, w.kicker.toUpperCase(), left, 190, 34, '800', 'rgba(255,255,255,.92)', 'left', 5)
  const isNumber = /^\d+$/.test(w.hero)
  const size = isNumber ? 190 : fit(ctx, w.hero, W - left - 60, 110, '800')
  text(ctx, w.hero, left, 190 + size * 0.95, size, '800', '#FFFFFF', 'left')
  let y = 190 + size * 0.95
  if (w.unit) {
    ctx.font = `800 ${size}px ${SANS}`
    const hw = ctx.measureText(w.hero).width
    if (isNumber) text(ctx, w.unit, left + hw + 22, y, 48, '700', '#FFFFFF', 'left')
  }
  if (w.line) { y += 70; text(ctx, w.line, left, y, 40, '600', 'rgba(255,255,255,.92)', 'left') }
  if (w.chips.length) { y += 64; text(ctx, w.chips.slice(0, 2).join('  ·  '), left, y, 38, '700', '#FFFFFF', 'left') }
  y += 80
  text(ctx, `Femata · ${SITE}`, left, Math.min(H - 40, y), 30, '700', 'rgba(255,255,255,.85)', 'left', 2)
  ctx.shadowColor = 'transparent'
}

/* ── shared bits ──────────────────────────────────────────────────── */

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function text(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, weight: string,
  colour: string, align: CanvasTextAlign = 'left', spacing = 0,
) {
  ctx.fillStyle = colour
  ctx.font = `${weight} ${size}px ${SANS}`
  if (!spacing) { ctx.textAlign = align; ctx.fillText(s, x, y); return }
  ctx.textAlign = 'left'
  const chars = [...s]
  const width = chars.reduce((a, ch) => a + ctx.measureText(ch).width + spacing, -spacing)
  let cx = align === 'center' ? x - width / 2 : x
  for (const ch of chars) { ctx.fillText(ch, cx, y); cx += ctx.measureText(ch).width + spacing }
}

/** The largest size, up to `max`, at which `s` fits on at most two lines. */
function fit(ctx: CanvasRenderingContext2D, s: string, width: number, max: number, weight: string): number {
  for (let size = max; size > 48; size -= 6) {
    if (wrap(ctx, s, width, size, weight).length <= 2) return size
  }
  return 48
}

function wrap(ctx: CanvasRenderingContext2D, s: string, width: number, size: number, weight: string): string[] {
  ctx.font = `${weight} ${size}px ${SANS}`
  const out: string[] = []
  let line = ''
  for (const word of s.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word
    if (ctx.measureText(next).width <= width || !line) line = next
    else { out.push(line); line = word }
  }
  if (line) out.push(line)
  return out
}

function chipsRow(ctx: CanvasRenderingContext2D, chips: string[], cx: number, y: number, max: number, p: Palette) {
  ctx.font = `700 34px ${SANS}`
  const pad = 30
  const gap = 18
  let shown = chips.map((c) => (c.length > 26 ? `${c.slice(0, 25)}…` : c))
  const widthOf = (list: string[]) => list.reduce((a, c) => a + ctx.measureText(c).width + pad * 2, 0) + gap * (list.length - 1)
  while (shown.length > 1 && widthOf(shown) > max) shown = shown.slice(0, -1)
  let x = cx - widthOf(shown) / 2
  for (const c of shown) {
    const w = ctx.measureText(c).width + pad * 2
    ctx.fillStyle = p.chip
    round(ctx, x, y, w, 72, 36)
    ctx.fill()
    text(ctx, c, x + w / 2, y + 48, 34, '700', p.chipInk, 'center')
    x += w + gap
  }
}

/** Day letters for the seven days ending today. */
function lastSevenLetters(): string[] {
  const out: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    out.push('SMTWTFS'[d.getDay()])
  }
  return out
}

function weekBars(ctx: CanvasRenderingContext2D, cx: number, baseline: number, week: number[], p: Palette, letters?: string[]) {
  const days = week.length === 7 ? week : [0, 0, 0, 0, 0, 0, 0]
  const peak = Math.max(...days, 1)
  const bw = 54
  const gap = 30
  const total = 7 * bw + 6 * gap
  let x = cx - total / 2
  const names = letters ?? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  days.forEach((m, i) => {
    const h = Math.max(20, Math.round((m / peak) * 150))
    ctx.fillStyle = m ? p.bar : p.barOff
    round(ctx, x, baseline - h - 40, bw, h, 18)
    ctx.fill()
    text(ctx, names[i], x + bw / 2, baseline, 28, '700', p.soft, 'center')
    x += bw + gap
  })
}

/** The Femata mark, the name (if shown), and the site. */
function wordmark(ctx: CanvasRenderingContext2D, cx: number, y: number, p: Palette, name?: string) {
  const label = name ? `${name} · Femata` : 'Femata'
  ctx.font = `800 40px ${SANS}`
  const tw = ctx.measureText(label).width
  const tile = 64
  const total = tile + 20 + tw
  const x = cx - total / 2
  ctx.fillStyle = '#3DB5F5'
  round(ctx, x, y - tile + 12, tile, tile, 20)
  ctx.fill()
  // A little note in the tile: the app icon's own mark.
  ctx.fillStyle = '#FFFFFF'
  disc(ctx, x + 26, y - 6, 10, '#FFFFFF')
  ctx.fillRect(x + 34, y - 40, 6, 36)
  round(ctx, x + 34, y - 42, 20, 10, 5)
  ctx.fill()
  text(ctx, label, x + tile + 20, y, 40, '800', p.ink, 'left')
  text(ctx, SITE, cx, y + 52, 30, '600', p.soft, 'center')
}
