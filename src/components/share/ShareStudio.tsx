import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Copy, Download, Link2, MessageCircle, Share2, X } from 'lucide-react'
import { useHoldMoment, useHoldSheet } from '@/stores/momentStore'
import { DEFAULT_SHARE_OPTIONS, buildShareText, type ShareOptions } from '@/lib/share/fields'
import { FORMATS, THEMES, THEMES_FOR, renderMomentCard, type CardFormat } from '@/lib/share/story'
import { rasterize } from '@/lib/share/art'
import { copyText } from '@/lib/share/share'
import { createShare } from '@/lib/share/link'
import { canCopyImage, canMessage, copyImage, saveToPhotos, sendMessage, shareLink } from '@/lib/share/destinations'
import { haptic } from '@/lib/haptics'
import { useAuth } from '@/hooks/useAuth'
import Femata, { type FemataMood } from '@/components/femata/Femata'
import BadgeArt from '@/components/badges/BadgeArt'
import type { BadgeArtName } from '@/components/badges/BadgeArt'
import type { ShareRequest } from '@/stores/shareStore'

/**
 * The share window: swipe through the card's colours, pick a shape
 * (Story, Post, Sticker), choose what is on it, then send it in one tap —
 * Messages, Photos, copy, a link, or everything else the phone offers
 * (Instagram, WhatsApp, TikTok… through the system sheet).
 *
 * Nothing leaves the device that the person has not seen: the card they
 * swipe to is the card that is sent.
 */
const MOODS: FemataMood[] = ['celebrate', 'happy', 'proud', 'cool', 'wink', 'in-love']

