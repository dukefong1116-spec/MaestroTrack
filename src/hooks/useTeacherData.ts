import { useEffect } from 'react'
import { subscribeStudents } from '@/lib/firebase/teacher'
import { subscribeTeacherSchedule } from '@/lib/firebase/schedule'
import { getPracticeSessions } from '@/lib/firebase/practice'
import { useTeacherStore } from '@/stores/teacherStore'

export function useTeacherData(teacherId: string | undefined) {
  const { setStudents, setStudentSessions, setSchedule } = useTeacherStore()

  useEffect(() => {
    if (!teacherId) return
    const unsubStudents = subscribeStudents(teacherId, async (students) => {
      setStudents(students)
      for (const student of students) {
        const sessions = await getPracticeSessions(student.uid)
        setStudentSessions(student.uid, sessions)
      }
    })
    const unsubSchedule = subscribeTeacherSchedule(teacherId, setSchedule)
    return () => { unsubStudents(); unsubSchedule() }
  }, [teacherId, setStudents, setStudentSessions, setSchedule])
}
