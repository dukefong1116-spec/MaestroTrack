import type { ReactNode } from 'react'

/**
 * The strip across the top of a profile, with the photo sitting on its
 * bottom edge. An uploaded picture if there is one, else the chosen plain
 * colour (darkened after dark by --clay-banner-mix), else the accent tint.
 */
export default function Banner({ image, color, height, children }: {
  image?: string | null
  color?: string | null
  height: number
  children?: ReactNode
}) {
  const background = image
    ? `center / cover no-repeat url("${encodeURI(image)}")`
    : color
      ? `color-mix(in srgb, ${color} var(--clay-banner-mix), #000)`
      : 'var(--clay-accent-soft)'
  return (
    <div className="relative" style={{ height, background, borderBottom: '1px solid var(--clay-line)' }}>
      {children}
    </div>
  )
}
