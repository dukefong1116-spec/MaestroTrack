import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, ChevronRight, MessagesSquare, Pencil, ReceiptText, SlidersHorizontal, UserRoundPlus } from 'lucide-react'
import { useTeacherStore } from '@/stores/teacherStore'
import { useUnreadThreads } from '@/hooks/useTeacherMessages'
import { balanceCents } from '@/lib/studio/billing'
import { money } from '@/lib/studio/dates'
import AddStudentSheet from '@/components/teacher/AddStudentSheet'
import { StudioPage } from '@/components/teacher/studio/ui'
import { useAuth } from '@/hooks/useAuth'
import Avatar from '@/components/profile/Avatar'
import Banner from '@/components/profile/Banner'
import BannerSheet from '@/components/profile/BannerSheet'
import { INSTRUMENT_THEMES } from '@/lib/utils/instruments'
import type { InstrumentType } from '@/types'

/** The phone's fifth tab: everything that is not one of the other four. */
export default function MorePage() {
  const navigate = useNavigate()
  const invoices = useTeacherStore((s) => s.invoices)
  const unread = useUnreadThreads()
  const [adding, setAdding] = useState(false)
  const [banner, setBanner] = useState(false)
  const { profile } = useAuth()
  const instrument = profile?.instrument as InstrumentType | undefined
  const sub = [profile?.studioName, instrument ? INSTRUMENT_THEMES[instrument]?.label : null].filter(Boolean).join(' · ')
  const due = invoices.reduce((a, i) => a + balanceCents(i), 0)
  // Each row a solid icon tile, its name and a line of what is inside —
  // roomier than a plain list, and the same tile style as Today's figures.
  const rows = [
    { label: 'Families & Invoices', sub: 'Billing, payments and family contacts', meta: due ? `${money(due)} due` : '', icon: ReceiptText, color: '#E0A12B', go: () => navigate('/teacher/families') },
    { label: 'Messages', sub: 'Conversations with your students', meta: unread.size ? `${unread.size} new` : '', icon: MessagesSquare, color: '#3B9BD9', go: () => navigate('/teacher/messages') },
    { label: 'Reports', sub: 'Progress reports for any period', meta: '', icon: BarChart3, color: '#3DAE7C', go: () => navigate('/teacher/reports') },
    { label: 'Add a student', sub: 'Invite someone, or keep a record', meta: '', icon: UserRoundPlus, color: '#8B6BD6', go: () => setAdding(true) },
    { label: 'Settings', sub: 'Your studio, lessons and the app', meta: '', icon: SlidersHorizontal, color: '#7D879C', go: () => navigate('/teacher/settings') },
  ]
  return (
    <StudioPage>
      {/* One panel, as on the student's Settings: your banner with your
          photo on its edge, your name and studio, then everything else. */}
      <div className="px-4 pb-4 pt-3 sm:px-5">
        <div className="overflow-hidden rounded-[22px]" style={{ border: '1px solid var(--clay-line)', background: 'var(--clay-surface)' }}>
          <div className="relative">
            <Banner image={profile?.bannerImage} color={profile?.bannerColor} height={150}>
              <button
                type="button"
                onClick={() => setBanner(true)}
                aria-label="Change profile background"
                className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: 'rgba(0,0,0,.3)', color: '#fff' }}
              >
                <Pencil size={15} aria-hidden="true" />
              </button>
            </Banner>
            <Link to="/teacher/settings/profile" aria-hidden="true" tabIndex={-1} className="absolute -bottom-8 left-4 rounded-full" style={{ border: '4px solid var(--clay-surface)' }}>
              <Avatar src={profile?.avatar} name={profile?.displayName} instrument={instrument} size={64} />
            </Link>
          </div>
          <Link to="/teacher/settings/profile" className="flex items-center gap-4 px-4 pb-4 pt-10 transition-transform active:scale-[.99]">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-bold" style={{ color: 'var(--clay-ink)' }}>{profile?.displayName || 'Your profile'}</span>
              {sub && <span className="mt-0.5 block truncate text-[13px]" style={{ color: 'var(--clay-dim)' }}>{sub}</span>}
            </span>
            <ChevronRight size={18} className="shrink-0" style={{ color: 'var(--clay-faint)' }} />
          </Link>
      <div>
        {rows.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={r.go}
            className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors active:bg-[var(--clay-bg)]"
            style={{ borderTop: '1px solid var(--clay-line)' }}
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[15px]"
              style={{ background: r.color, color: '#fff', boxShadow: `0 6px 14px -6px ${r.color}` }}
              aria-hidden="true"
            >
              <r.icon size={23} strokeWidth={2.1} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[16.5px] font-bold" style={{ color: 'var(--clay-ink)' }}>{r.label}</span>
              <span className="mt-0.5 block truncate text-[13px]" style={{ color: 'var(--clay-dim)' }}>{r.sub}</span>
            </span>
            {r.meta && <span className="shrink-0 text-[13px] font-semibold" style={{ color: 'var(--clay-accent-ink)' }}>{r.meta}</span>}
            <ChevronRight size={18} style={{ color: 'var(--clay-faint)' }} aria-hidden="true" />
          </button>
        ))}
      </div>
        </div>
      </div>
      <BannerSheet open={banner} onClose={() => setBanner(false)} />
      <AddStudentSheet open={adding} onClose={() => setAdding(false)} onAdded={(id) => navigate(`/teacher/students/${encodeURIComponent(id)}`)} />
    </StudioPage>
  )
}
