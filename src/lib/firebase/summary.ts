import { doc, setDoc, getDoc, onSnapshot, type Unsubscribe } from 'firebase/firestore'
import { db } from './config'
import { cleanForFirestore } from './clean'
import type { PracticeSummary, StudioStats } from '@/types'

/**
 * Rolled-up practice, written by the student's own app.
 *
 * Two documents rather than one, because they have different audiences:
 * a teacher may see the category breakdown, classmates may see only how
 * long someone practised each day. Splitting them means the rules can say
 * exactly that, instead of relying on the reader to look away — Firestore
 * rules govern whole documents and cannot withhold a field.
 */

const STUDIO = 'studioStats'
const SUMMARY = 'practiceSummary'

export async function writeSummaries(
  studio: StudioStats,
  summary: PracticeSummary
): Promise<void> {
  await Promise.all([
    setDoc(doc(db, STUDIO, studio.uid), cleanForFirestore(studio)),
    setDoc(doc(db, SUMMARY, summary.uid), cleanForFirestore(summary)),
  ])
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
    () => callback(null)
  )
}

export function subscribeStudioStats(
  uid: string,
  callback: (stats: StudioStats | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, STUDIO, uid),
    (snap) => callback(snap.exists() ? ({ uid, ...snap.data() } as StudioStats) : null),
    () => callback(null)
  )
}
