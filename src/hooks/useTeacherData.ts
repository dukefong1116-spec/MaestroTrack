import { useEffect } from 'react'
import { subscribeStudents } from '@/lib/firebase/teacher'
import { subscribeTeacherSchedule } from '@/lib/firebase/schedule'
import { getPracticeSummary } from '@/lib/firebase/summary'
import { sessionsFromSummary } from '@/lib/utils/summary'
import { useTeacherStore } from '@/stores/teacherStore'

export function useTeacherData(teacherId: string | undefined) {
  const { setStudents, setStudentSessions, setSchedule } = useTeacherStore()

  useEffect(() => {
    if (!teacherId) return
    const unsubStudents = subscribeStudents(teacherId, async (students) => {
      setStudents(students)

      // One summary document per student instead of their entire practice
      // history. Previously this fetched every session every student had
      // ever logged, one student at a time — around seven thousand
      // documents for a class of twenty a year in, on every dashboard
      // open. It also meant every private thought written into the
      // practice pad arrived in the teacher's browser, hidden by the
      // interface but present in the data.
      //
      // The charts are unchanged: the summary is expanded back into
      // stand-in sessions carrying only what a teacher is entitled to.
      const summaries = await Promise.all(
        students.map((s) => getPracticeSummary(s.uid).catch(() => null))
      )
      students.forEach((student, i) => {
        setStudentSessions(student.uid, sessionsFromSummary(summaries[i]))
      })
    })
    const unsubSchedule = subscribeTeacherSchedule(teacherId, setSchedule)
    return () => { unsubStudents(); unsubSchedule() }
  }, [teacherId, setStudents, setStudentSessions, setSchedule])
}
