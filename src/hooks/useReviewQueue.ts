import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTeacherStore } from '@/stores/teacherStore'
import { subscribeTeacherAssignments } from '@/lib/firebase/assignments'
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
  const { profile } = useAuth()
  const students = useTeacherStore((s) => s.students)
  const [raw, setRaw] = useState<Assignment[]>([])

  useEffect(() => {
    if (!profile?.uid || profile.role !== 'teacher') return
    return subscribeTeacherAssignments(profile.uid, setRaw)
  }, [profile?.uid, profile?.role])

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
