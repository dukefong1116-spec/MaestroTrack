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
  | 'trophy'
  | 'star'
  | 'bolt'
  | 'target'
  | 'brain'
  | 'book'
  | 'calendar'
  | 'users'
  | 'gradcap'
  | 'sword'
  | 'footprints'
  | 'trend'
  | 'chart'
  | 'message'
  | 'clipboard'
  | 'bell'
  | 'archive'
  | 'key'
  | 'mail'

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
    case 'trophy':
      return (
        <>
          <path d="M8 3.4h8v6.2a4 4 0 0 1-8 0Z" fill={f} stroke={c} strokeWidth="1.9" />
          <path d="M8 4.8H5.4a2 2 0 0 0-2 2.2c.2 2 1.7 3.4 3.6 3.6M16 4.8h2.6a2 2 0 0 1 2 2.2c-.2 2-1.7 3.4-3.6 3.6" stroke={c} strokeWidth="1.9" fill="none" />
          <path d="M12 13.6v3.2M8.6 20.6h6.8" stroke={c} strokeWidth="1.9" />
          <path d="M9.4 20.6c0-1.8 1.2-2.8 2.6-2.8s2.6 1 2.6 2.8" fill={f} stroke={c} strokeWidth="1.9" />
        </>
      )
    case 'star':
      return (
        <path
          d="M12 2.6 14.7 8.7 21.3 9.5 16.5 13.9 17.8 20.4 12 17.2 6.2 20.4 7.5 13.9 2.7 9.5 9.3 8.7Z"
          fill={f} stroke={c} strokeWidth="1.9"
        />
      )
    case 'bolt':
      return (
        <path
          d="M13.2 2.4 5.6 13.6h5l-1.8 8 8.6-11.6h-5.2Z"
          fill={f} stroke={c} strokeWidth="1.9"
        />
      )
    case 'target':
      return (
        <>
          <circle cx="12" cy="12" r="9" fill={f} stroke={c} strokeWidth="1.9" />
          <circle cx="12" cy="12" r="5" fill="none" stroke={c} strokeWidth="1.9" />
          <circle cx="12" cy="12" r="1.3" fill={c} />
        </>
      )
    case 'brain':
      return (
        <>
          <path
            d="M9.4 3.6a2.8 2.8 0 0 0-2.8 2.7A2.6 2.6 0 0 0 5 8.8a2.7 2.7 0 0 0 .3 5.2 2.9 2.9 0 0 0 2.8 3.4c.4 1.7 1.9 2.8 3.5 2.6V6.3c0-1.5-1-2.7-2.2-2.7Z"
            fill={f} stroke={c} strokeWidth="1.7"
          />
          <path
            d="M14.6 3.6a2.8 2.8 0 0 1 2.8 2.7A2.6 2.6 0 0 1 19 8.8a2.7 2.7 0 0 1-.3 5.2 2.9 2.9 0 0 1-2.8 3.4c-.4 1.7-1.9 2.8-3.5 2.6V6.3c0-1.5 1-2.7 2.2-2.7Z"
            fill={f} stroke={c} strokeWidth="1.7"
          />
        </>
      )
    case 'book':
      return (
        <>
          <path d="M4 4.8c2.4-1.2 5.2-1 8 .8v13.6c-2.8-1.8-5.6-2-8-.8Z" fill={f} stroke={c} strokeWidth="1.8" />
          <path d="M20 4.8c-2.4-1.2-5.2-1-8 .8v13.6c2.8-1.8 5.6-2 8-.8Z" fill={f} stroke={c} strokeWidth="1.8" />
        </>
      )
    case 'calendar':
      return (
        <>
          <rect x="3.4" y="5" width="17.2" height="15" rx="2.6" fill={f} stroke={c} strokeWidth="1.9" />
          <path d="M3.4 9.6h17.2M7.4 3v3.6M16.6 3v3.6" stroke={c} strokeWidth="1.9" />
          <circle cx="8.2" cy="14" r="1.15" fill={c} />
          <circle cx="12" cy="14" r="1.15" fill={c} />
          <circle cx="15.8" cy="14" r="1.15" fill={c} />
        </>
      )
    case 'users':
      return (
        <>
          <circle cx="8.6" cy="8.2" r="3.4" fill={f} stroke={c} strokeWidth="1.8" />
          <path d="M2.8 20c0-3.3 2.6-5.6 5.8-5.6s5.8 2.3 5.8 5.6" fill={f} stroke={c} strokeWidth="1.8" />
          <path d="M15.6 5.4a3.2 3.2 0 0 1 0 6.2M18 20c0-2.7-1.8-4.8-4.2-5.4" stroke={c} strokeWidth="1.8" fill="none" />
        </>
      )
    case 'gradcap':
      return (
        <>
          <path d="M12 3.4 21.4 8 12 12.6 2.6 8Z" fill={f} stroke={c} strokeWidth="1.8" />
          <path d="M6.6 10.2v4.4c0 1.7 2.4 3 5.4 3s5.4-1.3 5.4-3v-4.4" stroke={c} strokeWidth="1.8" fill="none" />
          <path d="M21.4 8v6" stroke={c} strokeWidth="1.8" />
        </>
      )
    case 'sword':
      return (
        <>
          <path d="M6.4 17.6 16.8 7.2l2 2-10.4 10.4Z" fill={f} stroke={c} strokeWidth="1.8" />
          <path d="M14.6 4.8 19.2 4l-.8 4.6M4.4 19.6l2.4-2.4M3 21l3.4-1" stroke={c} strokeWidth="1.8" />
        </>
      )
    case 'footprints':
      return (
        <>
          <ellipse cx="8.4" cy="7.6" rx="2.6" ry="3.4" fill={f} stroke={c} strokeWidth="1.7" />
          <ellipse cx="15.6" cy="15.4" rx="2.6" ry="3.4" fill={f} stroke={c} strokeWidth="1.7" />
          <circle cx="5.6" cy="12.6" r="1" fill={c} />
          <circle cx="18.4" cy="20.4" r="1" fill={c} />
        </>
      )
    case 'trend':
      return (
        <>
          <path d="M3.4 17.6 9 11l4 3.4 7.6-8.6" stroke={c} strokeWidth="2.1" fill="none" />
          <path d="M15.6 5.8h5v5" stroke={c} strokeWidth="2.1" fill="none" />
        </>
      )
    case 'chart':
      return (
        <>
          <rect x="4" y="12.6" width="4" height="7.4" rx="1.2" fill={f} stroke={c} strokeWidth="1.7" />
          <rect x="10" y="7.6" width="4" height="12.4" rx="1.2" fill={f} stroke={c} strokeWidth="1.7" />
          <rect x="16" y="3.8" width="4" height="16.2" rx="1.2" fill={f} stroke={c} strokeWidth="1.7" />
        </>
      )
    case 'message':
      return (
        <path
          d="M4 5.4h16v10.8H10.4L6 20V16.2H4Z"
          fill={f} stroke={c} strokeWidth="1.9"
        />
      )
    case 'clipboard':
      return (
        <>
          <rect x="5" y="4.4" width="14" height="17" rx="2.2" fill={f} stroke={c} strokeWidth="1.8" />
          <rect x="8.6" y="2.6" width="6.8" height="3.4" rx="1.3" fill={f} stroke={c} strokeWidth="1.8" />
          <path d="M8.4 11h7.2M8.4 14.8h7.2M8.4 18.6h4.4" stroke={c} strokeWidth="1.6" />
        </>
      )
    case 'bell':
      return (
        <>
          <path d="M12 3.4c-3 0-5 2.3-5 5.4v3.6l-1.8 3.2h13.6L17 12.4V8.8c0-3.1-2-5.4-5-5.4Z" fill={f} stroke={c} strokeWidth="1.8" />
          <path d="M9.8 18.6a2.3 2.3 0 0 0 4.4 0" stroke={c} strokeWidth="1.8" fill="none" />
        </>
      )
    case 'archive':
      return (
        <>
          <rect x="3.4" y="4" width="17.2" height="4.6" rx="1.4" fill={f} stroke={c} strokeWidth="1.8" />
          <path d="M4.6 8.6v9a2.4 2.4 0 0 0 2.4 2.4h10a2.4 2.4 0 0 0 2.4-2.4v-9" stroke={c} strokeWidth="1.8" fill="none" />
          <path d="M9.8 13h4.4" stroke={c} strokeWidth="1.8" />
        </>
      )
    case 'key':
      return (
        <>
          <circle cx="7.4" cy="15.4" r="4.2" fill={f} stroke={c} strokeWidth="1.8" />
          <path d="M10.6 12.2 19.6 3.2M16.4 6.4l2.4 2.4M13.4 9.4l2 2" stroke={c} strokeWidth="1.8" />
        </>
      )
    case 'mail':
      return (
        <>
          <rect x="3" y="5.4" width="18" height="13.2" rx="2.2" fill={f} stroke={c} strokeWidth="1.8" />
          <path d="m4 6.8 8 6.4 8-6.4" stroke={c} strokeWidth="1.8" fill="none" />
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
