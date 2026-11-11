import { useEffect } from 'react'
import { subscribeStudents } from '@/lib/firebase/teacher'
import { subscribeTeacherSchedule } from '@/lib/firebase/schedule'
import { subscribeStudioRequests } from '@/lib/firebase/requests'
import { getPracticeSummary } from '@/lib/firebase/summary'
import { sessionsFromSummary } from '@/lib/utils/summary'
import { useTeacherStore, TEACHER_SNAPSHOT_KEYS, type TeacherSnapshot } from '@/stores/teacherStore'
import { readSnapshot, writeSnapshot, snapshotKey } from '@/lib/cache/snapshot'
import { subscribeTeacherMessages } from '@/lib/firebase/messages'
import { subscribeTeacherAssignments } from '@/lib/firebase/assignments'

export function useTeacherData(teacherId: string | undefined) {
  const { setStudents, setStudentSessions, setSchedule, setRequests, setMessages, setAssignments, resetTeacherData } = useTeacherStore()

  useEffect(() => {
    resetTeacherData()
    if (!teacherId) return
    let active = true

    // The studio as you last saw it, at once — replaced, list by list, as
    // the live data arrives. Display only: see lib/cache/snapshot.
    void readSnapshot<TeacherSnapshot>(snapshotKey.teacher(teacherId)).then((snap) => {
      if (active && snap) useTeacherStore.getState().hydrate(snap)
    })
    let saveTimer: ReturnType<typeof setTimeout> | undefined
    const save = () => {
      clearTimeout(saveTimer)
      if (!active) return
      const now = useTeacherStore.getState()
      if (!TEACHER_SNAPSHOT_KEYS.every((k) => now.live[k])) return
      const data = Object.fromEntries(TEACHER_SNAPSHOT_KEYS.map((k) => [k, now[k]])) as unknown as TeacherSnapshot
      void writeSnapshot(snapshotKey.teacher(teacherId), data)
    }
    const stopSaving = useTeacherStore.subscribe((st, prev) => {
      if (TEACHER_SNAPSHOT_KEYS.every((k) => st[k] === prev[k] && st.live[k] === prev.live[k])) return
      clearTimeout(saveTimer)
      saveTimer = setTimeout(save, 1500)
    })
    const onHide = () => { if (document.visibilityState === 'hidden') save() }
    document.addEventListener('visibilitychange', onHide)

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
      useTeacherStore.setState((st) => ({ live: { ...st.live, studentSessions: true } }))
    })
    const unsubSchedule = subscribeTeacherSchedule(teacherId, setSchedule)
    const unsubRequests = subscribeStudioRequests(teacherId, setRequests)
    const unsubMessages = subscribeTeacherMessages(teacherId, (m) => { if (active) setMessages(m) })
    // One subscription for the bell, the tab bar and the review queue.
    const unsubAssignments = subscribeTeacherAssignments(teacherId, (a) => { if (active) setAssignments(a) })
    return () => {
      // Cancelled, not saved — see useStudentData.
      clearTimeout(saveTimer)
      active = false
      stopSaving()
      document.removeEventListener('visibilitychange', onHide)
      unsubStudents()
      unsubSchedule()
      unsubRequests()
      unsubMessages()
      unsubAssignments()
      resetTeacherData()
    }
  }, [teacherId, setStudents, setStudentSessions, setSchedule, setRequests, setMessages, setAssignments, resetTeacherData])
}
