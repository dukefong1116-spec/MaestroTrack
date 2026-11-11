import { useId, type CSSProperties } from 'react'
import { themeFor } from '@/lib/league/themes'

/**
 * The look of each league tier: its trophy, its colours, and the drawing
 * behind it. All drawn here as SVG — no image files, crisp at any size,
 * and loaded only with the League page.
 *
 * Tier colours are the tier's own, in light and dark mode alike: a ruby
 * metronome is ruby either way.
 */

const GOLD = '#FFD66B'

export function TierTrophy({ tier, size, animated = true, style }: {
  tier: number
  size: number
  animated?: boolean
  style?: CSSProperties
}) {
  const t = themeFor(tier)
  const [L, M, D] = t.metal
  const gid = `trophy-${useId().replace(/:/g, '')}`
  const G = `url(#${gid})`
  const a = animated

  let body: React.ReactNode = null
  if (t.id === 'pp') {
    body = <>
      <ellipse cx="42" cy="70" rx="12" ry="8.5" transform="rotate(-22 42 70)" fill={G} />
      <rect x="50" y="20" width="5.5" height="50" rx="2" fill={G} />
      <path d="M55.5 20C70 27 77 40 69 55C70 44 65 36 55.5 33Z" fill={G} />
      <rect x="45" y="77" width="7" height="10" fill={D} />
    </>
  } else if (t.id === 'p') {
    body = <>
      <path d="M37 16h7v38a6 6 0 0 0 12 0V16h7v38a13 13 0 0 1-9.5 12.5V87h-7V66.5A13 13 0 0 1 37 54Z" fill={G} />
      <g className={a ? 'league-wave' : undefined} stroke={M} strokeWidth="2.2" fill="none" strokeLinecap="round"><path d="M28 30q-5 8 0 16M72 30q5 8 0 16" /></g>
      <g className={a ? 'league-wave' : undefined} style={{ animationDelay: '.5s' }} stroke={M} strokeWidth="2" fill="none" strokeLinecap="round"><path d="M21 25q-9 13 0 26M79 25q9 13 0 26" /></g>
    </>
  } else if (t.id === 'mp') {
    body = <>
      <path d="M31 19C21 40 29 62 50 72C71 62 79 40 69 19" fill="none" stroke={G} strokeWidth="7" strokeLinecap="round" />
      <rect x="29" y="23" width="42" height="5" rx="2.5" fill={D} />
      <g stroke={D} strokeWidth="1.6"><line x1="43" y1="28" x2="43" y2="66" /><line x1="50" y1="28" x2="50" y2="70" /><line x1="57" y1="28" x2="57" y2="66" /></g>
      <circle cx="31" cy="16" r="4.5" fill={G} /><circle cx="69" cy="16" r="4.5" fill={G} />
      <rect x="46.5" y="72" width="7" height="15" fill={G} />
    </>
  } else if (t.id === 'f') {
    body = <>
      <path d="M35 84L43 14h14l8 70Z" fill={G} />
      <path d="M42 74l5-50h6l5 50Z" fill={L} opacity=".5" />
      <g className={a ? 'league-swing' : undefined} style={{ transformOrigin: '50px 74px' }}>
        <line x1="50" y1="74" x2="50" y2="24" stroke={D} strokeWidth="2.6" strokeLinecap="round" />
        <rect x="45.5" y="36" width="9" height="7" rx="1.5" fill={GOLD} />
      </g>
      <rect x="34" y="78" width="32" height="8" rx="2" fill={D} />
    </>
  } else {
    const leaves = [0, 1, 2, 3, 4].map((i) => {
      const y = 74 - i * 11
      const x = 21 + Math.abs(2 - i) * 1.6
      return <g key={i}>
        <ellipse cx={x} cy={y} rx="3.2" ry="6" transform={`rotate(${-25 + i * 8} ${x} ${y})`} />
        <ellipse cx={100 - x} cy={y} rx="3.2" ry="6" transform={`rotate(${25 - i * 8} ${100 - x} ${y})`} />
      </g>
    })
    body = <>
      <g fill="#E9B949">{leaves}</g>
      <path d="M28 18h44v6c0 24-9 36-22 38c-13-2-22-14-22-38Z" fill={G} />
      <path d="M28 26c-11 0-12 17 2 21M72 26c11 0 12 17-2 21" fill="none" stroke={G} strokeWidth="4" strokeLinecap="round" />
      <rect x="46" y="62" width="8" height="15" fill={G} />
      <rect x="38" y="76" width="24" height="7" rx="2" fill={D} />
      <g fill={GOLD}>
        <ellipse cx="43" cy="45" rx="4" ry="3" transform="rotate(-20 43 45)" />
        <ellipse cx="56" cy="42" rx="4" ry="3" transform="rotate(-20 56 42)" />
        <rect x="46" y="28" width="1.8" height="17" /><rect x="59" y="25" width="1.8" height="17" />
        <path d="M46 28L60.8 25v3L46 31Z" /><path d="M46 33L60.8 30v2.6L46 35.6Z" />
      </g>
      <path d="M50 2l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.9 2.7 1.1-5.3-4-3.7 5.4-.6z" fill={GOLD} />
    </>
  }

  return (
    <svg viewBox="0 0 100 106" width={size} height={size * 1.06} aria-hidden="true" style={style}>
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2=".4">
          <stop offset="0" stopColor={L} /><stop offset=".5" stopColor={M} /><stop offset="1" stopColor={D} />
        </linearGradient>
      </defs>
      {body}
      <rect x="36" y="86" width="28" height="9" rx="2" fill={G} />
      <rect x="30" y="94" width="40" height="9" rx="2.5" fill={D} />
      {a && <path className="league-twinkle" style={{ transformOrigin: '78px 14px' }} d="M78 6l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#fff" />}
    </svg>
  )
}

