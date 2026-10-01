import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, Square } from 'lucide-react'
import TakePlayer from '@/components/recordings/TakePlayer'
import { pickRecorderFormat, recorderOptions, MIC_CONSTRAINTS } from '@/lib/audio/recorderFormat'
import { uploadRecording } from '@/lib/firebase/recordings'
import { putClip, deleteClip } from '@/lib/storage/pendingClips'
import { useAuth } from '@/hooks/useAuth'

/**
 * Record a take for an assignment, here and now.
 *
 * Picking from earlier takes covers the musician who has already practised
 * and wants to submit the best one. This covers the other half: sitting
 * with the instrument, reading an assignment that asks to hear it, and
 * wanting to play it rather than go and start a practice session first.
 *
 * Shares the session recorder's format and microphone settings rather than
 * repeating them — the same 64kbps Opus, and the same refusal of the
 * browser's voice-call processing, which flattens dynamics and can gate a
 * quiet sustained note.
 */
export default function AssignmentRecorder({
  date, pieceName, onRecorded,
}: {
  /** The assignment's date, so the stored recording is filed sensibly. */
  date: string
  pieceName: string
  /** Fires with the new recording's id once it has genuinely landed. */
  onRecorded: (recordingId: string) => void
}) {
  const { profile, user } = useAuth()
  const uid = profile?.uid ?? user?.uid

  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [preview, setPreview] = useState<{ url: string; blob: Blob; secs: number; ext: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const recRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const startedAtRef = useRef<number | null>(null)
  const clipIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [recording])

  // Release the microphone and the preview URL on the way out.
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    if (preview) URL.revokeObjectURL(preview.url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = useCallback(async () => {
    setError('')
    try {
      const stream = streamRef.current ?? (await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS))
      streamRef.current = stream
      chunksRef.current = []

      const fmt = pickRecorderFormat()
      const rec = new MediaRecorder(stream, recorderOptions(fmt))
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        const startedAt = startedAtRef.current
        const secs = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0
        startedAtRef.current = null
        setSeconds(0)
        setPreview({ url: URL.createObjectURL(blob), blob, secs, ext: fmt.ext })

        // On disk before it goes anywhere, so a closed tab or a failed
        // upload does not destroy the take.
        const id = `assign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        clipIdRef.current = id
        if (uid) {
          void putClip({
            id, blob, seconds: secs, ext: fmt.ext, sessionId: null,
            date, pieceName, userId: uid, createdAt: Date.now(),
          })
        }
      }
      recRef.current = rec
      startedAtRef.current = Date.now()
      rec.start()
      setRecording(true)
    } catch {
      setError('Microphone access is needed to record.')
    }
  }, [uid, date, pieceName])

  const stop = useCallback(() => {
    const rec = recRef.current
    setRecording(false)
    if (rec && rec.state !== 'inactive') rec.stop()
  }, [])

  async function upload() {
    if (!preview || !uid) return
    setUploading(true)
    setError('')
    setProgress(null)
    try {
      const file = new File([preview.blob], `assignment-${Date.now()}.${preview.ext}`, {
        type: preview.blob.type,
      })
      const id = await uploadRecording(
        uid, file,
        { pieceName, date, duration: preview.secs },
        (pct) => setProgress(Math.round(pct))
      )
      // Only now is the local copy safe to drop.
      if (clipIdRef.current) await deleteClip(clipIdRef.current)
      setDone(true)
      onRecorded(id)
    } catch {
      setError('Could not upload the take. It is saved on this device — try again.')
    } finally {
      setUploading(false)
      setProgress(null)
    }
  }

  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  if (done && preview) {
    return (
      <div className="space-y-2">
        <TakePlayer src={preview.url} label="Just recorded" storedDuration={preview.secs} />
        <p className="text-[11.5px]" style={{ color: '#2E8B62' }}>Added to this submission.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {preview ? (
        <>
          <TakePlayer src={preview.url} label="New take" storedDuration={preview.secs} />
          <div className="flex gap-2">
            <button
              onClick={upload}
              disabled={uploading}
              className="flex-1 py-2.5 text-[13px] font-semibold disabled:opacity-60"
              style={{
                borderRadius: 'var(--clay-r-sm)',
                background: 'var(--clay-accent)',
                color: 'var(--clay-on-accent)',
              }}
            >
              {uploading ? (progress !== null ? `Uploading ${progress}%` : 'Uploading…') : 'Use this take'}
            </button>
            <button
              onClick={() => {
                URL.revokeObjectURL(preview.url)
                if (clipIdRef.current) void deleteClip(clipIdRef.current)
                setPreview(null)
              }}
              disabled={uploading}
              className="px-4 py-2.5 text-[13px] font-semibold disabled:opacity-60"
              style={{ borderRadius: 'var(--clay-r-sm)', background: 'var(--clay-bg)', color: 'var(--clay-dim)' }}
            >
              Again
            </button>
          </div>
        </>
      ) : (
        <button
          onClick={recording ? stop : start}
          className="flex w-full items-center justify-center gap-2.5 py-3 text-[13px] font-semibold"
          style={{
            borderRadius: 'var(--clay-r-sm)',
            background: recording ? 'var(--clay-danger)' : 'var(--clay-bg)',
            color: recording ? '#fff' : 'var(--clay-ink)',
          }}
        >
          {recording ? (
            <>
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
                <Square size={13} fill="currentColor" />
              </motion.span>
              Stop · {clock}
            </>
          ) : (
            <><Mic size={15} /> Record a take now</>
          )}
        </button>
      )}

      {error && (
        <p className="text-[11.5px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>
      )}
    </div>
  )
}
