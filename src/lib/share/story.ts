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

export type CardFormat = 'story' | 'post' | 'sticker' | 'reddit'
export type CardTheme = 'sunset' | 'sky' | 'night' | 'mint' | 'violet'

export const FORMATS: { id: CardFormat; label: string }[] = [
  { id: 'story', label: 'Story' },
  { id: 'post', label: 'Post' },
  { id: 'sticker', label: 'Sticker' },
]

const SIZE: Record<CardFormat, [number, number]> = { story: [1080, 1920], post: [1080, 1350], sticker: [1080, 760], reddit: [1080, 1350] }

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
  /** The Reddit picture's calendar (see RedditStreak). */
  reddit?: RedditStreak
}

/**
 * The streak as a progress picture for Reddit: no link and no web address
 * on it (a post with either reads as an ad), just the work, and a small
 * Femata mark. Never stored or sent anywhere but the person's own photos.
 */
export interface RedditStreak {
  /** The last 35 days, oldest first, today last: 0 missed, 1 practised, 2 kept (lesson day or freeze). */
  calendar: number[]
  /** "cello", already in words; omitted when unknown. */
  instrument?: string
}

/** The app's own icon, from the app itself (same origin, so drawable). */
let icon: Promise<HTMLImageElement | null> | null = null
function appIcon(): Promise<HTMLImageElement | null> {
  icon ??= new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = '/apple-touch-icon.png'
  })
  return icon
}

export async function renderMomentCard({ kind, fields, format, theme, art, reddit }: RenderInput): Promise<Blob> {
  try { await document.fonts.ready } catch { /* draw anyway */ }
  const [W, H] = SIZE[format]
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable on this device')
  const words = wordsFor(kind, fields)

  const logo = await appIcon()
  if (format === 'sticker') drawSticker(ctx, W, H, words, art)
  else if (format === 'reddit') drawReddit(ctx, W, H, THEMES[theme], fields, reddit, art, logo)
  else drawCard(ctx, W, H, format, THEMES[theme], words, art, fields, logo)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not build the image'))), 'image/png')
  })
}

/* ── story and post ───────────────────────────────────────────────── */

