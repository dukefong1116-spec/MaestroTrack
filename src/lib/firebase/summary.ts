import { doc, getDoc, onSnapshot, writeBatch, type Unsubscribe } from 'firebase/firestore'
import { db } from './config'
import { onSnapshotError } from './snapshotError'
import { cleanForFirestore } from './clean'
import type { PracticeSummary, StudioStats } from '@/types'

/**
 * Rolled-up practice, written by the student's own app.
 *
 * Two documents rather than one, because they were written for different
 * audiences: the summary carries the category breakdown, the studio row
 * only how long someone practised each day. (Both are now readable by the
 * student and their teacher only; classmates read neither.) Splitting them means the rules can say
 * exactly that, instead of relying on the reader to look away — Firestore
 * rules govern whole documents and cannot withhold a field.
 */

const STUDIO = 'studioStats'
const SUMMARY = 'practiceSummary'

export async function writeSummaries(
  studio: StudioStats,
  summary: PracticeSummary
): Promise<void> {
  const batch = writeBatch(db)
  batch.set(doc(db, STUDIO, studio.uid), cleanForFirestore(studio))
  batch.set(doc(db, SUMMARY, summary.uid), cleanForFirestore(summary))
  await batch.commit()
}

export async function getPracticeSummary(uid: string): Promise<PracticeSummary | null> {
  const snap = await getDoc(doc(db, SUMMARY, uid))
  return snap.exists() ? ({ uid, ...snap.data() } as PracticeSummary) : null
}

export function subscribePracticeSummary(
  uid: string,
  callback: (summary: PracticeSummary | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, SUMMARY, uid),
    (snap) => callback(snap.exists() ? ({ uid, ...snap.data() } as PracticeSummary) : null),
    (e) => { onSnapshotError('practiceSummary')(e); callback(null) }
  )
}

export function subscribeStudioStats(
  uid: string,
  callback: (stats: StudioStats | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, STUDIO, uid),
    (snap) => callback(snap.exists() ? ({ uid, ...snap.data() } as StudioStats) : null),
    (e) => { onSnapshotError('studioStats')(e); callback(null) }
  )
}

/**
 * Timer-checked minutes per day, written by the league server and nobody
 * else. Days are 'yyyy-MM-dd'; `from` is the first day the figures cover.
 */
export interface VerifiedPractice {
  from: string
  days: Record<string, number>
  updatedAt?: string
}

export function subscribeVerifiedPractice(
  uid: string,
  callback: (v: VerifiedPractice | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'verifiedPractice', uid),
    (snap) => callback(snap.exists() ? (snap.data() as VerifiedPractice) : null),
    (e) => { onSnapshotError('verifiedPractice')(e); callback(null) }
  )
}
