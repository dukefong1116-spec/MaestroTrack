import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion(): boolean {
  return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Canvas confetti burst. Renders nothing under prefers-reduced-motion.
 *
 * Deliberately canvas rather than DOM nodes — 80 animated elements in the
 * React tree would thrash layout on every frame.
 */

interface ConfettiProps {
  /** Extra colours mixed into the Limestone base palette. */
  colors?: string[]
  count?: number
  /** Milliseconds before particles stop being drawn. */
  duration?: number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  w: number
  h: number
  color: string
  shape: 'rect' | 'circle'
}

const BASE_COLORS = ['#E8503A', '#22201C', '#F8F6F2']

export default function Confetti({ colors = [], count = 80, duration = 1800 }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  // Read once at mount so the canvas is never even created for a viewer
  // who has asked for reduced motion.
  const [reduced] = useState(prefersReducedMotion)

  useEffect(() => {
    if (reduced) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const palette = [...BASE_COLORS, ...colors]
    const particles: Particle[] = []

    // Two emitters, angled inward from the lower third — reads as a burst
    // rather than rain falling from the top.
    for (let i = 0; i < count; i++) {
      const fromLeft = i % 2 === 0
      const spread = (Math.random() - 0.5) * 0.9
      const power = 9 + Math.random() * 7
      particles.push({
        x: fromLeft ? w * 0.18 : w * 0.82,
        y: h * 0.62,
        vx: (fromLeft ? 1 : -1) * (1.6 + Math.random() * 2.6) + spread * 2,
        vy: -power,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.34,
        w: 5 + Math.random() * 5,
        h: 7 + Math.random() * 6,
        color: palette[Math.floor(Math.random() * palette.length)],
        shape: Math.random() > 0.72 ? 'circle' : 'rect',
      })
    }

    const started = performance.now()
    const gravity = 0.32
    const drag = 0.992

    function frame(now: number) {
      const elapsed = now - started
      if (elapsed > duration) {
        ctx!.clearRect(0, 0, w, h)
        return
      }

      // Fade the whole burst out over the last third of its life.
      const fadeFrom = duration * 0.66
      const alpha = elapsed < fadeFrom ? 1 : 1 - (elapsed - fadeFrom) / (duration - fadeFrom)

      ctx!.clearRect(0, 0, w, h)
      ctx!.globalAlpha = Math.max(0, alpha)

      for (const p of particles) {
        p.vy += gravity
        p.vx *= drag
        p.vy *= drag
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr

        ctx!.save()
        ctx!.translate(p.x, p.y)
        ctx!.rotate(p.rot)
        ctx!.fillStyle = p.color
        if (p.shape === 'circle') {
          ctx!.beginPath()
          ctx!.arc(0, 0, p.w / 2, 0, Math.PI * 2)
          ctx!.fill()
        } else {
          ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        }
        ctx!.restore()
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [colors, count, duration, reduced])

  if (reduced) return null

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  )
}
