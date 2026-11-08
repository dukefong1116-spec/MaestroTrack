import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minus, Check, Pencil, Trash2 } from 'lucide-react'
import { format, parseISO, subDays } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { addPracticeSession } from '@/lib/firebase/practice'
import { pickRecorderFormat, recorderOptions } from '@/lib/audio/recorderFormat'
import { openMic, micProcessingWarning, waitForSignal, leadingSilenceSeconds } from '@/lib/audio/mic'
import { putClip, assignSession, deleteClip } from '@/lib/storage/pendingClips'
import { addPiece } from '@/lib/firebase/pieces'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { useUploadStore } from '@/stores/uploadStore'
import { computeSessionReward, type SessionReward } from '@/lib/utils/gamification'
import { playSessionChime, primeAudioContext } from '@/lib/utils/sound'
import { unlock, peek } from '@/lib/audio/engine'
import { Metronome, TapTempo } from '@/lib/audio/metronome'
import { detectPitch, toNote, type PitchReading } from '@/lib/audio/pitch'
import SessionCelebration from '@/components/celebration/SessionCelebration'
import SessionCoach, { type CoachTool } from '@/components/onboarding/SessionCoach'
import ConfirmSheet from '@/components/ui/ConfirmSheet'
import ShareSheet from '@/components/share/ShareSheet'
import { computeStreak } from '@/lib/utils/analytics'
import Sticker from '@/components/stickers/Sticker'
import DailyToday from '@/components/assignments/DailyToday'
import { useAssignments } from '@/hooks/useAssignments'
import { isDaily, awaitingStudent, sessionCounts } from '@/lib/utils/assignments'
import { CONFIDENCE_CHOICES } from '@/lib/utils/confidence'
import { boost } from '@/lib/audio/loudness'
import { takeLabel } from '@/lib/utils/takeNames'
import { useCategoryTimer } from '@/stores/categoryTimerStore'
import { apportion, categoryFields, type CategoryMinutes } from '@/lib/utils/categories'
import type { InstrumentType, PracticeCategory, PracticeSession } from '@/types'

type Tool = 'metro' | 'tuner' | 'mic' | null

