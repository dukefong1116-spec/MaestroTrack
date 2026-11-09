import {
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage, auth } from './config'
import { onSnapshotError } from './snapshotError'
import { cleanForFirestore } from './clean'
import { withStoredDay } from './storedDay'
import type { Recording } from '@/types'

const COL = 'recordings'

/**
 * A content type the Storage rules will accept, naming the real container.
 *
 * MediaRecorder does not reliably report an `audio/*` type for an
 * audio-only recording: asked for audio/mp4 it may still describe what it
 * produced as video/mp4, because mp4 is the container either way. The
 * Storage rules match `audio/.*`, so such a take is refused as
 * `storage/unauthorized` — which reads as a rules problem and is really a
 * labelling one.
 *
 * So the container is kept and only the leading type corrected. Rewriting
 * everything to audio/webm would pass the rule just as well, but would
 * then describe an mp4 as webm, and the file extension — chosen from the
 * same format decision at record time — would disagree with it.
 */
function audioContentType(blobType: string | undefined): string {
  if (!blobType) return 'audio/webm'
  if (blobType.startsWith('audio/')) return blobType
  if (blobType.startsWith('video/')) return 'audio/' + blobType.slice('video/'.length)
  // Anything else is passed through untouched, so the Storage rule still
  // refuses it. Rewriting every unknown type to audio/webm would have made
  // the upload succeed, which is the point — but it would also mean this
  // app could put any file at all in the bucket under an audio label, and
  // the rule's content check would constrain every client except ours.
  return blobType
}

export async function uploadRecording(
  userId: string,
  file: File,
  metadata: Omit<Recording, 'id' | 'userId' | 'audioUrl' | 'storagePath' | 'createdAt'>,
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
  // The document's id is chosen first and becomes part of the path, so
  // the Storage rules can find this take's document from the file alone
  // and let a teacher hear it only while it is handed in to them.
  const docRef = doc(collection(db, COL))
  const path = `recordings/${authUid}/${docRef.id}/${file.name}`
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
  const contentType = audioContentType(file.type)

  // A small take goes up in one request.
  //
  // A resumable upload is two exchanges: a POST that starts a session and
  // carries the metadata in X-Goog-Upload-Header-Content-Type, then the
  // bytes. The rules are evaluated against that first request, so what
  // they see depends on a header rather than on the body — a longer path
  // to the same place, and one more thing between a take and the bucket.
  // Below a few megabytes there is nothing to resume anyway: the whole
  // file is one request either way.
  //
  // Larger takes keep the resumable path, where progress reporting and
  // recovery actually earn their keep.
  const ONE_SHOT_MAX = 4 * 1024 * 1024

  if (file.size <= ONE_SHOT_MAX) {
    onProgress?.(0)
    await uploadBytes(storageRef, file, { contentType })
    onProgress?.(100)
  } else {
    const uploadTask = uploadBytesResumable(storageRef, file, { contentType })
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
  }

  // Only the path is stored — no download URL. A download URL plays for
  // anyone holding it and cannot be taken back; a path plays only through
  // the SDK, as someone the Storage rules let in. See recordingAudio.
  //
  // Stripped, not spread: a take with no notes carries `notes: undefined`,
  // which Firestore refuses with `invalid-argument`. That rejection came
  // *after* the audio had already uploaded, so the file sat in the bucket
  // with no row pointing at it and the app reported the take as failed.
  await setDoc(docRef, cleanForFirestore({
    ...metadata,
    userId: authUid,
    storagePath: path,
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

/**
 * Where to play a take from.
 *
 * Asked for at the moment of playing, as the signed-in person, so the
 * Storage rules decide every time — the owner always, a teacher only while
 * the take is handed in to them. The answer is handed straight to the
 * <audio>, which streams it: playback starts after the first few seconds
 * arrive, not after the whole file has.
 *
 * It used to fetch the whole file first (getBlob) and play it from memory,
 * which made a long take — or any take on a slow connection — sit on a
 * spinner, or fail. The link is never saved anywhere: not on the take, not
 * shared, so it is no more a standing capability than a file the person
 * could save while they had access.
 *
 * Takes saved before paths were stored have only their old link.
 */
export async function recordingAudio(r: Pick<Recording, 'storagePath' | 'audioUrl'>): Promise<string> {
  if (r.storagePath) return getDownloadURL(ref(storage, r.storagePath))
  if (r.audioUrl) return r.audioUrl
  throw new Error('This take has no audio')
}

export async function deleteRecording(id: string, r: Pick<Recording, 'storagePath' | 'audioUrl'>): Promise<void> {
  await deleteDoc(doc(db, COL, id))
  const where = r.storagePath ?? r.audioUrl
  if (!where) return
  try {
    const storageRef = ref(storage, where)
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
        .map((d) => withStoredDay<Recording>(d.id, d.data(), 'recordings'))
        .filter((r): r is Recording => r !== null)
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
    // Settled here, before anything sorts or reads it — see storedDay.
    const sorted = snap.docs
      .map((d) => withStoredDay<Recording>(d.id, d.data(), 'recordings'))
      .filter((r): r is Recording => r !== null)
      .sort((a, b) => b.date.localeCompare(a.date))
    callback(sorted)
  }, onSnapshotError('recordings'))
}

/**
 * Renames a take.
 *
 * No rules change was needed: the recordings rule already lets an owner
 * update their own document and pins userId, so a title rides along with
 * everything else. Trimmed and capped here because the value is drawn in
 * a row that has to stay one line.
 */
export async function renameRecording(id: string, title: string): Promise<void> {
  await updateDoc(doc(db, COL, id), { title: title.trim().slice(0, 80) })
}
