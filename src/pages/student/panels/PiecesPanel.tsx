import { useState, useMemo } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Plus, Archive, Star, ChevronRight, Crosshair } from 'lucide-react'
import Sticker from '@/components/stickers/Sticker'
import { format, parseISO, differenceInDays } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { derivePieceStats } from '@/lib/utils/pieces'
import { addPiece, updatePiece, deletePiece } from '@/lib/firebase/pieces'
import { getTheme } from '@/lib/utils/instruments'
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

export default function PiecesPanel() {
  const { profile, user } = useAuth()
  const { pieces, sessions, addPiece: addPieceToStore } = usePracticeStore()
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

  const selectedStats = useMemo(
    () => (selected ? derivePieceStats(selected, sessions) : null),
    [selected, sessions]
  )

  const statusColors: Record<string, 'success' | 'warning' | 'info'> = {
    active: 'info', archived: 'warning', mastered: 'success'
  }

  return (
    <div>
      {/* Filter tabs + add, on one row */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {(['active', 'mastered', 'archived'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all capitalize ${filter === f ? 'text-[var(--clay-ink)]' : 'text-[var(--clay-dim)] hover:text-[var(--clay-ink)] bg-transparent'}`}
            style={filter === f ? { backgroundColor: theme.primary } : undefined}
          >
            {f} ({pieces.filter((p) => p.status === f).length})
          </button>
        ))}
        <Button className="ml-auto" onClick={() => setOpen(true)}><Plus size={16} /> Add piece</Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Sticker name="book" size={36} tone="accent" />}
          title={`No ${filter} pieces`}
          description={filter === 'active' ? 'Add a piece to start tracking your practice.' : `No pieces with ${filter} status yet.`}
          action={filter === 'active' ? { label: 'Add Your First Piece', onClick: () => setOpen(true) } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((piece, i) => {
            const stats = derivePieceStats(piece, sessions)
            return (
            <motion.div key={piece.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="p-5 space-y-4" hover onClick={() => setSelected(piece)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--clay-ink)] truncate">{piece.title}</p>
                    {piece.composer && <p className="text-xs text-[var(--clay-dim)]">{piece.composer}</p>}
                  </div>
                  <Badge variant={statusColors[piece.status]}>{piece.status}</Badge>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-[var(--clay-dim)] mb-1">
                    <span>Completion</span>
                    <span>{stats.completionPercentage}%</span>
                  </div>
                  <div className="h-1.5 bg-[var(--clay-line)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${stats.completionPercentage}%`, backgroundColor: theme.primary }} />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-[var(--clay-dim)]">
                  <span>{stats.totalMinutes} min total</span>
                  <span>{stats.sessionCount} sessions</span>
                  <div className="flex">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={10} className={i < piece.difficulty ? 'text-amber-400 fill-amber-400' : 'text-[var(--clay-ink)]'} />
                    ))}
                  </div>
                </div>
                {piece.targetDate && (() => {
                  const daysLeft = differenceInDays(parseISO(piece.targetDate!), new Date())
                  return (
                    <p className={`text-xs mt-1 ${daysLeft < 0 ? 'text-red-400' : daysLeft <= 7 ? 'text-amber-400' : 'text-[var(--clay-dim)]'}`}>
                      <Crosshair size={11} className="inline mr-1 -mt-px" />Target: {format(parseISO(piece.targetDate!), 'MMM d')}
                      {daysLeft >= 0 ? ` · ${daysLeft}d left` : ' · Overdue'}
                    </p>
                  )
                })()}

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
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add New Piece">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Piece Title" placeholder="Moonlight Sonata" error={errors.title?.message} {...register('title')} />
          <Input label="Composer (optional)" placeholder="Ludwig van Beethoven" {...register('composer')} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-[var(--clay-faint)]">Difficulty (1–5)</label>
            <input type="range" min={1} max={5} step={1} className="w-full accent-[var(--clay-accent)]" {...register('difficulty')} />
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
      {selected && selectedStats && (
        <Modal open={!!selected} onClose={() => setSelected(null)} title={selected.title} size="md">
          <div className="space-y-4">
            {selected.composer && <p className="text-[var(--clay-dim)] text-sm">{selected.composer}</p>}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--clay-bg-deep)] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-[var(--clay-ink)]">{selectedStats.totalMinutes}</p>
                <p className="text-xs text-[var(--clay-dim)]">Total Minutes</p>
              </div>
              <div className="bg-[var(--clay-bg-deep)] rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-[var(--clay-ink)]">{selectedStats.sessionCount}</p>
                <p className="text-xs text-[var(--clay-dim)]">Sessions</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm text-[var(--clay-faint)] mb-2">
                <span>Completion</span>
                <span>{selectedStats.completionPercentage}%</span>
              </div>
              <div className="h-2 bg-[var(--clay-line)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${selectedStats.completionPercentage}%`, backgroundColor: theme.primary }} />
              </div>
            </div>
            {selectedStats.confidenceHistory.length > 0 && (
              <div>
                <p className="text-sm font-medium text-[var(--clay-faint)] mb-2">Confidence History</p>
                <div className="flex items-end gap-1 h-16">
                  {selectedStats.confidenceHistory.slice(-20).map((h, i) => (
                    <div key={i} className="flex-1 rounded-t" style={{ height: `${h.value * 10}%`, backgroundColor: theme.primary, opacity: 0.5 + (i / 40) }} title={`${h.date}: ${h.value}/10`} />
                  ))}
                </div>
              </div>
            )}
            {selected.notes && <p className="text-sm text-[var(--clay-dim)] italic">"{selected.notes}"</p>}
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