/** The drawing behind a tier: notes, keys, staves, a sunburst, stage lights. */
export function TierBackdrop({ tier }: { tier: number }) {
  const t = themeFor(tier)
  const c = t.ink
  let art: React.ReactNode = null
  if (t.id === 'pp') {
    const spots: [number, number][] = [[18, 28], [66, 62], [124, 22], [186, 54], [248, 26], [284, 84], [36, 112], [104, 146], [166, 104], [226, 152], [58, 184], [198, 186], [140, 70], [270, 140]]
    art = spots.map(([x, y], i) => i % 2
      ? <text key={i} x={x} y={y} fontSize={13 + (i % 3) * 4} fill={c} opacity=".24" transform={`rotate(${i * 9 - 20} ${x} ${y})`}>♪</text>
      : <circle key={i} cx={x} cy={y} r={1.6 + (i % 3)} fill={c} opacity=".18" />)
  } else if (t.id === 'p') {
    art = <>
      {Array.from({ length: 16 }, (_, i) => <g key={i}>
        <rect x={i * 20} y="150" width="20" height="56" rx="2" fill="#fff" fillOpacity=".35" stroke={c} strokeOpacity=".22" />
        {[0, 1, 3, 4, 5].includes(i % 7) && <rect x={i * 20 + 13} y="150" width="13" height="32" rx="2" fill={c} opacity=".24" />}
      </g>)}
      <text x="40" y="60" fontSize="18" fill={c} opacity=".18">♩</text>
      <text x="240" y="44" fontSize="22" fill={c} opacity=".18">♫</text>
    </>
  } else if (t.id === 'mp') {
    art = <>
      {[34, 128].flatMap((b) => [0, 1, 2, 3, 4].map((i) => {
        const y = b + i * 7
        return <path key={`${b}-${i}`} d={`M-10 ${y}C80 ${y - 28} 190 ${y + 28} 310 ${y - 8}`} fill="none" stroke={c} strokeWidth="1.1" opacity=".2" />
      }))}
      <text x="232" y="66" fontSize="22" fill={c} opacity=".22">♫</text>
      <text x="60" y="160" fontSize="20" fill={c} opacity=".22">♪</text>
    </>
  } else if (t.id === 'f') {
    const rays = []
    for (let i = 0; i < 18; i += 2) {
      const a1 = (Math.PI * i) / 18
      const a2 = (Math.PI * (i + 1)) / 18
      rays.push(<polygon key={i} points={`150,-30 ${150 + 420 * Math.cos(a1)},${-30 + 420 * Math.sin(a1)} ${150 + 420 * Math.cos(a2)},${-30 + 420 * Math.sin(a2)}`} fill={c} opacity=".07" />)
    }
    const accents: [number, number][] = [[30, 40], [262, 70], [52, 150], [240, 170], [150, 186]]
    art = <>
      {rays}
      {accents.map(([x, y]) => <path key={`${x}`} d={`M${x} ${y}l12 5-12 5`} fill="none" stroke={c} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" opacity=".22" />)}
    </>
  } else {
    const sparkles: [number, number][] = [[48, 38], [256, 30], [270, 128]]
    art = <>
      <polygon points="40,-10 70,210 150,210" fill="#fff" opacity=".07" />
      <polygon points="260,-10 230,210 150,210" fill="#fff" opacity=".07" />
      {Array.from({ length: 26 }, (_, i) => <circle key={i} cx={(i * 73) % 300} cy={(i * 47) % 200} r={0.7 + (i % 3) * 0.5} fill="#fff" opacity={0.3 + (i % 4) * 0.15} />)}
      {sparkles.map(([x, y]) => <path key={`${x}`} d={`M${x} ${y - 6}l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z`} fill={GOLD} opacity=".8" />)}
      <text x="26" y="170" fontSize="18" fill={GOLD} opacity=".35">♫</text>
    </>
  }
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {art}
    </svg>
  )
}

/** A tier's ground: its colours with its drawing, for any block of content. */
export function TierGround({ tier, className, style, children }: {
  tier: number
  className?: string
  style?: CSSProperties
  children?: React.ReactNode
}) {
  const t = themeFor(tier)
  return (
    <div className={`relative overflow-hidden ${className ?? ''}`} style={{ background: t.background, color: t.ink, ...style }}>
      <TierBackdrop tier={tier} />
      <div className="relative">{children}</div>
    </div>
  )
}
