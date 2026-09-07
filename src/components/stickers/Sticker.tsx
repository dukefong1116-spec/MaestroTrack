/**
 * Soft Clay sticker set.
 *
 * Hand-authored for this app — never system emoji, which render
 * differently on every platform and read as generic.
 *
 * Each sticker is one geometry drawn with a soft tinted fill and a
 * rounded outline, so it sits correctly against Clay's puffy surfaces.
 * `tone` flips the treatment for placement on a coloured button.
 */

export type StickerName =
  | 'metro'
  | 'pencil'
  | 'note'
  | 'mic'
  | 'tuner'
  | 'flame'
  | 'clock'
  | 'check'

interface StickerProps {
  name: StickerName
  size?: number
  /** 'ink' on light surfaces, 'onAccent' on top of a coloured button. */
  tone?: 'ink' | 'onAccent' | 'accent'
  className?: string
}

const TONES = {
  ink: { stroke: 'var(--clay-ink)', fill: '#E9E3F5' },
  accent: { stroke: 'var(--clay-accent)', fill: '#FFE0D6' },
  onAccent: { stroke: '#FFFFFF', fill: 'rgba(255,255,255,.38)' },
} as const

function paths(name: StickerName, c: string, f: string) {
  switch (name) {
    case 'metro':
      return (
        <>
          <path d="M12 2.6 19.4 21H4.6Z" fill={f} stroke={c} strokeWidth="1.9" />
          <path d="M12 6.2V16" stroke={c} strokeWidth="1.9" />
          <rect x="9.4" y="10" width="5.2" height="2.4" rx=".7" fill={c} />
          <path d="M7.2 21h9.6" stroke={c} strokeWidth="1.9" />
        </>
      )
    case 'pencil':
      return (
        <>
          <path
            d="M4 20.2 5.2 16 16.4 4.8a1.9 1.9 0 0 1 2.7 0l1.1 1.1a1.9 1.9 0 0 1 0 2.7L9 19.8Z"
            fill={f}
            stroke={c}
            strokeWidth="1.9"
          />
          <path d="M15.2 6 18 8.8M5.2 16 9 19.8" stroke={c} strokeWidth="1.9" />
        </>
      )
    case 'note':
      return (
        <>
          <circle cx="7.4" cy="17.6" r="3.5" fill={f} stroke={c} strokeWidth="1.9" />
          <path d="M10.9 17.6V4.2l8.6-1.6v12" stroke={c} strokeWidth="1.9" fill="none" />
          <circle cx="16" cy="14.6" r="3.5" fill={f} stroke={c} strokeWidth="1.9" />
        </>
      )
    case 'mic':
      return (
        <>
          <rect x="8.8" y="2.6" width="6.4" height="11.2" rx="3.2" fill={f} stroke={c} strokeWidth="1.9" />
          <path d="M5.4 11.4a6.6 6.6 0 0 0 13.2 0" stroke={c} strokeWidth="1.9" fill="none" />
          <path d="M12 18v3.2M8.6 21.4h6.8" stroke={c} strokeWidth="1.9" />
        </>
      )
    case 'tuner':
      return (
        <>
          <path d="M3.4 16.4a9.6 9.6 0 0 1 17.2 0" fill={f} stroke={c} strokeWidth="1.9" />
          <path d="M12 16.4 15.6 9" stroke={c} strokeWidth="1.9" />
          <circle cx="12" cy="16.4" r="1.9" fill={c} />
          <path d="M3.4 16.4h17.2" stroke={c} strokeWidth="1.9" />
        </>
      )
    case 'flame':
      return (
        <path
          d="M12.6 2.2c.3 2.4 1.3 3.8 2.8 5.5 1.9 2.2 3.4 4 3.4 6.9A6.8 6.8 0 0 1 5 14.6c0-2.1.9-3.5 2.2-5 .5.6.7 1.3.7 2.2 1.6-1.1 2.9-3.1 2.9-5.3 0-1.5-.3-2.9-.9-4.3 1 .1 2.1.4 2.7 0Z"
          fill={f}
          stroke={c}
          strokeWidth="1.9"
        />
      )
    case 'clock':
      return (
        <>
          <circle cx="12" cy="13" r="8.6" fill={f} stroke={c} strokeWidth="1.9" />
          <path d="M12 8.2V13l3.2 2.2" stroke={c} strokeWidth="1.9" />
          <path d="M9 2.4h6" stroke={c} strokeWidth="1.9" />
        </>
      )
    case 'check':
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={f} stroke={c} strokeWidth="1.9" />
          <path d="m7.8 12.2 2.9 2.9 5.5-6" stroke={c} strokeWidth="2.2" />
        </>
      )
  }
}

export default function Sticker({ name, size = 24, tone = 'ink', className }: StickerProps) {
  const { stroke, fill } = TONES[tone]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths(name, stroke, fill)}
    </svg>
  )
}
