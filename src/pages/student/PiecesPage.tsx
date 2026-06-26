import { useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Plus, BookOpen, Archive, Star, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { addPiece, updatePiece, deletePiece } from '@/lib/firebase/pieces'
import { getTheme } from '@/lib/utils/instruments'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/common/EmptyState'
import type { InstrumentType, Piece } from '@/types'

const schema = z.object({
  title: z.string().min(1, 'Title required'),
  composer: z.string().optional(),
  difficulty: z.coerce.number().min(1).max(5),
  targetDate: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function PiecesPage() {
  const { profile, user } = useAuth()
  const { pieces, addPiece: addPieceToStore } = usePracticeStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'active' | 'archived' | 'mastered'>('active')
  const [selected, setSelected] = useState<Piece | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { difficulty: 3 }
  })

  async function onSubmit(data: FormData) {
    const uid = profile?.uid ?? user?.uid
    if (!uid) return
    const pieceData = {
      title: data.title,
      composer: data.composer,
      difficulty: data.difficulty,
      status: 'active' as const,
      totalMinutes: 0,
      sessionCount: 0,
      completionPercentage: 0,
      confidenceHistory: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      targetDate: data.targetDate,
      notes: data.notes,
    }
    const id = await addPiece(uid, pieceData)
    addPieceToStore({ id, userId: uid, ...pieceData })
    reset()
    setOpen(false)
  }

  async function handleArchive(piece: Piece) {
    await updatePiece(piece.id, { status: piece.status === 'active' ? 'archived' : 'active' })
  }

  async function handleMaster(piece: Piece) {
    await updatePiece(piece.id, { status: 'mastered', completionPercentage: 100 })
  }

  const filtered = pieces.filter((p) => p.status === filter)

  const statusColors: Record<string, 'success' | 'warning' | 'info'> = {
    active: 'info', archived: 'warning', mastered: 'success'
  }

  return (
    <div>
      <PageHeader
        title="My Pieces"
        subtitle="Manage and track every piece in your repertoire."
        actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> Add Piece</Button>}
      />

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['active', 'mastered', 'archived'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${filter === f ? 'text-white' : 'text-slate-400 hover:text-white bg-transparent'}`}
            style={filter === f ? { backgroundColor: theme.primary } : undefined}
          >
            {f} ({pieces.filter((p) => p.status === f).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={36} />}
          title={`No ${filter} pieces`}
          description={filter === 'active' ? 'Add a piece to start tracking your practice.' : `No pieces with ${filter} status yet.`}
          action={filter === 'active' ? { label: 'Add Your First Piece', onClick: () => setOpen(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((piece, i) => (
            <motion.div key={piece.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5 space-y-4" hover onClick={() => setSelected(piece)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate">{piece.title}</p>
                    {piece.composer && <p className="text-xs text-slate-400">{piece.composer}</p>}
                  </div>
                  <Badge variant={statusColors[piece.status]}>{piece.status}</Badge>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Completion</span>
                    <span>{piece.completionPercentage}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${piece.completionPercentage}%`, backgroundColor: theme.primary }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{piece.totalMinutes} min total</span>
                  <span>{piece.sessionCount} sessions</span>
                  <div className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={10} className={i < piece.difficulty ? 'text-amber-400 fill-amber-400' : 'text-slate-700'} />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                  {piece.status === 'active' && (
                    <Button size="sm" variant="ghost" onClick={() => handleMaster(piece)}><Star size={12} /> Master</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleArchive(piece)}>
                    <Archive size={12} /> {piece.status === 'archived' ? 'Restore' : 'Archive'}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add New Piece">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Piece Title" placeholder="Moonlight Sonata" error={errors.title?.message} {...register('title')} />
          <Input label="Composer (optional)" placeholder="Ludwig van Beethoven" {...register('composer')} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Difficulty (1–5)</label>
            <input type="range" min={1} max={5} step={1} className="w-full accent-indigo-500" {...register('difficulty')} />
          </div>
          <Input label="Target Date (optional)" type="date" {...register('targetDate')} />
          <Textarea label="Notes (optional)" placeholder="Goals for this piece..." {...register('notes')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Add Piece</Button>
          </div>
        </form>
      </Modal>

      {/* Piece detail modal */}
      {selected && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={selected.title} size="md">
          <div className="space-y-4">
            {selected.composer && <p className="text-slate-400 text-sm">{selected.composer}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{selected.totalMinutes}</p>
                <p className="text-xs text-slate-400">Total Minutes</p>
              </div>
              <div className="bg-slate-800/60 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-white">{selected.sessionCount}</p>
                <p className="text-xs text-slate-400">Sessions</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm text-slate-300 mb-2">
                <span>Completion</span>
                <span>{selected.completionPercentage}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${selected.completionPercentage}%`, backgroundColor: theme.primary }} />
              </div>
            </div>
            {selected.confidenceHistory.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-300 mb-2">Confidence History</p>
                <div className="flex items-end gap-1 h-16">
                  {selected.confidenceHistory.slice(-20).map((h, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{ height: `${h.value * 10}%`, backgroundColor: theme.primary, opacity: 0.5 + (i / 40) }} title={`${h.date}: ${h.value}/10`} />
                  ))}
                </div>
              </div>
            )}
            {selected.notes && <p className="text-sm text-slate-400 italic">"{selected.notes}"</p>}
            <div className="flex gap-2">
              {selected.status === 'active' && (
                <Button size="sm" onClick={() => { handleMaster(selected); setSelected(null) }} className="flex-1">
                  <Star size={14} /> Mark as Mastered
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => { handleArchive(selected); setSelected(null) }} className="flex-1">
                <Archive size={14} /> {selected.status === 'archived' ? 'Restore' : 'Archive'}
              </Button>
              <Button size="sm" variant="danger" onClick={async () => { await deletePiece(selected.id); setSelected(null) }}>
                Delete
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