function drawCard(
  ctx: CanvasRenderingContext2D, W: number, H: number, format: CardFormat,
  p: Palette, w: CardWords, art: HTMLImageElement | null | undefined, f: ShareFields,
  logo: HTMLImageElement | null,
) {
  const story = format === 'story'
  const cx = W / 2

  // Ground: the colour, a glow where Femata stands, and a stave behind.
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H)
  g.addColorStop(0, p.top)
  g.addColorStop(1, p.bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Layout, top to bottom, sized to fit the shape.
  const head = story ? 170 : 92
  const footH = story ? 260 : 170
  const pillY = head + (story ? 150 : 112)
  const isNumber = /^\d+$/.test(w.hero)
  let artH = art ? (story ? 600 : 400) : 0
  let heroSize = isNumber ? (story ? 330 : 250) : fit(ctx, w.hero, W - 140, story ? 128 : 104, '900')
  const heroLines = isNumber ? [w.hero] : wrap(ctx, w.hero, W - 140, heroSize, '900').slice(0, 3)
  const below = () =>
    heroLines.length * heroSize * 0.98 + (w.unit ? 72 : 0) + (w.line ? 60 : 0) +
    (w.chips.length ? 118 : 0) + (w.week ? 250 : 0)
  const room = H - footH - (pillY + 70)
  const need = () => (art ? artH + 30 : 0) + below()
  if (need() > room && art) artH = Math.max(220, artH - (need() - room))
  if (need() > room && isNumber) heroSize = Math.max(170, heroSize - (need() - room))
  let y = pillY + 70 + Math.max(0, (room - need()) / 2)

  if (art) {
    const glow = ctx.createRadialGradient(cx, y + artH / 2, 0, cx, y + artH / 2, artH * 0.75)
    glow.addColorStop(0, 'rgba(255,255,255,.34)')
    glow.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, y - artH * 0.3, W, artH * 1.6)
  }
  ctx.save()
  ctx.globalAlpha = 0.09
  ctx.strokeStyle = p.ink
  ctx.lineWidth = 4
  const staffMid = art ? y + artH * 0.55 : H * 0.45
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(0, staffMid + i * 42); ctx.lineTo(W, staffMid + i * 42); ctx.stroke()
  }
  ctx.restore()

  // Header: the real app icon and the name.
  const iconS = story ? 96 : 76
  if (logo) {
    ctx.save()
    round(ctx, 72, head - iconS / 2, iconS, iconS, iconS * 0.23)
    ctx.clip()
    ctx.drawImage(logo, 72, head - iconS / 2, iconS, iconS)
    ctx.restore()
  }
  text(ctx, 'Femata', 72 + (logo ? iconS + 24 : 0), head + (story ? 18 : 14), story ? 54 : 44, '800', p.ink)
  if (f.dateLabel && story) text(ctx, f.dateLabel, W - 72, head + 14, 32, '600', p.soft, 'right')

  // The moment, in a pill.
  ctx.font = `800 ${story ? 36 : 30}px ${SANS}`
  const kick = w.kicker.toUpperCase()
  const kw = [...kick].reduce((a, ch) => a + ctx.measureText(ch).width + 5, 0) + 70
  ctx.fillStyle = p.chip
  round(ctx, cx - kw / 2, pillY - (story ? 46 : 40), kw, story ? 72 : 62, 36)
  ctx.fill()
  text(ctx, kick, cx, pillY + (story ? 3 : 2), story ? 36 : 30, '800', p.chipInk, 'center', 5)

  if (art) {
    const aw = artH * (art.naturalWidth && art.naturalHeight ? art.naturalWidth / art.naturalHeight : 7 / 6)
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,.22)'
    ctx.shadowBlur = 50
    ctx.shadowOffsetY = 24
    ctx.drawImage(art, cx - aw / 2, y, aw, artH)
    ctx.restore()
    y += artH + 30
  }

  for (const line of heroLines) {
    y += heroSize * 0.84
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,.12)'
    ctx.shadowBlur = 18
    ctx.shadowOffsetY = 6
    text(ctx, line, cx, y, heroSize, '900', p.ink, 'center')
    ctx.restore()
    y += heroSize * 0.14
  }
  if (w.unit) { y += 58; text(ctx, w.unit, cx, y, story ? 54 : 46, '800', p.soft, 'center') }
  if (w.line) { y += 60; text(ctx, w.line, cx, y, story ? 38 : 34, '600', p.soft, 'center') }
  if (w.chips.length) { y += 44; chipsRow(ctx, w.chips.slice(0, 3), cx, y, W - 140, p); y += 74 }
  if (w.week) { y += 40; weekBars(ctx, cx, y + 190, w.week, p, w.days); y += 210 }

  // Footer: who, and where to find Femata.
  const fy = H - footH + (story ? 70 : 40)
  if (f.name) {
    const r = story ? 40 : 34
    const label = f.name
    ctx.font = `800 ${story ? 44 : 38}px ${SANS}`
    const nw = ctx.measureText(label).width
    const total = r * 2 + 20 + nw
    const x0 = cx - total / 2
    disc(ctx, x0 + r, fy, r, p.chip)
    text(ctx, label.trim().charAt(0).toUpperCase(), x0 + r, fy + r * 0.38, r * 1.05, '800', p.chipInk, 'center')
    text(ctx, label, x0 + r * 2 + 20, fy + (story ? 15 : 13), story ? 44 : 38, '800', p.ink, 'left')
  }
  const sy = fy + (story ? 100 : 78)
  ctx.font = `700 ${story ? 32 : 28}px ${SANS}`
  const site = `Practise on Femata · ${SITE}`
  const sw = ctx.measureText(site).width + 64
  ctx.fillStyle = p.chip
  round(ctx, cx - sw / 2, sy - (story ? 44 : 38), sw, story ? 66 : 58, 33)
  ctx.fill()
  text(ctx, site, cx, sy, story ? 32 : 28, '700', p.chipInk, 'center')
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

