import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play, Pause } from 'lucide-react'

/**
 * A practice take.
 *
 * The native <audio controls> element was a dark grey slab dropped into a
 * soft lilac sheet — and with preload="none" it showed --:-- for a
 * duration the app already knows, having recorded it. This draws the
 * controls in the app's own language and trusts the stored length until
 * the file itself reports one.
 *
 * Only one take plays at a time: they are takes of the same passage, and
 * two at once is never what anyone wants.
 */

const CURRENT = { el: null as HTMLAudioElement | null }

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TakePlayer({
  src, label, storedDuration,
}: {
  src: string
  label: string
  /** Length measured while recording — shown before the file is fetched. */
  storedDuration?: number
}) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [loaded, setLoaded] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const total = loaded ?? storedDuration ?? 0
  const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onTime = () => setElapsed(el.currentTime)
    const onMeta = () => { if (Number.isFinite(el.duration)) setLoaded(el.duration) }
    const onEnd = () => { setPlaying(false); setElapsed(0); el.currentTime = 0 }
    const onErr = () => { setError(true); setPlaying(false); setBusy(false) }
    const onPlaying = () => setBusy(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnd)
    el.addEventListener('error', onErr)
    el.addEventListener('playing', onPlaying)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('error', onErr)
      el.removeEventListener('playing', onPlaying)
    }
  }, [])

  // Stop this one if another take takes over.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onPause = () => setPlaying(false)
    el.addEventListener('pause', onPause)
    return () => el.removeEventListener('pause', onPause)
  }, [])

  async function toggle() {
    const el = ref.current
    if (!el || error) return
    if (playing) {
      el.pause()
      setPlaying(false)
      return
    }
    if (CURRENT.el && CURRENT.el !== el) CURRENT.el.pause()
    CURRENT.el = el
    setBusy(true)
    try {
      await el.play()
      setPlaying(true)
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  function scrub(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current
    if (!el || total <= 0) return
    const box = e.currentTarget.getBoundingClientRect()
    const to = ((e.clientX - box.left) / box.width) * total
    el.currentTime = Math.max(0, Math.min(total, to))
    setElapsed(el.currentTime)
  }

  return (
    <div className="px-3.5 py-3" style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)' }}>
      <audio ref={ref} src={src} preload="none" />

      <div className="flex items-center gap-3">
        <motion.button
          onClick={toggle}
          whileTap={{ scale: 0.92 }}
          disabled={error}
          aria-label={playing ? `Pause ${label}` : `Play ${label}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
          style={{
            background: 'var(--clay-accent)',
            color: 'var(--clay-on-accent)',
            boxShadow: 'var(--clay-accent-shadow)',
          }}
        >
          {busy ? (
            <motion.span
              className="block h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }}
            />
          ) : playing ? (
            <Pause size={15} fill="currentColor" />
          ) : (
            // Nudged right so the triangle reads as centred in the circle.
            <Play size={15} fill="currentColor" style={{ marginLeft: 2 }} />
          )}
        </motion.button>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
              {label}
            </span>
            <span className="ml-auto shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--clay-dim)' }}>
              {error ? 'unavailable' : playing || elapsed > 0 ? `${clock(elapsed)} / ${clock(total)}` : clock(total)}
            </span>
          </div>

          {/* Generous hit area around a slim bar — easy to scrub, quiet at rest. */}
          <div className="mt-2 -my-1.5 cursor-pointer py-1.5" onClick={scrub}>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: 'var(--clay-accent)', transition: 'width .1s linear' }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
