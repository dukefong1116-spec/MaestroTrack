import { useMemo } from 'react'
import { useMinuteTick } from '@/hooks/useMinuteTick'
import { usePracticeStore } from '@/stores/practiceStore'
import {
  isOpen, awaitingStudent, sortForStudent, deriveProgress, deriveDailyProgress, dueness,
  type AssignmentProgress, type DailyProgress, type Dueness,
} from '@/lib/utils/assignments'
import type { Assignment } from '@/types'

export interface StudentAssignment {
  assignment: Assignment
  progress: AssignmentProgress
  daily: DailyProgress
  due: Dueness
}

/**
 * A student's assignments, with the parts that can be derived already
 * derived — progress from the session log, urgency from the due date.
 *
 * The assignments themselves come from the one subscription the app keeps
 * (see useStudentData), so however many screens call this, Firestore is
 * asked once.
 */
export function useAssignments() {
  const sessions = usePracticeStore((s) => s.sessions)
  const raw = usePracticeStore((s) => s.assignments)

  // One clock for the whole list, so every due date is judged against the
  // same instant, and the list ages without needing a reload.
  const now = useMinuteTick()

  const all = useMemo<StudentAssignment[]>(
    () => sortForStudent(raw, now).map((assignment) => ({
      assignment,
      progress: deriveProgress(assignment, sessions),
      daily: deriveDailyProgress(assignment, sessions, now),
      due: dueness(assignment, now),
    })),
    [raw, sessions, now]
  )

  return {
    all,
    open: useMemo(() => all.filter((x) => isOpen(x.assignment)), [all]),
    todo: useMemo(() => all.filter((x) => awaitingStudent(x.assignment)), [all]),
    done: useMemo(() => all.filter((x) => !isOpen(x.assignment)), [all]),
  }
}