/* ── Reddit: the streak as a progress picture ─────────────────────── */

function drawReddit(
  ctx: CanvasRenderingContext2D, W: number, H: number, p: Palette, f: ShareFields,
  r: RedditStreak | undefined, art: HTMLImageElement | null | undefined, logo: HTMLImageElement | null,
) {
  const cx = W / 2
  const g = ctx.createLinearGradient(0, 0, W * 0.3, H)
  g.addColorStop(0, p.top)
  g.addColorStop(1, p.bottom)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // The number, and what it counts.
  const days = f.streakDays ?? 0
  text(ctx, 'DAILY PRACTICE', cx, 150, 34, '800', p.soft, 'center', 7)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,.14)'
  ctx.shadowBlur = 24
  ctx.shadowOffsetY = 8
  text(ctx, `Day ${days}`, cx, 380, fit(ctx, `Day ${days}`, W - 160, 230, '900'), '900', p.ink, 'center')
  ctx.restore()
  const what = r?.instrument ? `of practising ${r.instrument} every day` : 'of practising every day'
  text(ctx, what, cx, 460, Math.min(48, fit(ctx, what, W - 160, 48, '700')), '700', p.soft, 'center')

  // Five weeks, today last.
  const cal = (r?.calendar ?? []).slice(-35)
  while (cal.length < 35) cal.unshift(0)
  const px = 90, py = 530, pw = W - 180
  const cell = (pw - 80) / 7
  const sq = cell - 20
  const sh = Math.round(sq * 0.8)
  const step = sh + 16
  const ph = 104 + 5 * step + 66
  ctx.fillStyle = p.chip
  round(ctx, px, py, pw, ph, 44)
  ctx.fill()
  const today = new Date()
  for (let c = 0; c < 7; c++) {
    const d = new Date(today)
    d.setDate(d.getDate() - 34 + c)
    const letter = 'SMTWTFS'[d.getDay()]
    text(ctx, letter, px + 40 + c * cell + cell / 2, py + 72, 30, '800', p.soft, 'center')
  }
  cal.forEach((v, i) => {
    const x = px + 40 + (i % 7) * cell + 10
    const y = py + 100 + Math.floor(i / 7) * step
    ctx.fillStyle = v === 1 ? p.bar : p.barOff
    round(ctx, x, y, sq, sh, 20)
    ctx.fill()
    if (v === 1) {
      ctx.font = `${Math.round(sh * 0.58)}px ${SANS}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🔥', x + sq / 2, y + sh / 2 + 2)
      ctx.textBaseline = 'alphabetic'
    } else if (v === 2) {
      disc(ctx, x + sq / 2, y + sh / 2, 9, p.bar)
    }
    if (i === 34) {
      ctx.strokeStyle = p.ink
      ctx.lineWidth = 5
      round(ctx, x - 5, y - 5, sq + 10, sh + 10, 24)
      ctx.stroke()
    }
  })
  const done = cal.filter((v) => v === 1).length
  text(ctx, `${done} of the last 35 days`, cx, py + ph - 30, 32, '700', p.soft, 'center')

  // Femata, small, and the name only: no address anywhere.
  if (art) ctx.drawImage(art, W - 220, H - 176, 150, 150)
  if (logo) {
    ctx.save()
    round(ctx, 70, H - 128, 64, 64, 16)
    ctx.clip()
    ctx.drawImage(logo, 70, H - 128, 64, 64)
    ctx.restore()
  }
  text(ctx, 'Femata', 152, H - 84, 34, '800', p.ink)
}

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

