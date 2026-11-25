import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { PlayerProfileView } from '@/pages/student/LeaguePlayerPage'
import Femata from '@/components/femata/Femata'
import type { LeagueCard } from '@/types'

/**
 * The profile a share link's ✕ leads to: the sharer as the league shows
 * them (PlayerProfileView), then the cards they have shared, and an
 * invitation to try Femata. Open to anyone, signed in or not; the data
 * comes from /api/profile, by the share's slug.
 */
export default function PublicProfilePage() {
  const { slug = '' } = useParams()
  const [data, setData] = useState<{ card: LeagueCard; shares: { slug: string; image: string }[] } | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let live = true
    fetch(`/api/profile?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (live) setData(d) })
      .catch(() => { if (live) setMissing(true) })
    return () => { live = false }
  }, [slug])

  const back = (
    <a
      href={`/s/${encodeURIComponent(slug)}`}
      aria-label="Back to the card"
      className="absolute left-3 flex h-9 w-9 items-center justify-center rounded-full"
      style={{ top: 'calc(12px + env(safe-area-inset-top))', background: 'rgba(255,255,255,.75)', color: '#000' }}
    >
      <ChevronLeft size={20} aria-hidden="true" />
    </a>
  )

  return (
    <div className="min-h-[100dvh] pb-32" style={{ background: 'var(--clay-page)', fontFamily: 'var(--clay-font)' }}>
      <div className="mx-auto max-w-xl px-6 pt-8">
        {data ? (
          <>
            <PlayerProfileView card={data.card} back={back} />
            {data.shares.length > 0 && (
              <section className="mt-2 pt-5" style={{ borderTop: '1px solid var(--clay-line)' }}>
                <h2 className="text-[11.5px] font-bold uppercase tracking-[.08em]" style={{ color: 'var(--clay-dim)' }}>Shared</h2>
                <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {data.shares.map((s) => (
                    <a key={s.slug} href={`/s/${s.slug}`} className="block overflow-hidden rounded-[12px]" style={{ aspectRatio: '1200 / 630', background: 'var(--clay-bg)' }}>
                      <img src={s.image} alt="" loading="lazy" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : missing ? (
          <div className="flex flex-col items-center py-24 text-center">
            <Femata mood="sleepy" size={110} />
            <p className="mt-3 text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>This profile isn't available</p>
            <p className="mt-1 text-[14px]" style={{ color: 'var(--clay-dim)' }}>The link may have been taken down.</p>
          </div>
        ) : (
          <div className="flex justify-center py-24">
            <div className="h-8 w-8 animate-spin rounded-full" style={{ border: '3px solid var(--clay-accent-soft)', borderTopColor: 'var(--clay-accent)' }} />
          </div>
        )}
      </div>

      {/* Try Femata, pinned to the bottom. */}
      <a href="https://femataus.com"
        className="fixed bottom-0 left-1/2 z-10 mb-[max(14px,env(safe-area-inset-bottom))] flex w-[min(92vw,540px)] -translate-x-1/2 items-center gap-3 rounded-[18px] py-2.5 pl-4 pr-2.5"
        style={{ background: '#FFFFFF', color: '#0E1626', boxShadow: '0 12px 32px rgba(0,0,0,.25)' }}>
        <img src="/apple-touch-icon.png" alt="" className="h-9 w-9 shrink-0 rounded-[10px]" />
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-tight">Practise with Femata. It makes practice fun.</span>
        <b className="shrink-0 rounded-full px-4 py-2 text-[14px] font-semibold" style={{ background: '#3DB5F5', color: '#04223A' }}>Try it free</b>
      </a>
    </div>
  )
}
