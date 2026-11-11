import { useState } from 'react'
import { Mail, FileText, Shield, HelpCircle, ChevronDown, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTour } from '@/hooks/useTour'
import Button from '@/components/ui/Button'
import { Panel, Block, Legend, FactRow, SettingsScreen } from '@/components/ui/Panel'
import { recentOpenTimes } from '@/lib/utils/openTimes'
import licenses from '@/generated/licenses.json'

const SUPPORT_EMAIL = 'support@maestrotrack.app'

/**
 * Help, the legal pages, and what this build actually is.
 *
 * The version and the credits are generated — `vite.config.ts` injects the
 * version from package.json and `scripts/licenses.mjs` writes the credits
 * from node_modules. Neither is typed by hand, because a hand-typed one is
 * wrong the first time something changes and nobody notices.
 *
 * The policy and terms are placeholders, and say so plainly. Writing
 * convincing-looking legal text that nobody has approved would be worse
 * than an obvious gap.
 */

function Placeholder({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-transform active:scale-[.99] sm:px-6"
        style={{ borderTop: '1px solid var(--clay-line)' }}
      >
        <span className="flex shrink-0" style={{ color: 'var(--clay-dim)' }}>{icon}</span>
        <span className="min-w-0 flex-1 text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{title}</span>
        <ChevronDown
          size={18}
          className="shrink-0 transition-transform"
          style={{ color: 'var(--clay-faint)', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <div className="px-5 pb-5 sm:px-6" style={{ color: 'var(--clay-dim)' }}>
          {children}
        </div>
      )}
    </>
  )
}

function NotWrittenYet({ what }: { what: string }) {
  return (
    <div
      className="rounded-[var(--clay-r-sm)] px-4 py-3.5 text-[13px] leading-relaxed"
      style={{ background: 'var(--clay-warning-bg)', color: 'var(--clay-warning-fg)' }}
    >
      <strong>Placeholder — not a real {what}.</strong> Nothing here has been written or reviewed.
      Replace this before anyone outside testing uses the app.
    </div>
  )
}

export default function AboutPage() {
  const { profile } = useAuth()
  const back = profile?.role === 'teacher' ? '/teacher/settings' : '/student/settings'
  const isTeacher = profile?.role === 'teacher'
  // Read once: how quickly Today appeared on this device, latest first.
  const [opens] = useState(recentOpenTimes)

  // The first-run tour again, from the top — skippable this time, since
  // they asked for it rather than being new.
  const { replay } = useTour()

  const [showLicenses, setShowLicenses] = useState(false)

  return (
    <SettingsScreen title="Support & Legal" back={back}>
      <Panel>
        <Block first>
          <Legend title="Help" />
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`MaestroTrack ${__APP_VERSION__} — support`)}`}
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--clay-accent)' }}
          >
            <Mail size={16} /> {SUPPORT_EMAIL}
          </a>
          <p className="mt-2 text-xs" style={{ color: 'var(--clay-faint)' }}>
            Opens your mail app. There is no contact form — that would need a server the app does not have.
          </p>
        </Block>

        <Placeholder title="Frequently asked questions" icon={<HelpCircle size={19} />}>
          <NotWrittenYet what="FAQ" />
        </Placeholder>

        <Placeholder title="Privacy policy" icon={<Shield size={19} />}>
          <NotWrittenYet what="privacy policy" />
          <p className="mt-3 text-[13px] leading-relaxed">
            What the app actually does with your data is described, accurately, under
            Privacy &amp; Security — that part is real and checkable against the database rules.
          </p>
        </Placeholder>

        <Placeholder title="Terms of service" icon={<FileText size={19} />}>
          <NotWrittenYet what="terms of service" />
        </Placeholder>

        {/* Students only, for now: the teacher tour comes later. */}
        {!isTeacher && (
          <Block>
            <Legend
              title="The tour"
              hint="The walk-through a new account gets. You can skip it this time."
            />
            <Button variant="outline" size="sm" onClick={replay}>
              <RotateCcw size={15} /> Show me again
            </Button>
          </Block>
        )}

        <Block>
          <Legend title="This build" />
        </Block>
        <FactRow label="Version" value={__APP_VERSION__} />
        <FactRow label="Built" value={__BUILD_DATE__} />
        {opens.length > 0 && (
          <FactRow
            label="Today opened in"
            value={opens.map((t) => `${(t.shown / 1000).toFixed(1)}s${t.live ? ` (live ${(t.live / 1000).toFixed(1)}s)` : ''}`).join(' · ')}
          />
        )}

        <button
          type="button"
          onClick={() => setShowLicenses((o) => !o)}
          aria-expanded={showLicenses}
          className="flex w-full items-center gap-3.5 px-5 py-4 text-left transition-transform active:scale-[.99] sm:px-6"
          style={{ borderTop: '1px solid var(--clay-line)' }}
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold" style={{ color: 'var(--clay-ink)' }}>
              Open-source licenses
            </span>
            <span className="block text-xs" style={{ color: 'var(--clay-dim)' }}>
              {licenses.length} packages this app is built on
            </span>
          </span>
          <ChevronDown
            size={18}
            className="shrink-0 transition-transform"
            style={{ color: 'var(--clay-faint)', transform: showLicenses ? 'rotate(180deg)' : 'none' }}
          />
        </button>
        {showLicenses && (
          <div style={{ borderTop: '1px solid var(--clay-line)' }}>
            {licenses.map((l) => (
              <div
                key={l.name}
                className="flex items-baseline justify-between gap-4 px-5 py-2.5 sm:px-6"
                style={{ borderTop: '1px solid var(--clay-line)' }}
              >
                <span className="min-w-0 truncate text-[13px]" style={{ color: 'var(--clay-ink)' }}>
                  {l.name} <span style={{ color: 'var(--clay-faint)' }}>{l.version}</span>
                </span>
                <span className="shrink-0 text-xs" style={{ color: 'var(--clay-dim)' }}>{l.license}</span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </SettingsScreen>
  )
}
