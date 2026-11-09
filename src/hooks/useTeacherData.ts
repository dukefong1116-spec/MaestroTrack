import { useEffect } from 'react'
import { subscribeStudents } from '@/lib/firebase/teacher'
import { subscribeTeacherSchedule } from '@/lib/firebase/schedule'
import { subscribeStudioRequests } from '@/lib/firebase/requests'
import { getPracticeSummary } from '@/lib/firebase/summary'
import { sessionsFromSummary } from '@/lib/utils/summary'
import { useTeacherStore } from '@/stores/teacherStore'
import { subscribeTeacherMessages } from '@/lib/firebase/messages'

export function useTeacherData(teacherId: string | undefined) {
  const { setStudents, setStudentSessions, setSchedule, setRequests, setMessages, resetTeacherData } = useTeacherStore()

  useEffect(() => {
    resetTeacherData()
    if (!teacherId) return
    let active = true
    const unsubStudents = subscribeStudents(teacherId, async (students) => {
      if (!active) return
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
      if (!active) return
      students.forEach((student, i) => {
        setStudentSessions(student.uid, sessionsFromSummary(summaries[i]))
      })
    })
    const unsubSchedule = subscribeTeacherSchedule(teacherId, setSchedule)
    const unsubRequests = subscribeStudioRequests(teacherId, setRequests)
    const unsubMessages = subscribeTeacherMessages(teacherId, (m) => { if (active) setMessages(m) })
    return () => {
      active = false
      unsubStudents()
      unsubSchedule()
      unsubRequests()
      unsubMessages()
      resetTeacherData()
    }
  }, [teacherId, setStudents, setStudentSessions, setSchedule, setRequests, setMessages, resetTeacherData])
}
