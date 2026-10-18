import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage, auth } from './config'
import { onSnapshotError } from './snapshotError'
import { cleanForFirestore } from './clean'
import type { Recording } from '@/types'

const COL = 'recordings'

/**
 * A content type the Storage rules will accept.
 *
 * Falls back to audio/webm rather than refusing, because the file really
 * is audio either way and the alternative is losing the take. The
 * extension chosen at record time comes from the same format decision, so
 * this stays consistent with the name.
 */
function audioContentType(blobType: string | undefined): string {
  return blobType && blobType.startsWith('audio/') ? blobType : 'audio/webm'
}

export async function uploadRecording(
  userId: string,
  file: File,
  metadata: Omit<Recording, 'id' | 'userId' | 'audioUrl' | 'createdAt'>,
  onProgress?: (pct: number) => void
): Promise<string> {
  // The path must be built from the *authenticated* uid, because that is
  // what the security rules compare against (request.auth.uid). Callers
  // pass a uid taken from the profile, which is rebuilt from a local cache
  // when the Firestore doc is missing and can therefore drift. If the two
  // ever disagree the upload is rejected as unauthorized, with nothing to
  // indicate why.
  const authUid = auth.currentUser?.uid
  if (!authUid) throw Object.assign(new Error('Not signed in'), { code: 'storage/unauthenticated' })
  if (authUid !== userId) {
    console.warn('[recordings] profile uid', userId, 'differs from auth uid', authUid, '— using auth uid')
  }
  const path = `recordings/${authUid}/${Date.now()}_${file.name}`
  const storageRef = ref(storage, path)
  // Say what this is, rather than hoping the blob still knows.
  //
  // The upload used to send no metadata at all, which leaves the content
  // type to whatever `file.type` happens to hold. The Storage rules only
  // accept `audio/*`, so a blob that arrives with an empty type — or with
  // a container type like video/webm, which some browsers report for an
  // audio-only MediaRecorder — is rejected as `storage/unauthorized`:
  // a permissions error for what is really a labelling problem, with
  // nothing on screen to say so. Verified against the emulator: an empty
  // content type is refused, every audio/* one is accepted.
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: audioContentType(file.type),
  })

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
        onProgress?.(pct)
      },
      reject,
      resolve
    )
  })

  const audioUrl = await getDownloadURL(storageRef)
  // Stripped, not spread: a take with no notes carries `notes: undefined`,
  // which Firestore refuses with `invalid-argument`. That rejection came
  // *after* the audio had already uploaded, so the file sat in the bucket
  // with no row pointing at it and the app reported the take as failed.
  const docRef = await addDoc(collection(db, COL), cleanForFirestore({
    ...metadata,
    userId: authUid,
    audioUrl,
    createdAt: new Date().toISOString(),
  }))
  return docRef.id
}

/**
 * Marks takes as handed in, which is what makes them readable by the
 * student's teacher. Recordings are private until this is called — a
 * student records freely while practising, and chooses what is heard.
 */
export async function shareRecordings(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) => updateDoc(doc(db, COL, id), { sharedWithTeacher: true }))
  )
}

export async function deleteRecording(id: string, audioUrl: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
  try {
    const storageRef = ref(storage, audioUrl)
    await deleteObject(storageRef)
  } catch {
    // storage object may already be gone
  }
}

/**
 * The takes a teacher is allowed to hear: the ones handed in.
 *
 * Separate from subscribeRecordings rather than a parameter, because the
 * filter is not cosmetic — a security rule only permits a query when the
 * query itself proves every possible result is readable. Asking for a
 * student's recordings without constraining sharedWithTeacher is refused
 * outright, so a teacher would see none at all rather than only the
 * private ones being withheld.
 */
export function subscribeSharedRecordings(
  userId: string,
  callback: (recordings: Recording[]) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where('userId', '==', userId),
    where('sharedWithTeacher', '==', true)
  )
  return onSnapshot(q, (snap) => {
    callback(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Recording)
        .sort((a, b) => b.date.localeCompare(a.date))
    )
  }, onSnapshotError('recordings'))
}

export function subscribeRecordings(
  userId: string,
  callback: (recordings: Recording[]) => void
): Unsubscribe {
  const q = query(collection(db, COL), where('userId', '==', userId))
  return onSnapshot(q, (snap) => {
    const sorted = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as Recording)
      .sort((a, b) => b.date.localeCompare(a.date))
    callback(sorted)
  }, onSnapshotError('recordings'))
}
