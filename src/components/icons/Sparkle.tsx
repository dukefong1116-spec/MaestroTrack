import type { SVGProps } from 'react'

/**
 * Four-point sparkle burst — one large star with two satellites.
 * Filled rather than stroked so it reads at small sizes.
 */
export default function Sparkle({ size = 24, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11 2.6c.15 0 .28.1.32.25l1.06 3.98a.33.33 0 0 0 .23.24l3.98 1.06a.33.33 0 0 1 0 .64l-3.98 1.06a.33.33 0 0 0-.23.23l-1.06 3.98a.33.33 0 0 1-.64 0L9.62 10.06a.33.33 0 0 0-.23-.23L5.41 8.77a.33.33 0 0 1 0-.64l3.98-1.06a.33.33 0 0 0 .23-.24l1.06-3.98a.33.33 0 0 1 .32-.25Z" />
      <path d="M18.6 12.4c.13 0 .24.09.28.21l.53 1.98c.02.09.09.16.18.18l1.98.53a.29.29 0 0 1 0 .56l-1.98.53a.29.29 0 0 0-.18.18l-.53 1.98a.29.29 0 0 1-.56 0l-.53-1.98a.29.29 0 0 0-.18-.18l-1.98-.53a.29.29 0 0 1 0-.56l1.98-.53a.29.29 0 0 0 .18-.18l.53-1.98a.29.29 0 0 1 .28-.21Z" />
      <path d="M6.2 15.5c.12 0 .22.08.25.19l.38 1.44c.02.08.08.14.16.16l1.44.38a.26.26 0 0 1 0 .5l-1.44.38a.26.26 0 0 0-.16.16l-.38 1.44a.26.26 0 0 1-.5 0l-.38-1.44a.26.26 0 0 0-.16-.16l-1.44-.38a.26.26 0 0 1 0-.5l1.44-.38a.26.26 0 0 0 .16-.16l.38-1.44c.03-.11.13-.19.25-.19Z" />
    </svg>
  )
}
