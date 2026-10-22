import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Download, Share2, X } from 'lucide-react'
import {
  buildShareFields, buildShareText, DEFAULT_SHARE_OPTIONS,
  type ShareOptions,
} from '@/lib/share/fields'
import { renderShareCard, CARD_LAYOUTS, type CardLayout } from '@/lib/share/card'
import { canShareFiles, copyText, downloadCard, shareCard } from '@/lib/share/share'
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

  const toggle = (key: keyof ShareOptions) =>
    setOptions((o) => ({ ...o, [key]: !o[key] }))

  const native = blobRef.current ? canShareFiles(blobRef.current) : false

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      style={{ background: 'rgba(58,48,84,.42)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="w-full max-w-[420px] overflow-hidden p-5"
        style={{ background: 'var(--clay-surface)', borderRadius: 'var(--clay-r-lg)' }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--clay-ink)' }}>
            Share your session
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ color: 'var(--clay-dim)' }}>
            <X size={17} />
          </button>
        </div>

        <div
          className="mb-3 flex aspect-[4/5] items-center justify-center overflow-hidden"
          style={{ background: 'var(--clay-bg)', borderRadius: 'var(--clay-r-md)' }}
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

        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onShare}
            disabled={!preview}
            className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-[13.5px] font-bold disabled:opacity-40"
            style={{
              background: 'var(--clay-accent)',
              color: 'var(--clay-on-accent)',
              boxShadow: 'var(--clay-accent-shadow)',
            }}
          >
            {native ? <Share2 size={15} /> : <Download size={15} />}
            {native ? 'Share' : 'Save image'}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { if (blobRef.current) { downloadCard(blobRef.current); flash('Saved') } }}
            disabled={!preview}
            aria-label="Save image"
            className="flex h-[46px] w-[46px] items-center justify-center rounded-full disabled:opacity-40"
            style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}
          >
            <Download size={15} />
          </motion.button>
        </div>

        <button
          onClick={() => void copyText(text).then((ok) => flash(ok ? 'Text copied' : 'Could not copy'))}
          className="mt-2.5 w-full text-[11.5px]"
          style={{ color: 'var(--clay-dim)' }}
        >
          or copy the caption
        </button>

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
