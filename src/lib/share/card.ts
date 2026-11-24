import type { ShareFields } from './fields'

/**
 * A share link's preview picture (the shareable cards themselves are in
 * story.ts), drawn rather than screenshotted.
 *
 * Takes ShareFields and nothing else — no session, no profile — so the
 * renderer has no way to draw something private even by mistake.
 *
 * Plain canvas rather than an html-to-image pass over a hidden node:
 * DOM-to-image rasterisers are unreliable about fonts. Here the font is
 * the device's own, the same one the app uses.
 *
 * Nothing remote is ever drawn. A single cross-origin image would taint
 * the canvas and make toBlob throw a security error, which would present
 * as "sharing is broken" with nothing to explain it.
 */

const C = {
  bg: '#FFFFFF',
  bgDeep: '#E1E7F4',
  surface: '#E6F4FB',
  ink: '#000000',
  dim: '#787EA1',
  faint: '#B6AFC9',
  line: '#E4DEF0',
  accent: '#4BB6EC',
  accentHover: '#3791BE',
  accentSoft: '#C7E9F0',
  accentInk: '#16658F',
  mint: '#6BCB9B',
  butterSoft: '#FFF6D9',
}

const SANS = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'

/**
 * The same card again, landscape, for a share link's preview.
 *
 * Open Graph previews are 1.91:1 — a platform given the 1080x1350 card
 * above either crops it to a band through the middle or shows it as a
 * thumbnail the size of a stamp. So this is a separate composition at
 * 1200x630 rather than the portrait card scaled.
 *
 * Drawn here, in the browser, from the same ShareFields and the same
 * palette, so the picture a crawler fetches is the picture the person
 * previewed. The alternative — generating it on a server from the stored
 * document — means a second renderer that can disagree with this one
 * about what a share looks like.
 */
export async function renderOgCard(fields: ShareFields): Promise<Blob> {
  try { await document.fonts.ready } catch { /* older browsers: draw anyway */ }

  const w = 1200
  const h = 630
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable in this browser')

  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, w, h)

  // One panel, inset, the way every screen in the app is built.
  ctx.fillStyle = C.surface
  roundRect(ctx, 48, 48, w - 96, h - 96, 28)
  ctx.fill()

  const left = 108
  let y = 150

  if (fields.name) {
    text(ctx, fields.name.toUpperCase(), left, y, 26, '700', C.dim, 'left', 3)
    y += 52
  }

  const lead = fields.badgeLabel ?? fields.headline ?? (fields.minutes ? undefined : fields.pieceTitle)
  if (lead) {
    // A badge, a league result, a month, a piece: leads with what it is,
    // not with a duration.
    ctx.font = `700 86px ${SANS}`
    let size = 86
    while (size > 44 && ctx.measureText(lead).width > w - 520) { size -= 6; ctx.font = `700 ${size}px ${SANS}` }
    text(ctx, lead, left, y + 54, size, '700', C.ink)
    text(ctx, fields.badgeLabel ? 'Badge earned' : fields.subline ?? '', left, y + 108, 30, '500', C.dim)
  } else if (!fields.minutes && fields.streakDays) {
    text(ctx, String(fields.streakDays), left, y + 78, 150, '700', C.accent)
    text(ctx, 'day practice streak', left, y + 132, 42, '600', C.ink)
  } else {
    text(ctx, String(fields.minutes), left, y + 78, 150, '700', C.accent)
    const nw = ctx.measureText(String(fields.minutes)).width
    text(ctx, fields.minutes === 1 ? 'minute' : 'minutes', left + nw + 20, y + 78, 42, '600', C.ink)
    text(ctx, 'of practice', left, y + 132, 42, '600', C.ink)
  }

  const footer = h - 112
  if (fields.pieceTitle) {
    text(ctx, fields.pieceTitle, left, footer - 56, 30, '500', C.dim)
  }
  if (fields.dateLabel) {
    text(ctx, fields.dateLabel, left, footer - 14, 28, '500', C.faint)
  }

  wordmark(ctx, left, footer + 6)

  // The right third carries the streak if there is one, the week if not.
  const rx = w - 300
  if (fields.streakDays) {
    flame(ctx, rx, 176, 150, C.accent)
    text(ctx, String(fields.streakDays), rx, 420, 116, '700', C.ink, 'center')
    text(ctx, fields.streakDays === 1 ? 'day streak' : 'day streak', rx, 466, 30, '600', C.dim, 'center')
  } else if (fields.week?.some((m) => m > 0)) {
    weekStripSmall(ctx, rx, 420, fields.week)
    text(ctx, 'this week', rx, 466, 30, '600', C.dim, 'center')
  }

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not build the image'))),
      'image/png'
    )
  })
}

/** The week strip again, scaled for the landscape card's right third. */
function weekStripSmall(ctx: CanvasRenderingContext2D, cx: number, baseline: number, week?: number[]) {
  const days = week && week.length === 7 ? week : [0, 0, 0, 0, 0, 0, 0]
  const peak = Math.max(...days, 1)
  const barW = 24
  const gap = 14
  const total = days.length * barW + (days.length - 1) * gap
  let x = cx - total / 2
  days.forEach((mins, i) => {
    const bh = Math.max(14, Math.round((mins / peak) * 170))
    ctx.fillStyle = mins === 0 ? C.bgDeep : i === days.length - 1 ? C.mint : C.accent
    roundRect(ctx, x, baseline - bh, barW, bh, 9)
    ctx.fill()
    x += barW + gap
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
  text(ctx, 'Femata', x + 72, y + 36, 30, '600', onDark ? '#FFFFFF' : C.ink)
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
