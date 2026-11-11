import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Download, Link2, Share2, X } from 'lucide-react'
import {
  buildShareFields, buildShareText, DEFAULT_SHARE_OPTIONS,
  type ShareOptions,
} from '@/lib/share/fields'
import { renderShareCard, CARD_LAYOUTS, type CardLayout } from '@/lib/share/card'
import { canShareFiles, copyText, downloadCard, shareCard } from '@/lib/share/share'
import { createShare } from '@/lib/share/link'
import { useAuth } from '@/hooks/useAuth'
import type { PracticeSession, UserProfile } from '@/types'

/**
 * Pick a card, see exactly what it says, then send it.
 *
 * The preview is not decoration. Everything here ends up somewhere public,
 * so the rule is that nothing leaves the device that the person has not
 * literally looked at first.
 */
export default function ShareSheet({
  session, profile, streakDays, pieceTitle, week, onClose,
}: {
  session: PracticeSession
  profile: Pick<UserProfile, 'displayName'>
  streakDays: number
  pieceTitle?: string
  week?: number[]
  onClose: () => void
}) {
  const [layout, setLayout] = useState<CardLayout>('number')
  const [options, setOptions] = useState<ShareOptions>(DEFAULT_SHARE_OPTIONS)
  const [preview, setPreview] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const { user } = useAuth()

  // Held as a ref as well as state: the Share button needs it synchronously.
  const blobRef = useRef<Blob | null>(null)

  const fields = useMemo(
    () => buildShareFields({ session, profile, streakDays, pieceTitle, week, options }),
    [session, profile, streakDays, pieceTitle, week, options]
  )
  const text = useMemo(() => buildShareText(fields), [fields])

  // Rendered whenever the card changes, never on the click. Safari spends
  // the user gesture on the first await, so by the time an image rendered
  // inside the handler was ready, permission to share it had gone.
  useEffect(() => {
    let alive = true
    let url: string | null = null
    setError(null)
    renderShareCard(fields, layout)
      .then((blob) => {
        if (!alive) return
        blobRef.current = blob
        url = URL.createObjectURL(blob)
        setPreview(url)
      })
      .catch(() => { if (alive) setError('Could not draw the card on this browser.') })
    return () => {
      alive = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [fields, layout])

  const flash = useCallback((msg: string) => {
    setDone(msg)
    setTimeout(() => setDone(null), 1800)
  }, [])

  function onShare() {
    const blob = blobRef.current
    if (!blob) return
    void shareCard(blob, text).then((outcome) => {
      if (outcome === 'shared') flash('Shared')
      else if (outcome === 'downloaded') flash('Saved to your device')
    })
  }

  /**
   * Publish the card as a link, then hand over the URL.
   *
   * A URL goes everywhere a message goes; a PNG only goes where
   * navigator.share accepts files, which on a desktop is almost nowhere.
   * On the platforms that unfurl it, this arrives as a card rather than
   * an attachment — which is the whole point.
   *
   * Unlike the image path this one has to await before sharing, so the
   * Safari gesture rule is lost and the native sheet may not open. The
   * clipboard is the fallback, and the link is the thing either way.
   */
  async function onShareLink() {
    const uid = user?.uid
    if (!uid || publishing) return
    setPublishing(true)
    try {
      const { url } = await createShare(uid, 'session', fields)
      const payload = `${text}\n${url}`
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: 'MaestroTrack', text, url })
          flash('Shared')
          return
        } catch (err) {
          // Dismissing the sheet is a decision, not a failure.
          if ((err as { name?: string })?.name === 'AbortError') return
        }
      }
      flash(await copyText(payload) ? 'Link copied' : 'Could not copy the link')
    } catch {
      setError('Could not publish the link. Check your connection and try again.')
    } finally {
      setPublishing(false)
    }
  }

  const toggle = (key: keyof ShareOptions) =>
    setOptions((o) => ({ ...o, [key]: !o[key] }))

  const native = blobRef.current ? canShareFiles(blobRef.current) : false

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center p-2 sm:items-center sm:p-4"
      style={{ background: 'rgba(58,48,84,.42)', paddingTop: 'max(8px, env(safe-area-inset-top))' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        // Never taller than the screen: on a phone, with the browser's own
        // bars taking their share, the sheet used to grow past the top and
        // take its close button with it — leaving no way out at all. Now it
        // scrolls inside itself, and the title row with × stays pinned.
        className="no-scrollbar w-full max-w-[420px] overflow-y-auto overscroll-contain px-5 pb-5"
        style={{
          background: 'var(--clay-surface)',
          borderRadius: 'var(--clay-r-lg)',
          maxHeight: 'calc(100dvh - 16px - env(safe-area-inset-top))',
        }}
      >
        <div className="sticky top-0 z-10 -mx-5 mb-3 flex items-center justify-between px-5 pb-2 pt-5" style={{ background: 'var(--clay-surface)' }}>
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>
            Share your session
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: 'var(--clay-ink)', background: 'var(--clay-bg)' }}
          >
            <X size={17} />
          </button>
        </div>

        <div
          className="mb-3 flex aspect-[4/5] items-center justify-center overflow-hidden"
          // Shorter on a short screen, so the choices below still fit; the
          // card inside keeps its own shape (object-contain).
          style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-md)', maxHeight: '44dvh', marginInline: 'auto' }}
        >
          {error ? (
            <p className="px-6 text-center text-[12px]" style={{ color: 'var(--clay-dim)' }}>{error}</p>
          ) : preview ? (
            <img src={preview} alt="Your share card" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[12px]" style={{ color: 'var(--clay-faint)' }}>Drawing…</span>
          )}
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          {CARD_LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLayout(l.id)}
              className="rounded-[14px] px-2 py-2 text-left transition-colors"
              style={
                layout === l.id
                  ? { background: 'var(--clay-accent)', color: 'var(--clay-on-accent)' }
                  : { background: 'var(--clay-bg)', color: 'var(--clay-dim)' }
              }
            >
              <span className="block text-[12px] font-semibold">{l.label}</span>
              <span className="mt-0.5 block text-[10px] leading-tight opacity-80">{l.hint}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Toggle on={options.includeName} onClick={() => toggle('includeName')} label="My name" />
          <Toggle on={options.includeStreak} onClick={() => toggle('includeStreak')} label="Streak" />
          <Toggle on={options.includePiece} onClick={() => toggle('includePiece')} label="Piece" />
        </div>

        {/* The link leads. It unfurls as a card in every messaging app and
            most social ones; the image is kept beside it because Instagram
            and TikTok do not unfurl links at all, and that is where this
            gets posted. */}
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => void onShareLink()}
            disabled={!preview || publishing}
            className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-[13.5px] font-bold disabled:opacity-40"
            style={{
              background: 'var(--clay-accent)',
              color: 'var(--clay-on-accent)',
              boxShadow: 'var(--clay-accent-shadow)',
            }}
          >
            <Link2 size={15} />
            {publishing ? 'Publishing…' : 'Share link'}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onShare}
            disabled={!preview}
            aria-label={native ? 'Share the image' : 'Save the image'}
            className="flex h-[46px] w-[46px] items-center justify-center rounded-full disabled:opacity-40"
            style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}
          >
            {native ? <Share2 size={15} /> : <Download size={15} />}
          </motion.button>
        </div>

        <div className="mt-2.5 flex items-center justify-center gap-3 text-[11.5px]">
          <button
            onClick={() => { if (blobRef.current) { downloadCard(blobRef.current); flash('Saved') } }}
            style={{ color: 'var(--clay-dim)' }}
          >
            save image
          </button>
          <span style={{ color: 'var(--clay-faint)' }} aria-hidden="true">·</span>
          <button
            onClick={() => void copyText(text).then((ok) => flash(ok ? 'Text copied' : 'Could not copy'))}
            style={{ color: 'var(--clay-dim)' }}
          >
            copy the caption
          </button>
        </div>

        <p className="mt-2 text-center text-[10.5px] leading-snug" style={{ color: 'var(--clay-faint)' }}>
          A link is public to anyone who gets it. Remove it any time in
          Settings → Privacy &amp; Security.
        </p>

        <AnimatePresence>
          {done && (
            <motion.p
              initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-2 flex items-center justify-center gap-1.5 text-[12px] font-semibold"
              style={{ color: 'var(--clay-mint)' }}
            >
              <Check size={13} /> {done}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors"
      style={
        on
          ? { background: 'var(--clay-accent-soft)', color: 'var(--clay-accent-ink)' }
          : { background: 'var(--clay-bg)', color: 'var(--clay-faint)' }
      }
    >
      {label}
    </button>
  )
}