/** Sentinel for the dropdown's own "add one" row. */
const NEW_PIECE = '__new__'
type Clip = {
  /** Also the IndexedDB key, so the durable copy and this one stay paired. */
  id: string
  url: string
  blob: Blob
  seconds: number
  ext: string
  /** What the browser actually encoded it as. */
  mimeType?: string
  /** Seconds of silence the take begins with, once measured. */
  leadIn?: number
  /** What you called it, if you named it before finishing. */
  title?: string
}

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
    pieces, addSession, addPiece: addPieceToStore,
    timerRunning, timerStartedAt, timerAccumulatedSec,
    startTimer, pauseTimer, stopTimer, resetTimer,
  } = usePracticeStore()
  const sessions = usePracticeStore((s) => s.sessions)
  const recordings = usePracticeStore((s) => s.recordings)

  // A take not yet named is called by today's date, carrying on from any
  // takes already recorded today in earlier sessions — so this session's
  // first take is "Nov 5, 2026 2" if the morning already had one, matching
  // what it will be called in the history once saved.
  const todayISO = format(new Date(), 'yyyy-MM-dd')
  const takenEarlierToday = useMemo(
    () => recordings.filter((r) => r.date.substring(0, 10) === todayISO).length,
    [recordings, todayISO]
  )
  const clipName = (i: number) => takeLabel(todayISO, takenEarlierToday + i + 1)

  /** Their own history decides this, so nothing has to be stored. */
  const firstEver = sessions.length === 0

  /** Adding a piece without leaving the session. */
  const [addingPiece, setAddingPiece] = useState(false)
  const [newPieceTitle, setNewPieceTitle] = useState('')
  const [addingBusy, setAddingBusy] = useState(false)

  async function createPiece() {
    const uid = profile?.uid ?? user?.uid
    const title = newPieceTitle.trim()
    if (!uid || !title || addingBusy) return
    setAddingBusy(true)
    try {
      // The same shape PiecesPanel writes, field for field. The cast this
      // used to carry hid the fact that it was missing two required ones.
      const pieceData = {
        title,
        difficulty: 3,
        status: 'active' as const,
        totalMinutes: 0,
        sessionCount: 0,
        completionPercentage: 0,
        confidenceHistory: [],
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      const id = await addPiece(uid, pieceData)
      // Into the store as well as Firestore, so the dropdown has it before
      // the subscription catches up.
      addPieceToStore({ id, userId: uid, ...pieceData })
      // Selected straight away: adding one mid-session means you are
      // playing it now.
      setPieceId(id)
      setAddingPiece(false)
      setNewPieceTitle('')
    } catch {
      // Left open with the text still in it, so nothing is retyped.
    } finally {
      setAddingBusy(false)
    }
  }

  const [tool, setTool] = useState<Tool>(null)

  /**
   * Teaching the tools where they live.
   *
   * Only on a first session — `firstEver` is the person's own history, so
   * no flag has to be stored and nobody who has been using the app gets
   * coached. `coachUsed` advances the line when a tool is opened, so it
   * reacts to what you did rather than counting Next taps.
   */
  const [coachUsed, setCoachUsed] = useState<CoachTool[]>([])
  const [coachSkipped, setCoachSkipped] = useState(false)
  const [thoughts, setThoughts] = useState('')
  const [pieceId, setPieceId] = useState('')
  // Started from a scoped daily assignment, the category comes with it —
  // the surest way to stop a session quietly not counting is for it never
  // to have the wrong category in the first place.
  const [params] = useSearchParams()
  const fromAssignment = params.get('category')
  const [category, setCategory] = useState<PracticeCategory>(
    CATEGORIES.includes(fromAssignment as PracticeCategory)
      ? (fromAssignment as PracticeCategory)
      : 'Repertoire'
  )
  const [reward, setReward] = useState<SessionReward | null>(null)
  const [justSaved, setJustSaved] = useState<PracticeSession | null>(null)
  const [sharing, setSharing] = useState<PracticeSession | null>(null)

  /**
   * The two figures the card needs beyond the session itself, derived from
   * the same log every other screen reads — so a posted card can never
   * disagree with the streak shown a moment earlier.
   */
  const shareStreak = useMemo(() => computeStreak(sessions).current, [sessions])
  const shareWeek = useMemo(() => {
    if (!sharing) return undefined
    const end = parseISO(sharing.date)
    return Array.from({ length: 7 }, (_, i) => {
      const day = format(subDays(end, 6 - i), 'yyyy-MM-dd')
      return sessions
        .filter((x) => x.date === day)
        .reduce((total, x) => total + x.durationMinutes, 0)
    })
  }, [sessions, sharing])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  /** Finish is a two-beat flow now: capture the length, then ask how it went. */
  const [askingConfidence, setAskingConfidence] = useState(false)
  /**
   * Takes the person has decided not to keep, chosen on the way out.
   *
   * A session used to upload every clip it had recorded, and the only way
   * to be rid of a bad one was to let it go up and delete it afterwards.
   * Dropped here instead: an unticked take is removed from the local
   * queue and never leaves the device at all.
   *
   * A ref as well as state, because finish() reads it after several
   * awaits and a state value captured in that closure would be stale.
   */
  const [discarded, setDiscarded] = useState<Set<string>>(new Set())
  const discardedRef = useRef<Set<string>>(new Set())

  /** The take being renamed in the list, and the one being deleted. */
  const [renamingClip, setRenamingClip] = useState<string | null>(null)
  const [clipDraft, setClipDraft] = useState('')
  const [deletingClip, setDeletingClip] = useState<Clip | null>(null)

  /**
   * Naming a take mid-session.
   *
   * Written to the durable copy as well as the one on screen: the clip in
   * IndexedDB is what actually gets uploaded, and a name that lived only
   * in React state would be lost the moment the page reloaded.
   */
  function nameClip(id: string, title: string) {
    const next = title.trim().slice(0, 80)
    setClipsBoth((list) => list.map((c) => (c.id === id ? { ...c, title: next || undefined } : c)))
    const clip = clipsRef.current.find((c) => c.id === id)
    if (clip) {
      void putClip({
        id: clip.id, blob: clip.blob, seconds: clip.seconds, ext: clip.ext,
        sessionId: null, date: format(new Date(), 'yyyy-MM-dd'),
        pieceName: 'Practice session', title: next || undefined,
        userId: profile?.uid ?? user?.uid ?? '', createdAt: Date.now(),
      })
    }
  }

  /**
   * Dropping a take mid-session.
   *
   * Both copies go, and the object URL with them — the blob stays in
   * memory for as long as something holds that URL, and a session with
   * several discarded takes would otherwise sit on all of them.
   */
  function removeClip(clip: Clip) {
    URL.revokeObjectURL(clip.url)
    setClipsBoth((list) => list.filter((c) => c.id !== clip.id))
    void deleteClip(clip.id)
  }
  /** Held so a save retry reuses the answer rather than asking twice. */
  const answeredRef = useRef<number | null>(null)
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
    if (!timerRunning && !timerStartedAt && timerAccumulatedSec === 0) startTimer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── which category the clock is running in ───────────── */
  // Subscribed, so tapping a chip re-renders even while paused.
  const clock = useCategoryTimer()

  // A fresh session starts the category clock where the timer starts. A
  // resumed one — you left through the bar and came back — picks up the
  // category you were in rather than the default. The `elapsed > 0` test
  // is what tells them apart, and also discards a clock left over from a
  // session that never finished saving.
  useEffect(() => {
    const c = useCategoryTimer.getState()
    const elapsed = usePracticeStore.getState().elapsedSeconds()
    if (c.current && elapsed > 0) setCategory(c.current)
    else c.begin(category, elapsed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Moving on to another category: the time so far stays where it was spent. */
  function pickCategory(next: PracticeCategory) {
    useCategoryTimer.getState().switchTo(next, usePracticeStore.getState().elapsedSeconds())
    setCategory(next)
  }

  /** "It was Scales" — the whole session, not just from here on. */
  function relabelSession(to: PracticeCategory) {
    useCategoryTimer.getState().relabelAll(to)
    setCategory(to)
  }

  const elapsedSec = measuredSecRef.current ?? Math.floor(
    timerAccumulatedSec + (timerRunning && timerStartedAt ? (Date.now() - timerStartedAt) / 1000 : 0)
  )
  const mm = String(Math.floor(elapsedSec / 60)).padStart(2, '0')
  const ss = String(elapsedSec % 60).padStart(2, '0')

  // Seconds per category so far, the live stretch included.
  const liveSecByCategory = clock.secondsAt(elapsedSec)
  // As whole minutes summing to the clock: what an assignment bar adds while you play.
  const liveSplit: CategoryMinutes = apportion(liveSecByCategory, Math.floor(elapsedSec / 60))
  // And exactly as finish() will save it, for the "won't count" check.
  const savingSplit: CategoryMinutes = apportion(liveSecByCategory, Math.max(1, Math.round(elapsedSec / 60)))

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
  /** Set when the browser insists on processing the signal anyway. */
  const [micWarning, setMicWarning] = useState<string | null>(null)
  /** True while waiting for a freshly opened microphone to speak. */
  const [preparing, setPreparing] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const tunerRafRef = useRef<number | null>(null)
  // The tuner borrows the app's single context (lib/audio/engine) instead
  // of building its own. It used to create one per open and close it on
  // exit — which, now that the context is shared, would silence the
  // metronome and the reward chime along with it. Only the analyser graph
  // is torn down here; the context outlives this page.
  const tunerNodesRef = useRef<{ src: MediaStreamAudioSourceNode; analyser: AnalyserNode } | null>(null)

  const stopTuner = useCallback(() => {
    if (tunerRafRef.current !== null) cancelAnimationFrame(tunerRafRef.current)
    tunerRafRef.current = null
    setReading(null)
    if (tunerNodesRef.current) {
      try { tunerNodesRef.current.src.disconnect() } catch { /* already gone */ }
      try { tunerNodesRef.current.analyser.disconnect() } catch { /* already gone */ }
      tunerNodesRef.current = null
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
      // Guard against a stray double-open leaving two analysers attached.
      stopTuner()

      const stream = await openMic(streamRef.current)
      streamRef.current = stream
      setMicWarning(micProcessingWarning(stream))

      const ctx = unlock()
      if (!ctx) {
        setMicError('Audio is unavailable in this browser right now.')
        return
      }
      const src = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 4096
      src.connect(analyser)
      tunerNodesRef.current = { src, analyser }

      const buf = new Float32Array(analyser.fftSize)
      const loop = () => {
        // A previous loop can still have one frame in flight when the tuner
        // is closed and reopened; bail if these nodes are no longer current.
        if (tunerNodesRef.current?.analyser !== analyser) return
        analyser.getFloatTimeDomainData(buf)
        const f = detectPitch(buf, ctx.sampleRate)
        setReading(f ? toNote(f) : null)
        tunerRafRef.current = requestAnimationFrame(loop)
      }
      loop()
    } catch {
      setMicError('Microphone access is needed for the tuner.')
    }
  }, [stopTuner])

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
      const stream = await openMic(streamRef.current)
      streamRef.current = stream
      setMicWarning(micProcessingWarning(stream))

      /**
       * Wait for the microphone to actually produce audio.
       *
       * getUserMedia resolves when the track exists, not when the device
       * is delivering — an interface still negotiating, a Bluetooth
       * headset switching to its telephony profile. Recording into that
       * window records the silence.
       *
       * A fixed warm-up was tried first and was wrong in both directions:
       * too short for a slow device, pure delay for a ready one. This
       * returns the moment a non-zero sample arrives, which is usually at
       * once, and gives up after a beat so a silent room still records.
       */
      const prepCtx = unlock()
      if (prepCtx) {
        setPreparing(true)
        await waitForSignal(stream, prepCtx)
        setPreparing(false)
      }

      chunksRef.current = []
      // Explicit format and bitrate: the default was measured at 129 kbps,
      // which is 29 MB for a half-hour take and the real reason finishing a
      // session felt like it hung.
      const fmt = pickRecorderFormat()
      const rec = new MediaRecorder(stream, recorderOptions(fmt))
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' })
        const startedAt = recordStartRef.current
        const seconds = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 0
        const id = `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const ext = fmt.ext

        setClipsBoth((prev) => [...prev, {
          id, url: URL.createObjectURL(blob), blob, seconds, ext,
          mimeType: rec.mimeType || undefined,
        }])

        // Measured, not judged by ear. "The start is dead" and "it sounds
        // fine now" are both unfalsifiable; a number says whether any of
        // this worked, and which encoder produced it.
        const measureCtx = peek()
        if (measureCtx) {
          void leadingSilenceSeconds(blob, measureCtx).then((lead) => {
            if (lead === null) return
            console.info('[take] leading silence %ss · %s', lead.toFixed(2), rec.mimeType)
            setClipsBoth((prev) => prev.map((c) => (c.id === id ? { ...c, leadIn: lead } : c)))
          })
        }

        // Straight to disk. Until the upload lands this is the only copy
        // that survives the tab closing.
        // Piece, notes and date are only settled when the session is
        // saved, so they are filled in then. This write exists purely so
        // the audio itself survives the tab closing.
        const uid = profile?.uid ?? user?.uid
        if (uid) {
          void putClip({
            id, blob, seconds, ext,
            sessionId: null,
            date: format(new Date(), 'yyyy-MM-dd'),
            pieceName: 'Practice session',
            userId: uid,
            createdAt: Date.now(),
          })
        }

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
      setPreparing(false)
      setMicError('Microphone access is needed to record.')
    }
  }, [profile?.uid, user?.uid])

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
      // The shared context is deliberately not closed here.
      streamRef.current?.getTracks().forEach((t) => t.stop())
      // clipsRef, not `clips` — this effect has no deps, so the state
      // variable here is forever the empty array from the first render
      // and every clip's object URL leaked.
      clipsRef.current.forEach((c) => URL.revokeObjectURL(c.url))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Escape backs out of the question, same as "Keep practising".
  useEffect(() => {
    if (!askingConfidence) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelFinish() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askingConfidence])

  /* ── tool switching ────────────────────────────────────── */
  function pickTool(next: Tool) {
    // Opening one is what moves the line on.
    setCoachUsed((u) => (next && !u.includes(next as CoachTool) ? [...u, next as CoachTool] : u))

    const closing = tool === next
    const target = closing ? null : next
    if (tool === 'tuner' && target !== 'tuner') stopTuner()
    setTool(target)
    if (target === 'tuner') void startTuner()
  }

  /**
   * Scoped daily assignments this session is about to not count toward.
   *
   * A session logged under the wrong category simply never appears in the
   * assignment's squares, with nothing anywhere to explain the gap — the
   * student concludes the feature is broken, and the teacher concludes
   * they did not practise. Catching it at the one moment the category is
   * still editable turns a silent failure into a question.
   */
  const { open: openAssignments } = useAssignments()
  const missed = useMemo(
    () => openAssignments
      .filter((x) => isDaily(x.assignment) && awaitingStudent(x.assignment) && x.assignment.category)
      .filter((x) => !sessionCounts(x.assignment, {
        category, pieceName: pieceId || undefined, categoryMinutes: savingSplit,
      }))
      .map((x) => x.assignment),
    [openAssignments, category, pieceId, savingSplit]
  )

  /* ── finish ────────────────────────────────────────────── */

  /**
   * First beat of Finish. Everything that must happen at the moment the
   * player stops playing happens here — above all stopping the clock, so
   * that time spent deciding how the session went is not counted as
   * practice.
   */
  function beginFinish() {
    primeAudioContext() // synchronous, inside the gesture
    if (!(profile?.uid ?? user?.uid)) return

    // Already answered on a previous attempt that failed to save — asking
    // the same question twice for one session is worse than not asking.
    if (answeredRef.current !== null) {
      void finish(answeredRef.current)
      return
    }

    // Everything that makes noise or captures audio stops here, not after
    // the question — otherwise the mic keeps recording while the player
    // decides how it went, and that silence lands in the take.
    metroRef.current?.stop()
    setMetroOn(false)
    if (recording) void stopRecording()
    stopTuner()
    setTool(null)

    if (measuredSecRef.current === null) measuredSecRef.current = stopTimer()
    setAskingConfidence(true)
  }

  /** Tapped Finish by mistake — give the session back, clock intact. */
  function cancelFinish() {
    setAskingConfidence(false)
    const banked = measuredSecRef.current
    measuredSecRef.current = null
    if (banked !== null) {
      usePracticeStore.setState({ timerAccumulatedSec: banked })
      startTimer()
    }
  }

  /** Set for the whole of a save attempt, so a second tap cannot start one. */
  const savingRef = useRef(false)

  async function finish(confidenceRating: number) {
    // A ref, not the `saving` state: state updates are asynchronous and the
    // exit animation keeps the confidence buttons in the DOM and clickable
    // for a moment after they are dismissed, so two quick taps would both
    // get past a state check and write two sessions.
    if (savingRef.current) return
    savingRef.current = true

    answeredRef.current = confidenceRating
    primeAudioContext() // this tap is a gesture too — Safari needs it here
    setAskingConfidence(false)

    const uid = profile?.uid ?? user?.uid
    if (!uid) { savingRef.current = false; return }

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

    // Whole minutes per category, summing exactly to the session.
    const split = apportion(useCategoryTimer.getState().secondsAt(measuredSecRef.current), minutes)
    const payload = {
      date,
      durationMinutes: minutes,
      ...categoryFields(split, category),
      pieceName: pieceId || undefined,
      difficultyRating: 3,
      confidenceRating,
      notes: thoughts.trim() || undefined,
    }

    setSaving(true)
    let id: string
    try {
      id = await addPracticeSession(uid, payload)
    } catch {
      setSaveError('Could not save the session. Check your connection and try again.')
      setSaving(false)
      savingRef.current = false   // a failed attempt may be retried
      return
    }

    measuredSecRef.current = null // the row exists; the length is safe now
    const newSession = { id, userId: uid, createdAt: new Date().toISOString(), ...payload } as PracticeSession
    addSession(newSession as never)
    // Held for the share card, which is offered on the celebration. The
    // store has it too, but reading it back by id would race the
    // subscription that is about to deliver the same row.
    setJustSaved(newSession)

    // Piece totals are derived from the session log — nothing to increment.

    // Hand the takes their session and let them go up in the background.
    // This used to be awaited, which is why finishing a session with a
    // recording felt broken: the row above was already written, but the
    // page sat on "Saving…" until tens of megabytes had transferred.
    // Dropped first, so a discarded take is gone from the queue whether
    // or not the upload that follows ever runs.
    const dropped = [...discardedRef.current]
    for (const id of dropped) {
      try { await deleteClip(id) } catch { /* already gone; nothing to undo */ }
    }

    const clipIds = clipsRef.current
      .map((c) => c.id)
      .filter((id) => !discardedRef.current.has(id))
    if (clipIds.length) {
      const pieceTitle = pieces.find((p) => p.id === pieceId)?.title ?? 'Practice session'
      await assignSession(clipIds, id, {
        date,
        pieceName: pieceTitle,
        notes: thoughts.trim() || undefined,
        category: payload.category,
      })
      void useUploadStore.getState().drain(uid)
    }

    const earned = computeSessionReward({
      sessionsBefore,
      newSession,
      dailyGoalMinutes: Math.round((profile?.weeklyGoalMinutes ?? 300) / 7),
    })

    setSaving(false)
    resetTimer()
    useCategoryTimer.getState().reset()
    // The gesture that started all this is long gone by now — several
    // awaits back — so the context must already be running. It is, because
    // beginFinish() and this handler both unlocked it at tap time, and
    // every gesture in the app re-unlocks. If it somehow is not, the chime
    // no-ops rather than scheduling notes onto a stopped clock, which is
    // how the sound used to vanish with nothing reported.
    playSessionChime(profile?.instrument as InstrumentType | undefined, minutes)
    setReward(earned)
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
            onChange={(e) => {
              // The dropdown listed existing pieces only, so a new account
              // opened it to "What are you working on?" and nothing at all
              // — a dead end you could only leave by abandoning the
              // session, adding a piece in Library, and coming back.
              if (e.target.value === NEW_PIECE) { setAddingPiece(true); return }
              setPieceId(e.target.value)
            }}
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
            <option value={NEW_PIECE}>+ New piece…</option>
          </select>

          <button
            onClick={() => { resetTimer(); useCategoryTimer.getState().reset(); navigate('/student/practice') }}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-90"
            style={{ ...surface, borderRadius: 999, color: 'var(--clay-dim)' }}
            aria-label="Discard session"
            title="Discard session"
          >
            <X size={18} />
          </button>
        </div>

        {/* thoughts */}
        <div className="mb-6 p-4" style={{ ...surface, boxShadow: 'none' }}>
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
            style={{ width: 5, height: 226, marginLeft: -2.5, background: 'var(--clay-bg-deep)' }}
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
            onClick={() => (timerRunning ? pauseTimer() : startTimer())}
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

        {firstEver && !coachSkipped && (
          <SessionCoach used={coachUsed} onSkip={() => setCoachSkipped(true)} />
        )}

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
                        {preparing
                          ? 'Waiting for the mic…'
                          : recording
                            ? 'Recording…'
                            : clips.length ? `${clips.length} clip${clips.length > 1 ? 's' : ''} ready` : 'Capture a take'}
                      </span>
                      <span className="text-[22px] font-semibold tabular-nums" style={{ color: recording ? 'var(--clay-accent)' : 'var(--clay-faint)' }}>
                        {String(Math.floor(recSeconds / 60)).padStart(2, '0')}:{String(recSeconds % 60).padStart(2, '0')}
                      </span>
                    </div>

                    <motion.button
                      onClick={recording ? stopRecording : startRecording}
                      disabled={preparing}
                      whileTap={{ scale: preparing ? 1 : 0.94 }}
                      className="w-full py-3 text-[13px] font-semibold disabled:opacity-80"
                      style={{
                        ...surface,
                        background: recording ? 'var(--clay-danger)' : 'var(--clay-accent)',
                        color: '#fff', boxShadow: 'none',
                      }}
                    >
                      {preparing
                        ? 'Getting ready…'
                        : recording ? 'Stop recording' : 'Start recording'}
                    </motion.button>

                    {/* Said plainly, because a processed recording otherwise
                        sounds like the instrument, the room, or the player. */}
                    {micWarning && (
                      <p className="mt-2.5 text-[11.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>
                        {micWarning}
                      </p>
                    )}

                    {clips.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {/* Named and dropped here, while you can still hear
                            what you are deciding about. Waiting until the
                            session is over means doing it from memory. */}
                        {clips.map((c, i) => (
                          <div key={c.id}>
                            <div className="mb-1 flex items-center gap-2">
                              {renamingClip === c.id ? (
                                <input
                                  autoFocus
                                  value={clipDraft}
                                  aria-label="Name this take"
                                  maxLength={80}
                                  onChange={(e) => setClipDraft(e.target.value)}
                                  onBlur={() => { nameClip(c.id, clipDraft); setRenamingClip(null) }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') { e.preventDefault(); nameClip(c.id, clipDraft); setRenamingClip(null) }
                                    if (e.key === 'Escape') setRenamingClip(null)
                                  }}
                                  className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold outline-none"
                                  style={{ color: 'var(--clay-ink)', borderBottom: '1px solid var(--clay-accent)' }}
                                />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => { setClipDraft(c.title ?? ''); setRenamingClip(c.id) }}
                                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                                  title="Name this take"
                                >
                                  <span className="truncate text-[12px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                                    {c.title?.trim() || clipName(i)}
                                  </span>
                                  <Pencil size={10} className="shrink-0" style={{ color: 'var(--clay-faint)' }} />
                                </button>
                              )}
                              <button
                                type="button"
                                aria-label={`Delete ${c.title?.trim() || clipName(i)}`}
                                onClick={() => setDeletingClip(c)}
                                className="shrink-0"
                                style={{ color: 'var(--clay-faint)' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            {/* Native controls, so no tap of ours to wake audio in —
                                but a session has already woken it to record, so
                                boost only if it is running and otherwise play as
                                before. */}
                            <audio
                              src={c.url}
                              controls
                              className="w-full"
                              style={{ height: 34 }}
                              onPlay={(e) => boost(e.currentTarget, { onlyIfRunning: true })}
                            />
                            {/* Shown only when there is something to report, so
                                it disappears the moment this is fixed rather
                                than becoming another number nobody reads. */}
                            {typeof c.leadIn === 'number' && c.leadIn > 0.25 && (
                              <p className="mt-1 text-[10.5px]" style={{ color: 'var(--clay-danger)' }}>
                                Starts with {c.leadIn.toFixed(1)}s of silence
                                {c.mimeType ? ` · ${c.mimeType}` : ''}
                              </p>
                            )}
                          </div>
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

        {/* Today's assignment target, counting the session in progress —
            without the live figure it would sit frozen for exactly as long
            as someone is practising and looking at it. */}
        <div className="mb-5">
          <DailyToday liveMinutes={Math.floor(elapsedSec / 60)} liveByCategory={liveSplit} compact />
        </div>

        {/* category */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {CATEGORIES.map((c) => {
            const spent = Math.floor((liveSecByCategory[c] ?? 0) / 60)
            return (
              <button
                key={c}
                onClick={() => pickCategory(c)}
                aria-pressed={category === c}
                className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3.5 py-2 text-[12px] font-semibold transition-transform active:scale-95"
                style={{
                  borderRadius: 999,
                  background: category === c ? 'var(--clay-accent-soft)' : 'var(--clay-surface)',
                  color: category === c ? 'var(--clay-accent-ink)' : 'var(--clay-dim)',
                  boxShadow: category === c ? 'none' : 'var(--clay-raised)',
                }}
              >
                {c}
                {/* The split as it forms: every category with a minute in it
                    says how many, so moving on is visibly not losing time. */}
                {spent > 0 && (
                  <span className="tabular-nums" style={{ opacity: 0.75 }}>{spent}m</span>
                )}
              </button>
            )
          })}
        </div>

        {saveError && (
          <p className="mb-3 rounded-2xl px-4 py-3 text-[13px] leading-relaxed" style={{ background: 'var(--clay-danger-bg)', color: 'var(--clay-danger)' }}>
            {saveError}
          </p>
        )}

        {/* finish — becomes a retry/continue pair if takes failed to upload */}
          <motion.button
            onClick={beginFinish}
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
      </div>

      {/* How did that go? One question, three taps. A second question would
          turn the end of a session into a form. Skip keeps the old neutral 7
          so nobody is forced to self-assess to log practice. */}
      <AnimatePresence>
        {askingConfidence && (
          <motion.div
            key="confidence"
            className="fixed inset-0 z-[55] flex items-end justify-center p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <div
              className="absolute inset-0"
              style={{ background: 'rgba(58,48,84,.45)' }}
              onClick={cancelFinish}
            />
            <motion.div
              className="relative w-full max-w-md px-6 py-7"
              style={{ ...surface, borderRadius: 'var(--clay-r-lg)', boxShadow: 'var(--clay-deep)' }}
              initial={{ y: 40, scale: 0.97 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <p className="text-center text-[19px] font-bold" style={{ color: 'var(--clay-ink)' }}>
                How did that go?
              </p>
              <p className="mt-1 text-center text-[13px]" style={{ color: 'var(--clay-dim)' }}>
                {mm}:{ss} of practice{pieceId ? ` · ${activePieces.find((p) => p.id === pieceId)?.title ?? ''}` : ''}
              </p>

              {/* Asked rather than assumed. Changing the category is a tap;
                  finding out a week later that nothing counted is not. */}
              {missed.map((a) => (
                <div
                  key={a.id}
                  className="mt-4 px-3.5 py-3"
                  style={{ background: 'var(--clay-warning-bg)', borderRadius: 'var(--clay-r-sm)' }}
                >
                  <p className="text-[12.5px] font-semibold" style={{ color: 'var(--clay-warning-fg)' }}>
                    This won't count toward "{a.title}"
                  </p>
                  <p className="mt-0.5 text-[12px]" style={{ color: 'var(--clay-ink)' }}>
                    That one asks for {a.category}; you've logged this as {category}.
                  </p>
                  <button
                    onClick={() => relabelSession(a.category as PracticeCategory)}
                    className="mt-2 rounded-full px-3 py-1.5 text-[12px] font-semibold"
                    style={{ background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }}
                  >
                    It was {a.category}
                  </button>
                </div>
              ))}

              {/* What to keep, asked once, here — rather than uploading
                  everything and leaving you to delete the bad takes
                  afterwards. An unticked take never leaves the device. */}
              {clips.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
                    Keep {clips.length === 1 ? 'this take' : 'these takes'}?
                  </p>
                  <div className="space-y-1.5">
                    {clips.map((c, i) => {
                      const keep = !discarded.has(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={keep}
                          onClick={() => {
                            setDiscarded((prev) => {
                              const next = new Set(prev)
                              if (next.has(c.id)) next.delete(c.id)
                              else next.add(c.id)
                              discardedRef.current = next
                              return next
                            })
                          }}
                          className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-opacity"
                          style={{
                            borderRadius: 'var(--clay-r-sm)',
                            background: 'var(--clay-bg)',
                            opacity: keep ? 1 : 0.5,
                          }}
                        >
                          <span
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                            style={{
                              background: keep ? 'var(--clay-accent)' : 'transparent',
                              border: keep ? 'none' : '1.5px solid var(--clay-faint)',
                              color: 'var(--clay-on-accent)',
                            }}
                          >
                            {keep && <Check size={13} strokeWidth={3} />}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                            {c.title?.trim() || clipName(i)}
                          </span>
                          <span
                            className="shrink-0 text-[11.5px] tabular-nums"
                            style={{ color: keep ? 'var(--clay-dim)' : 'var(--clay-faint)' }}
                          >
                            {keep ? `${Math.round(c.seconds)}s` : 'discard'}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mt-5 space-y-2.5">
                {CONFIDENCE_CHOICES.map((c) => (
                  <motion.button
                    key={c.value}
                    onClick={() => void finish(c.value)}
                    disabled={saving}
                    whileTap={{ scale: 0.97 }}
                    className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left"
                    style={{
                      borderRadius: 'var(--clay-r-md)',
                      background: 'var(--clay-bg)',
                      color: 'var(--clay-ink)',
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: c.tint }}
                    >
                      <Sticker name={c.sticker} size={18} tone="onAccent" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{c.label}</span>
                      <span className="block text-[12px]" style={{ color: 'var(--clay-dim)' }}>{c.hint}</span>
                    </span>
                  </motion.button>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-center gap-5">
                <button
                  onClick={() => void finish(7)}
                  disabled={saving}
                  className="text-[13px] font-semibold"
                  style={{ color: 'var(--clay-faint)' }}
                >
                  Skip
                </button>
                <span style={{ color: 'var(--clay-faint)' }}>·</span>
                <button
                  onClick={cancelFinish}
                  disabled={saving}
                  className="text-[13px] font-semibold"
                  style={{ color: 'var(--clay-faint)' }}
                >
                  Keep practising
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asked here rather than sending you to Library: the whole point
          is not to leave a running session to answer it. */}
      <Modal open={addingPiece} onClose={() => setAddingPiece(false)} title="What are you playing?" size="sm">
        <Input
          label="Piece"
          placeholder="Ballade No. 1"
          value={newPieceTitle}
          autoFocus
          onChange={(e) => setNewPieceTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void createPiece() } }}
          hint="You can add the composer and a target date later, in Library."
        />
        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setAddingPiece(false)}>
            Cancel
          </Button>
          <Button className="flex-1" loading={addingBusy} disabled={!newPieceTitle.trim()} onClick={() => void createPiece()}>
            Add it
          </Button>
        </div>
      </Modal>

      <ConfirmSheet
        open={!!deletingClip}
        title="Delete this take?"
        body={deletingClip
          ? `“${deletingClip.title?.trim() || 'This take'}” has not been saved yet, so it will be gone the moment you confirm.`
          : undefined}
        onCancel={() => setDeletingClip(null)}
        onConfirm={() => { if (deletingClip) removeClip(deletingClip); setDeletingClip(null) }}
      />

      <SessionCelebration
        reward={reward}
        instrument={profile?.instrument as InstrumentType | undefined}
        onDismiss={() => { setReward(null); navigate('/student/practice') }}
        onShare={justSaved ? () => { setReward(null); setSharing(justSaved) } : undefined}
      />

      <AnimatePresence>
        {sharing && (
          <ShareSheet
            session={sharing}
            profile={{ displayName: profile?.displayName ?? '' }}
            streakDays={shareStreak}
            pieceTitle={pieces.find((p) => p.id === sharing.pieceName)?.title}
            week={shareWeek}
            // Closing the card is the end of the session either way.
            onClose={() => { setSharing(null); navigate('/student/practice') }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
