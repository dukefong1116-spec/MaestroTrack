import { useEffect, useRef, useState } from 'react'
import { ImageUp, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { useLeagueStore } from '@/stores/leagueStore'
import { AVATAR_ACCEPT_ATTR, removeBanner, setBannerColor, uploadBanner } from '@/lib/firebase/avatar'

/**
 * Choosing the strip behind your profile photo: a picture of your own, or
 * any plain colour from the system colour picker. Shown here and on your
 * league profile.
 */
export default function BannerSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  /** Shown at once; the league card catches up on the next sync. */
  const patch = (p: { bannerColor?: string; bannerImage?: string }) => {
    const live = useAuthStore.getState().profile
    if (live) useAuthStore.getState().setProfile({ ...live, ...p })
  }
  const resync = () => { if (profile?.role === 'student' && !profile.leagueOptOut) void useLeagueStore.getState().sync() }

  const pickColour = (c: string) => {
    patch({ bannerColor: c, bannerImage: '' })
    setError(null)
    // The picker reports every step of a drag: save once it settles.
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      setBannerColor(c).then(resync).catch(() => setError('Couldn’t save that colour. Try again.'))
    }, 600)
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const url = await uploadBanner(file)
      patch({ bannerImage: url })
      resync()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t upload that picture.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await removeBanner()
      patch({ bannerImage: '' })
      resync()
    } catch {
      setError('Couldn’t remove the picture. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const row = 'flex w-full items-center gap-3 px-1 py-3 text-left text-[15px] font-semibold'
  const colour = profile?.bannerColor || '#C7E9F0'

  return (
    <Modal open={open} onClose={onClose} title="Profile background" size="sm">
      <label className={`${row} cursor-pointer`} style={{ color: 'var(--clay-ink)', opacity: busy ? 0.5 : 1 }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-[10px]" style={{ background: 'var(--clay-accent-soft)', color: 'var(--clay-accent-ink)' }}>
          <ImageUp size={18} aria-hidden="true" />
        </span>
        <span className="flex-1">{busy ? 'Uploading…' : 'Upload a picture'}</span>
        <input type="file" accept={AVATAR_ACCEPT_ATTR} className="sr-only" disabled={busy} onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      <label className={row} style={{ color: 'var(--clay-ink)', borderTop: '1px solid var(--clay-line)' }}>
        <span className="h-9 w-9 rounded-[10px]" style={{ background: colour, border: '1px solid var(--clay-line)' }} aria-hidden="true" />
        <span className="flex-1">Plain colour</span>
        <input
          type="color"
          aria-label="Background colour"
          value={colour}
          onChange={(e) => pickColour(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded-[8px] border-0 bg-transparent p-0"
        />
      </label>
      {profile?.bannerImage && (
        <button type="button" onClick={() => void remove()} disabled={busy} className={row} style={{ color: 'var(--clay-danger-fg)', borderTop: '1px solid var(--clay-line)' }}>
          <span className="flex h-9 w-9 items-center justify-center"><Trash2 size={18} aria-hidden="true" /></span>
          Remove picture
        </button>
      )}
      {error && <p className="mt-2 text-[13px]" style={{ color: 'var(--clay-danger-fg)' }}>{error}</p>}
    </Modal>
  )
}
