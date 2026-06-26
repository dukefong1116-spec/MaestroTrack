import { useState, useMemo } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Plus, Trash2, Clock, Music2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { addPracticeSession, deletePracticeSession } from '@/lib/firebase/practice'
import { updatePiece } from '@/lib/firebase/pieces'
import { getTheme } from '@/lib/utils/instruments'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/common/EmptyState'
import type { PracticeCategory, InstrumentType } from '@/types'

const CATEGORIES: PracticeCategory[] = [
  'Scales', 'Technique', 'Sight Reading', 'Repertoire', 'Memorization', 'Ear Training', 'Improvisation'
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

export default function PracticeLogPage() {
  const { profile, user } = useAuth()
  const { sessions, pieces, addSession } = usePracticeStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      durationMinutes: 30,
      difficultyRating: 3,
      confidenceRating: 7,
    }
  })

  async function onSubmit(data: FormData) {
    const uid = profile?.uid ?? user?.uid
    if (!uid) return
    const id = await addPracticeSession(uid, data)

    // Optimistically add to local store so it shows immediately
    addSession({ id, userId: uid, createdAt: new Date().toISOString(), ...data } as never)

    // Update piece stats if pieceName is given
    if (data.pieceName) {
      const piece = pieces.find((p) => p.title.toLowerCase() === data.pieceName!.toLowerCase())
      if (piece) {
        const newConfidenceHistory = [...(piece.confidenceHistory ?? []), { date: data.date, value: data.confidenceRating }]
        updatePiece(piece.id, {
          totalMinutes: piece.totalMinutes + data.durationMinutes,
          sessionCount: piece.sessionCount + 1,
          confidenceHistory: newConfidenceHistory,
          updatedAt: new Date().toISOString(),
        }).catch(() => {})
      }
    }

    reset()
    setOpen(false)
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try { await deletePracticeSession(id) } finally { setDeleting(null) }
  }

  const grouped = useMemo(() => {
    const map: Record<string, typeof sessions> = {}
    for (const s of sessions) {
      const key = s.date.substring(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(s)
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a))
  }, [sessions])

  const categoryColors: Record<PracticeCategory, string> = {
    Scales: 'info', Technique: 'purple', 'Sight Reading': 'success',
    Repertoire: 'warning', Memorization: 'danger', 'Ear Training': 'info', Improvisation: 'success',
  } as Record<PracticeCategory, 'info' | 'purple' | 'success' | 'warning' | 'danger'>

  return (
    <div>
      <PageHeader
        title="Practice Log"
        subtitle="Every session counts. Track your musical journey."
        actions={<Button onClick={() => setOpen(true)} size="md"><Plus size={16} /> Log Session</Button>}
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={<Music2 size={40} />}
          title="No practice sessions yet"
          description="Start logging your practice to track progress and build momentum."
          action={{ label: 'Log Your First Session', onClick: () => setOpen(true) }}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, daySessions]) => (
            <motion.div key={date} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-sm font-semibold text-slate-300">{format(parseISO(date), 'EEEE, MMMM d')}</p>
                <div className="flex-1 h-px bg-slate-800" />
                <p className="text-xs text-slate-500">{daySessions.reduce((s, x) => s + x.durationMinutes, 0)} min</p>
              </div>
              <div className="space-y-2">
                {daySessions.map((session) => (
                  <Card key={session.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant={categoryColors[session.category] as 'info'} size="sm">{session.category}</Badge>
                          {session.pieceName && (
                            <span className="text-xs text-slate-300 font-medium">"{session.pieceName}"</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-2">
                          <span className="flex items-center gap-1"><Clock size={12} />{session.durationMinutes} min</span>
                          <span>Difficulty: {session.difficultyRating}/5</span>
                          <span>Confidence: {session.confidenceRating}/10</span>
                        </div>
                        {session.notes && <p className="text-xs text-slate-400 mt-2 italic">"{session.notes}"</p>}
                      </div>
                      <button
                        onClick={() => handleDelete(session.id)}
                        disabled={deleting === session.id}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1 shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Log Practice Session">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
          <Input label="Duration (minutes)" type="number" placeholder="30" error={errors.durationMinutes?.message} {...register('durationMinutes')} />
          <Select
            label="Category"
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
            placeholder="Select category"
            error={errors.category?.message}
            {...register('category')}
          />
          <Input label="Piece Name (optional)" placeholder="Beethoven Sonata No. 14" {...register('pieceName')} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Difficulty (1–5)</label>
              <input type="range" min={1} max={5} step={1} className="w-full accent-indigo-500" {...register('difficultyRating')} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-300">Confidence (1–10)</label>
              <input type="range" min={1} max={10} step={1} className="w-full accent-indigo-500" {...register('confidenceRating')} />
            </div>
          </div>
          <Textarea label="Notes (optional)" placeholder="What went well? What needs work?" {...register('notes')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting} style={{ backgroundColor: theme.primary }}>Save Session</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
