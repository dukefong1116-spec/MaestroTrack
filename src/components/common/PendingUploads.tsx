import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useUploadStore } from '@/stores/uploadStore'
import Sticker from '@/components/stickers/Sticker'

/**
 * Background upload status for practice takes.
 *
 * Finishing a session no longer waits for the audio, so this is what turns
 * "nothing is happening" into "your take is going up". It also drains the
 * queue on mount, which is how a recording survives a tab closed mid-upload
 * or a connection that died: the audio is on disk, and the next visit
 * finishes the job.
 */
export default function PendingUploads() {
  const { profile, user } = useAuth()
  const uid = profile?.uid ?? user?.uid
  const { pending, uploading, progress, drain, status } = useUploadStore()
  const state = status()

  // Pick up anything owed from a previous visit.
  useEffect(() => {
    if (!uid) return
    void drain(uid)
  }, [uid, drain])

  // Losing a take to a closed tab is the thing this whole queue exists to
  // prevent; warn while one is actually in flight.
  useEffect(() => {
    if (!uploading) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [uploading])

  const owed = pending.length
  if (!uid || owed === 0 || state === 'idle') return null

  // "Uploading" is claimed only while an attempt is genuinely in flight,
  // and a percentage only once the transfer has actually reported one.
  // Anything else says what is really true: owed, but not moving.
  const headline =
    state === 'uploading'
      ? `Uploading ${owed > 1 ? `${owed} takes` : 'your take'}…`
      : state === 'stalled'
        ? `${owed} take${owed > 1 ? 's' : ''} didn't upload`
        : `${owed} take${owed > 1 ? 's' : ''} waiting to upload`

  // Zero is not progress. A connection that has reported nothing and one
  // that has reported "0% transferred" look identical to a person, and both
  // look broken as a number — so neither gets a percentage.
  const measured = progress !== null && progress > 0

  const detail =
    state === 'uploading'
      ? 'Your session is already saved. You can keep using the app.'
      : state === 'stalled'
        ? 'Saved on this device — it will finish next time you are online.'
        : 'Saved on this device. Starting shortly.'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,360px)] -translate-x-1/2 px-4 py-3"
        style={{
          background: 'var(--clay-surface)',
          borderRadius: 'var(--clay-r-md)',
          boxShadow: 'var(--clay-deep)',
          fontFamily: 'var(--clay-font)',
        }}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-2.5">
          <Sticker name="mic" size={16} tone="accent" />
          <p className="flex-1 text-[12.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
            {headline}
          </p>
          {state === 'uploading' && measured && (
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--clay-dim)' }}>
              {progress}%
            </span>
          )}
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
          {state === 'uploading' && !measured ? (
            // Connected, nothing measured yet. An indeterminate sweep is
            // honest here; a 0% bar reads as broken.
            <motion.div
              className="h-full w-1/3 rounded-full"
              style={{ background: 'var(--clay-accent)' }}
              animate={{ x: ['-100%', '300%'] }}
              transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
            />
          ) : (
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--clay-accent)' }}
              animate={{ width: `${state === 'uploading' ? (progress ?? 0) : 0}%` }}
              transition={{ duration: 0.25 }}
            />
          )}
        </div>

        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--clay-faint)' }}>
          {detail}
        </p>

        {state !== 'uploading' && (
          <button
            onClick={() => void drain(uid)}
            className="mt-2 text-[12px] font-semibold"
            style={{ color: 'var(--clay-accent)' }}
          >
            Try again now
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
