import { useMemo } from 'react'
import { useTeacherStore } from '@/stores/teacherStore'
import { sortForReview, awaitingStudent, dueness, latestSubmission } from '@/lib/utils/assignments'
import type { Assignment, UserProfile } from '@/types'

export interface ReviewItem {
  assignment: Assignment
  student: UserProfile | undefined
  /** ISO time the work was handed in — what the queue is ordered by. */
  submittedAt: string | null
}

/**
 * Everything a teacher owes a response to, across every student.
 *
 * Previously assignments were only visible one student at a time, so
 * noticing that work had been handed in meant opening each student and
 * looking. With more than about three students that stops happening, and
 * submitted work goes unanswered — which teaches students that submitting
 * is pointless.
 */
export function useReviewQueue() {
  const students = useTeacherStore((s) => s.students)
  // Kept by useTeacherData — one subscription for the whole app.
  const raw = useTeacherStore((s) => s.assignments)

  const byId = useMemo(
    () => new Map(students.map((s) => [s.uid, s])),
    [students]
  )

  const queue = useMemo<ReviewItem[]>(
    () => sortForReview(raw).map((assignment) => ({
      assignment,
      student: byId.get(assignment.studentId),
      submittedAt: latestSubmission(assignment)?.at ?? null,
    })),
    [raw, byId]
  )

  /** Open work already past its due date and still untouched by the student. */
  const overdue = useMemo(
    () => raw.filter((a) => awaitingStudent(a) && dueness(a) === 'overdue'),
    [raw]
  )

  return { queue, overdue, all: raw }
}
