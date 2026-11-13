import { useState } from 'react'
import { FileText, Image, Music, Video } from 'lucide-react'
import { attachmentUrl } from '@/lib/firebase/studio'
import type { AssignmentAttachment } from '@/types'

const ICON = { audio: Music, video: Video, pdf: FileText, image: Image }

/**
 * The files a teacher attached to an assignment: a demo to listen to, the
 * score. Each opens in a new tab, fetched only when tapped. Shown to the
 * student and the teacher alike.
 */
export default function AttachmentList({ files, className }: { files?: AssignmentAttachment[]; className?: string }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  if (!files?.length) return null
  async function open(f: AssignmentAttachment) {
    setBusy(f.storagePath)
    setError('')
    // Opened first, filled in once the link arrives: a tab opened after an
    // await is treated as a pop-up and blocked on a phone.
    const tab = window.open('', '_blank')
    try {
      const url = await attachmentUrl(f)
      if (tab) tab.location.href = url
      else window.location.href = url
    } catch {
      tab?.close()
      setError('Could not open that file.')
    } finally {
      setBusy(null)
    }
  }
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-1.5">
        {files.map((f) => {
          const Icon = ICON[f.kind] ?? FileText
          return (
            <button key={f.storagePath} type="button" disabled={busy === f.storagePath} onClick={() => open(f)}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-60"
              style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>
              <Icon size={13} aria-hidden="true" style={{ color: 'var(--clay-accent-ink)' }} />
              <span className="truncate">{f.name}</span>
            </button>
          )
        })}
      </div>
      {error && <p className="mt-1 text-[12px]" style={{ color: 'var(--clay-danger)' }}>{error}</p>}
    </div>
  )
}
