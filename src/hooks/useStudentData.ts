import { useEffect } from 'react'
import { subscribePracticeSessions } from '@/lib/firebase/practice'
import { subscribePieces } from '@/lib/firebase/pieces'
import { subscribePerformances } from '@/lib/firebase/performances'
import { subscribeRecordings } from '@/lib/firebase/recordings'
import { subscribeStudentMessages } from '@/lib/firebase/messages'
import { subscribeStudentSchedule } from '@/lib/firebase/schedule'
import { subscribeStudentAssignments } from '@/lib/firebase/assignments'
import { usePracticeStore } from '@/stores/practiceStore'
import { readSnapshot, writeSnapshot, snapshotKey, type Snapshot } from '@/lib/cache/snapshot'
import { SNAPSHOT_KEYS } from '@/stores/practiceStore'
import { useAuthStore } from '@/stores/authStore'
import { useStudentStudioStore, readAnnouncementSeen } from '@/stores/studentStudioStore'
import { subscribeStudioAnnouncements } from '@/lib/firebase/announcements'
import {
  subscribeMyStudioLessons, subscribeMyOccurrences, subscribeMySharedNotes, subscribeMyCorrections, subscribeMyTeacherPractice,
} from '@/lib/firebase/studio'
import { studentSlots } from '@/lib/studio/studentLessons'
import type { LessonOccurrence, LessonSlot, StudioLesson } from '@/types'

/** Whose data the store holds, across mounts of this hook. */
let lastUser: string | undefined

export function useStudentData(userId: string | undefined) {
  const { setSessions, setPieces, setPerformances, setRecordings, setMessages, setLessons, setAssignments, resetUserData } = usePracticeStore()

  useEffect(() => {
    // Cleared only when the account changes (signing out, or someone else
    // signing in) — never because a page mounted. It used to run on every
    // mount, and a session opened straight from a widget or link started
    // its clock a moment before this wiped it back to zero.
    if (lastUser !== userId) {
      if (lastUser !== undefined) resetUserData()
      lastUser = userId
    }
    if (!userId) return
    let active = true
    const guarded = <T,>(set: (value: T) => void) => (value: T) => { if (active) set(value) }

    // What you saw last time, at once — replaced, list by list, as the
    // live data arrives. Display only: see lib/cache/snapshot.
    void readSnapshot<Snapshot>(snapshotKey.student(userId)).then((snap) => {
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
      const data = Object.fromEntries(SNAPSHOT_KEYS.map((k) => [k, now[k]])) as unknown as Snapshot
      void writeSnapshot(snapshotKey.student(userId), data)
    }
    const stopSaving = usePracticeStore.subscribe((st, prev) => {
      if (!SNAPSHOT_KEYS.every((k) => st.live[k])) return
      if (SNAPSHOT_KEYS.every((k) => st[k] === prev[k])) return
      unsaved = true
      clearTimeout(saveTimer)
      saveTimer = setTimeout(save, 1500)
    })
    // Leaving the app (switching away, locking the phone) saves at once:
    // a quick look-and-close should still make the next open instant.
    const onHide = () => { if (document.visibilityState === 'hidden') save() }
    document.addEventListener('visibilitychange', onHide)

    const studio = useStudentStudioStore.getState()
    studio.reset()
    studio.set({ announcementSeen: readAnnouncementSeen(userId) })
    let legacySlots: LessonSlot[] | null = null
    let studioLessons: StudioLesson[] = []
    let studioDates: LessonOccurrence[] = []
    const pushLessons = () => {
      if (!active || legacySlots === null) return
      const teacherId = useAuthStore.getState().profile?.teacherId
      setLessons([...legacySlots, ...studentSlots(userId, teacherId, studioLessons, studioDates)])
    }

    // The teacher's studio calendar, in the same shape as the slots
    // above, added to them — see lib/studio/studentLessons. pushLessons
    // waits for the slots so the list never goes live without them.
    // Asked of the current teacher only (the rules require it), so it is
    // re-asked whenever the student joins or leaves a studio.
    let stopStudioLessons: (() => void) | null = null
    const watchStudioLessons = (teacherId: string | null) => {
      stopStudioLessons?.()
      stopStudioLessons = null
      studioLessons = []
      studioDates = []
      useStudentStudioStore.getState().set({ announcements: [] })
      if (teacherId) {
        const a = subscribeMyStudioLessons(userId, teacherId, (l) => { studioLessons = l; pushLessons() })
        const b = subscribeMyOccurrences(userId, teacherId, (o) => { studioDates = o; pushLessons() })
        // The studio's announcements, also only from the teacher they are with now.
        const c = subscribeStudioAnnouncements(teacherId, (announcements) => { if (active) useStudentStudioStore.getState().set({ announcements }) })
        stopStudioLessons = () => { a(); b(); c() }
      }
      pushLessons()
    }
    watchStudioLessons(useAuthStore.getState().profile?.teacherId ?? null)
    const stopTeacherWatch = useAuthStore.subscribe((st, prev) => {
      const next = st.profile?.teacherId ?? null
      if (next !== (prev.profile?.teacherId ?? null)) watchStudioLessons(next)
    })

    const unsubs = [
      subscribePracticeSessions(userId, guarded(setSessions)),
      subscribePieces(userId, guarded(setPieces)),
      subscribePerformances(userId, guarded(setPerformances)),
      subscribeRecordings(userId, guarded(setRecordings)),
      subscribeStudentMessages(userId, guarded(setMessages)),
      // Lessons recur weekly and change rarely, but the schedule is what
      // "your lesson is tomorrow" is derived from, and nothing else
      // subscribed to it.
      subscribeStudentSchedule(userId, (slots) => { legacySlots = slots; pushLessons() }),
      subscribeMySharedNotes(userId, guarded((sharedNotes) => studio.set({ sharedNotes }))),
      subscribeMyCorrections(userId, guarded((corrections) => studio.set({ corrections }))),
      subscribeMyTeacherPractice(userId, guarded((teacherPractice) => studio.set({ teacherPractice }))),
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
      stopTeacherWatch()
      stopStudioLessons?.()
      unsubs.forEach((u) => u())
      resetUserData()
      useStudentStudioStore.getState().reset()
    }
  }, [userId, setSessions, setPieces, setPerformances, setRecordings, setMessages, setLessons, setAssignments, resetUserData])
}
