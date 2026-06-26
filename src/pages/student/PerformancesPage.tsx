import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Plus, Trophy, Calendar, MapPin, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { addPerformance, updatePerformance, deletePerformance } from '@/lib/firebase/performances'
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
import type { InstrumentType, PerformanceType } from '@/types'

const TYPES: PerformanceType[] = ['Competition', 'Recital', 'Audition', 'Jury', 'Masterclass']

const schema = z.object({
  eventName: z.string().min(1, 'Event name required'),
  type: z.enum(['Competition','Recital','Audition','Jury','Masterclass'] as [PerformanceType, ...PerformanceType[]]),
  date: z.string(),
  location: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

const typeColors: Record<PerformanceType, 'warning' | 'danger' | 'info' | 'success' | 'purple'> = {
  Competition: 'warning', Recital: 'success', Audition: 'danger', Jury: 'info', Masterclass: 'purple'
}

export default function PerformancesPage() {
  const { profile, user } = useAuth()
  const { performances } = usePracticeStore()
  const theme = getTheme(profile?.instrument as InstrumentType | undefined)
  const [open, setOpen] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { date: format(new Date(), 'yyyy-MM-dd') }
  })

  async function onSubmit(data: FormData) {
    const uid = profile?.uid ?? user?.uid
    if (!uid) return
    await addPerformance(uid, {
      ...data,
      pieces: [],
      preparationPercentage: 0,
      createdAt: new Date().toISOString(),
    })
    reset()
    setOpen(false)
  }

  const upcoming = performances.filter((p) => differenceInDays(parseISO(p.date), new Date()) >= 0)
    .sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())
  const past = performances.filter((p) => differenceInDays(parseISO(p.date), new Date()) < 0)
    .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime())

  return (
    <div>
      <PageHeader
        title="Performances"
        subtitle="Track competitions, recitals, auditions, and more."
        actions={<Button onClick={() => setOpen(true)}><Plus size={16} /> Add Performance</Button>}
      />

      {performances.length === 0 ? (
        <EmptyState
          icon={<Trophy size={36} />}
          title="No performances yet"
          description="Add upcoming recitals, auditions, or competitions to prepare effectively."
          action={{ label: 'Add Your First Performance', onClick: () => setOpen(true) }}
        />
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Upcoming</p>
              <div className="space-y-3">
                {upcoming.map((perf, i) => {
                  const daysLeft = differenceInDays(parseISO(perf.date), new Date())
                  return (
                    <motion.div key={perf.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Card className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <Badge variant={typeColors[perf.type]}>{perf.type}</Badge>
                              <Badge variant={daysLeft <= 7 ? 'danger' : daysLeft <= 30 ? 'warning' : 'info'}>
                                {daysLeft === 0 ? 'Today!' : `${daysLeft} days away`}
                              </Badge>
                            </div>
                            <p className="font-bold text-white text-lg">{perf.eventName}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400 flex-wrap">
                              <span className="flex items-center gap-1"><Calendar size={12} />{format(parseISO(perf.date), 'MMMM d, yyyy')}</span>
                              {perf.location && <span className="flex items-center gap-1"><MapPin size={12} />{perf.location}</span>}
                            </div>
                          </div>
                          <button onClick={() => deletePerformance(perf.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="mt-4">
                          <div className="flex justify-between text-xs text-slate-400 mb-2">
                            <span>Preparation Progress</span>
                            <span>{perf.preparationPercentage}%</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${perf.preparationPercentage}%`, backgroundColor: theme.primary }} />
                            </div>
                            <div className="flex gap-1">
                              <button onClick={() => updatePerformance(perf.id, { preparationPercentage: Math.min(100, perf.preparationPercentage + 10) })} className="text-slate-400 hover:text-white">
                                <ChevronUp size={14} />
                              </button>
                              <button onClick={() => updatePerformance(perf.id, { preparationPercentage: Math.max(0, perf.preparationPercentage - 10) })} className="text-slate-400 hover:text-white">
                                <ChevronDown size={14} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {perf.notes && <p className="text-xs text-slate-400 mt-3 italic">"{perf.notes}"</p>}
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

          {past.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Past</p>
              <div className="space-y-2">
                {past.map((perf) => (
                  <Card key={perf.id} className="p-4 opacity-70">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <Badge variant={typeColors[perf.type]}>{perf.type}</Badge>
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-sm truncate">{perf.eventName}</p>
                          <p className="text-xs text-slate-400">{format(parseISO(perf.date), 'MMM d, yyyy')}</p>
                        </div>
                      </div>
                      <button onClick={() => deletePerformance(perf.id)} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add Performance">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Event Name" placeholder="Spring Recital 2026" error={errors.eventName?.message} {...register('eventName')} />
          <Select
            label="Type"
            options={TYPES.map((t) => ({ value: t, label: t }))}
            placeholder="Select type"
            error={errors.type?.message}
            {...register('type')}
          />
          <Input label="Date" type="date" error={errors.date?.message} {...register('date')} />
          <Input label="Location (optional)" placeholder="Carnegie Hall, New York" {...register('location')} />
          <Textarea label="Notes (optional)" placeholder="Pieces to perform, goals..." {...register('notes')} />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Add Performance</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
