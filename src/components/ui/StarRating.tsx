import { Star } from 'lucide-react'

/**
 * Pick one to five stars.
 *
 * Difficulty was a slider in the form and stars everywhere it was shown,
 * so you chose it in one language and read it back in another. The stars
 * here are the same glyph and colour the piece list draws.
 *
 * Tapping the star that is already the value does nothing rather than
 * clearing it: a piece always has a difficulty, and an accidental second
 * tap should not leave it at zero.
 */
export default function StarRating({
  value,
  onChange,
  label,
  size = 28,
}: {
  value: number
  onChange: (value: number) => void
  label: string
  size?: number
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-semibold" style={{ color: 'var(--clay-ink)' }}>{label}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => {
          const lit = n <= value
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={n === value}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              onClick={() => onChange(n)}
              // Wide hit area: the glyph is small, a thumb is not.
              className="flex h-11 w-11 items-center justify-center transition-transform active:scale-90"
            >
              <Star
                size={size}
                style={{ color: lit ? 'var(--clay-butter)' : 'var(--clay-line)' }}
                fill={lit ? 'var(--clay-butter)' : 'none'}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}
