import { plural, type ShareFields } from './fields'

/**
 * The share card, drawn rather than screenshotted.
 *
 * Takes ShareFields and nothing else — no session, no profile — so the
 * renderer has no way to draw something private even by mistake.
 *
 * Plain canvas rather than an html-to-image pass over a hidden node: the
 * app's type is Fredoka and Caveat, and DOM-to-image rasterisers are
 * unreliable about waiting for web fonts. Here the wait is explicit and
 * one line long.
 *
 * Nothing remote is ever drawn. A single cross-origin image would taint
 * the canvas and make toBlob throw a security error, which would present
 * as "sharing is broken" with nothing to explain it.
 */

export type CardLayout = 'number' | 'streak' | 'ticket'

export const CARD_LAYOUTS: { id: CardLayout; label: string; hint: string }[] = [
  { id: 'number', label: 'The number', hint: 'Minutes front and centre' },
  { id: 'streak', label: 'The streak', hint: 'Bold — best at a milestone' },
  { id: 'ticket', label: 'The ticket', hint: 'Names the piece' },
]

const W = 1080
const H = 1350

const C = {
  bg: '#F1ECF8',
  bgDeep: '#E7E0F3',
  surface: '#FFFFFF',
  ink: '#3A3054',
  dim: '#8B82A3',
  faint: '#B6AFC9',
  line: '#E4DEF0',
  accent: '#FF7A5C',
  accentHover: '#F26243',
  accentSoft: '#FFEDE7',
  accentInk: '#E05539',
  mint: '#6BCB9B',
  butterSoft: '#FFF6D9',
}

const SANS = "'Fredoka', system-ui, sans-serif"

export async function renderShareCard(
  fields: ShareFields,
  layout: CardLayout = 'number'
): Promise<Blob> {
  // Without this the first fillText runs before Fredoka has loaded and
  // the whole card silently falls back to the system font.
  try { await document.fonts.ready } catch { /* older browsers: draw anyway */ }

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable in this browser')

  if (layout === 'streak') drawStreak(ctx, fields)
  else if (layout === 'ticket') drawTicket(ctx, fields)
  else drawNumber(ctx, fields)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not build the image'))),
      'image/png'
    )
  })
}

/* ── shared bits ──────────────────────────────────────────────────── */

function roundRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

function text(
  ctx: CanvasRenderingContext2D, s: string, x: number, y: number,
  size: number, weight: string, colour: string,
  align: CanvasTextAlign = 'left', spacing = 0
) {
  ctx.fillStyle = colour
  ctx.font = `${weight} ${size}px ${SANS}`
  ctx.textAlign = spacing ? 'left' : align
  if (!spacing) { ctx.fillText(s, x, y); return }

  // letterSpacing is not supported everywhere, so it is done by hand and
  // the line is measured first to keep it centred.
  const chars = [...s]
  const width = chars.reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing)
  let cx = align === 'center' ? x - width / 2 : x
  for (const ch of chars) {
    ctx.fillText(ch, cx, y)
    cx += ctx.measureText(ch).width + spacing
  }
}

/** The word mark: a coral tile with three bars, then the name. */
function wordmark(ctx: CanvasRenderingContext2D, x: number, y: number, onDark = false) {
  ctx.fillStyle = onDark ? '#FFFFFF' : C.accent
  roundRect(ctx, x, y, 54, 54, 18)
  ctx.fill()
  ctx.fillStyle = onDark ? C.accent : '#FFFFFF'
  const bars = [[13, 18, 8, 20], [25, 13, 8, 30], [37, 23, 8, 14]]
  for (const [bx, by, bw, bh] of bars) {
    roundRect(ctx, x + bx, y + by, bw, bh, 4)
    ctx.fill()
  }
  text(ctx, 'MaestroTrack', x + 72, y + 36, 30, '600', onDark ? '#FFFFFF' : C.ink)
}

/** Monday-first week strip. Today is the last bar, and mint. */
function weekStrip(ctx: CanvasRenderingContext2D, cx: number, baseline: number, week?: number[]) {
  const days = week && week.length === 7 ? week : [0, 0, 0, 0, 0, 0, 0]
  const peak = Math.max(...days, 1)
  const barW = 42
  const gap = 26
  const total = days.length * barW + (days.length - 1) * gap
  let x = cx - total / 2
  days.forEach((mins, i) => {
    const h = Math.max(22, Math.round((mins / peak) * 150))
    const isToday = i === days.length - 1
    ctx.fillStyle = mins === 0 ? C.bgDeep : isToday ? C.mint : C.accent
    roundRect(ctx, x, baseline - h, barW, h, 16)
    ctx.fill()
    x += barW + gap
  })
}

function flame(ctx: CanvasRenderingContext2D, cx: number, top: number, size: number, fill: string) {
  const s = size / 100
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(cx, top)
  ctx.bezierCurveTo(cx - 46 * s, top + 48 * s, cx - 38 * s, top + 108 * s, cx, top + 108 * s)
  ctx.bezierCurveTo(cx + 38 * s, top + 108 * s, cx + 46 * s, top + 60 * s, cx + 14 * s, top + 30 * s)
  ctx.bezierCurveTo(cx + 10 * s, top + 56 * s, cx - 4 * s, top + 56 * s, cx - 4 * s, top + 40 * s)
  ctx.bezierCurveTo(cx - 4 * s, top + 26 * s, cx - 2 * s, top + 12 * s, cx, top)
  ctx.closePath()
  ctx.fill()
}

