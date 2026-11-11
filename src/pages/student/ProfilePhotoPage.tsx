import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Camera, Image as ImageIcon, ChevronRight, Check } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useAuth } from '@/hooks/useAuth'
import { useAuthStore } from '@/stores/authStore'
import { uploadAvatar, removeAvatar, AVATAR_ACCEPT_ATTR, checkAvatarFile } from '@/lib/firebase/avatar'
import { authErrorMessage } from '@/lib/firebase/account'
import Avatar from '@/components/profile/Avatar'
import type { InstrumentType } from '@/types'

/**
 * Picking a profile photo.
 *
 * Two routes to the same file input: one that asks the camera for a fresh
 * picture (`capture`), one that opens the library. On a desktop browser
 * both land in the same file chooser, which is the right fallback — there
 * is no camera to prefer.
 *
 * Picking only previews it. Nothing is uploaded until Save — so a wrong
 * pick, or a change of mind, costs nothing; leaving the page drops it.
 */
export default function ProfilePhotoPage() {
  const { profile } = useAuth()
  const { setProfile } = useAuthStore()

  const cameraInput = useRef<HTMLInputElement>(null)
  const libraryInput = useRef<HTMLInputElement>(null)

  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null)
  const [error, setError] = useState('')
  /** Picked but not saved yet: the file, and a local picture of it. */
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null)
  const [saved, setSaved] = useState(false)

  const uid = profile?.uid
  const shown = pending?.url ?? profile?.avatar

  // The local picture is released when it is replaced, saved, or left.
  useEffect(() => () => { if (pending) URL.revokeObjectURL(pending.url) }, [pending])
  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 2500)
    return () => clearTimeout(t)
  }, [saved])

  function patchProfile(avatar: string) {
    if (!profile || !uid) return
    const updated = { ...profile, avatar, updatedAt: new Date().toISOString() }
    setProfile(updated)
    localStorage.setItem(`maestro_profile_${uid}`, JSON.stringify(updated))
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    // Clear it straight away: picking the same file twice in a row fires no
    // change event otherwise, and the second attempt looks like a dead tap.
    e.target.value = ''
    if (!file) return

    setError('')
    setSaved(false)
    const problem = checkAvatarFile(file)
    if (problem) { setError(problem); return }
    setPending({ file, url: URL.createObjectURL(file) })
  }

  async function onSave() {
    if (!pending) return
    setError('')
    setBusy('upload')
    try {
      const url = await uploadAvatar(pending.file)
      patchProfile(url)
      setPending(null)
      setSaved(true)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function onRemove() {
    setError('')
    setBusy('remove')
    try {
      await removeAvatar()
      patchProfile('')
      setPending(null)
    } catch (err) {
      setError(authErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const rowStyle = { borderTop: '1px solid var(--clay-line)' } as const

  function Row({
    icon, label, hint, onClick, disabled,
  }: {
    icon: React.ReactNode
    label: string
    hint: string
    onClick: () => void
    disabled?: boolean
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-colors disabled:opacity-50 sm:px-6"
        style={rowStyle}
      >
        <span className="flex shrink-0" style={{ color: 'var(--clay-dim)' }}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{label}</span>
          <span className="block text-xs" style={{ color: 'var(--clay-dim)' }}>{hint}</span>
        </span>
        <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--clay-faint)' }} />
      </button>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center gap-3 lg:mb-8">
        <Link
          to={`/${profile?.role === 'teacher' ? 'teacher' : 'student'}/settings/profile`}
          aria-label="Back to Edit Profile"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
          style={{ background: 'var(--clay-surface)', boxShadow: 'var(--clay-raised)', color: 'var(--clay-ink)' }}
        >
          <ChevronLeft size={20} />
        </Link>
        <h1
          className="text-[22px] font-bold leading-tight lg:text-[26px]"
          style={{ color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
        >
          Profile Photo
        </h1>
      </div>

      <input
        ref={cameraInput}
        type="file"
        accept={AVATAR_ACCEPT_ATTR}
        capture="user"
        onChange={onPick}
        className="hidden"
      />
      <input
        ref={libraryInput}
        type="file"
        accept={AVATAR_ACCEPT_ATTR}
        onChange={onPick}
        className="hidden"
      />

      <div
        className="overflow-hidden"
        style={{
          background: 'var(--clay-surface)',
          borderRadius: 'var(--clay-r-md)',
        }}
      >
        <div className="flex flex-col items-center px-5 py-8 sm:px-6">
          <Avatar
            src={shown}
            name={profile?.displayName}
            instrument={profile?.instrument as InstrumentType | undefined}
            size={132}
            className={busy === 'upload' ? 'opacity-60' : undefined}
          />
          {pending && (
            <p className="mt-4 text-[13px] font-medium" style={{ color: 'var(--clay-dim)' }}>
              {busy === 'upload' ? 'Saving…' : 'Not saved yet'}
            </p>
          )}
          {saved && !pending && (
            <p className="mt-4 flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: 'var(--clay-success-fg)' }}>
              <Check size={15} /> Photo saved
            </p>
          )}
        </div>

        <Row
          icon={<Camera size={19} />}
          label="Take a photo"
          hint="Use the camera"
          onClick={() => cameraInput.current?.click()}
          disabled={busy !== null}
        />
        <Row
          icon={<ImageIcon size={19} />}
          label="Choose from library"
          hint="Pick an existing picture"
          onClick={() => libraryInput.current?.click()}
          disabled={busy !== null}
        />
      </div>

      {pending && (
        <Button onClick={onSave} loading={busy === 'upload'} className="mt-4 w-full">
          Save photo
        </Button>
      )}

      {error && (
        <p className="mt-4 text-[13px] font-medium" style={{ color: 'var(--clay-danger)' }}>{error}</p>
      )}

      {/* Apart from the panel above: removing is not one of the ways to set
          a photo, and it should not share a surface with them. */}
      {pending ? null : profile?.avatar ? (
        <button
          type="button"
          onClick={onRemove}
          disabled={busy !== null}
          className="mt-4 flex w-full items-center justify-center rounded-[var(--clay-r-md)] py-4 text-[15px] font-semibold transition-transform active:scale-[.98] disabled:opacity-50"
          style={{ background: 'var(--clay-surface)', color: 'var(--clay-danger)', boxShadow: 'var(--clay-raised)' }}
        >
          {busy === 'remove' ? 'Removing…' : 'Remove current photo'}
        </button>
      ) : (
        <p className="mt-4 px-1 text-xs" style={{ color: 'var(--clay-faint)' }}>
          No photo yet — your initials stand in until you add one.
        </p>
      )}
    </div>
  )
}
