import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { motion } from 'framer-motion'
import { Plus, Trash2, Calendar } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { createLessonSlot, deleteLessonSlot } from '@/lib/firebase/schedule'
import { INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import PageHeader from '@/components/common/PageHeader'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/common/EmptyState'
import type { InstrumentType, LessonSlot } from '@/types'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const schema = z.object({
  studentId: z.string().min(1, 'Select a student'),
  dayOfWeek: z.coerce.number().min(0).max(6),
  startTime: z.string().min(1, 'Select a time'),
  durationMinutes: z.coerce.number().min(1),
})
type FormData = z.infer<typeof schema>

function formatTime(time: string) {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`
}

function SlotCard({ slot, onDelete }: { slot: LessonSlot; onDelete: () => void }) {
  const { students } = useTeacherStore()
  const student = students.find((s) => s.uid === slot.studentId)
  const emoji = student?.instrument ? INSTRUMENT_THEMES[student.instrument as InstrumentType]?.emoji : '🎵'

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
      <div className="bg-slate-800/80 border border-slate-700/50 rounded-xl p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg shrink-0">{emoji}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{slot.studentName}</p>
            <p className="text-xs text-slate-500">{formatTime(slot.startTime)} · {slot.durationMinutes}min</p>
          </div>
        </div>
        <button onClick={onDelete} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
          <Trash2 size={13} />
        </button>
      </div>
    </motion.div>
  )
}

export default function SchedulePage() {
  const { profile } = useAuth()
  const { students, schedule } = useTeacherStore()
  const [open, setOpen] = useState(false)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { dayOfWeek: 1, durationMinutes: 60 },
  })

  async function onSubmit(data: FormData) {
    if (!profile) return
    const student = students.find((s) => s.uid === data.studentId)
    if (!student) return
    await createLessonSlot(profile.uid, {
      studentId: data.studentId,
      studentName: student.displayName ?? student.email,
      dayOfWeek: data.dayOfWeek as LessonSlot['dayOfWeek'],
      startTime: data.startTime,
      durationMinutes: data.durationMinutes,
    })
    reset()
    setOpen(false)
  }

  // Build time options: every 30 min from 6:00 to 21:00
  const timeOptions = []
  for (let h = 6; h <= 21; h++) {
    for (const m of [0, 30]) {
      const val = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      timeOptions.push({ value: val, label: formatTime(val) })
    }
  }

  const totalSlots = schedule.length

  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle={`${totalSlots} lesson${totalSlots !== 1 ? 's' : ''} scheduled weekly`}
        actions={
          students.length > 0
            ? <Button onClick={() => setOpen(true)}><Plus size={16} /> Add Lesson</Button>
            : undefined
        }
      />

      {students.length === 0 ? (
        <EmptyState
          icon={<Calendar size={36} />}
          title="No students yet"
          description="Add students to your studio before scheduling lessons."
        />
      ) : schedule.length === 0 ? (
        <EmptyState
          icon={<Calendar size={36} />}
          title="No lessons scheduled"
          description="Add your first lesson slot to build your weekly schedule."
          action={{ label: 'Add Lesson', onClick: () => setOpen(true) }}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {([1, 2, 3, 4, 5, 6, 0] as const).map((day) => {
            const daySlots = schedule
              .filter((s) => s.dayOfWeek === day)
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
            const isToday = new Date().getDay() === day

            return (
              <div key={day}>
                <div className={`text-xs font-semibold uppercase tracking-widest mb-2 pb-1.5 border-b ${isToday ? 'text-sky-500 border-sky-300' : 'text-slate-500 border-slate-200'}`}>
                  {DAYS_SHORT[day]}
                  {isToday && <span className="ml-1 text-sky-500">·</span>}
                </div>
                <div className="space-y-2">
                  {daySlots.length === 0 ? (
                    <p className="text-xs text-slate-700 text-center py-3">—</p>
                  ) : (
                    daySlots.map((slot) => (
                      <SlotCard
                        key={slot.id}
                        slot={slot}
                        onDelete={() => deleteLessonSlot(slot.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Modal open={open} onClose={() => { setOpen(false); reset() }} title="Add Lesson Slot">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Select
            label="Student"
            options={students.map((s) => ({ value: s.uid, label: s.displayName ?? s.email }))}
            placeholder="Select student"
            error={errors.studentId?.message}
            {...register('studentId')}
          />
          <Select
            label="Day of Week"
            options={DAYS.map((d, i) => ({ value: String(i), label: d }))}
            error={errors.dayOfWeek?.message}
            {...register('dayOfWeek')}
          />
          <Select
            label="Start Time"
            options={timeOptions}
            placeholder="Select time"
            error={errors.startTime?.message}
            {...register('startTime')}
          />
          <Select
            label="Duration"
            options={[
              { value: '30', label: '30 minutes' },
              { value: '45', label: '45 minutes' },
              { value: '60', label: '1 hour' },
              { value: '90', label: '1.5 hours' },
            ]}
            error={errors.durationMinutes?.message}
            {...register('durationMinutes')}
          />
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); reset() }} className="flex-1">Cancel</Button>
            <Button type="submit" className="flex-1" loading={isSubmitting}>Add Lesson</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
