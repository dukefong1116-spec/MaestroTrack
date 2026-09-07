import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Trash2, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { addPracticeSession, deletePracticeSession } from '@/lib/firebase/practice'
import { updatePiece } from '@/lib/firebase/pieces'
import { computeStreak } from '@/lib/utils/analytics'
import { computeSessionReward, type SessionReward } from '@/lib/utils/gamification'
import { playSessionChime, primeAudioContext } from '@/lib/utils/sound'
import SessionCelebration from '@/components/celebration/SessionCelebration'
import Sticker from '@/components/stickers/Sticker'
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

const surface: React.CSSProperties = {
  background: 'var(--clay-surface)',
  borderRadius: 'var(--clay-r-md)',
  boxShadow: 'var(--clay-raised)',
}

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
  session, pieces, recordings, deleting, onDelete, onClose,
}: {
  session: PracticeSession | null
  pieces: Piece[]
  recordings: Recording[]
  deleting: boolean
  onDelete: () => void
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
            {recordings.map((r) => (
              <div key={r.id} className="px-3.5 py-3" style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-sm)' }}>
                <div className="mb-2 flex items-center gap-2">
                  <Sticker name="mic" size={16} tone="accent" />
                  <span className="truncate text-[12.5px] font-semibold">{r.pieceName}</span>
                  {r.duration != null && (
                    <span className="ml-auto shrink-0 text-[11px] tabular-nums" style={{ color: 'var(--clay-dim)' }}>
                      {String(Math.floor(r.duration / 60)).padStart(2, '0')}:{String(r.duration % 60).padStart(2, '0')}
                    </span>
                  )}
                </div>
                <audio src={r.audioUrl} controls preload="none" className="w-full" style={{ height: 34 }} />
              </div>
            ))}
          </div>
        )}

        <Button variant="secondary" onClick={onDelete} loading={deleting} className="w-full">
          <Trash2 size={15} /> Delete session
        </Button>
      </div>
    </Modal>
  )
}