/* ── A: the number ───────────────────────────────────────────────── */

function drawNumber(ctx: CanvasRenderingContext2D, f: ShareFields) {
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, W, H)
  circle(ctx, 1010, 120, 300, C.accentSoft)
  circle(ctx, 70, 1260, 240, C.bgDeep)
  circle(ctx, 960, 1200, 120, C.butterSoft)

  wordmark(ctx, 96, 92)
  if (f.name) text(ctx, f.name, 96, 206, 28, '500', C.dim)
  text(ctx, f.dateLabel, 96, f.name ? 248 : 206, 26, '400', C.faint)

  ctx.fillStyle = C.surface
  roundRect(ctx, 96, 320, 888, 440, 56)
  ctx.fill()

  text(ctx, 'TODAY I PRACTISED', 540, 420, 28, '500', C.faint, 'center', 5)
  text(ctx, String(f.minutes), 540, 620, 220, '700', C.ink, 'center')
  text(ctx, f.minutes === 1 ? 'minute' : 'minutes', 540, 694, 40, '400', C.dim, 'center')

  if (f.streakDays) {
    ctx.fillStyle = C.accentSoft
    roundRect(ctx, 330, 812, 420, 96, 48)
    ctx.fill()
    flame(ctx, 408, 832, 62, C.accent)
    text(ctx, `${f.streakDays}-day streak`, 450, 874, 38, '600', C.accentInk)
  }

  weekStrip(ctx, 540, 1130, f.week)
  text(ctx, 'maestro-track.vercel.app', 540, 1248, 26, '400', C.faint, 'center')
}

/* ── B: the streak ───────────────────────────────────────────────── */

function drawStreak(ctx: CanvasRenderingContext2D, f: ShareFields) {
  ctx.fillStyle = C.accent
  ctx.fillRect(0, 0, W, H)
  circle(ctx, 1010, 110, 330, C.accentHover)
  circle(ctx, 60, 1280, 260, C.accentHover)

  wordmark(ctx, 96, 92, true)

  flame(ctx, 540, 300, 300, '#FFFFFF')
  text(ctx, String(f.streakDays ?? 1), 540, 860, 300, '700', '#FFFFFF', 'center')
  text(ctx, f.streakDays === 1 ? 'DAY STREAK' : 'DAYS IN A ROW', 540, 936, 44, '500', C.accentSoft, 'center', 8)

  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, 300, 1020, 480, 110, 55)
  ctx.fill()
  text(ctx, `${f.minutes} min today`, 540, 1092, 40, '600', C.accentInk, 'center')

  if (f.name) text(ctx, f.name, 540, 1208, 30, '400', C.accentSoft, 'center')
  text(ctx, 'maestro-track.vercel.app', 540, 1262, 26, '400', C.accentSoft, 'center')
}

/* ── C: the ticket ───────────────────────────────────────────────── */

function drawTicket(ctx: CanvasRenderingContext2D, f: ShareFields) {
  ctx.fillStyle = C.surface
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#FFC85C'
  ctx.fillRect(0, 0, W, 28)
  circle(ctx, 1040, 1240, 180, C.butterSoft)

  wordmark(ctx, 96, 112)

  text(ctx, (f.category ?? 'PRACTICE').toUpperCase(), 96, 316, 28, '500', C.faint, 'left', 5)
  text(ctx, f.pieceTitle ?? 'Practice session', 96, 390, 56, '600', C.ink)

  // A waveform, not a real one: this is a picture of having played, and
  // drawing a fake spectrum from real audio would be the only part of
  // this card that was not true.
  const bars = 26
  const mid = 560
  let x = 96
  for (let i = 0; i < bars; i++) {
    const t = i / (bars - 1)
    const h = 40 + Math.round(Math.abs(Math.sin(t * 7.5)) * 150 + Math.abs(Math.cos(t * 3.1)) * 40)
    ctx.fillStyle = i % 2 === 0 ? C.accent : '#FFC0AC'
    roundRect(ctx, x, mid - h / 2, 14, h, 7)
    ctx.fill()
    x += 34
  }

  ctx.strokeStyle = C.line
  ctx.lineWidth = 3
  ctx.setLineDash([10, 14])
  ctx.beginPath()
  ctx.moveTo(96, 740)
  ctx.lineTo(984, 740)
  ctx.stroke()
  ctx.setLineDash([])

  text(ctx, `${f.minutes} min`, 96, 880, 120, '700', C.ink)
  const meta = [f.streakDays ? `${plural(f.streakDays, 'day')} in a row` : null, f.dateLabel]
    .filter(Boolean).join('  ·  ')
  text(ctx, meta, 96, 946, 30, '400', C.dim)

  if (f.name) text(ctx, f.name, 96, 1180, 30, '500', C.dim)
  text(ctx, 'maestro-track.vercel.app', 96, 1240, 26, '400', C.faint)
}
