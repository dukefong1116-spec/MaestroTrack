import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db, storage } from './config'

/**
 * Profile photos.
 *
 * One object per person at a fixed path, overwritten on each upload. The
 * alternative — a timestamped name like recordings use — leaves every
 * picture someone has ever set sitting in the bucket, and gives us two
 * things to keep in step (the file and the pointer to it) instead of one.
 *
 * `getDownloadURL` returns a fresh token each time the object is replaced,
 * so the stored URL changes on every upload and no cache has to be busted
 * by hand.
 */

const MAX_BYTES = 5 * 1024 * 1024

/** Kept in step with the Storage rule, which accepts exactly these. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const AVATAR_ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(',')

export function avatarPath(uid: string): string {
  return `avatars/${uid}/profile`
}

/** Why a file was refused, in words a person can act on. */
export function checkAvatarFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'That needs to be a JPEG, PNG or WebP image.'
  }
  if (file.size > MAX_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 5MB.`
  }
  return null
}

/**
 * Uploads and points the profile at it. Returns the new URL.
 *
 * The uid comes from `auth.currentUser`, not from the profile: the profile
 * can be rebuilt from a local cache and drift, and a path that disagrees
 * with the token is rejected as unauthorized with nothing to say why. The
 * recordings upload learned this the hard way.
 */
export async function uploadAvatar(file: File): Promise<string> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You are not signed in.')

  const problem = checkAvatarFile(file)
  if (problem) throw new Error(problem)

  const objectRef = ref(storage, avatarPath(uid))
  // Stated rather than inferred: the rule matches on contentType, so a blob
  // that arrives with an empty type is refused as a permissions error for
  // what is really a labelling problem.
  await uploadBytes(objectRef, file, { contentType: file.type })
  const url = await getDownloadURL(objectRef)

  await setDoc(
    doc(db, 'users', uid),
    { avatar: url, updatedAt: new Date().toISOString() },
    { merge: true }
  )
  return url
}

/**
 * Clears the photo. The object goes first, then the pointer — the other
 * order can leave a profile pointing at a file that is no longer there.
 */
export async function removeAvatar(): Promise<void> {
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You are not signed in.')

  try {
    await deleteObject(ref(storage, avatarPath(uid)))
  } catch {
    // Already gone, or never uploaded. Clearing the pointer is still right.
  }

  await setDoc(
    doc(db, 'users', uid),
    { avatar: '', updatedAt: new Date().toISOString() },
    { merge: true }
  )
}
