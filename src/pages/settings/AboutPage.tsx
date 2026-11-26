import { useState } from 'react'
import { Mail, FileText, Shield, HelpCircle, ChevronDown, RotateCcw } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTour } from '@/hooks/useTour'
import Button from '@/components/ui/Button'
import { Panel, Block, Legend, FactRow, SettingsScreen } from '@/components/ui/Panel'
import { FAQ, PRIVACY, TERMS } from '@/content/legal'

const SUPPORT_EMAIL = 'help@femataus.com'

/**
 * Help, the legal pages, and what this build actually is.
 *
 * The version and the credits are generated — `vite.config.ts` injects the
 * version from package.json and `scripts/licenses.mjs` writes the credits
 * from node_modules. Neither is typed by hand, because a hand-typed one is
 * wrong the first time something changes and nobody notices.
 *
 * The FAQ, policy and terms are in src/content/legal.ts.
 */

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
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

/** **bold**, and the support address as a mail link. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*|help@femataus\.com)/g).map((part, i) => {
    const bold = part.startsWith('**') && part.endsWith('**')
    const t = bold ? part.slice(2, -2) : part
    const body = t === SUPPORT_EMAIL
      ? <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold underline" style={{ color: 'var(--clay-accent)' }}>{t}</a>
      : t
    return bold ? <strong key={i} style={{ color: 'var(--clay-ink)' }}>{body}</strong> : <span key={i}>{body}</span>
  })
}

/** One of the documents in src/content/legal.ts, drawn from its light markup. */
function Doc({ text }: { text: string }) {
  const out: React.ReactNode[] = []
  let bullets: string[] = []
  const flush = () => {
    if (!bullets.length) return
    out.push(<ul key={`u${out.length}`} className="mt-1.5 list-disc space-y-1 pl-5">{bullets.map((b, i) => <li key={i}>{inline(b)}</li>)}</ul>)
    bullets = []
  }
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) { bullets.push(line.slice(2)); continue }
    flush()
    const k = `l${out.length}`
    if (line.startsWith('# ')) out.push(<h3 key={k} className="mt-5 text-[15px] font-bold first:mt-0" style={{ color: 'var(--clay-ink)' }}>{line.slice(2)}</h3>)
    else if (line.startsWith('## ')) out.push(<h4 key={k} className="mt-3 text-[13.5px] font-semibold" style={{ color: 'var(--clay-ink)' }}>{line.slice(3)}</h4>)
    else if (line.startsWith('Q: ')) out.push(<p key={k} className="mt-3 font-semibold" style={{ color: 'var(--clay-ink)' }}>{line.slice(3)}</p>)
    else out.push(<p key={k} className="mt-1.5">{inline(line)}</p>)
  }
  flush()
  return <div className="text-[13.5px] leading-relaxed">{out}</div>
}

export default function AboutPage() {
  const { profile } = useAuth()
  const back = profile?.role === 'teacher' ? '/teacher/settings' : '/student/settings'
  const isTeacher = profile?.role === 'teacher'

  // The first-run tour again, from the top — skippable this time, since
  // they asked for it rather than being new.
  const { replay } = useTour()


  return (
    <SettingsScreen title="Support & Legal" back={back}>
      <Panel>
        <Block first>
          <Legend title="Help" />
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Femata ${__APP_VERSION__} — support`)}`}
            className="inline-flex items-center gap-2 text-sm font-semibold"
            style={{ color: 'var(--clay-accent)' }}
          >
            <Mail size={16} /> {SUPPORT_EMAIL}
          </a>
          <p className="mt-2 text-xs" style={{ color: 'var(--clay-faint)' }}>
            Opens your mail app. Or use Send feedback in Settings.
          </p>
        </Block>

        <Section title="Frequently asked questions" icon={<HelpCircle size={19} />}>
          <Doc text={FAQ} />
        </Section>

        <Section title="Privacy policy" icon={<Shield size={19} />}>
          <Doc text={PRIVACY} />
        </Section>

        <Section title="Terms of service" icon={<FileText size={19} />}>
          <Doc text={TERMS} />
        </Section>

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
          <Legend title="About" />
        </Block>
        <FactRow label="Version" value={__APP_VERSION__} />
      </Panel>
    </SettingsScreen>
  )
}
