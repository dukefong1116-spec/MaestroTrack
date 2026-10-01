import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePracticeStore } from '@/stores/practiceStore'
import { subscribeStudentAssignments } from '@/lib/firebase/assignments'
import {
  isOpen, awaitingStudent, sortForStudent, deriveProgress, dueness,
  type AssignmentProgress, type Dueness,
} from '@/lib/utils/assignments'
import type { Assignment } from '@/types'

export interface StudentAssignment {
  assignment: Assignment
  progress: AssignmentProgress
  due: Dueness
}

/**
 * A student's assignments, with the parts that can be derived already
 * derived — progress from the session log, urgency from the due date.
 *
 * Deliberately a separate hook from the dashboard's existing inline
 * subscription rather than a rewrite of it: that code works, and the two
 * can coexist until the new list is proven.
 */
export function useAssignments() {
  const { profile, user } = useAuth()
  const uid = profile?.uid ?? user?.uid
  const sessions = usePracticeStore((s) => s.sessions)
  const [raw, setRaw] = useState<Assignment[]>([])

  useEffect(() => {
    if (!uid) return
    return subscribeStudentAssignments(uid, setRaw)
  }, [uid])

  // One clock for the whole list, so every due date is judged against the
  // same instant, and the list ages without needing a reload.
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const all = useMemo<StudentAssignment[]>(
    () => sortForStudent(raw, now).map((assignment) => ({
      assignment,
      progress: deriveProgress(assignment, sessions),
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
