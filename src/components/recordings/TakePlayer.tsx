import { useEffect, useRef, useState } from 'react'
import { boost, wakeAudio } from '@/lib/audio/loudness'
import { motion } from 'framer-motion'
import { Pause, Pencil, Play, Trash2 } from 'lucide-react'
import ConfirmSheet from '@/components/ui/ConfirmSheet'

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

/**
 * A twentieth of a second of silence, played inside the tap.
 *
 * A private take has to be fetched before it can play, and iOS refuses
 * play() once the tap has been awaited past. Playing something — anything
 * — from the tap itself unlocks the element, and the real take can then
 * play on it when it arrives.
 */
let silence: string | null = null
function silentClip(): string {
  if (silence) return silence
  const rate = 8000
  const samples = rate / 20
  const bytes = new Uint8Array(44 + samples)
  const view = new DataView(bytes.buffer)
  const text = (at: number, s: string) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i) }
  text(0, 'RIFF'); view.setUint32(4, 36 + samples, true); text(8, 'WAVE')
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true)
  view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true)
  text(36, 'data'); view.setUint32(40, samples, true)
  bytes.fill(128, 44) // 8-bit PCM is unsigned: 128 is silence
  silence = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
  return silence
}

function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function TakePlayer({
  src, load, loadFallback, label, storedDuration, onRename, onDelete,
}: {
  /** The audio, where it is already at hand — a take just recorded. */
  src?: string
  /**
   * Or how to fetch it, for a saved take: called on the first play, so a
   * list of takes costs nothing until one is played. A blob: URL it
   * returns is revoked when the player goes.
   */
  load?: () => Promise<string>
  /**
   * A second way to get the audio, tried once if the first will not play
   * — downloading the whole take where streaming is refused.
   */
  loadFallback?: () => Promise<string>
  label: string
  /** Length measured while recording — shown before the file is fetched. */
  storedDuration?: number
  /**
   * Given only where the take is the viewer's own. Not everywhere this
   * appears is: a teacher reads a student's takes in the review sheet,
   * and a preview of something not yet uploaded has no document behind
   * it to rename or delete.
   */
  onRename?: (title: string) => void
  onDelete?: () => void
}) {
  const ref = useRef<HTMLAudioElement | null>(null)
  const fetched = useRef<string | null>(null)
  const fallbackRef = useRef(loadFallback)
  fallbackRef.current = loadFallback
  /** The one fallback attempt, shared by whoever notices the failure first. */
  const fallbackRun = useRef<Promise<boolean> | null>(null)
  /** While the switch is under way, the failed stream's notices are moot. */
  const switching = useRef(false)

  /**
   * Streaming failed: download the whole take and play that instead.
   *
   * Some browsers refuse a streamed take once the loudness boost has asked
   * for it cross-origin, and say so as "a format this browser cannot
   * play" — of a file they would play perfectly well from a download. The
   * element was unlocked by the first tap, so playing again here is
   * allowed without another one.
   */
  function fallBack(el: HTMLAudioElement): Promise<boolean> {
    if (fallbackRun.current) return fallbackRun.current
    const get = fallbackRef.current
    if (!get) return Promise.resolve(false)
    fallbackRun.current = (async () => {
      switching.current = true
      setError(false)
      setUndecodable(false)
      setBusy(true)
      try {
        const url = await get()
        if (fetched.current?.startsWith('blob:')) URL.revokeObjectURL(fetched.current)
        fetched.current = url
        el.src = url
        boost(el)
        await el.play()
        setPlaying(true)
        return true
      } catch {
        // Downloaded and still not playable: now it really is the format.
        setUndecodable(el.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED)
        setError(true)
        setPlaying(false)
        return false
      } finally {
        switching.current = false
        setBusy(false)
      }
    })()
    return fallbackRun.current
  }
  useEffect(() => () => {
    if (fetched.current?.startsWith('blob:')) URL.revokeObjectURL(fetched.current)
  }, [])
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [loaded, setLoaded] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  /** The file arrived but this browser cannot decode it. */
  const [undecodable, setUndecodable] = useState(false)

  /**
   * Renaming happens in place.
   *
   * A take used to be called "Take 1", "Take 2" — its position in the
   * list and nothing else, so a row told you nothing about what was on
   * it. Editing here rather than behind a menu, because the name you
   * want usually occurs to you while you are listening to it.
   */
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)

  /**
   * Deleting asks properly.
   *
   * A take is not recoverable — the document and the audio both go — and
   * the control sits a thumb's width from Play. This was a second tap on
   * the same spot, which is easy to do by accident and says nothing
   * about what is about to happen.
   */
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function commitName() {
    setEditing(false)
    const next = draft.trim()
    if (next && next !== label) onRename?.(next)
    else setDraft(label)
  }

  const total = loaded ?? storedDuration ?? 0
  const pct = total > 0 ? Math.min(100, (elapsed / total) * 100) : 0

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onTime = () => setElapsed(el.currentTime)
    const onMeta = () => { if (Number.isFinite(el.duration)) setLoaded(el.duration) }
    const onEnd = () => { setPlaying(false); setElapsed(0); el.currentTime = 0 }
    const onErr = () => {
      // A late notice about a source already replaced — the stream that
      // failed, after the fallback has taken over. Starting a new load
      // clears el.error, so a stale one finds nothing to report.
      if (!el.error || switching.current) return
      // The stream failed and there is another way to get it: try that
      // before saying anything. If it fails too, this runs again for it.
      if (fallbackRef.current && !fallbackRun.current) { void fallBack(el); return }
      // Why it failed decides what to offer. A take recorded in Chrome is
      // Opus in WebM, which Safari cannot decode however intact the file
      // is — so "unavailable" was telling someone their recording was
      // gone when it was sitting in the bucket, playable on any other
      // browser. MEDIA_ERR_SRC_NOT_SUPPORTED is that case; the rest are a
      // file that genuinely could not be fetched.
      setUndecodable(el.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED)
      setError(true)
      setPlaying(false)
      setBusy(false)
    }
    // Not for the unlocking silence: the take itself may still be on its way.
    const onPlaying = () => { if (el.currentSrc !== silence) setBusy(false) }
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
    // Before anything is awaited: Safari only resumes audio inside the tap.
    wakeAudio()
    setBusy(true)
    try {
      if (load && !fetched.current) {
        // Unlock inside the tap, then fetch — see silentClip.
        el.src = silentClip()
        el.play().catch(() => {})
        fetched.current = await load()
        el.src = fetched.current
      }
      boost(el) // louder, the way Voice Memos is — see lib/audio/loudness
      await el.play()
      setPlaying(true)
    } catch {
      if (await fallBack(el)) return
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
    <>
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
            {editing ? (
              <input
                autoFocus
                value={draft}
                aria-label="Name this take"
                maxLength={80}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitName() }
                  if (e.key === 'Escape') { setDraft(label); setEditing(false) }
                }}
                className="min-w-0 flex-1 bg-transparent text-[12.5px] font-semibold outline-none"
                style={{ color: 'var(--clay-ink)', borderBottom: '1px solid var(--clay-accent)' }}
              />
            ) : onRename ? (
              <button
                type="button"
                onClick={() => { setDraft(label); setEditing(true) }}
                className="flex min-w-0 items-center gap-1.5 text-left"
                title="Rename this take"
              >
                <span className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                  {label}
                </span>
                <Pencil size={11} className="shrink-0" style={{ color: 'var(--clay-faint)' }} />
              </button>
            ) : (
              <span className="truncate text-[12.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                {label}
              </span>
            )}
            <span className="ml-auto shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--clay-dim)' }}>
              {error
                ? undecodable ? "can't play here" : 'unavailable'
                : playing || elapsed > 0 ? `${clock(elapsed)} / ${clock(total)}` : clock(total)}
            </span>
            {onDelete && (
              <button
                type="button"
                aria-label={`Delete ${label}`}
                onClick={() => setConfirmingDelete(true)}
                className="shrink-0"
                style={{ color: 'var(--clay-faint)' }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>

          {/* A take this browser cannot decode is not a lost take. Offer it
              for download rather than leaving a dead row: the file is
              fine, and it plays in Chrome, in Firefox, or in anything
              else on the device. */}
          {undecodable && (
            <p className="mt-1 text-[11px]" style={{ color: 'var(--clay-dim)' }}>
              Recorded in a format this browser can’t play.{' '}
              <a
                href={src}
                download
                className="font-semibold underline"
                style={{ color: 'var(--clay-accent)' }}
              >
                Download the take
              </a>
              {' '}— it opens in Chrome, or in any music player.
            </p>
          )}

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

    <ConfirmSheet
      open={confirmingDelete}
      title="Delete this take?"
      body={`“${label}” will be gone for good — the recording and its audio both. This cannot be undone.`}
      onCancel={() => setConfirmingDelete(false)}
      onConfirm={() => { setConfirmingDelete(false); onDelete?.() }}
    />
    </>
  )
}
