import {
  collection, deleteDoc, doc, getDocs, orderBy, query, setDoc, where,
} from 'firebase/firestore'
import { db, loadStorage } from '@/lib/firebase/config'
import { renderOgCard } from './card'
import type { ShareFields } from './fields'

/**
 * Publishing a card as a link instead of a picture.
 *
 * A PNG only travels where navigator.share accepts files, which on
 * desktop is almost nowhere — the download fallback in share.ts exists
 * because that path fails so often. A URL travels everywhere, and on the
 * platforms that unfurl it, it arrives as a card rather than an
 * attachment.
 *
 * What makes that work is not this file: it is that /s/<slug> is rendered
 * on the server with Open Graph tags, because no crawler runs JavaScript.
 * This end only writes the document that page reads.
 */

export type ShareKind = 'session' | 'badge' | 'streak' | 'week'

export interface ShareRecord {
  slug: string
  ownerId: string
  kind: ShareKind
  fields: ShareFields
  createdAt: string
  /** The picture a crawler fetches to draw the preview. */
  image?: string
}

const COL = 'shares'

/**
 * 22 characters from crypto.getRandomValues — ~131 bits.
 *
 * Deliberately not the session id: that is an internal key that appears in
 * other places, and a URL is the one place a key becomes something people
 * copy, forward and keep. Unguessable is the only thing standing between a
 * share and a stranger, since `get` on this collection is open.
 */
export function newSlug(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = new Uint8Array(22)
  crypto.getRandomValues(bytes)
  // Modulo over 62 from a 256-value byte is very slightly biased toward the
  // first 8 letters. At 131 bits that costs a fraction of a bit and buys
  // simplicity; it is not a secret, it is an address.
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

/** Where the published page lives. */
export function shareUrl(slug: string): string {
  return `${window.location.origin}/s/${slug}`
}

export function sharePath(ownerId: string, slug: string): string {
  return `shares/${ownerId}/${slug}.png`
}

/**
 * Publishes `fields` and returns the link.
 *
 * Three steps, in this order, because each one depends on the last:
 *
 *  1. draw the landscape card in the browser — the same renderer, the
 *     same palette and the same fields as the picture already previewed;
 *  2. upload it to the one publicly readable path in the bucket, because
 *     the crawler that fetches it is signed in as nobody;
 *  3. write the document, carrying that image's URL.
 *
 * The document is written last on purpose. A share that exists without
 * its picture unfurls as a bare link, which looks broken; a picture
 * uploaded for a share that was never written is an orphan nobody sees.
 * Of the two failures, the invisible one is the better one to risk.
 *
 * `setDoc` with an id we chose rather than `addDoc`: the slug has to be
 * ours before the upload, so the image can be stored under it.
 */
export async function createShare(
  ownerId: string,
  kind: ShareKind,
  fields: ShareFields
): Promise<{ slug: string; url: string }> {
  const slug = newSlug()

  let image: string | undefined
  try {
    const blob = await renderOgCard(fields)
    const { storage, ref, uploadBytes, getDownloadURL } = await loadStorage()
    const target = ref(storage, sharePath(ownerId, slug))
    await uploadBytes(target, blob, { contentType: 'image/png' })
    image = await getDownloadURL(target)
  } catch (err) {
    // A link with no picture still works — it unfurls with the title and
    // description, which is more than the image route gave a desktop. So
    // this is reported and carried on from, not thrown.
    console.error('[share] could not publish the preview image', err)
  }

  await setDoc(doc(db, COL, slug), {
    ownerId,
    kind,
    // Written as-is: ShareFields is already the allowlist of what may
    // leave the device, and the rules check the same list server-side.
    fields,
    createdAt: new Date().toISOString(),
    ...(image ? { image } : {}),
  })

  return { slug, url: shareUrl(slug) }
}

/** Every link this person has published, newest first. */
export async function listMyShares(ownerId: string): Promise<ShareRecord[]> {
  const snap = await getDocs(query(
    collection(db, COL),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc')
  ))
  return snap.docs.map((d) => ({ slug: d.id, ...d.data() } as ShareRecord))
}

/**
 * Unpublishes a link. The page 404s immediately.
 *
 * Previews already cached by a platform are not recalled by this and can
 * outlive it by days — the screen that offers this says so rather than
 * implying a clean undo.
 */
export async function deleteShare(ownerId: string, slug: string): Promise<void> {
  // The document first: that is what makes the page 404, and it is the
  // part that matters. A picture left in the bucket is invisible once
  // nothing points at it.
  await deleteDoc(doc(db, COL, slug))
  try {
    const { storage, ref, deleteObject } = await loadStorage()
    await deleteObject(ref(storage, sharePath(ownerId, slug)))
  } catch {
    // Already gone, or never uploaded. Either way the link is dead.
  }
}

/**
 * Publish, then hand the link to whatever the device offers.
 *
 * The native sheet is tried first and the clipboard is the fallback. Note
 * that unlike the image path this one awaits before sharing, so Safari
 * has already spent the user gesture by the time navigator.share is
 * called and may refuse to open — which is why the clipboard is not
 * treated as a sad path. Either way the person ends up holding the link.
 */
export async function publishAndShare(
  ownerId: string,
  kind: ShareKind,
  fields: ShareFields,
  text: string
): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  let url: string
  try {
    ({ url } = await createShare(ownerId, kind, fields))
  } catch {
    return 'failed'
  }

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: 'MaestroTrack', text, url })
      return 'shared'
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`)
    return 'copied'
  } catch {
    return 'failed'
  }
}
