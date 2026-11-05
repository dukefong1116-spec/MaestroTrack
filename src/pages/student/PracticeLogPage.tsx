import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AnimatePresence, motion } from 'framer-motion'
import { Share2, Trash2, ChevronRight } from 'lucide-react'
import { format, parseISO, subDays } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import ShareSheet from '@/components/share/ShareSheet'
import { addPracticeSession, deletePracticeSession } from '@/lib/firebase/practice'
import { computeStreak } from '@/lib/utils/analytics'
import { computeSessionReward, type SessionReward } from '@/lib/utils/gamification'
import { playSessionChime, primeAudioContext } from '@/lib/utils/sound'
import SessionCelebration from '@/components/celebration/SessionCelebration'
import NudgeList from '@/components/common/NudgeList'
import { usePracticeNudges } from '@/hooks/usePracticeNudges'
import { Panel, Block } from '@/components/ui/Panel'
import DailyToday from '@/components/assignments/DailyToday'
import { useAssignments } from '@/hooks/useAssignments'
import { isDailyToday } from '@/lib/utils/assignments'
import Sticker from '@/components/stickers/Sticker'
import TakePlayer from '@/components/recordings/TakePlayer'
import { deleteRecording, renameRecording } from '@/lib/firebase/recordings'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
import type { PracticeCategory, InstrumentType, PracticeSession, Piece, Recording } from '@/types'

const CATEGORIES: PracticeCategory[] = [
  'Scales', 'Technique', 'Sight Reading', 'Repertoire', 'Memorization', 'Ear Training', 'Improvisation',
]

