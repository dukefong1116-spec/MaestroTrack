import { useEffect } from 'react'
import { subscribePracticeSessions } from '@/lib/firebase/practice'
import { subscribePieces } from '@/lib/firebase/pieces'
import { subscribePerformances } from '@/lib/firebase/performances'
import { subscribeRecordings } from '@/lib/firebase/recordings'
import { subscribeTeacherNotes } from '@/lib/firebase/teacher'
import { usePracticeStore } from '@/stores/practiceStore'

export function useStudentData(userId: string | undefined) {
  const { setSessions, setPieces, setPerformances, setRecordings, setTeacherNotes } = usePracticeStore()

  useEffect(() => {
    if (!userId) return
    const unsubs = [
      subscribePracticeSessions(userId, setSessions),
      subscribePieces(userId, setPieces),
      subscribePerformances(userId, setPerformances),
      subscribeRecordings(userId, setRecordings),
      subscribeTeacherNotes(userId, setTeacherNotes),
    ]
    return () => unsubs.forEach((u) => u())
  }, [userId, setSessions, setPieces, setPerformances, setRecordings, setTeacherNotes])
}
