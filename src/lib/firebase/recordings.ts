import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './config'
import type { Recording } from '@/types'

const COL = 'recordings'

export async function uploadRecording(
  userId: string,
  file: File,
  metadata: Omit<Recording, 'id' | 'userId' | 'audioUrl' | 'createdAt'>,
  onProgress?: (pct: number) => void
): Promise<string> {
  const storageRef = ref(storage, `recordings/${userId}/${Date.now()}_${file.name}`)
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
  const docRef = await addDoc(collection(db, COL), {
    ...metadata,
    userId,
    audioUrl,
    createdAt: new Date().toISOString(),
  })
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
  const q = query(collection(db, COL), where('userId', '==', userId), orderBy('date', 'desc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Recording))
  })
}
