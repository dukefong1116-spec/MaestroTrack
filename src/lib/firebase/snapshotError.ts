import type { FirestoreError } from 'firebase/firestore'

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