const schema = z.object({
  date: z.string(),
  durationMinutes: z.coerce.number().min(1).max(600),
  category: z.enum(['Scales','Technique','Sight Reading','Repertoire','Memorization','Ear Training','Improvisation'] as [PracticeCategory, ...PracticeCategory[]]),
  pieceName: z.string().optional(),
  difficultyRating: z.coerce.number().min(1).max(5),
  confidenceRating: z.coerce.number().min(1).max(10),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

/**
 * The metronome glyph is a triangle — at 22px it reads as a warning sign,
 * so it's reserved for the large Start Session button where it's legible.
 */
const CATEGORY_STICKER: Record<PracticeCategory, 'note' | 'pencil' | 'clock'> = {
  Scales: 'note',
  Technique: 'clock',
  'Sight Reading': 'pencil',
  Repertoire: 'note',
  Memorization: 'clock',
  'Ear Training': 'note',
  Improvisation: 'note',
}

/** Read-only view of one logged session: its data, notes and any takes. */
function SessionDetailSheet({
  session, pieces, recordings, deleting, onDelete, onShare, onClose,
}: {
  session: PracticeSession | null
  pieces: Piece[]
  recordings: Recording[]
  deleting: boolean
  onDelete: () => void
  onShare: () => void
  onClose: () => void
}) {
  if (!session) return null
  const title = pieces.find((p) => p.id === session.pieceName)?.title ?? session.pieceName

  const stats = [
    { label: 'Duration', value: `${session.durationMinutes} min` },
    { label: 'Difficulty', value: `${session.difficultyRating}/5` },
    { label: 'Confidence', value: `${session.confidenceRating}/10` },
  ]

  return (
    <Modal open onClose={onClose} title={format(parseISO(session.date), 'EEEE, MMM d')}>
      <div style={{ fontFamily: 'var(--clay-font)', color: 'var(--clay-ink)' }}>

        <div className="mb-4 flex items-center gap-3">
          <Sticker name={CATEGORY_STICKER[session.category] ?? 'note'} size={26} tone="accent" />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{title || session.category}</p>
            <p className="text-[12px]" style={{ color: 'var(--clay-dim)' }}>{session.category}</p>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2.5">
          {stats.map((s) => (
            <div key={s.label} className="px-3 py-2.5 text-center" style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)' }}>
              <p className="text-[15px] font-semibold tabular-nums">{s.value}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[.08em]" style={{ color: 'var(--clay-dim)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* notes, in the same hand as the session's thoughts pad */}
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
          Notes
        </p>
        <div
          className="mb-5 px-3.5 py-3"
          style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)', minHeight: 62 }}
        >
          {session.notes ? (
            <p style={{ fontFamily: 'var(--clay-hand)', fontSize: 19, lineHeight: '26px' }}>{session.notes}</p>
          ) : (
            <p className="text-[12.5px]" style={{ color: 'var(--clay-faint)' }}>Nothing written down for this one.</p>
          )}
        </div>

        {/* takes captured during the session */}
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em]" style={{ color: 'var(--clay-dim)' }}>
          Recordings {recordings.length > 0 && <span>({recordings.length})</span>}
        </p>
        {recordings.length === 0 ? (
          <p className="mb-5 text-[12.5px]" style={{ color: 'var(--clay-faint)' }}>
            No takes recorded during this session.
          </p>
        ) : (
          <div className="mb-5 space-y-2.5">
            {/* Oldest first, so "Take 1" is the one recorded first. Every take
                otherwise carried the same fallback name and they were
                impossible to tell apart. */}
            {[...recordings]
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
              .map((r, i) => (
                <TakePlayer
                  key={r.id}
                  src={r.audioUrl}
                  label={r.title?.trim() || `Take ${i + 1}`}
                  storedDuration={r.duration}
                  onRename={(title) => { void renameRecording(r.id, title) }}
                  onDelete={() => { void deleteRecording(r.id, r.audioUrl) }}
                />
              ))}
          </div>
        )}

        <div className="flex gap-2">
          {/* Sharing lives here rather than in the finishing flow on
              purpose: a modal demanding to be dismissed at the end of
              every session is a tax on practising, and this is reachable
              for any session, not only the newest one. */}
          <Button variant="primary" onClick={onShare} className="flex-1">
            <Share2 size={15} /> Share
          </Button>
          <Button variant="secondary" onClick={onDelete} loading={deleting} className="flex-1">
            <Trash2 size={15} /> Delete
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default function PracticeLogPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()

  const { sessions, pieces, recordings, addSession, timerRunning, resetTimer } = usePracticeStore()
  const [sharing, setSharing] = useState<PracticeSession | null>(null)

  /**
   * The two figures the card needs beyond the session itself. Derived
   * here from the same session log everything else reads, so a shared
   * card can never disagree with the streak on screen.
   */
  const shareStreak = useMemo(() => computeStreak(sessions).current, [sessions])
  const shareWeek = useMemo(() => {
    if (!sharing) return undefined
    const end = parseISO(sharing.date)
    return Array.from({ length: 7 }, (_, i) => {
      const day = format(subDays(end, 6 - i), 'yyyy-MM-dd')
      return sessions
        .filter((s) => s.date === day)
        .reduce((total, s) => total + s.durationMinutes, 0)
    })
  }, [sessions, sharing])

  const [open, setOpen] = useState(false)
  const [detail, setDetail] = useState<PracticeSession | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [reward, setReward] = useState<SessionReward | null>(null)
  const [saveError, setSaveError] = useState('')

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      durationMinutes: 30,
      difficultyRating: 3,
      confidenceRating: 7,
    },
  })

  const { current: streak } = useMemo(() => computeStreak(sessions), [sessions])

  /** Mon-first array of the last 7 days, flagged where practice happened. */
  // NudgeList renders null when it has nothing to say, so the Block
  // around it has to ask the same question or it draws an empty rule.
  const nudges = usePracticeNudges(1)
  const showNudge = profile?.notify?.nudges !== false && nudges.length > 0
  // Both of these render null when empty, so the panel around them has to
  // ask the same questions or it draws an empty box.
  const { open: openAssignments } = useAssignments()
  const hasDaily = openAssignments.some(isDailyToday)

  const week = useMemo(() => {
    const minutes: Record<string, number> = {}
    for (const s of sessions) {
      const key = s.date.substring(0, 10)
      minutes[key] = (minutes[key] ?? 0) + s.durationMinutes
    }
    const today = format(new Date(), 'yyyy-MM-dd')
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = format(d, 'yyyy-MM-dd')
      const mins = minutes[key] ?? 0
      return { key, label: format(d, 'EEEEE'), done: mins > 0, minutes: mins, isToday: key === today }
    })
  }, [sessions])

  /** The tallest bar sets the scale; a flat week should not look empty. */
  const weekPeak = useMemo(() => Math.max(30, ...week.map((d) => d.minutes)), [week])
  const weekTotal = useMemo(() => week.reduce((a, d) => a + d.minutes, 0), [week])

  const grouped = useMemo(() => {
    const map: Record<string, typeof sessions> = {}
    for (const s of sessions) {
      const key = s.date.substring(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [sessions])

  async function onSubmit(data: FormData) {
    primeAudioContext()

    const uid = profile?.uid ?? user?.uid
    if (!uid) return
    const sessionsBefore = sessions

    let id: string
    try {
      setSaveError('')
      id = await addPracticeSession(uid, data)
    } catch {
      setSaveError('Could not save the session. Check your connection and try again.')
      return
    }

    const newSession = { id, userId: uid, createdAt: new Date().toISOString(), ...data } as PracticeSession
    addSession(newSession as never)

    // Piece totals are derived from the session log (see derivePieceStats),
    // so there are no counters to increment here. That's deliberate: the
    // old increments were never reverted when a session was deleted.

    const earned = computeSessionReward({
      sessionsBefore,
      newSession,
      dailyGoalMinutes: Math.round((profile?.weeklyGoalMinutes ?? 300) / 7),
    })
    if (earned.streakState !== 'backdated') {
      playSessionChime(profile?.instrument as InstrumentType | undefined, earned.minutes)
    }

    reset()
    resetTimer()
    setOpen(false)
    setReward(earned)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try { await deletePracticeSession(id) } finally { setDeleting(null) }
  }

  return (
    <div
      className="-mx-6 -my-8 min-h-full px-5 pb-12 pt-7"
      style={{ background: 'var(--clay-bg)', fontFamily: 'var(--clay-font)', color: 'var(--clay-ink)' }}
    >
      <div className="mx-auto w-full max-w-md">

        {/* heading, with the exception tucked beside it */}
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[27px] font-semibold leading-tight">Practice</h1>
            <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>
              {format(new Date(), 'EEEE')} · let's get after it
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => setOpen(true)}>
            <Sticker name="pencil" size={14} tone="accent" /> Log past
          </Button>
        </div>

        {/* session in progress */}
        {timerRunning && (
          <button
            type="button"
            onClick={() => navigate('/student/session')}
            className="mb-4 flex w-full items-center gap-3 px-4 py-3.5 text-left"
            style={{
              borderRadius: 'var(--clay-r-md)',
              background: 'var(--clay-accent)',
              boxShadow: 'var(--clay-accent-shadow)',
              color: 'var(--clay-on-accent)',
            }}
          >
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-white" />
            </span>
            <span className="text-[13px] font-semibold">Session in progress</span>
            <span className="ml-auto text-[13px] font-semibold opacity-90">Resume →</span>
          </button>
        )}

        {/* Anything asking for your attention, before the doing. Renders
            nothing at all when there is nothing to say. */}
        {(showNudge || hasDaily) && (
          <Panel className="mb-5">
            {showNudge && (
              <Block first>
                <NudgeList limit={1} />
              </Block>
            )}
            <DailyToday compact />
          </Panel>
        )}

        {/* The doing, then the week it adds up to. */}
        <Panel className="mb-6">
          <Block first>
            <button
              type="button"
              onClick={() => navigate('/student/session')}
              className="flex min-h-[72px] w-full items-center justify-center gap-3 text-[19px] font-bold transition-transform active:scale-[.99]"
              style={{
                borderRadius: 'var(--clay-r-sm)',
                background: 'var(--clay-accent)',
                color: 'var(--clay-on-accent)',
                boxShadow: 'var(--clay-accent-shadow)',
              }}
            >
              <Sticker name="metro" size={26} tone="onAccent" /> Start session
            </button>
          </Block>

          {/* The shape of the week, which no other screen shows: a number
              says how much, this says when. */}
          <Block>
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
                Last seven days
              </p>
              <p className="text-[12.5px]" style={{ color: 'var(--clay-faint)' }}>
                {Math.round(weekTotal / 7)} min/day
              </p>
            </div>

            <div className="grid h-[96px] items-end gap-[7px]" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {week.map((d) => (
                <div key={d.key} className="flex h-full flex-col items-center justify-end gap-1.5">
                  <span
                    className="text-[10px] tabular-nums"
                    style={{ color: d.isToday ? 'var(--clay-accent-ink)' : 'var(--clay-faint)', fontWeight: d.isToday ? 600 : 400 }}
                  >
                    {d.minutes > 0 ? d.minutes : ''}
                  </span>
                  <div
                    className="w-full transition-all duration-700"
                    style={{
                      // A day with nothing still gets a sliver, so the
                      // column reads as empty rather than as missing.
                      height: d.minutes > 0 ? `${Math.max(6, (d.minutes / weekPeak) * 72)}px` : '3px',
                      borderRadius: '5px 5px 0 0',
                      // One series, today emphasised — a dimmed accent
                      // rather than a second colour. --clay-bg-deep was
                      // within a few points of the panel on dark, so the
                      // bars were there and invisible.
                      background: d.minutes > 0 ? 'var(--clay-accent)' : 'var(--clay-line)',
                      opacity: d.minutes === 0 || d.isToday ? 1 : 0.4,
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="mt-2 grid gap-[7px] text-center" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
              {week.map((d) => (
                <span
                  key={d.key}
                  className="text-[10.5px]"
                  style={{ color: d.isToday ? 'var(--clay-accent-ink)' : 'var(--clay-faint)', fontWeight: d.isToday ? 600 : 400 }}
                >
                  {d.label}
                </span>
              ))}
            </div>
          </Block>

          <Block>
            <div className="flex items-center gap-2.5">
              <Sticker name="flame" size={18} tone="accent" />
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
                {streak > 0 ? `${streak} ${streak === 1 ? 'day' : 'days'}` : 'Start one today'}
              </span>
              <span className="shrink-0 text-[12.5px]" style={{ color: 'var(--clay-faint)' }}>
                {weekTotal} min this week
              </span>
            </div>
          </Block>
        </Panel>

        {/* history */}
        {grouped.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Sticker name="note" size={46} tone="accent" className="mx-auto mb-3" />
            <p className="text-[15px] font-semibold">No sessions yet</p>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--clay-dim)' }}>
              Hit Start Session and the clock does the rest.
            </p>
          </div>
        ) : (
          <Panel>
            <div className="flex items-baseline justify-between px-5 pb-2.5 pt-3.5">
              <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clay-dim)' }}>
                Recent
              </p>
              <p className="text-[12px]" style={{ color: 'var(--clay-faint)' }}>
                {sessions.length} session{sessions.length === 1 ? '' : 's'}
              </p>
            </div>
            {grouped.map(([date, day]) => (
              <div key={date}>

                <div>
                  {day.map((s, si) => {
                    const title = pieces.find((p) => p.id === s.pieceName)?.title ?? s.pieceName
                    const clipCount = recordings.filter((r) => r.sessionId === s.id).length
                    return (
                      <motion.button
                        key={s.id}
                        onClick={() => setDetail(s)}
                        whileTap={{ scale: 0.98 }}
                        className="flex w-full items-center gap-3.5 px-5 py-3 text-left"
                        style={{ borderTop: '1px solid var(--clay-line)' }}
                      >
                        {/* The date rides the row rather than a tinted strip
                            above it; only the first row of a day carries it,
                            so a day still reads as a group. */}
                        <span className="w-[34px] shrink-0 text-center">
                          {si === 0 && (
                            <>
                              <span className="block text-[10px] uppercase tracking-[.08em]" style={{ color: 'var(--clay-faint)' }}>
                                {format(parseISO(date), 'EEE')}
                              </span>
                              <span className="block text-[15px] font-semibold leading-tight">
                                {format(parseISO(date), 'd')}
                              </span>
                            </>
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold capitalize">{title || s.category}</p>
                          <p className="flex items-center gap-1.5 text-[11.5px]" style={{ color: 'var(--clay-dim)' }}>
                            {clipCount > 0 && (
                              <span className="inline-flex shrink-0 items-center gap-1">
                                <Sticker name="mic" size={11} tone="accent" /> {clipCount} ·
                              </span>
                            )}
                            <span className="truncate">{s.notes || s.category}</span>
                          </p>
                        </div>
                        <span className="shrink-0 text-[13px] font-semibold" style={{ color: 'var(--clay-accent-ink)' }}>
                          {s.durationMinutes}m
                        </span>
                        <ChevronRight size={15} style={{ color: 'var(--clay-faint)' }} className="shrink-0" />
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            ))}
          </Panel>
        )}
      </div>

      <SessionDetailSheet
        session={detail}
        pieces={pieces}
        recordings={recordings.filter((r) => detail && r.sessionId === detail.id)}
        deleting={deleting === detail?.id}
        onDelete={async () => {
          if (!detail) return
          await handleDelete(detail.id)
          setDetail(null)
        }}
        onShare={() => setSharing(detail)}
        onClose={() => setDetail(null)}
      />

      <AnimatePresence>
        {sharing && (
          <ShareSheet
            session={sharing}
            profile={{ displayName: profile?.displayName ?? '' }}
            streakDays={shareStreak}
            pieceTitle={pieces.find((p) => p.id === sharing.pieceName)?.title}
            week={shareWeek}
            onClose={() => setSharing(null)}
          />
        )}
      </AnimatePresence>

      <SessionCelebration
        reward={reward}
        instrument={profile?.instrument as InstrumentType | undefined}
        onDismiss={() => setReward(null)}
      />

      <Modal open={open} onClose={() => { setOpen(false); setSaveError('') }} title="Log Practice Session">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {saveError && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'var(--clay-accent-soft)', border: 'none', color: 'var(--clay-danger)' }}>
              {saveError}
            </div>
          )}
          <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
          <Input label="Duration (minutes)" type="number" placeholder="30" error={errors.durationMinutes?.message} {...register('durationMinutes')} />
          <Select
            label="Category"
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            placeholder="Select category"
            error={errors.category?.message}
            {...register('category')}
          />
          <Select
            label="Piece (optional)"
            options={[
              { value: '', label: '— None —' },
              ...pieces.filter((p) => p.status === 'active').map((p) => ({ value: p.id, label: p.title })),
            ]}
            {...register('pieceName')}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--clay-faint)]">Difficulty (1–5)</label>
              <input type="range" min={1} max={5} step={1} className="w-full accent-[var(--clay-accent)]" {...register('difficultyRating')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[var(--clay-faint)]">Confidence (1–10)</label>
              <input type="range" min={1} max={10} step={1} className="w-full accent-[var(--clay-accent)]" {...register('confidenceRating')} />
            </div>
          </div>
          <Textarea label="Notes (optional)" placeholder="What went well? What needs work?" {...register('notes')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Save Session</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
