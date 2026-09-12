import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { addPracticeSession } from '@/lib/firebase/practice'
import { uploadRecording } from '@/lib/firebase/recordings'
import { computeSessionReward, type SessionReward } from '@/lib/utils/gamification'
import { playSessionChime, primeAudioContext } from '@/lib/utils/sound'
import { Metronome, TapTempo } from '@/lib/audio/metronome'
import { detectPitch, toNote, type PitchReading } from '@/lib/audio/pitch'
import SessionCelebration from '@/components/celebration/SessionCelebration'
import Sticker from '@/components/stickers/Sticker'
import type { InstrumentType, PracticeSession, PracticeCategory } from '@/types'

type Tool = 'metro' | 'tuner' | 'mic' | null
type Clip = { url: string; blob: Blob; seconds: number; uploaded?: boolean }

const CATEGORIES: PracticeCategory[] = [
  'Scales', 'Technique', 'Sight Reading', 'Repertoire', 'Memorization', 'Ear Training', 'Improvisation',
]

/* ── shared clay styles ─────────────────────────────────── */
const surface: React.CSSProperties = {
  background: 'var(--clay-surface)',
  borderRadius: 'var(--clay-r-md)',
  boxShadow: 'var(--clay-raised)',
}

export default function SessionPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const {
    pieces, addSession, timerRunning, timerStartedAt, startTimer, stopTimer, resetTimer,
  } = usePracticeStore()
  const sessions = usePracticeStore((s) => s.sessions)

  const [tool, setTool] = useState<Tool>(null)
  const [thoughts, setThoughts] = useState('')
  const [pieceId, setPieceId] = useState('')
  const [category, setCategory] = useState<PracticeCategory>('Repertoire')
  const [reward, setReward] = useState<SessionReward | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  /** Set once the session row exists, so a retry can't double-save it. */
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null)
  const [pendingReward, setPendingReward] = useState<SessionReward | null>(null)
  // The session's own date/length, so a retry — possibly after midnight —
  // tags recordings with the date they were actually made on, and the
  // delayed chime still reflects the real session length.
  const [savedDate, setSavedDate] = useState('')
  const [savedMinutes, setSavedMinutes] = useState(0)
  // The length is measured once, when Finish is tapped, and held until it
  // is safely persisted. Previously `finish()` called stopTimer() every
  // attempt — which also clears timerStartedAt — so if the first save threw,
  // the retry the error message invites measured 0 elapsed and filed a
  // 90-minute session as 1 minute.
  const measuredSecRef = useRef<number | null>(null)

  /* ── timer ─────────────────────────────────────────────── */
  const [, forceTick] = useState(0)
  useEffect(() => {
    if (!timerRunning) return
    const id = setInterval(() => forceTick((n) => n + 1), 500)
    return () => clearInterval(id)
  }, [timerRunning])

  // Start automatically on arrival so the page is live the moment it opens.
  useEffect(() => {
    if (!timerRunning && !timerStartedAt) startTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const elapsedSec = timerRunning && timerStartedAt
    ? Math.floor((Date.now() - timerStartedAt) / 1000)
    : (measuredSecRef.current ?? 0)
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0')
  const ss = String(elapsedSec % 60).padStart(2, '0')

  /* ── metronome ─────────────────────────────────────────── */
  const [bpm, setBpm] = useState(92)
  const [metroOn, setMetroOn] = useState(false)
  const [beat, setBeat] = useState(-1)
  const metroRef = useRef<Metronome | null>(null)
  const tapRef = useRef(new TapTempo())

  if (metroRef.current === null) {
    metroRef.current = new Metronome({
      onBeat: (i) => {
        // Schedule the visual to land with the click rather than ahead of it.
        setTimeout(() => setBeat(i), 0)
      },
    })
  }

  useEffect(() => {
    const m = metroRef.current
    return () => m?.dispose()
  }, [])

  useEffect(() => {
    if (metroRef.current) metroRef.current.setBpm(bpm)
  }, [bpm])

  const toggleMetro = useCallback(() => {
    const m = metroRef.current
    if (!m) return
    m.prime() // synchronous, inside the gesture — required by Safari
    const now = m.toggle()
    setMetroOn(now)
    if (!now) setBeat(-1)
  }, [])

  const handleTap = useCallback(() => {
    const next = tapRef.current.tap()
    if (next) setBpm(next)
  }, [])

  /* ── tuner ─────────────────────────────────────────────── */
  const [reading, setReading] = useState<PitchReading | null>(null)
  const [micError, setMicError] = useState('')
  const streamRef = useRef<MediaStream | null>(null)
  const tunerRafRef = useRef<number | null>(null)
  // Every open of the tuner built a new AudioContext and never closed the old
  // one. Browsers cap concurrently-open contexts (Chrome: 6) — a few
  // tuner→metronome→tuner cycles in one session would silently break all
  // audio, chime included, for the rest of that session.
  const tunerCtxRef = useRef<AudioContext | null>(null)

  const stopTuner = useCallback(() => {
    if (tunerRafRef.current !== null) cancelAnimationFrame(tunerRafRef.current)
    tunerRafRef.current = null
    setReading(null)
    if (tunerCtxRef.current) {
      tunerCtxRef.current.close().catch(() => {})
      tunerCtxRef.current = null
    }
  }, [])

  const startTuner = useCallback(async () => {
    setMicError('')
    try {
      // A click would be detected as a pitch — you can't tune against one.
      if (metroRef.current?.running) {
        metroRef.current.stop()
        setMetroOn(false)
        setBeat(-1)
      }
      // Guard against a stray double-open leaking a context.
      if (tunerCtxRef.current) {
        tunerCtxRef.current.close().catch(() => {})
        tunerCtxRef.current = null
      }

      const stream = streamRef.current ?? (await navigator.mediaDevices.getUserMedia({ audio: true }))
      streamRef.current = stream

      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctor()
      tunerCtxRef.current = ctx
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      src.connect(analyser)

      const buf = new Float32Array(analyser.fftSize)
      const loop = () => {
        // A previous loop can still have one frame in flight when the tuner
        // is closed and reopened; bail if this context is no longer current.
        if (tunerCtxRef.current !== ctx) return
        analyser.getFloatTimeDomainData(buf)
        const f = detectPitch(buf, ctx.sampleRate)
        setReading(f ? toNote(f) : null)
        tunerRafRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch {
      setMicError('Microphone access is needed for the tuner.')
    }
  }, [])

  /* ── recorder ──────────────────────────────────────────── */
  const [recording, setRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [clips, setClips] = useState<Clip[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  // Wall-clock start time, not React state — `rec.onstop` is a closure fixed
  // at record-start, so if it read `recSeconds` there it would always see 0
  // (every clip's stored duration was silently wrong before this).
  const recordStartRef = useRef<number | null>(null)
  // Mirrors `clips` synchronously. `onSubmit`/`finish` are plain closures
  // fixed at render time — after an `await`, re-reading the `clips` state
  // variable there still returns the array from that render, never a clip
  // added later by `onstop`. Uploads must read this ref, not the state.
  const clipsRef = useRef<Clip[]>([])
  // Resolved by `onstop`, so `stopRecording()` can be awaited — without this,
  // a recording stopped as part of hitting Finish raced the upload: `onstop`
  // hadn't run yet, so that take was silently dropped from the upload.
  const stopResolversRef = useRef<(() => void)[]>([])

  function setClipsBoth(updater: (prev: Clip[]) => Clip[]) {
    clipsRef.current = updater(clipsRef.current)
    setClips(clipsRef.current)
  }

  useEffect(() => {
    if (!recording) return
    const id = setInterval(() => setRecSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [recording])

  const startRecording = useCallback(async () => {
    setMicError('')
    try {
      const stream = streamRef.current ?? (await navigator.mediaDevices.getUserMedia({ audio: true }))
      streamRef.current = stream
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        const startedAt = recordStartRef.current
        const seconds = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0
        setClipsBoth((prev) => [...prev, { url: URL.createObjectURL(blob), blob, seconds }])
        recordStartRef.current = null
        setRecSeconds(0)
        const resolvers = stopResolversRef.current
        stopResolversRef.current = []
        resolvers.forEach((r) => r())
      }
      recorderRef.current = rec
      recordStartRef.current = Date.now()
      rec.start()
      setRecording(true)
    } catch {
      setMicError('Microphone access is needed to record.')
    }
  }, [])

  /** Resolves only once `onstop` has actually run and the clip is in `clipsRef`. */
  const stopRecording = useCallback((): Promise<void> => {
    const rec = recorderRef.current
    setRecording(false)
    if (!rec || rec.state === 'inactive') return Promise.resolve()
    return new Promise((resolve) => {
      stopResolversRef.current.push(resolve)
      rec.stop()
    })
  }, [])

  // Release the mic, the tuner's audio context, and any object URLs on unmount.
  useEffect(() => {
    return () => {
      if (tunerRafRef.current !== null) cancelAnimationFrame(tunerRafRef.current)
      tunerCtxRef.current?.close().catch(() => {})
      streamRef.current?.getTracks().forEach((t) => t.stop())
      // clipsRef, not `clips` — this effect has no deps, so the state
      // variable here is forever the empty array from the first render
      // and every clip's object URL leaked.
      clipsRef.current.forEach((c) => URL.revokeObjectURL(c.url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── tool switching ────────────────────────────────────── */
  function pickTool(next: Tool) {
    const closing = tool === next
    const target = closing ? null : next
    if (tool === 'tuner' && target !== 'tuner') stopTuner()
    setTool(target)
    if (target === 'tuner') void startTuner()
  }

  /* ── finish ────────────────────────────────────────────── */
  async function finish() {
    primeAudioContext() // synchronous, inside the gesture

    const uid = profile?.uid ?? user?.uid
    if (!uid) return

    metroRef.current?.stop()
    setMetroOn(false)
    // Awaited: onstop fires asynchronously, and without waiting here the
    // clip stopped by this same Finish tap wasn't in clipsRef yet when
    // uploadClips ran, so it was silently dropped from the upload.
    if (recording) await stopRecording()
    stopTuner()

    if (measuredSecRef.current === null) measuredSecRef.current = stopTimer()
    const minutes = Math.max(1, Math.round(measuredSecRef.current / 60))
    const sessionsBefore = sessions
    const date = format(new Date(), 'yyyy-MM-dd')

    const payload = {
      date,
      durationMinutes: minutes,
      category,
      pieceName: pieceId || undefined,
      difficultyRating: 3,
      confidenceRating: 7,
      notes: thoughts.trim() || undefined,
    }

    setSaving(true)
    let id: string
    try {
      id = await addPracticeSession(uid, payload)
    } catch {
      setSaveError('Could not save the session. Check your connection and try again.')
      setSaving(false)
      return
    }

    measuredSecRef.current = null // the row exists; the length is safe now
    const newSession = { id, userId: uid, createdAt: new Date().toISOString(), ...payload } as PracticeSession
    addSession(newSession as never)

    // Piece totals are derived from the session log — nothing to increment.

    const remaining = await uploadClips(uid, id, date)

    const earned = computeSessionReward({
      sessionsBefore,
      newSession,
      dailyGoalMinutes: Math.round((profile?.weeklyGoalMinutes ?? 300) / 7),
    })

    setSaving(false)
    resetTimer()

    // The session is saved either way. If takes failed to upload, hold the
    // page open so the failure is visible and retryable — the blobs are still
    // in memory, so this is recoverable until the tab closes.
    if (remaining > 0) {
      setSavedSessionId(id)
      setSavedDate(date)
      setSavedMinutes(minutes)
      setPendingReward(earned)
      setSaveError(
        `Session saved, but ${remaining} recording${remaining > 1 ? 's' : ''} didn't upload. ` +
        `${remaining > 1 ? 'They are' : 'It is'} still held in this tab — retry now, or continue and lose ${remaining > 1 ? 'them' : 'it'}.`
      )
      return
    }

    playSessionChime(profile?.instrument as InstrumentType | undefined, minutes)
    setReward(earned)
  }

  /**
   * Uploads every clip not yet stored, tagging each with its session.
   * Returns how many are still outstanding.
   */
  async function uploadClips(uid: string, sessionId: string, date: string): Promise<number> {
    // clipsRef, not the `clips` state closure — see its declaration for why.
    const outstanding = clipsRef.current.filter((c) => !c.uploaded)
    if (!outstanding.length) return 0

    const pieceTitle = pieces.find((p) => p.id === pieceId)?.title ?? 'Practice session'
    const results = await Promise.allSettled(
      outstanding.map((clip, i) => {
        // Safari's MediaRecorder emits audio/mp4, everyone else audio/webm —
        // derive the extension from the blob so the two always agree.
        const ext = clip.blob.type.includes('mp4') ? 'mp4' : 'webm'
        const file = new File([clip.blob], `session-${Date.now()}-${i}.${ext}`, { type: clip.blob.type })
        return uploadRecording(uid, file, {
          pieceName: pieceTitle,
          date,
          notes: thoughts.trim() || undefined,
          duration: clip.seconds,
          sessionId,
        })
      })
    )

    // Mark the ones that landed so a retry only re-sends genuine failures.
    const succeeded = new Set(
      outstanding.filter((_, i) => results[i].status === 'fulfilled').map((c) => c.url)
    )
    if (succeeded.size) {
      setClipsBoth((prev) => prev.map((c) => (succeeded.has(c.url) ? { ...c, uploaded: true } : c)))
    }

    return results.filter((r) => r.status === 'rejected').length
  }

  async function retryUploads() {
    const uid = profile?.uid ?? user?.uid
    if (!uid || !savedSessionId) return
    setSaving(true)
    // Reuse the session's own date, not "now" — a retry can happen well
    // after midnight, and the clip should still be dated to the session.
    const remaining = await uploadClips(uid, savedSessionId, savedDate)
    setSaving(false)

    if (remaining > 0) {
      setSaveError(`Still couldn't upload ${remaining} recording${remaining > 1 ? 's' : ''}. Check your connection.`)
      return
    }
    setSaveError('')
    playSessionChime(profile?.instrument as InstrumentType | undefined, savedMinutes)
    setReward(pendingReward)
  }

  const activePieces = useMemo(() => pieces.filter((p) => p.status === 'active'), [pieces])

  /* ── render ────────────────────────────────────────────── */
  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'var(--clay-bg)', fontFamily: 'var(--clay-font)', color: 'var(--clay-ink)' }}
    >
      <div className="mx-auto w-full max-w-md px-5 pb-10 pt-5">

        {/* header */}
        <div className="mb-5 flex items-center justify-between gap-3">
          <button
            onClick={() => navigate('/student/practice')}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ ...surface, borderRadius: 999 }}
            aria-label="Minimise session — the timer keeps running"
            title="Minimise — timer keeps running"
          >
            <Minus size={18} />
          </button>

          <select
            value={pieceId}
            onChange={(e) => setPieceId(e.target.value)}
            className="min-w-0 flex-1 cursor-pointer truncate px-4 py-2.5 text-sm font-semibold outline-none"
            style={{
              ...surface,
              borderRadius: 999,
              color: pieceId ? 'var(--clay-accent-ink)' : 'var(--clay-dim)',
              background: pieceId ? 'var(--clay-accent-soft)' : 'var(--clay-surface)',
              border: 'none',
              appearance: 'none',
              textAlign: 'center',
            }}
          >
            <option value="">What are you working on?</option>
            {activePieces.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>

          <button
            onClick={() => { resetTimer(); navigate('/student/practice') }}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ ...surface, borderRadius: 999, color: 'var(--clay-dim)' }}
            aria-label="Discard session"
            title="Discard session"
          >
            <X size={18} />
          </button>
        </div>

        {/* thoughts */}
        <div className="mb-6 p-4" style={surface}>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
            Thoughts
          </p>
          <textarea
            value={thoughts}
            onChange={(e) => setThoughts(e.target.value)}
            rows={3}
            placeholder="what's working? what isn't?"
            className="w-full resize-none bg-transparent outline-none"
            style={{
              fontFamily: 'var(--clay-hand)',
              fontSize: 19,
              lineHeight: '26px',
              color: 'var(--clay-ink)',
              backgroundImage:
                'repeating-linear-gradient(transparent, transparent 25px, var(--clay-line) 25px, var(--clay-line) 26px)',
            }}
          />
        </div>

        {/*
          Pendulum + dial. The arm is anchored below the dial and runs taller
          than it, so the top third — and the weight — stays visible above the
          face while it swings. It doubles as the metronome's visual beat.
        */}
        <div className="relative mb-7 flex h-[268px] items-end justify-center">
          <motion.div
            className="absolute bottom-[34px] left-1/2 origin-bottom rounded-full"
            style={{ width: 5, height: 226, marginLeft: -2.5, background: '#CFC4E6' }}
            animate={{ rotate: metroOn ? [-16, 16] : [-4, 4] }}
            transition={{
              duration: metroOn ? 60 / bpm : 3.2,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
          >
            {/* weight sits in the exposed section above the dial */}
            <span
              className="absolute left-1/2 block"
              style={{
                top: 16, width: 26, height: 17, marginLeft: -13,
                borderRadius: 6,
                background: 'var(--clay-accent)',
                boxShadow: '0 4px 10px -2px rgba(255,122,92,.5)',
              }}
            />
          </motion.div>

          <motion.button
            onClick={() => (timerRunning ? stopTimer() : startTimer())}
            className="relative z-10 mb-5 flex h-[168px] w-[168px] flex-col items-center justify-center rounded-full"
            style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-deep)' }}
            whileTap={{ scale: 0.94 }}
          >
            <span className="text-[38px] font-semibold leading-none tabular-nums" style={{ letterSpacing: '-.02em' }}>
              {mm}:{ss}
            </span>
            <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
              {timerRunning ? 'tap to pause' : 'tap to resume'}
            </span>
          </motion.button>
        </div>

        {/* tool dock */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          {([
            { id: 'metro', label: 'Metronome', on: metroOn },
            { id: 'tuner', label: 'Tuner', on: tool === 'tuner' },
            { id: 'mic', label: 'Record', on: recording },
          ] as const).map((t) => {
            const open = tool === t.id
            return (
              <motion.button
                key={t.id}
                onClick={() => pickTool(t.id)}
                whileTap={{ scale: 0.93 }}
                className="flex flex-col items-center gap-1.5 py-3"
                style={{
                  ...surface,
                  background: t.on ? 'var(--clay-accent)' : 'var(--clay-surface)',
                  boxShadow: t.on ? 'var(--clay-accent-shadow)' : 'var(--clay-raised)',
                  color: t.on ? 'var(--clay-on-accent)' : 'var(--clay-ink)',
                  outline: open && !t.on ? '2px solid var(--clay-accent)' : 'none',
                  outlineOffset: -2,
                }}
              >
                <Sticker name={t.id} size={22} tone={t.on ? 'onAccent' : 'ink'} />
                <span className="text-[10px] font-semibold">{t.label}</span>
              </motion.button>
            )
          })}
        </div>

        {/* drawers */}
        <AnimatePresence mode="wait">
          {tool === 'metro' && (
            <motion.div
              key="metro"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="p-4" style={surface}>
                <div className="mb-3 flex items-end justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[34px] font-semibold leading-none tabular-nums">{bpm}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[.1em]" style={{ color: 'var(--clay-dim)' }}>
                      bpm
                    </span>
                  </div>
                  <div className="flex gap-1.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <span
                        key={i}
                        className="block rounded-full transition-transform"
                        style={{
                          width: 9, height: 9,
                          background: beat === i ? 'var(--clay-accent)' : 'var(--clay-line)',
                          transform: beat === i ? 'scale(1.5)' : 'scale(1)',
                        }}
                      />
                    ))}
                  </div>
                </div>

                <input
                  type="range" min={40} max={208} value={bpm}
                  onChange={(e) => setBpm(Number(e.target.value))}
                  className="mb-3 w-full"
                  style={{ accentColor: 'var(--clay-accent)' }}
                />

                <div className="grid grid-cols-2 gap-2.5">
                  <motion.button
                    onClick={handleTap}
                    whileTap={{ scale: 0.94 }}
                    className="py-3 text-[13px] font-semibold"
                    style={{ ...surface, background: 'var(--clay-bg-deep)', boxShadow: 'none' }}
                  >
                    Tap tempo
                  </motion.button>
                  <motion.button
                    onClick={toggleMetro}
                    whileTap={{ scale: 0.94 }}
                    className="py-3 text-[13px] font-semibold"
                    style={{
                      ...surface,
                      background: metroOn ? 'var(--clay-accent)' : 'var(--clay-ink)',
                      color: '#fff',
                      boxShadow: 'none',
                    }}
                  >
                    {metroOn ? 'Stop' : 'Start'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {tool === 'tuner' && (
            <motion.div
              key="tuner"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="p-5 text-center" style={surface}>
                {micError ? (
                  <p className="text-[13px]" style={{ color: 'var(--clay-danger)' }}>{micError}</p>
                ) : (
                  <>
                    <div className="mb-1 text-[44px] font-semibold leading-none">
                      {reading ? `${reading.note}${reading.octave}` : '—'}
                    </div>
                    <div className="mb-4 text-[11px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
                      {reading ? `${reading.cents > 0 ? '+' : ''}${reading.cents} cents` : 'play a note'}
                    </div>
                    {/* needle gauge */}
                    <div className="relative mx-auto h-2.5 w-full max-w-[240px] rounded-full" style={{ background: 'var(--clay-bg-deep)' }}>
                      <span className="absolute left-1/2 top-1/2 block h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded" style={{ background: 'var(--clay-faint)' }} />
                      <motion.span
                        className="absolute top-1/2 block h-5 w-1.5 rounded-full"
                        style={{
                          background: reading && Math.abs(reading.cents) <= 5 ? 'var(--clay-mint)' : 'var(--clay-accent)',
                          marginTop: -10,
                        }}
                        animate={{ left: `calc(${50 + (reading ? Math.max(-50, Math.min(50, reading.cents)) : 0)}% - 3px)` }}
                        transition={{ type: 'spring', stiffness: 220, damping: 22 }}
                      />
                    </div>
                    <p className="mt-3 text-[11px]" style={{ color: 'var(--clay-faint)' }}>
                      Metronome pauses while tuning
                    </p>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {tool === 'mic' && (
            <motion.div
              key="mic"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="p-4" style={surface}>
                {micError ? (
                  <p className="text-[13px]" style={{ color: 'var(--clay-danger)' }}>{micError}</p>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[13px] font-semibold">
                        {recording ? 'Recording…' : clips.length ? `${clips.length} clip${clips.length > 1 ? 's' : ''} ready` : 'Capture a take'}
                      </span>
                      <span className="text-[22px] font-semibold tabular-nums" style={{ color: recording ? 'var(--clay-accent)' : 'var(--clay-faint)' }}>
                        {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:{String(recSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <motion.button
                      onClick={recording ? stopRecording : startRecording}
                      whileTap={{ scale: 0.94 }}
                      className="w-full py-3 text-[13px] font-semibold"
                      style={{
                        ...surface,
                        background: recording ? 'var(--clay-danger)' : 'var(--clay-accent)',
                        color: '#fff', boxShadow: 'none',
                      }}
                    >
                      {recording ? 'Stop recording' : 'Start recording'}
                    </motion.button>

                    {clips.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {clips.map((c, i) => (
                          <audio key={i} src={c.url} controls className="w-full" style={{ height: 34 }} />
                        ))}
                        <p className="text-[11px]" style={{ color: 'var(--clay-faint)' }}>
                          Saved to your recordings when you finish.
                        </p>
                      </div>
                    )}
                    {metroOn && (
                      <p className="mt-3 text-[11px]" style={{ color: 'var(--clay-faint)' }}>
                        The metronome click will be picked up by the mic.
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* category */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className="shrink-0 whitespace-nowrap px-3.5 py-2 text-[12px] font-semibold transition-transform active:scale-95"
              style={{
                borderRadius: 999,
                background: category === c ? 'var(--clay-accent-soft)' : 'var(--clay-surface)',
                color: category === c ? 'var(--clay-accent-ink)' : 'var(--clay-dim)',
                boxShadow: category === c ? 'none' : 'var(--clay-raised)',
              }}
            >
              {c}
            </button>
          ))}
        </div>

        {saveError && (
          <p className="mb-3 rounded-2xl px-4 py-3 text-[13px] leading-relaxed" style={{ background: '#FFE8EA', color: 'var(--clay-danger)' }}>
            {saveError}
          </p>
        )}

        {/* finish — becomes a retry/continue pair if takes failed to upload */}
        {savedSessionId ? (
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              onClick={retryUploads}
              disabled={saving}
              whileTap={{ scale: 0.96 }}
              className="py-4 text-[15px] font-semibold disabled:opacity-60"
              style={{
                borderRadius: 'var(--clay-r-lg)',
                background: 'var(--clay-accent)',
                color: 'var(--clay-on-accent)',
                boxShadow: 'var(--clay-accent-shadow)',
              }}
            >
              {saving ? 'Retrying…' : 'Retry upload'}
            </motion.button>
            <motion.button
              onClick={() => { resetTimer(); navigate('/student/practice') }}
              disabled={saving}
              whileTap={{ scale: 0.96 }}
              className="py-4 text-[15px] font-semibold disabled:opacity-60"
              style={{
                borderRadius: 'var(--clay-r-lg)',
                background: 'var(--clay-surface)',
                color: 'var(--clay-dim)',
                boxShadow: 'var(--clay-raised)',
              }}
            >
              Continue
            </motion.button>
          </div>
        ) : (
          <motion.button
            onClick={finish}
            disabled={saving}
            whileTap={{ scale: 0.96 }}
            className="w-full py-4 text-[16px] font-semibold disabled:opacity-60"
            style={{
              borderRadius: 'var(--clay-r-lg)',
              background: 'var(--clay-accent)',
              color: 'var(--clay-on-accent)',
              boxShadow: 'var(--clay-accent-shadow)',
            }}
          >
            {saving ? 'Saving…' : 'Finish Session →'}
          </motion.button>
        )}
      </div>

      <SessionCelebration
        reward={reward}
        instrument={profile?.instrument as InstrumentType | undefined}
        onDismiss={() => { setReward(null); navigate('/student/practice') }}
      />
    </motion.div>
  )
}