export default function PracticeLogPage() {
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const { sessions, pieces, recordings, addSession, timerRunning, resetTimer } = usePracticeStore()

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
  const week = useMemo(() => {
    const days = new Set(sessions.map((s) => s.date.substring(0, 10)))
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      const key = format(d, 'yyyy-MM-dd')
      return { key, label: format(d, 'EEEEE'), done: days.has(key) }
    })
  }, [sessions])

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

    if (data.pieceName) {
      const piece = pieces.find((p) => p.id === data.pieceName)
      if (piece) {
        const history = [...(piece.confidenceHistory ?? []), { date: data.date, value: data.confidenceRating }]
        const avg = history.reduce((sum, h) => sum + h.value, 0) / history.length
        updatePiece(piece.id, {
          totalMinutes: piece.totalMinutes + data.durationMinutes,
          sessionCount: piece.sessionCount + 1,
          confidenceHistory: history,
          completionPercentage: Math.min(100, Math.round(avg * 10)),
          updatedAt: new Date().toISOString(),
        }).catch(() => {})
      }
    }

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
      className="-mx-6 -my-8 min-h-screen px-5 pb-12 pt-7"
      style={{ background: 'var(--clay-bg)', fontFamily: 'var(--clay-font)', color: 'var(--clay-ink)' }}
    >
      <div className="mx-auto w-full max-w-md">

        {/* heading */}
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <h1 className="text-[27px] font-semibold leading-tight">Practice</h1>
          <p className="text-[13px]" style={{ color: 'var(--clay-dim)' }}>
            {format(new Date(), 'EEEE')} · let's get after it
          </p>
        </motion.div>

        {/* session in progress */}
        {timerRunning && (
          <motion.button
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
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
          </motion.button>
        )}

        {/* streak */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="mb-5 flex items-center gap-3 px-4 py-3.5"
          style={{ ...surface, background: 'var(--clay-accent-soft)', boxShadow: 'none' }}
        >
          <Sticker name="flame" size={24} tone="accent" />
          <div className="min-w-0">
            <p className="text-[17px] font-semibold leading-none" style={{ color: 'var(--clay-accent-ink)' }}>
              {streak} {streak === 1 ? 'day' : 'days'}
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--clay-dim)' }}>
              {streak > 0 ? 'keep it lit' : 'start one today'}
            </p>
          </div>
          <div className="ml-auto flex gap-1.5">
            {week.map((d) => (
              <span
                key={d.key}
                title={d.key}
                className="block rounded-full"
                style={{
                  width: 9, height: 9,
                  background: d.done ? 'var(--clay-accent)' : 'rgba(58,48,84,.14)',
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* the two chunks */}
        <div className="mb-7 grid grid-cols-2 gap-3.5">
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 300, damping: 22 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => navigate('/student/session')}
            className="flex flex-col items-center px-3 pb-4 pt-5 text-center"
            style={{
              borderRadius: 'var(--clay-r-lg)',
              background: 'var(--clay-accent)',
              boxShadow: 'var(--clay-accent-shadow)',
              color: 'var(--clay-on-accent)',
            }}
          >
            <Sticker name="metro" size={40} tone="onAccent" />
            <span className="mt-2.5 text-[16px] font-semibold leading-tight">Start<br />Session</span>
            <span className="mt-1.5 text-[10.5px] leading-snug opacity-90">
              timer · metronome<br />tuner · record
            </span>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, type: 'spring', stiffness: 300, damping: 22 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setOpen(true)}
            className="flex flex-col items-center px-3 pb-4 pt-5 text-center"
            style={{ ...surface, borderRadius: 'var(--clay-r-lg)' }}
          >
            <Sticker name="pencil" size={40} tone="accent" />
            <span className="mt-2.5 text-[16px] font-semibold leading-tight">Log It<br />Manually</span>
            <span className="mt-1.5 text-[10.5px] leading-snug" style={{ color: 'var(--clay-dim)' }}>
              already<br />practiced?
            </span>
          </motion.button>
        </div>

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
          <div className="space-y-6">
            {grouped.map(([date, day], gi) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + gi * 0.04 }}
              >
                <div className="mb-2.5 flex items-baseline gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[.1em]" style={{ color: 'var(--clay-dim)' }}>
                    {format(parseISO(date), 'EEE, MMM d')}
                  </p>
                  <span className="text-[11px] font-semibold" style={{ color: 'var(--clay-faint)' }}>
                    {day.reduce((s, x) => s + x.durationMinutes, 0)} min
                  </span>
                </div>

                <div className="space-y-2.5">
                  {day.map((s) => {
                    const title = pieces.find((p) => p.id === s.pieceName)?.title ?? s.pieceName
                    const clipCount = recordings.filter((r) => r.sessionId === s.id).length
                    return (
                      <motion.button
                        key={s.id}
                        onClick={() => setDetail(s)}
                        whileTap={{ scale: 0.98 }}
                        className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                        style={surface}
                      >
                        <Sticker name={CATEGORY_STICKER[s.category] ?? 'note'} size={22} tone="accent" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold">{title || s.category}</p>
                          <p className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--clay-dim)' }}>
                            {s.category}
                            {clipCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                · <Sticker name="mic" size={11} tone="accent" /> {clipCount}
                              </span>
                            )}
                            {s.notes && <span className="truncate">· {s.notes}</span>}
                          </p>
                        </div>
                        <span
                          className="shrink-0 px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            borderRadius: 999,
                            background: 'var(--clay-accent-soft)',
                            color: 'var(--clay-accent-ink)',
                          }}
                        >
                          {s.durationMinutes}m
                        </span>
                        <ChevronRight size={15} style={{ color: 'var(--clay-faint)' }} className="shrink-0" />
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>
            ))}
          </div>
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
        onClose={() => setDetail(null)}
      />

      <SessionCelebration
        reward={reward}
        instrument={profile?.instrument as InstrumentType | undefined}
        onDismiss={() => setReward(null)}
      />

      <Modal open={open} onClose={() => { setOpen(false); setSaveError('') }} title="Log Practice Session">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {saveError && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FEF0EE', border: '1px solid #FDDDD9', color: '#C0392B' }}>
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
              <label className="text-sm font-medium text-[#A09C95]">Difficulty (1–5)</label>
              <input type="range" min={1} max={5} step={1} className="w-full accent-[#E8503A]" {...register('difficultyRating')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-[#A09C95]">Confidence (1–10)</label>
              <input type="range" min={1} max={10} step={1} className="w-full accent-[#E8503A]" {...register('confidenceRating')} />
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
