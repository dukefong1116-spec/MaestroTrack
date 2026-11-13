import type { AttendanceMark, RepertoireStatus } from '@/types'
import type { Tone } from '@/components/teacher/studio/tokens'

export const ATTENDANCE: { value: AttendanceMark; label: string; tone: Tone }[] = [
  { value: 'present', label: 'Present', tone: 'success' },
  { value: 'student_cancel', label: 'Student cancelled', tone: 'warning' },
  { value: 'teacher_cancel', label: 'Teacher cancelled', tone: 'info' },
  { value: 'missed', label: 'Missed', tone: 'danger' },
]

export const REP_STATUS: { value: RepertoireStatus; label: string; tone: Tone }[] = [
  { value: 'learning', label: 'Learning', tone: 'info' },
  { value: 'polishing', label: 'Polishing', tone: 'warning' },
  { value: 'ready', label: 'Performance-ready', tone: 'success' },
  { value: 'done', label: 'Completed', tone: 'neutral' },
]
