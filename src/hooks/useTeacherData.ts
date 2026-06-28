import { useEffect } from 'react'
import { subscribeStudents } from '@/lib/firebase/teacher'
import { getPracticeSessions } from '@/lib/firebase/practice'
import { useTeacherStore } from '@/stores/teacherStore'

export function useTeacherData(teacherId: string | undefined) {
  const { setStudents, setStudentSessions } = useTeacherStore()

  useEffect(() => {
    if (!teacherId) return
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
