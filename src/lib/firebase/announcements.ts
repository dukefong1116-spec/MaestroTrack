import { addDoc, collection, deleteDoc, doc, query, where, type FirestoreError, type Unsubscribe } from 'firebase/firestore'
import { db } from './config'
import { onSnapshotError, onServerSnapshot } from './snapshotError'
import type { Announcement } from '@/types'

/**
 * A teacher's note to the whole studio — "the recital is Saturday at 2".
 *
 * One document, read by every student currently in the studio, rather
 * than a copy dropped into each conversation: it shows at the top of the
 * student's Studio page until they dismiss it, and the teacher can take
 * it down once and for everyone. Never edited; post a new one instead.
 */

const COL = 'announcements'
export const ANNOUNCEMENT_MAX = 2000

const newestFirst = (a: Announcement, b: Announcement) => b.createdAt.localeCompare(a.createdAt)

function list(label: string, teacherId: string, callback: (rows: Announcement[]) => void): Unsubscribe {
  const q = query(collection(db, COL), where('teacherId', '==', teacherId))
  return onServerSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Announcement).sort(newestFirst)),
    (e: FirestoreError) => { onSnapshotError(label)(e); callback([]) },
  )
}

export async function postAnnouncement(teacherId: string, text: string): Promise<string> {
  const body = text.trim().slice(0, ANNOUNCEMENT_MAX)
  if (!body) throw new Error('Write something first.')
  const ref = await addDoc(collection(db, COL), { teacherId, text: body, createdAt: new Date().toISOString() })
  return ref.id
}

/** Taken down for everyone. */
export async function deleteAnnouncement(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}

/** The teacher's own, newest first. */
export function subscribeTeacherAnnouncements(teacherId: string, callback: (rows: Announcement[]) => void): Unsubscribe {
  return list('announcements', teacherId, callback)
}

/** A student's: their current teacher's, newest first. The query names the teacher because the rules require it. */
export function subscribeStudioAnnouncements(teacherId: string, callback: (rows: Announcement[]) => void): Unsubscribe {
  return list('studioAnnouncements', teacherId, callback)
}
