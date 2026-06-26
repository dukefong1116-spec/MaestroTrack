import { useEffect } from 'react'
import { subscribeStudents } from '@/lib/firebase/teacher'
import { getPracticeSessions } from '@/lib/firebase/practice'
import { useTeacherStore } from '@/stores/teacherStore'

// teacherId is the teacher's own Firebase UID.
// Students are linked via teacherId field in their Firestore document.
export function useTeacherData(teacherId: string | undefined) {
  const { setStudents, setStudentSessions } = useTeacherStore()

  useEffect(() => {
    if (!teacherId) {
      console.log('[TeacherData] No teacherId — skipping subscription')
      return
    }
    console.log('[TeacherData] Subscribing with teacherId:', teacherId)
    const unsub = subscribeStudents(teacherId, async (students) => {
      setStudents(students)
      for (const student of students) {
        const sessions = await getPracticeSessions(student.uid)
        setStudentSessions(student.uid, sessions)
      }
    })
    return unsub
  }, [teacherId, setStudents, setStudentSessions])
}
