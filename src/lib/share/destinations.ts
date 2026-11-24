import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from '@/lib/native'

/**
 * Where a card can go in one tap, besides the system share sheet:
 * Photos and Messages (the iPhone app, through FemataSharePlugin in
 * ios/App/App/NativeTabBar.swift), and the clipboard (anywhere that allows
 * copying a picture), which is how a sticker gets into an Instagram story.
 */

interface SharePlugin {
  saveImage(o: { data: string }): Promise<{ saved: boolean; denied?: boolean }>
  canMessage(): Promise<{ ok: boolean }>
  message(o: { data?: string; text: string }): Promise<{ sent: boolean }>
  shareLink(o: { url: string; text: string }): Promise<{ shared: boolean }>
}
const Native = registerPlugin<SharePlugin>('FemataShare')

export async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

/** Messages, with the card attached — the iPhone app only. */
export async function canMessage(): Promise<boolean> {
  if (!isNativeApp) return false
  try { return (await Native.canMessage()).ok } catch { return false }
}

/** A new message with the words and the link (which unfurls into the card). */
export async function sendMessage(text: string): Promise<boolean> {
  try { return (await Native.message({ text })).sent } catch { return false }
}

/**
 * The share sheet with a link. In the app, natively (it works after the
 * link was made); on the web, the browser's, and the clipboard if the
 * browser refuses (Safari only shares straight from a tap).
 */
export async function shareLink(url: string, text: string): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  if (isNativeApp) {
    try { return (await Native.shareLink({ url, text })).shared ? 'shared' : 'cancelled' } catch { /* fall through */ }
  }
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title: 'Femata', text, url }); return 'shared' } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled'
    }
  }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); return 'copied' } catch { return 'failed' }
}

/** Straight into Photos in the app; a download on the web. */
export async function saveToPhotos(blob: Blob): Promise<'saved' | 'denied' | 'downloaded' | 'failed'> {
  if (isNativeApp) {
    try {
      const r = await Native.saveImage({ data: await toBase64(blob) })
      return r.saved ? 'saved' : r.denied ? 'denied' : 'failed'
    } catch { return 'failed' }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `femata-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

/** Whether this browser can put a picture on the clipboard. */
export const canCopyImage = () =>
  typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function'

/** Must be called straight from the tap, with the picture already made. */
export async function copyImage(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return true
  } catch {
    return false
  }
}
