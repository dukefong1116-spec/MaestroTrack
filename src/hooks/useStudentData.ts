import { useEffect } from 'react'
import { subscribePracticeSessions } from '@/lib/firebase/practice'
import { subscribePieces } from '@/lib/firebase/pieces'
import { subscribePerformances } from '@/lib/firebase/performances'
import { subscribeRecordings } from '@/lib/firebase/recordings'
import { subscribeStudentMessages } from '@/lib/firebase/messages'
import { subscribeStudentSchedule } from '@/lib/firebase/schedule'
import { subscribeStudentAssignments } from '@/lib/firebase/assignments'
import { usePracticeStore } from '@/stores/practiceStore'
import { readSnapshot, writeSnapshot } from '@/lib/cache/snapshot'

export function useStudentData(userId: string | undefined) {
  const { setSessions, setPieces, setPerformances, setRecordings, setMessages, setLessons, setAssignments, resetUserData } = usePracticeStore()

  useEffect(() => {
    resetUserData()
    if (!userId) return
    let active = true
    const guarded = <T,>(set: (value: T) => void) => (value: T) => { if (active) set(value) }

    // What you saw last time, at once — replaced, list by list, as the
    // live data arrives. Display only: see lib/cache/snapshot.
    void readSnapshot(userId).then((snap) => {
      if (active && snap) usePracticeStore.getState().hydrate(snap)
    })

    // And kept current for next time, from live data only, a moment after
    // things settle.
    let saveTimer: ReturnType<typeof setTimeout> | undefined
    let unsaved = false
    const save = () => {
      clearTimeout(saveTimer)
      if (!active || !unsaved) return
      unsaved = false
      const now = usePracticeStore.getState()
      void writeSnapshot(userId, {
        sessions: now.sessions, pieces: now.pieces, assignments: now.assignments, lessons: now.lessons,
      })
    }
    const stopSaving = usePracticeStore.subscribe((st, prev) => {
      const { live } = st
      if (!live.sessions || !live.pieces || !live.assignments || !live.lessons) return
      if (st.sessions === prev.sessions && st.pieces === prev.pieces
        && st.assignments === prev.assignments && st.lessons === prev.lessons) return
      unsaved = true
      clearTimeout(saveTimer)
      saveTimer = setTimeout(save, 1500)
    })
    // Leaving the app (switching away, locking the phone) saves at once:
    // a quick look-and-close should still make the next open instant.
    const onHide = () => { if (document.visibilityState === 'hidden') save() }
    document.addEventListener('visibilitychange', onHide)

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
      // Cancelled, not saved: this also runs on signing out, and a write
      // landing after sign-out cleared the copy would leave it behind.
      clearTimeout(saveTimer)
      active = false
      document.removeEventListener('visibilitychange', onHide)
      stopSaving()
      unsubs.forEach((u) => u())
      resetUserData()
    }
  }, [userId, setSessions, setPieces, setPerformances, setRecordings, setMessages, setLessons, setAssignments, resetUserData])
}
