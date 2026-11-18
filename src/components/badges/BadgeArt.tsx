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
  // dawn — a sun on the horizon and a bird
  early_bird: { bg: '#FFF1DE', a: '#FF9F43', b: '#FFC75F', c: '#FFFFFF', d: '#3D7FC4' },
  // midnight — moon, stars and an owl's eyes
  night_owl: { bg: '#E3E6F7', a: '#3B3F8C', b: '#6A70C9', c: '#FFD86B', d: '#FFFFFF' },
  // green — two calendar pages, both ticked
  weekend: { bg: '#E2F5EC', a: '#2E9E6B', b: '#7FD3A8', c: '#FFFFFF', d: '#1F6E4A' },
  // ember — two flames
  fortnight: { bg: '#FFE9E2', a: '#F0552E', b: '#FF8A4C', c: '#FFD27A', d: '#FFF4DA' },
  // ice blue — a diamond
  unbreakable: { bg: '#E2F1FB', a: '#2F86D6', b: '#7CC2F2', c: '#D6EEFF', d: '#FFFFFF' },
  // pink — a metronome
  half_century: { bg: '#FDEBF2', a: '#D9467A', b: '#F58BB0', c: '#FFFFFF', d: '#8E2A50' },
  // amber — a stopwatch
  fifty_hours: { bg: '#FFF6D9', a: '#E0A100', b: '#FFD23F', c: '#FFFFFF', d: '#7A5600' },
  // teal — headphones
  deep_focus: { bg: '#E6F4F1', a: '#1F8A7A', b: '#5FC2B2', c: '#FFFFFF', d: '#145C52' },
  // red — a microphone
  encore: { bg: '#FFE8E6', a: '#E24B4A', b: '#FF8C7A', c: '#FFFFFF', d: '#5F5E5A' },
  // violet and gold — a crown
  mastered: { bg: '#EEE8FC', a: '#7A5AC4', b: '#B39DF0', c: '#FFD23F', d: '#FFFFFF' },
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

    case 'early_bird':
      return (
        <>
          <path d="M14 82h92" stroke={p.a} strokeWidth="6" strokeLinecap="round" />
          <path d="M30 82a30 30 0 0 1 60 0Z" fill={p.b} />
          <path d="M60 40v-12M33 50l-8-8M87 50l8-8M22 70H12M98 70h10" stroke={p.a} strokeWidth="5" strokeLinecap="round" />
          <path d="M42 98h36M50 106h20" stroke={p.b} strokeWidth="5" strokeLinecap="round" />
          <path d="M76 30c4-5 9-5 12 0 3-5 8-5 12 0" stroke={p.d} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        </>
      )

    case 'night_owl':
      return (
        <>
          <path d="M74 22a34 34 0 1 0 26 52A28 28 0 0 1 74 22Z" fill={p.a} />
          <circle cx="32" cy="30" r="3.5" fill={p.c} />
          <circle cx="96" cy="26" r="2.5" fill={p.c} />
          <path d="M88 46l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5Z" fill={p.c} />
          <circle cx="52" cy="62" r="7" fill={p.d} />
          <circle cx="52" cy="62" r="3" fill={p.a} />
          <circle cx="70" cy="62" r="7" fill={p.d} />
          <circle cx="70" cy="62" r="3" fill={p.a} />
          <path d="M58 72l3 5 3-5Z" fill={p.c} />
        </>
      )

    case 'weekend':
      return (
        <>
          <rect x="18" y="30" width="40" height="52" rx="8" fill={p.b} />
          <rect x="18" y="30" width="40" height="13" rx="6" fill={p.d} />
          <rect x="62" y="38" width="40" height="52" rx="8" fill={p.a} />
          <rect x="62" y="38" width="40" height="13" rx="6" fill={p.d} />
          <path d="M28 62l7 7 13-14" stroke={p.c} strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M72 70l7 7 13-14" stroke={p.c} strokeWidth="5.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )

    case 'fortnight':
      return (
        <>
          <path d="M48 100c-16 0-26-11-26-26 0-14 10-22 14-34 6 8 6 15 4 20 6-6 10-15 8-28 14 9 26 24 26 42 0 15-11 26-26 26Z" fill={p.b} />
          <path d="M72 100c-15 0-24-10-24-24 0-13 9-21 13-32 5 7 6 14 4 19 6-5 9-14 7-26 13 8 24 23 24 39 0 14-10 24-24 24Z" fill={p.a} />
          <path d="M72 100c-8 0-13-6-13-13 0-8 6-12 9-18 2 6 2 9 1 12 4-2 7-7 6-13 7 5 10 12 10 19 0 8-6 13-13 13Z" fill={p.c} />
        </>
      )

    case 'unbreakable':
      return (
        <>
          <path d="M36 34h48l18 22-42 46-42-46Z" fill={p.a} />
          <path d="M36 34h48l-12 22H48Z" fill={p.b} />
          <path d="M18 56h84L60 102Z" fill={p.a} />
          <path d="M48 56h24L60 102Z" fill={p.b} />
          <path d="M48 56l-12-22M72 56l12-22" stroke={p.c} strokeWidth="2.5" />
          <path d="M92 18l2.5 5.5 5.5 2.5-5.5 2.5-2.5 5.5-2.5-5.5-5.5-2.5 5.5-2.5Z" fill={p.d} />
        </>
      )

    case 'half_century':
      return (
        <>
          <path d="M44 102h32l-6-74H50Z" fill={p.b} />
          <path d="M38 102h44l-4-10H42Z" fill={p.a} />
          <path d="M52 28h16" stroke={p.a} strokeWidth="6" strokeLinecap="round" />
          <path d="M60 86 80 34" stroke={p.d} strokeWidth="5" strokeLinecap="round" />
          <circle cx="74" cy="50" r="6" fill={p.d} />
          <path d="M52 70h16M54 58h12M55 46h10" stroke={p.c} strokeWidth="3" strokeLinecap="round" />
        </>
      )

    case 'fifty_hours':
      return (
        <>
          <circle cx="60" cy="62" r="36" fill={p.a} />
          <circle cx="60" cy="62" r="28" fill={p.c} />
          <path d="M60 62V44M60 62l13 8" stroke={p.d} strokeWidth="5.5" strokeLinecap="round" />
          <circle cx="60" cy="62" r="4" fill={p.d} />
          <path d="M60 37v4M85 62h-4M60 87v-4M35 62h4" stroke={p.b} strokeWidth="4" strokeLinecap="round" />
          <path d="M48 22h24" stroke={p.a} strokeWidth="7" strokeLinecap="round" />
        </>
      )

    case 'deep_focus':
      return (
        <>
          <path d="M26 72v-8a34 34 0 0 1 68 0v8" stroke={p.a} strokeWidth="8" fill="none" strokeLinecap="round" />
          <rect x="18" y="66" width="22" height="34" rx="9" fill={p.b} />
          <rect x="80" y="66" width="22" height="34" rx="9" fill={p.b} />
          <rect x="24" y="72" width="10" height="22" rx="5" fill={p.d} />
          <rect x="86" y="72" width="10" height="22" rx="5" fill={p.d} />
          <path d="M50 76c3-6 7-6 10 0s7 6 10 0" stroke={p.a} strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      )

    case 'encore':
      return (
        <>
          <rect x="44" y="18" width="32" height="54" rx="16" fill={p.a} />
          <path d="M52 34h16M52 44h16M52 54h16" stroke={p.b} strokeWidth="3.5" strokeLinecap="round" />
          <path d="M34 58a26 26 0 0 0 52 0" stroke={p.d} strokeWidth="6" fill="none" strokeLinecap="round" />
          <path d="M60 84v14M46 100h28" stroke={p.d} strokeWidth="6" strokeLinecap="round" />
          <circle cx="92" cy="28" r="6" fill={p.a} />
        </>
      )

    case 'mastered':
      return (
        <>
          <path d="M24 84 18 38l24 18 18-28 18 28 24-18-6 46Z" fill={p.c} />
          <rect x="24" y="84" width="72" height="14" rx="5" fill={p.a} />
          <circle cx="60" cy="68" r="7" fill={p.a} />
          <circle cx="38" cy="72" r="4.5" fill={p.b} />
          <circle cx="82" cy="72" r="4.5" fill={p.b} />
          <circle cx="18" cy="38" r="5" fill={p.c} />
          <circle cx="60" cy="28" r="5" fill={p.c} />
          <circle cx="102" cy="38" r="5" fill={p.c} />
        </>
      )
  }
}

/** A badge's own colours, for whatever surrounds it — the unlock's glow and sparks. */
// oxlint-disable-next-line react/only-export-components -- a lookup beside the art it colours
export function badgePalette(name: BadgeArtName): Palette {
  return PALETTES[name]
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
