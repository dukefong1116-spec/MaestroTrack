import {
  collection, deleteDoc, doc, getDoc, onSnapshot, query, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { auth, db } from './config'
import { requestId } from './invites'
import type { StudioRequest } from '@/types'

const REQUESTS = 'studioRequests'
const USERS = 'users'

function readRequest(id: string, data: Record<string, unknown>): StudioRequest {
  return {
    id,
    studentId: String(data.studentId ?? ''),
    teacherId: String(data.teacherId ?? ''),
    studentName: String(data.studentName ?? ''),
    instrument: data.instrument as StudioRequest['instrument'],
    inviteToken: String(data.inviteToken ?? ''),
    createdAt: String(data.createdAt ?? ''),
    status: (data.status as StudioRequest['status']) ?? 'pending',
    decidedAt: data.decidedAt ? String(data.decidedAt) : undefined,
  }
}

/**
 * Everyone waiting on this teacher's answer.
 *
 * Filtered to pending in the query rather than in the callback: a
 * studio accumulates declined rows forever, and none of them are the
 * teacher's business once decided.
 */
export function subscribeStudioRequests(
  teacherId: string,
  onChange: (requests: StudioRequest[]) => void
): () => void {
  const q = query(
    collection(db, REQUESTS),
    where('teacherId', '==', teacherId),
    where('status', '==', 'pending')
  )
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => readRequest(d.id, d.data()))
      rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      onChange(rows)
    },
    (e) => {
      console.error('[StudioRequests] subscription failed', e)
      onChange([])
    }
  )
}

/**
 * Let them in.
 *
 * Two writes, one batch: the student's profile gains the teacher, and
 * the request is marked answered. Rules read the state from before the
 * batch, so the profile write still sees a pending request while the
 * other half of the batch is settling it.
 *
 * This is the only place in the app where one person writes to another
 * person's profile, and the rule behind it is correspondingly narrow:
 * only `teacherId`, only onto a student with no teacher, and only with
 * a pending request addressed to the teacher doing the writing.
 */
export async function acceptStudioRequest(
  request: StudioRequest,
  studioName?: string,
  teacherName?: string
): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You are not signed in.')
  if (uid !== request.teacherId) throw new Error('That request is not yours to accept.')

  const batch = writeBatch(db)
  batch.update(doc(db, USERS, request.studentId), {
    teacherId: uid,
    studioName: studioName ?? '',
    teacherName: teacherName ?? '',
    updatedAt: new Date().toISOString(),
  })
  batch.update(doc(db, REQUESTS, request.id), {
    status: 'accepted',
    decidedAt: new Date().toISOString(),
  })
  await batch.commit()
}

/** Turn them away. Nothing is written to their profile. */
export async function declineStudioRequest(request: StudioRequest): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You are not signed in.')
  if (uid !== request.teacherId) throw new Error('That request is not yours to decline.')

  const batch = writeBatch(db)
  batch.update(doc(db, REQUESTS, request.id), {
    status: 'declined',
    decidedAt: new Date().toISOString(),
  })
  await batch.commit()
}

/** A student changing their mind before anyone has answered. */
export async function withdrawStudioRequest(studentId: string, teacherId: string): Promise<void> {
  if (auth.currentUser?.uid !== studentId) throw new Error('That request is not yours to withdraw.')
  await deleteDoc(doc(db, REQUESTS, requestId(studentId, teacherId)))
}

/**
 * When this student's request to `teacherId` was accepted — what the
 * "You've joined" notification is dated from. Their own request, which
 * the rules already let them read. Null if there is none, or not accepted.
 */
export async function acceptedAt(studentId: string, teacherId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, REQUESTS, requestId(studentId, teacherId)))
  if (!snap.exists()) return null
  const r = readRequest(snap.id, snap.data())
  return r.status === 'accepted' ? (r.decidedAt ?? null) : null
}

/** What a student is waiting on, if anything. */
export function subscribeMyStudioRequest(
  studentId: string,
  onChange: (request: StudioRequest | null) => void
): () => void {
  const q = query(collection(db, REQUESTS), where('studentId', '==', studentId))
  return onSnapshot(
    q,
    (snap) => {
      const pending = snap.docs
        .map((d) => readRequest(d.id, d.data()))
        .find((r) => r.status === 'pending')
      onChange(pending ?? null)
    },
    (e) => {
      console.error('[StudioRequests] own request subscription failed', e)
      onChange(null)
    }
  )
}

/**
 * Leaving, by the student's own hand.
 *
 * The mirror of removeStudentFromStudio, and the only studio field a
 * student may write: the rule lets teacherId be cleared but never set,
 * so this walks out and cannot walk in.
 */
export async function leaveStudio(studentId: string): Promise<void> {
  if (auth.currentUser?.uid !== studentId) throw new Error('That is not your studio to leave.')
  await updateDoc(doc(db, USERS, studentId), {
    teacherId: null,
    studioName: '',
    teacherName: '',
    updatedAt: new Date().toISOString(),
  })
}