export default function ShareStudio({ request, onClose }: { request: ShareRequest; onClose: () => void }) {
  useHoldSheet(true)
  // Full screen while open: a badge won meanwhile waits its turn behind it.
  useHoldMoment(true)
  const { user } = useAuth()
  const [format, setFormat] = useState<CardFormat>('story')
  // A sticker is see-through, so it has one look; a card has three colours.
  const themes = useMemo(() => (format === 'sticker' ? THEMES_FOR[request.kind].slice(0, 1) : THEMES_FOR[request.kind]), [format, request.kind])
  const [pick, setPick] = useState(0)
  const [mood, setMood] = useState<FemataMood>(request.mood ?? 'celebrate')
  const [options, setOptions] = useState<ShareOptions>(DEFAULT_SHARE_OPTIONS)
  const [art, setArt] = useState<HTMLImageElement | null>(null)
  const [cards, setCards] = useState<{ blob: Blob; url: string }[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState(false)
  const strip = useRef<HTMLDivElement>(null)

  const fields = useMemo(() => request.build(options), [request, options])
  const text = useMemo(() => buildShareText(fields), [fields])

  useEffect(() => { void canMessage().then(setMessages) }, [])

  // The picture in the middle: the badge's own art, or Femata.
  useEffect(() => {
    let live = true
    const node = request.badgeId
      ? <BadgeArt name={request.badgeId as BadgeArtName} size={600} />
      : <Femata mood={mood} tone="sunrise" size={700} />
    void rasterize(node).then((img) => { if (live) setArt(img) })
    return () => { live = false }
  }, [request.badgeId, mood])

  // Every colour drawn ahead, for the current shape and choices: the phone
  // only opens the share sheet straight from a tap with the picture ready.
  useEffect(() => {
    let live = true
    const made: string[] = []
    void Promise.all(themes.map((theme) => renderMomentCard({ kind: request.kind, fields, format, theme, art, reddit: request.reddit })))
      .then((blobs) => {
        if (!live) return
        const next = blobs.map((blob) => { const url = URL.createObjectURL(blob); made.push(url); return { blob, url } })
        setCards(next)
      })
      .catch(() => { if (live) setNote('Could not draw the card on this device.') })
    return () => { live = false; made.forEach((u) => URL.revokeObjectURL(u)) }
  }, [request.kind, fields, format, art, themes])

  const flash = useCallback((msg: string) => {
    setNote(msg)
    window.setTimeout(() => setNote(null), 2000)
  }, [])

  const current = cards[Math.min(pick, cards.length - 1)]?.blob ?? null
  const toggle = (k: keyof ShareOptions) => setOptions((o) => ({ ...o, [k]: !o[k] }))

  function onScroll() {
    const el = strip.current
    if (!el) return
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== pick) { setPick(i); haptic('select') }
  }
  const goTo = (i: number) => strip.current?.scrollTo({ left: i * strip.current.clientWidth, behavior: 'smooth' })

  // The link for exactly this card, made once (on the first send) and
  // reused: a link is a public page, so it is never made until asked for.
  const linkFor = useRef<{ key: string; url: string } | null>(null)
  async function link(): Promise<string | null> {
    if (!user?.uid) return null
    const key = JSON.stringify([request.kind, fields])
    if (linkFor.current?.key === key) return linkFor.current.url
    setBusy(true)
    try {
      // The tall card in the colours chosen, for the page the link opens.
      const full = await renderMomentCard({ kind: request.kind, fields, format: 'story', theme: themes[Math.min(pick, themes.length - 1)], art }).catch(() => undefined)
      const { url } = await createShare(user.uid, request.kind, fields, full)
      linkFor.current = { key, url }
      return url
    } catch {
      flash('Could not make the link. Check your connection.')
      return null
    } finally {
      setBusy(false)
    }
  }
  const sent = (o: string) => { if (o === 'shared') flash('Shared'); else if (o === 'copied') flash('Link copied') }

  const formats = request.reddit ? [...FORMATS, { id: 'reddit' as const, label: 'Reddit' }] : FORMATS
  const reddit = format === 'reddit'
  // A title to post it with: the picture carries no words to copy.
  const redditTitle = `Day ${fields.streakDays ?? 0} of practising ${request.reddit?.instrument ?? 'music'} every day`

  const dests: { id: string; label: string; icon: React.ReactNode; bg: string; fg: string; run: () => void; hide?: boolean }[] = [
    {
      id: 'messages', label: 'Messages', icon: <MessageCircle size={22} />, bg: '#34C759', fg: '#fff', hide: !messages || reddit,
      run: () => void link().then((url) => { if (url) void sendMessage(`${text}\n${url}`).then((ok) => { if (ok) flash('Sent') }) }),
    },
    {
      id: 'save', label: 'Save', icon: <Download size={22} />, bg: 'var(--clay-bg)', fg: 'var(--clay-ink)',
      run: () => {
        if (!current) return
        void saveToPhotos(current).then((r) => flash(r === 'saved' ? 'Saved to Photos' : r === 'downloaded' ? 'Saved' : r === 'denied' ? 'Allow Photos in Settings to save' : 'Could not save'))
      },
    },
    reddit
      ? {
        id: 'title', label: 'Copy title', icon: <Copy size={21} />, bg: 'var(--clay-bg)', fg: 'var(--clay-ink)',
        run: () => void copyText(redditTitle).then((ok) => flash(ok ? 'Title copied' : 'Could not copy')),
      }
      : format === 'sticker'
      ? {
        id: 'copy', label: 'Copy sticker', icon: <Copy size={21} />, bg: 'var(--clay-bg)', fg: 'var(--clay-ink)', hide: !canCopyImage(),
        run: () => { if (current) void copyImage(current).then((ok) => flash(ok ? 'Copied — paste it on your story' : 'Could not copy')) },
      }
      : {
        id: 'copy', label: busy ? 'Making…' : 'Copy link', icon: <Link2 size={21} />, bg: 'var(--clay-bg)', fg: 'var(--clay-ink)', hide: !user,
        run: () => void link().then((url) => { if (url) void copyText(`${text}\n${url}`).then((ok) => flash(ok ? 'Link copied' : 'Could not copy')) }),
      },
    {
      id: 'more', label: 'More', icon: <Share2 size={21} />, bg: 'var(--clay-accent)', fg: 'var(--clay-on-accent)', hide: !user || reddit,
      run: () => void link().then((url) => { if (url) void shareLink(url, text).then(sent) }),
    },
  ]

  const ratio = format === 'story' ? '9 / 16' : format === 'post' || format === 'reddit' ? '4 / 5' : '1080 / 760'

  return (
    <motion.div
      className="fixed inset-0 z-[85] flex items-end justify-center p-2 sm:items-center sm:p-4"
      style={{ background: 'rgba(14,22,38,.5)', paddingTop: 'max(8px, env(safe-area-inset-top))' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        className="no-scrollbar w-full max-w-[440px] overflow-y-auto overscroll-contain px-5 pb-5"
        style={{ background: 'var(--clay-surface)', borderRadius: 'var(--clay-r-lg)', maxHeight: 'calc(100dvh - 16px - env(safe-area-inset-top))', paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}
      >
        <div className="sticky top-0 z-10 -mx-5 flex items-center justify-between px-5 pb-2 pt-4" style={{ background: 'var(--clay-surface)' }}>
          <h2 className="text-[16px] font-bold" style={{ color: 'var(--clay-ink)' }}>{request.title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'var(--clay-bg)', color: 'var(--clay-ink)' }}>
            <X size={17} />
          </button>
        </div>

        {/* The cards, one per colour: swipe between them. */}
        <div ref={strip} onScroll={onScroll} className="no-scrollbar -mx-5 flex snap-x snap-mandatory overflow-x-auto" aria-label="Card designs">
          {themes.map((t, i) => (
            <div key={t} className="flex w-full shrink-0 snap-center justify-center px-5 py-1">
              <div
                className="flex items-center justify-center overflow-hidden"
                style={{
                  aspectRatio: ratio, height: format === 'sticker' ? 'auto' : 'min(46dvh, 440px)', width: format === 'sticker' ? '100%' : undefined,
                  borderRadius: 18, boxShadow: '0 10px 30px -12px rgba(14,22,38,.45)',
                  // A sticker is see-through: shown over a stand-in photo.
                  background: format === 'sticker' ? 'linear-gradient(135deg,#8B6B4A,#3A2A1E)' : 'var(--clay-bg)',
                }}
              >
                {cards[i]
                  ? <img src={cards[i].url} alt={`${THEMES[t].label} card`} className="h-full w-full object-contain" draggable={false} />
                  : <div className="h-7 w-7 animate-spin rounded-full" style={{ border: '3px solid var(--clay-accent-soft)', borderTopColor: 'var(--clay-accent)' }} />}
              </div>
            </div>
          ))}
        </div>
        {format !== 'sticker' && (
          <div className="mt-2 flex items-center justify-center gap-2">
            {themes.map((t, i) => (
              <button key={t} type="button" onClick={() => goTo(i)} aria-label={`${THEMES[t].label} colours`}
                className="h-6 w-6 rounded-full transition-transform"
                style={{ background: `linear-gradient(135deg, ${THEMES[t].top}, ${THEMES[t].bottom})`, outline: i === pick ? '2.5px solid var(--clay-accent)' : '1px solid var(--clay-line)', outlineOffset: 2, transform: i === pick ? 'scale(1.08)' : 'none' }} />
            ))}
          </div>
        )}

        {/* The shape. */}
        <div className={`mt-3 grid ${formats.length > 3 ? 'grid-cols-4' : 'grid-cols-3'} rounded-full p-1`} style={{ background: 'rgba(118,118,128,.14)' }} role="group" aria-label="Shape">
          {formats.map((f) => (
            <button key={f.id} type="button" aria-pressed={format === f.id} onClick={() => { setFormat(f.id); setPick(0); strip.current?.scrollTo({ left: 0 }); haptic('select') }}
              className="rounded-full py-1.5 text-[13px] font-semibold transition-colors"
              style={format === f.id ? { background: 'var(--clay-surface)', color: 'var(--clay-ink)', boxShadow: '0 1px 2px rgba(20,30,60,.1)' } : { color: 'var(--clay-dim)' }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* What is on it. */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {request.toggles.name && !reddit && <Chip on={options.includeName} onClick={() => toggle('includeName')}>My name</Chip>}
          {request.toggles.streak && <Chip on={options.includeStreak} onClick={() => toggle('includeStreak')}>Streak</Chip>}
          {request.toggles.piece && <Chip on={options.includePiece} onClick={() => toggle('includePiece')}>Piece</Chip>}
        </div>
        {!request.badgeId && (
          <div className="mt-2 grid grid-cols-6 gap-2" role="group" aria-label="Femata's face">
            {MOODS.map((m) => (
              <button key={m} type="button" aria-pressed={mood === m} aria-label={`Femata ${m}`} onClick={() => { setMood(m); haptic('select') }}
                className="flex aspect-square w-full items-center justify-center rounded-[12px]"
                style={{ background: mood === m ? 'var(--clay-accent-soft)' : 'var(--clay-bg)', outline: mood === m ? '2px solid var(--clay-accent)' : 'none' }}>
                <Femata mood={m} size={34} />
              </button>
            ))}
          </div>
        )}

        {/* Where it goes, in one tap. */}
        <div className="mt-4 flex justify-between gap-1">
          {dests.filter((d) => !d.hide).map((d) => (
            <button key={d.id} type="button" onClick={() => { haptic('tap'); d.run() }} disabled={!current || (d.id === 'link' && busy)}
              className="flex min-w-0 flex-1 flex-col items-center gap-1 disabled:opacity-40">
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[16px]" style={{ background: d.bg, color: d.fg }}>{d.icon}</span>
              <span className="w-full truncate text-center text-[11.5px] font-semibold" style={{ color: 'var(--clay-dim)' }}>{d.label}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] leading-snug" style={{ color: 'var(--clay-faint)' }}>
          {reddit
            ? `Save the picture and post it as an image post, with a title like "${redditTitle}". No link, on the picture or in the post: Reddit treats posts with links as ads.`
            : <>{format === 'sticker' ? 'Copy or save the sticker, then add it over your own photo in your story.' : 'Sent as a link that opens into this card. Instagram, WhatsApp and more are under More.'}
              {' '}Links are public to anyone who gets them; remove them in Settings › Privacy.</>}
        </p>

        <AnimatePresence>
          {note && (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-2 flex items-center justify-center gap-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--clay-mint)' }}>
              <Check size={13} /> {note}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className="rounded-full px-3 py-1.5 text-[12px] font-semibold"
      style={on ? { background: 'var(--clay-accent-soft)', color: 'var(--clay-accent-ink)' } : { background: 'var(--clay-bg)', color: 'var(--clay-faint)' }}>
      {on ? '✓ ' : ''}{children}
    </button>
  )
}
