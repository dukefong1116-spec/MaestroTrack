/**
 * Getting the card off the device.
 *
 * Three routes, because no single one works everywhere: the native share
 * sheet on a phone, a download on a desktop, and copying the text when
 * neither is available.
 *
 * The blob is passed in already made, and that is the important part.
 * Safari only honours navigator.share inside the user gesture that
 * triggered it, and an `await` before the call spends that gesture — the
 * same rule that governs AudioContext.resume() and cost this app two
 * rounds of debugging. So the card is rendered when the sheet opens, and
 * the Share button hands over something that already exists.
 */

export type ShareOutcome = 'shared' | 'downloaded' | 'copied' | 'cancelled'

function fileFrom(blob: Blob): File {
  return new File([blob], `maestrotrack-${Date.now()}.png`, { type: 'image/png' })
}

export function canShareFiles(blob: Blob): boolean {
  try {
    return typeof navigator.canShare === 'function'
      && navigator.canShare({ files: [fileFrom(blob)] })
  } catch {
    return false
  }
}

/** Must be called directly from a click handler — see above. */
export async function shareCard(blob: Blob, text: string): Promise<ShareOutcome> {
  const file = fileFrom(blob)
  if (canShareFiles(blob)) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (err) {
      // Dismissing the sheet rejects with AbortError. That is a decision,
      // not a failure, and must not fall through to a surprise download.
      if ((err as { name?: string })?.name === 'AbortError') return 'cancelled'
    }
  }
  downloadCard(blob)
  return 'downloaded'
}

export function downloadCard(blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `maestrotrack-${Date.now()}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on the next tick: revoking immediately races the download in
  // some browsers and the file arrives empty.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
