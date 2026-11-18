import { doc, setDoc } from 'firebase/firestore'
import { auth, db, loadStorage } from './config'

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
 * A picture made the size it is shown at. A phone photo is several
 * megabytes and 4000 pixels across; as an avatar it is drawn at 40, so
 * every list it appears in (the league board, the teacher's students)
 * downloaded the whole thing. Drawn onto a canvas no larger than `max` on
 * its longer side and saved as JPEG — a few dozen kilobytes. EXIF
 * rotation is applied, so a sideways phone photo comes out upright. If
 * the browser cannot do any of this, the original goes up as before.
 */
async function shrink(file: File, max: number): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // JPEG has no transparency: a see-through PNG would turn black.
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    if (!blob) return file
    // Bigger than it is ever shown: always the resized one. Already small
    // enough: whichever file is lighter.
    return scale < 1 || blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

/** Big enough for the largest place a face is drawn (the league profile, 88px) on a 3x screen. */
const AVATAR_MAX = 512
/** A banner spans a phone or a settings column, never more. */
const BANNER_MAX = 1600

/**
 * Uploads and points the profile at it. Returns the new URL.
 *
 * The uid comes from `auth.currentUser`, not from the profile: the profile
 * can be rebuilt from a local cache and drift, and a path that disagrees
 * with the token is rejected as unauthorized with nothing to say why. The
 * recordings upload learned this the hard way.
 */
export async function uploadAvatar(file: File): Promise<string> {
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You are not signed in.')

  const problem = checkAvatarFile(file)
  if (problem) throw new Error(problem)

  const { storage, ref, uploadBytes, getDownloadURL } = await loadStorage()
  const objectRef = ref(storage, avatarPath(uid))
  const body = await shrink(file, AVATAR_MAX)
  // Stated rather than inferred: the rule matches on contentType, so a blob
  // that arrives with an empty type is refused as a permissions error for
  // what is really a labelling problem.
  await uploadBytes(objectRef, body, { contentType: body.type || file.type })
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
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You are not signed in.')

  try {
    const { storage, ref, deleteObject } = await loadStorage()
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

/**
 * The banner behind the profile photo. A picture lives beside the photo
 * (same folder, same Storage rule); a plain colour is just a field.
 * Choosing one clears the other, so the profile never holds both.
 */
export async function uploadBanner(file: File): Promise<string> {
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You are not signed in.')
  const problem = checkAvatarFile(file)
  if (problem) throw new Error(problem)
  const { storage, ref, uploadBytes, getDownloadURL } = await loadStorage()
  const objectRef = ref(storage, `avatars/${uid}/banner`)
  const body = await shrink(file, BANNER_MAX)
  await uploadBytes(objectRef, body, { contentType: body.type || file.type })
  const url = await getDownloadURL(objectRef)
  await setDoc(doc(db, 'users', uid), { bannerImage: url, updatedAt: new Date().toISOString() }, { merge: true })
  return url
}

export async function setBannerColor(color: string): Promise<void> {
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You are not signed in.')
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Not a colour.')
  await removeBannerImage(uid)
  await setDoc(doc(db, 'users', uid), { bannerColor: color, bannerImage: '', updatedAt: new Date().toISOString() }, { merge: true })
}

async function removeBannerImage(uid: string): Promise<void> {
  try {
    const { storage, ref, deleteObject } = await loadStorage()
    await deleteObject(ref(storage, `avatars/${uid}/banner`))
  } catch {
    // Never uploaded, or already gone.
  }
}

export async function removeBanner(): Promise<void> {
  await auth.authStateReady()
  const uid = auth.currentUser?.uid
  if (!uid) throw new Error('You are not signed in.')
  await removeBannerImage(uid)
  await setDoc(doc(db, 'users', uid), { bannerImage: '', updatedAt: new Date().toISOString() }, { merge: true })
}
