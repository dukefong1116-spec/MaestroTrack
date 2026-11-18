import type { ReactNode } from 'react'

/**
 * The strip across the top of a profile, with the photo sitting on its
 * bottom edge. An uploaded picture if there is one, else the chosen plain
 * colour (darkened after dark by --clay-banner-mix), else the accent tint.
 *
 * The picture is an <img>, not a CSS url(): a Firebase download URL
 * carries its path percent-encoded (avatars%2F…), and any re-encoding on
 * the way into CSS turns that into %252F — a file that does not exist, so
 * the banner silently stayed blank. An <img> takes the URL exactly as
 * given.
 */
export default function Banner({ image, color, height, children }: {
  image?: string | null
  color?: string | null
  height: number
  children?: ReactNode
}) {
  const fill = color ? `color-mix(in srgb, ${color} var(--clay-banner-mix), #000)` : 'var(--clay-accent-soft)'
  return (
    <div className="relative overflow-hidden" style={{ height, background: fill, borderBottom: '1px solid var(--clay-line)' }}>
      {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {children}
    </div>
  )
}
