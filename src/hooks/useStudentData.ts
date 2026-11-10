import { useEffect } from 'react'
import { subscribePracticeSessions } from '@/lib/firebase/practice'
import { subscribePieces } from '@/lib/firebase/pieces'
import { subscribePerformances } from '@/lib/firebase/performances'
import { subscribeRecordings } from '@/lib/firebase/recordings'
import { subscribeStudentMessages } from '@/lib/firebase/messages'
import { subscribeStudentSchedule } from '@/lib/firebase/schedule'
import { subscribeStudentAssignments } from '@/lib/firebase/assignments'
import { usePracticeStore } from '@/stores/practiceStore'

export function useStudentData(userId: string | undefined) {
  const { setSessions, setPieces, setPerformances, setRecordings, setMessages, setLessons, setAssignments, resetUserData } = usePracticeStore()

  useEffect(() => {
    resetUserData()
    if (!userId) return
    let active = true
    const guarded = <T,>(set: (value: T) => void) => (value: T) => { if (active) set(value) }
    const unsubs = [
      subscribePracticeSessions(userId, guarded(setSessions)),
      subscribePieces(userId, guarded(setPieces)),
      subscribePerformances(userId, guarded(setPerformances)),
      subscribeRecordings(userId, guarded(setRecordings)),
      subscribeStudentMessages(userId, guarded(setMessages)),
      // Lessons recur weekly and change rarely, but the schedule is what
      // "your lesson is tomorrow" is derived from, and nothing else
      // subscribed to it.
      subscribeStudentSchedule(userId, guarded(setLessons)),
      // Once, here, rather than once per screen that shows them: the
      // dashboard, Today, the bell, the tab bar and the studio pages all
      // read this one copy.
      subscribeStudentAssignments(userId, guarded(setAssignments)),
    ]
    return () => {
      active = false
      unsubs.forEach((u) => u())
      resetUserData()
    }
  }, [userId, setSessions, setPieces, setPerformances, setRecordings, setMessages, setLessons, setAssignments, resetUserData])
}
