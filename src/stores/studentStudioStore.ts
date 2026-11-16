import { create } from 'zustand'
import type { Announcement, LessonNote, PracticeCorrection, TeacherPracticeEntry } from '@/types'

/**
 * What a student's teacher has written for them in the studio: notes
 * shared from lessons, suggested corrections to their log, and practice
 * the teacher recorded for them. Kept apart from the practice store so
 * nothing the student owns is mixed with what someone else wrote.
 */
interface StudentStudioState {
  sharedNotes: LessonNote[]
  corrections: PracticeCorrection[]
  teacherPractice: TeacherPracticeEntry[]
  /** The current teacher's announcements, newest first. */
  announcements: Announcement[]
  /** The newest announcement this device has dismissed (its createdAt). */
  announcementSeen: string
  set: (patch: Partial<Pick<StudentStudioState, 'sharedNotes' | 'corrections' | 'teacherPractice' | 'announcements' | 'announcementSeen'>>) => void
  reset: () => void
}

export const useStudentStudioStore = create<StudentStudioState>((set) => ({
  sharedNotes: [],
  corrections: [],
  teacherPractice: [],
  announcements: [],
  announcementSeen: '',
  set: (patch) => set(patch),
  reset: () => set({ sharedNotes: [], corrections: [], teacherPractice: [], announcements: [], announcementSeen: '' }),
}))

/** How long an announcement stays at the top of the Studio page if nobody dismisses it. */
export const ANNOUNCEMENT_DAYS = 30

/** The announcement still worth showing: the newest, if recent and not dismissed on this device. */
export function liveAnnouncement(list: Announcement[], seen: string, now = Date.now()): Announcement | undefined {
  const top = list[0]
  if (!top || top.createdAt <= seen) return undefined
  return now - Date.parse(top.createdAt) < ANNOUNCEMENT_DAYS * 864e5 ? top : undefined
}

const seenKey = (uid: string) => `maestro_announcement_seen_${uid}`

export function readAnnouncementSeen(uid: string): string {
  try { return localStorage.getItem(seenKey(uid)) ?? '' } catch { return '' }
}

/** Dismissed on this device: remembered here, and hidden at once. */
export function dismissAnnouncement(uid: string, createdAt: string): void {
  try { localStorage.setItem(seenKey(uid), createdAt) } catch { /* storage blocked: hidden for this visit only */ }
  useStudentStudioStore.getState().set({ announcementSeen: createdAt })
}
