import { useEffect } from 'react'
import { subscribePracticeSessions } from '@/lib/firebase/practice'
import { subscribePieces } from '@/lib/firebase/pieces'
import { subscribePerformances } from '@/lib/firebase/performances'
import { subscribeRecordings } from '@/lib/firebase/recordings'
import { subscribeTeacherNotes } from '@/lib/firebase/teacher'
import { subscribeStudentSchedule } from '@/lib/firebase/schedule'
import { usePracticeStore } from '@/stores/practiceStore'

export function useStudentData(userId: string | undefined) {
  const { setSessions, setPieces, setPerformances, setRecordings, setTeacherNotes, setLessons } = usePracticeStore()

  useEffect(() => {
    if (!userId) return
    const unsubs = [
      subscribePracticeSessions(userId, setSessions),
      subscribePieces(userId, setPieces),
      subscribePerformances(userId, setPerformances),
      subscribeRecordings(userId, setRecordings),
      subscribeTeacherNotes(userId, setTeacherNotes),
      // Lessons recur weekly and change rarely, but the schedule is what
      // "your lesson is tomorrow" is derived from, and nothing else
      // subscribed to it.
      subscribeStudentSchedule(userId, setLessons),
    ]
    return () => unsubs.forEach((u) => u())
  }, [userId, setSessions, setPieces, setPerformances, setRecordings, setTeacherNotes, setLessons])
}
