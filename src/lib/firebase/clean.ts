/**
 * Firestore rejects `undefined` field values outright, with the unhelpful
 * error code `invalid-argument` and no indication of which field caused it.
 *
 * This bit twice. Sessions were fixed early by stripping undefined inline;
 * recordings were not, so any take without notes — which is most of them —
 * uploaded its audio to Storage successfully and then failed the database
 * write that records it. The audio was in the bucket and the app could
 * never find it.
 *
 * Empty strings go too: a stored `''` is indistinguishable from an absent
 * field everywhere this data is read, and keeping it only creates a second
 * shape to handle.
 */
export function cleanForFirestore<T extends object>(data: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== '') out[key] = value
  }
  return out
}
