import { useEffect, useState } from 'react'
import { animate } from 'framer-motion'

interface CountUpProps {
  to: number
  from?: number
  /** Seconds. */
  duration?: number
  /** Seconds to wait before starting. */
  delay?: number
  className?: string
  style?: React.CSSProperties
}

/**
 * Animated number. Snaps straight to the target under reduced-motion.
 */
export default function CountUp({
  to,
  from = 0,
  duration = 0.9,
  delay = 0,
  className,
  style,
}: CountUpProps) {
  const [value, setValue] = useState(from)

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(to)
      return
    }
    const controls = animate(from, to, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    })
    return () => controls.stop()
  }, [to, from, duration, delay])

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {value}
    </span>
  )
}
