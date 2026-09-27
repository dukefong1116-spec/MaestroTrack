import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage, auth } from './config'
import { cleanForFirestore } from './clean'
import type { Recording } from '@/types'

const COL = 'recordings'

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
  const uploadTask = uploadBytesResumable(storageRef, file)

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

export async function deleteRecording(id: string, audioUrl: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
  try {
    const storageRef = ref(storage, audioUrl)
    await deleteObject(storageRef)
  } catch {
    // storage object may already be gone
  }
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
  })
}
