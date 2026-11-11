import {
  onSnapshot,
  type DocumentReference, type DocumentSnapshot, type FirestoreError, type Query, type QuerySnapshot, type Unsubscribe,
} from 'firebase/firestore'

/**
 * onSnapshot that only speaks once the server has.
 *
 * With no connection, Firestore answers a listener from its memory — and
 * on a fresh start its memory is empty, so a student with two years of
 * practice is told, as a fact, that they have none. That blanked the
 * screen on a weak signal, and overwrote the copy saved on the device with
 * nothing. So everything before the server's first confirmed answer is
 * ignored; the saved copy stays on screen until there is something true
 * to replace it with. After that first answer it behaves as before,
 * including showing your own writes straight away.
 *
 * Metadata events are asked for only to learn when the server confirms a
 * list that did not change (an empty one, say); on their own, later, they
 * deliver nothing.
 */
export function onServerSnapshot<T>(
  target: Query<T>, next: (snap: QuerySnapshot<T>) => void, error?: (e: FirestoreError) => void,
): Unsubscribe
export function onServerSnapshot<T>(
  target: DocumentReference<T>, next: (snap: DocumentSnapshot<T>) => void, error?: (e: FirestoreError) => void,
): Unsubscribe
export function onServerSnapshot(
  target: Query | DocumentReference,
  next: ((snap: QuerySnapshot) => void) | ((snap: DocumentSnapshot) => void),
  error?: (e: FirestoreError) => void,
): Unsubscribe {
  let confirmed = false
  let lastDoc: string | undefined
  const deliver = (snap: QuerySnapshot | DocumentSnapshot) => {
    const first = !confirmed && !snap.metadata.fromCache
    if (first) confirmed = true
    if (!confirmed) return
    if ('docChanges' in snap) {
      if (first || snap.docChanges().length > 0) (next as (s: QuerySnapshot) => void)(snap)
      return
    }
    const now = JSON.stringify(snap.data() ?? null)
    if (first || now !== lastDoc) (next as (s: DocumentSnapshot) => void)(snap)
    lastDoc = now
  }
  return onSnapshot(target as Query, { includeMetadataChanges: true }, deliver as (s: QuerySnapshot) => void, error)
}

/**
 * A subscription that fails silently is indistinguishable from one that
 * returns nothing.
 *
 * onSnapshot takes an optional error callback, and without it a rejected
 * query — denied by rules, or needing an index nobody has created — simply
 * never calls back. The app then shows an empty list and says "nothing
 * here yet", which is how a student with two years of practice came to see
 * "No sessions yet" with nothing anywhere explaining it.
 *
 * This does not fix a failure. It makes one findable.
 */
export function onSnapshotError(label: string) {
  return (e: FirestoreError) => {
    console.error(
      `[${label}] could not read from the database: ${e.code}.`,
      e.code === 'permission-denied'
        ? 'The security rules are refusing this read.'
        : e.code === 'failed-precondition'
          ? 'This query needs an index — the error above carries a link that creates it.'
          : e.message
    )
  }
}
