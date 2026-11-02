/**
 * Badge artwork.
 *
 * Deliberately NOT part of the Sticker set. Stickers are UI furniture —
 * one colour, lucide-weight, drawn to sit beside nav icons. A badge is
 * something you earned, so each gets its own palette and fills its tile.
 *
 * Locked badges render the identical shapes in flat grey, so unlocking
 * reads as colour arriving rather than a filter being removed.
 */

import type { BadgeId } from '@/lib/utils/progression'

/**
 * Ids come from the domain (progression.ts), not from here. If a badge is
 * added there without artwork, PALETTES below stops compiling — which is
 * exactly the failure we want.
 */
export type BadgeArtName = BadgeId

interface Palette {
  bg: string
  a: string
  b: string
  c: string
  d: string
}

const LOCKED: Palette = {
  bg: '#E9E5F2', a: '#C2BAD4', b: '#B2A9C6', c: '#D3CCE1', d: '#A79EBD',
}

const PALETTES: Record<BadgeArtName, Palette> = {
  // gold + coral — the very first note
  first_session: { bg: '#FFEFE3', a: '#FF7A5C', b: '#FF9E7A', c: '#FFD23F', d: '#FFB93F' },
  // crimson + gold — a shield and crossed batons
  week_warrior: { bg: '#FFE6E8', a: '#E8434F', b: '#FF6B76', c: '#FFD23F', d: '#FFF4D6' },
  // gold + laurel — a hundred sessions
  century: { bg: '#FFF3DC', a: '#F0A81F', b: '#FFC85C', c: '#6BBF8A', d: '#4E9E6C' },
  // teal — distance and endurance
  marathon: { bg: '#DFF4F0', a: '#4FA89B', b: '#7CC6BA', c: '#FFFFFF', d: '#2F7A70' },
  // steel — a summit reached
  consistency: { bg: '#E4EBF2', a: '#5A7086', b: '#8CA3B8', c: '#FFFFFF', d: '#FFD23F' },
  // violet — hours accumulating
  ten_hours: { bg: '#EDE6FB', a: '#8B5CF6', b: '#C4B5FD', c: '#FFD23F', d: '#6D3FD4' },
}

function Art({ name, p }: { name: BadgeArtName; p: Palette }) {
  switch (name) {
    case 'first_session':
      return (
        <>
          {/* sparkle */}
          <circle cx="87" cy="35" r="11" fill={p.c} />
          <path
            d="M87 18v-7M87 59v-7M104 35h7M63 35h7M99 23l5-5M70 52l5-5M99 47l5 5M70 18l5 5"
            stroke={p.c} strokeWidth="4" strokeLinecap="round"
          />
          {/* beamed note */}
          <circle cx="44" cy="83" r="15" fill={p.a} />
          <circle cx="73" cy="75" r="15" fill={p.b} />
          <path d="M59 83V37l29-7v46" stroke={p.a} strokeWidth="8" fill="none" strokeLinecap="round" />
        </>
      )

    case 'week_warrior':
      return (
        <>
          <path d="M60 20 94 33v31c0 22-16 33-34 39-18-6-34-17-34-39V33Z" fill={p.a} />
          <path d="M60 20 94 33v14c-11-7-22-11-34-11s-23 4-34 11V33Z" fill={p.b} />
          <path d="M46 50 74 78M74 50 46 78" stroke={p.c} strokeWidth="9" strokeLinecap="round" />
          <circle cx="60" cy="64" r="7" fill={p.d} />
        </>
      )

    case 'century':
      return (
        <>
          {/* Two earlier passes framed the number with laurel; both times the
              leaves crowded it into a blob at tile size. The number IS the
              badge, so it gets the whole tile and the wreath goes away. */}
          <rect x="16" y="42" width="10" height="40" rx="5" fill={p.a} />
          <rect x="10" y="42" width="17" height="10" rx="5" fill={p.a} />
          <circle cx="58" cy="62" r="14" fill="none" stroke={p.a} strokeWidth="9" />
          <circle cx="92" cy="62" r="14" fill="none" stroke={p.b} strokeWidth="9" />
          {/* plinth — carries the palette's green without adding detail */}
          <rect x="30" y="92" width="60" height="7" rx="3.5" fill={p.c} />
          <path d="M96 24l3 6.4 6.4 3-6.4 3-3 6.4-3-6.4-6.4-3 6.4-3Z" fill={p.b} />
        </>
      )

    case 'marathon':
      return (
        <>
          {/* road receding to a finish line */}
          <path d="M34 104 52 48h16l18 56Z" fill={p.a} />
          <rect x="57" y="90" width="6" height="11" rx="3" fill={p.c} />
          <rect x="57" y="74" width="5" height="9" rx="2.5" fill={p.c} />
          <rect x="58" y="61" width="4" height="7" rx="2" fill={p.c} />
          {/* flag */}
          <rect x="57" y="18" width="4.5" height="32" rx="2.2" fill={p.d} />
          <path d="M61.5 20h24v16h-24Z" fill={p.c} />
          <path d="M61.5 20h12v8h-12ZM73.5 28h12v8h-12Z" fill={p.d} />
        </>
      )

    case 'consistency':
      return (
        <>
          {/* a summit */}
          <path d="M14 96 44 44l18 30 10-16 24 38Z" fill={p.b} />
          <path d="M32 96 62 44l34 52Z" fill={p.a} />
          <path d="M62 44 74 62H50Z" fill={p.c} />
          {/* sun */}
          <circle cx="88" cy="32" r="10" fill={p.d} />
        </>
      )

    case 'ten_hours':
      return (
        <>
          <rect x="34" y="24" width="52" height="10" rx="5" fill={p.d} />
          <rect x="34" y="86" width="52" height="10" rx="5" fill={p.d} />
          <path d="M44 34h32L61 60l15 26H44l15-26Z" fill={p.b} />
          <path d="M52 40h16l-8 14Z" fill={p.c} />
          <path d="M49 80h22c0-8-5-13-11-13s-11 5-11 13Z" fill={p.c} />
          <rect x="58.5" y="54" width="3" height="14" rx="1.5" fill={p.c} />
        </>
      )
  }
}

export default function BadgeArt({
  name,
  size = 76,
  locked = false,
  className,
}: {
  name: BadgeArtName
  size?: number
  locked?: boolean
  className?: string
}) {
  const p = locked ? LOCKED : PALETTES[name]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      role="img"
      aria-hidden="true"
    >
      <rect x="6" y="6" width="108" height="108" rx="30" fill={p.bg} />
      <Art name={name} p={p} />
    </svg>
  )
}
