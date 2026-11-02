import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore'
import { auth, db } from './config'

/**
 * Everything the signed-in person's account holds, as one JSON file.
 *
 * Read entirely from the client with their own credentials, so no rule
 * changes and no backend: if a query here were refused, that would mean
 * the app could not show them their own data either.
 *
 * Deliberately only their own documents. A teacher's export does not
 * include their students' practice — that is the students' data, and the
 * rules do not grant it (a teacher sees rolled-up figures, never sessions).
 */

/** Collections keyed by a plain `userId` field. */
const BY_USER = ['practiceSessions', 'pieces', 'performances', 'recordings'] as const
/** Collections where the person is the student the row is about. */
const BY_STUDENT = ['assignments', 'lessonSlots'] as const
/** Documents whose id is the uid. */
const BY_UID_DOC = ['practiceSummary', 'studioStats'] as const

export interface ExportResult {
  json: string
  filename: string
  counts: Record<string, number>
}

async function safeCollect(
  label: string,
  run: () => Promise<unknown[]>,
  counts: Record<string, number>
): Promise<unknown[]> {
  try {
    const rows = await run()
    counts[label] = rows.length
    return rows
  } catch {
    // A collection this role has no claim on is not an error worth
    // failing the whole export for — it is simply not theirs.
    counts[label] = 0
    return []
  }
}

export async function buildDataExport(): Promise<ExportResult> {
  const user = auth.currentUser
  if (!user) throw new Error('You are not signed in.')
  const uid = user.uid

  const counts: Record<string, number> = {}
  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    account: {
      uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      createdAt: user.metadata.creationTime ?? null,
      lastSignInAt: user.metadata.lastSignInTime ?? null,
    },
  }

  const profile = await getDoc(doc(db, 'users', uid))
  out.profile = profile.exists() ? profile.data() : null
  counts.profile = profile.exists() ? 1 : 0

  for (const name of BY_USER) {
    out[name] = await safeCollect(name, async () => {
      const snap = await getDocs(query(collection(db, name), where('userId', '==', uid)))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    }, counts)
  }

  for (const name of BY_STUDENT) {
    out[name] = await safeCollect(name, async () => {
      const snap = await getDocs(query(collection(db, name), where('studentId', '==', uid)))
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    }, counts)
  }

  for (const name of BY_UID_DOC) {
    out[name] = await safeCollect(name, async () => {
      const snap = await getDoc(doc(db, name, uid))
      return snap.exists() ? [snap.data()] : []
    }, counts)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  return {
    json: JSON.stringify(out, null, 2),
    filename: `maestrotrack-${stamp}.json`,
    counts,
  }
}

/** Hands the file to the browser. Separate so the build can be tested. */
export function downloadJson({ json, filename }: ExportResult): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on the next tick: Safari has not finished reading it yet when
  // click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
