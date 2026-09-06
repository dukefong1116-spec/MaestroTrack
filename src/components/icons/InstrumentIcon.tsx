import type { SVGProps } from 'react'
import type { InstrumentType } from '@/types'

/**
 * Hand-authored instrument glyphs.
 *
 * Drawn to the same contract as lucide-react (24x24 viewBox, currentColor
 * stroke, 1.75 width, round caps/joins, no fill) so they sit beside the
 * app's existing nav icons without looking like a different icon set.
 */

interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  size?: number
}

function Svg({ size = 24, ...props }: GlyphProps & { children: React.ReactNode }) {
  const { children, ...rest } = props
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {children}
    </svg>
  )
}

/* ── Keyboard ─────────────────────────────────────────────── */
export function PianoGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="6.5" width="20" height="11" rx="1.5" />
      <path d="M7.3 6.5v11M12 6.5v11M16.7 6.5v11" />
      <path d="M5.9 6.5h2.6v6.2H5.9zM14.6 6.5h2.6v6.2h-2.6z" fill="currentColor" />
    </Svg>
  )
}

/* ── Bowed strings ────────────────────────────────────────── */
function BowedBody({ endpin }: { endpin?: boolean }) {
  return (
    <>
      {/* body: narrow upper bout, deep waist, wide lower bout */}
      <path d="M12 5.6c-1.9 0-3.3 1.3-3.3 3.1 0 1.6 1.4 2.3 1.4 3.5 0 1.4-2.7 2-2.7 4.8 0 2.6 2.1 4.4 4.6 4.4s4.6-1.8 4.6-4.4c0-2.8-2.7-3.4-2.7-4.8 0-1.2 1.4-1.9 1.4-3.5 0-1.8-1.4-3.1-3.3-3.1Z" />
      {/* neck + pegbox */}
      <path d="M12 5.6V2.2M10.7 2.2h2.6" />
      {/* bridge + f-holes */}
      <path d="M9.7 16.6h4.6M10.1 14.2v1.6M13.9 14.2v1.6" />
      {endpin && <path d="M12 21v1.6" />}
    </>
  )
}

export function ViolinGlyph(props: GlyphProps) {
  return <Svg {...props}><BowedBody /></Svg>
}
export function ViolaGlyph(props: GlyphProps) {
  return <Svg {...props}><BowedBody /></Svg>
}
export function CelloGlyph(props: GlyphProps) {
  return <Svg {...props}><BowedBody endpin /></Svg>
}

/* ── Woodwind ─────────────────────────────────────────────── */
export function FluteGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <rect x="2" y="9.8" width="20" height="4.4" rx="2.2" />
      <path d="M5.2 10.4v3.2" />
      <circle cx="9.5" cy="12" r=".85" fill="currentColor" stroke="none" />
      <circle cx="13" cy="12" r=".85" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="12" r=".85" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function ClarinetGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M10.6 2.2h2.8v12.6l3.2 5.9a.7.7 0 0 1-.6 1.1H8a.7.7 0 0 1-.6-1.1l3.2-5.9Z" />
      <circle cx="12" cy="5.6" r=".8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8.8" r=".8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none" />
    </Svg>
  )
}

export function SaxophoneGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      {/* mouthpiece + body curving down into the bell */}
      <path d="M8.5 2.5v8.5c0 3.8.8 5.8 3.5 7" />
      {/* bell: a closed cone opening up and to the right */}
      <path d="M11.4 17.1 17.3 10.8 20.7 16.2 12.6 18.9Z" />
      {/* key rods */}
      <path d="M6.6 7.4h1.9M6.6 10.4h1.9M7 13.4h1.9" />
    </Svg>
  )
}

/* ── Brass ────────────────────────────────────────────────── */
export function TrumpetGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M3.4 12h11.2" />
      <circle cx="2.8" cy="12" r="1.1" />
      <path d="M14.6 8.4 21 6.2v11.6l-6.4-2.2Z" />
      <path d="M7.2 12V8.6M10 12V8.6M12.8 12V8.6" />
    </Svg>
  )
}

export function TromboneGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M6.2 9.6h9.4M6.2 14.4h9.4" />
      <path d="M6.2 9.6a2.4 2.4 0 0 0 0 4.8" />
      <circle cx="16.2" cy="14.4" r=".9" />
      <path d="M15.6 7.6 21 5.6v12.8l-5.4-2Z" />
    </Svg>
  )
}

/* ── Percussion ───────────────────────────────────────────── */
export function PercussionGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="8.6" rx="8" ry="3.1" />
      <path d="M4 8.6v6.2c0 1.7 3.6 3.1 8 3.1s8-1.4 8-3.1V8.6" />
      <path d="M6.4 10.4 8 14.9M17.6 10.4 16 14.9M12 11.7v6.2" />
    </Svg>
  )
}

/* ── Voice ────────────────────────────────────────────────── */
export function VoiceGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="8.6" cy="7.4" r="3.2" />
      <path d="M2.9 20.2c0-3.1 2.6-5.2 5.7-5.2s5.7 2.1 5.7 5.2" />
      <path d="M17.2 8.4a4.2 4.2 0 0 1 0 7.2M20.1 5.6a8 8 0 0 1 0 12.8" />
    </Svg>
  )
}

/* ── Guitar ───────────────────────────────────────────────── */
export function GuitarGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <path d="M12 7.2c-2 0-3.4 1.2-3.4 2.9 0 1.4 1.2 2 1.2 3.1 0 1.4-2.8 2-2.8 5 0 2.6 2.2 4.4 5 4.4s5-1.8 5-4.4c0-3-2.8-3.6-2.8-5 0-1.1 1.2-1.7 1.2-3.1 0-1.7-1.4-2.9-3.4-2.9Z" />
      <path d="M12 7.2V2.3M10.7 2.3h2.6" />
      <circle cx="12" cy="17.6" r="1.9" />
      <path d="M10.6 4.7h2.8" />
    </Svg>
  )
}

/* ── Generic fallback ─────────────────────────────────────── */
export function NoteGlyph(props: GlyphProps) {
  return (
    <Svg {...props}>
      <circle cx="7" cy="18" r="3" />
      <circle cx="18" cy="15.4" r="3" />
      <path d="M10 18V5.4l11-2.4v12.4" />
      <path d="M10 8.6 21 6.2" />
    </Svg>
  )
}

const GLYPHS: Record<InstrumentType, (p: GlyphProps) => React.ReactElement> = {
  piano: PianoGlyph,
  violin: ViolinGlyph,
  viola: ViolaGlyph,
  cello: CelloGlyph,
  flute: FluteGlyph,
  clarinet: ClarinetGlyph,
  saxophone: SaxophoneGlyph,
  trumpet: TrumpetGlyph,
  trombone: TromboneGlyph,
  percussion: PercussionGlyph,
  voice: VoiceGlyph,
  guitar: GuitarGlyph,
}

interface InstrumentIconProps extends GlyphProps {
  instrument?: InstrumentType
}

export default function InstrumentIcon({ instrument, ...props }: InstrumentIconProps) {
  const Glyph = instrument ? GLYPHS[instrument] : NoteGlyph
  return <Glyph {...props} />
}
