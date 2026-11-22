import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Eye, EyeOff, Medal, Music2, Sprout, Trophy } from 'lucide-react'
import Femata from '@/components/femata/Femata'
import InstrumentIcon from '@/components/icons/InstrumentIcon'
import { Ask, BigButton, Choice, HoldToCommit, STAGE, Stage, TopBar } from '@/components/onboarding/stage'
import { EXPERIENCE, INSTRUMENT_GROUPS, MINUTES, MINUTE_LINES, instrumentFields } from '@/lib/onboarding/catalog'
import { signUp } from '@/lib/firebase/auth'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { takePendingInvite } from '@/lib/utils/pendingInvite'
import { useAuth } from '@/hooks/useAuth'
import type { ExperienceLevel } from '@/types'

/**
 * The first-run setup, one question a screen: what you play, your name,
 * how experienced you are, how often and how long you practise, your
 * account, then the commitment, the welcome, reminders and the widget.
 * The tour carries on in the app afterwards.
 *
 * Answers are kept for the visit (sessionStorage), so a reload mid-way
 * does not start over.
 */
type Step = 'instrument' | 'name' | 'experience' | 'days' | 'minutes' | 'account' | 'commit' | 'welcome' | 'notify' | 'widget'
const ORDER: Step[] = ['instrument', 'name', 'experience', 'days', 'minutes', 'account', 'commit', 'welcome', 'notify', 'widget']

interface Answers { picked: string[]; other: string; name: string; level: ExperienceLevel | null; days: number | null; minutes: number }
const START: Answers = { picked: [], other: '', name: '', level: null, days: null, minutes: 30 }
const KEY = 'femata_setup'

function load(): { step: Step; a: Answers } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (saved?.a && ORDER.includes(saved.step)) return { step: saved.step, a: { ...START, ...saved.a } }
  } catch { /* nothing kept, or no storage */ }
  return { step: 'instrument', a: START }
}

const LEVEL_ICON = { beginner: Sprout, intermediate: Music2, advanced: Trophy, professional: Medal }

export default function SetupPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const initial = useMemo(load, [])
  const [step, setStep] = useState<Step>(initial.step)
  const [a, setA] = useState<Answers>(initial.a)
  const [dir, setDir] = useState(1)
  const set = (patch: Partial<Answers>) => setA((x) => ({ ...x, ...patch }))

  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ step, a })) } catch { /* fine without it */ }
  }, [step, a])

  // Someone already signed in has nothing to set up here — unless they
  // are partway through the screens after the account (commit onwards).
  const accountMade = ORDER.indexOf(step) > ORDER.indexOf('account')
  useEffect(() => {
    if (user && !accountMade) navigate('/student', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (to: Step) => { setDir(ORDER.indexOf(to) >= ORDER.indexOf(step) ? 1 : -1); setStep(to) }
  const next = () => go(ORDER[ORDER.indexOf(step) + 1])
  const back = step === 'instrument' ? () => navigate('/start') : accountMade ? undefined : () => go(ORDER[ORDER.indexOf(step) - 1])
  const progress = (ORDER.indexOf(step) + 1) / ORDER.length

  const picks = useMemo(() => {
    const other = a.other.trim()
    return other ? [...a.picked, other] : a.picked
  }, [a.picked, a.other])
  const mainLabel = useMemo(() => (picks.length ? (instrumentFields(picks).instrumentName ?? instrumentFields(picks).instruments[0]) : ''), [picks])
  const first = a.name.trim().split(/\s+/)[0]

  function finish() {
    try { sessionStorage.removeItem(KEY) } catch { /* fine */ }
    const invited = takePendingInvite()
    navigate(invited ? `/join/${invited}` : '/student', { replace: true })
  }

  const full = step === 'welcome'
  return (
    <Stage staff={step === 'commit'}>
      {!full && step !== 'commit' && <TopBar progress={progress} onBack={back} />}
      <AnimatePresence mode="wait" custom={dir} initial={false}>
        <motion.div
          key={step}
          custom={dir}
          initial={{ opacity: 0, x: 40 * dir }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 * dir }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {step === 'instrument' && (
            <InstrumentStep a={a} set={set} onNext={next} canGo={picks.length > 0} />
          )}
          {step === 'name' && (
            <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); if (a.name.trim().length >= 2) next() }}>
              <Ask mood="happy">What should I call you?</Ask>
              <h2 className="mb-3 text-[26px] font-black">What's your name?</h2>
              <input
                autoFocus
                value={a.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Your name"
                autoComplete="given-name"
                maxLength={40}
                className="w-full rounded-[16px] px-4 py-3.5 text-[18px] font-extrabold outline-none placeholder:font-bold"
                style={{ background: 'rgba(14,22,38,.55)', border: `2px solid ${a.name ? STAGE.sky : STAGE.ink3}`, color: STAGE.cream }}
              />
              <p className="mt-2 text-[13px] font-semibold" style={{ color: STAGE.muted }}>You can change it later in your profile.</p>
              <div className="mt-auto pt-4"><BigButton type="submit" disabled={a.name.trim().length < 2}>CONTINUE</BigButton></div>
            </form>
          )}
          {step === 'experience' && (
            <div className="flex flex-1 flex-col">
              <Ask mood="thinking">How long have you played{first ? `, ${first}` : ''}?</Ask>
              <div className="flex flex-col gap-2.5">
                {EXPERIENCE.map((x) => {
                  const Icon = LEVEL_ICON[x.value]
                  return (
                    <Choice key={x.value} on={a.level === x.value} onClick={() => set({ level: x.value })}>
                      <Icon size={22} className="shrink-0" style={{ color: a.level === x.value ? STAGE.skyDeep : STAGE.sky }} />
                      <span>{x.label}<span className="block text-[12.5px] font-bold opacity-60">{x.line}</span></span>
                    </Choice>
                  )
                })}
              </div>
              <div className="mt-auto pt-4"><BigButton disabled={!a.level} onClick={next}>CONTINUE</BigButton></div>
            </div>
          )}
          {step === 'days' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <Ask mood="focused">How many days a week do you practise right now?</Ask>
              <div className="no-scrollbar -mx-1 flex min-h-0 flex-col gap-2 overflow-y-auto px-1 pb-2">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <Choice
                    key={n}
                    on={a.days === n}
                    onClick={() => set({ days: n })}
                    right={(
                      <span className="flex gap-[4px]" aria-hidden>
                        {Array.from({ length: 7 }, (_, k) => (
                          <i key={k} className="h-[8px] w-[8px] rounded-full" style={{ background: k < n ? (a.days === n ? STAGE.skyDeep : STAGE.sky) : (a.days === n ? '#D5DCE6' : STAGE.ink3) }} />
                        ))}
                      </span>
                    )}
                  >
                    {n} day{n > 1 ? 's' : ''}
                  </Choice>
                ))}
              </div>
              <div className="mt-auto pt-3"><BigButton disabled={!a.days} onClick={next}>CONTINUE</BigButton></div>
            </div>
          )}
          {step === 'minutes' && (
            <div className="flex min-h-0 flex-1 flex-col">
              <Ask mood="happy">And how long, on a usual day?</Ask>
              <MinutePicker value={a.minutes} onChange={(m) => set({ minutes: m })} />
              <div className="mt-3"><BigButton onClick={() => (user ? go('commit') : next())}>CONTINUE</BigButton></div>
            </div>
          )}
          {step === 'account' && (
            <AccountStep a={a} picks={picks} onDone={() => go('commit')} />
          )}
          {step === 'commit' && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <h2 className="text-[26px] font-black">I'll use Femata to…</h2>
              <p className="mt-2 max-w-[300px] text-[16px] font-bold leading-snug" style={{ color: STAGE.muted }}>
                practise <b style={{ color: STAGE.cream }}>{a.days ?? 5} day{(a.days ?? 5) > 1 ? 's' : ''} a week</b>,{' '}
                <b style={{ color: STAGE.cream }}>{a.minutes} minutes a day</b>{mainLabel ? <>, on my {mainLabel.toLowerCase()}</> : null}
              </p>
              <div className="mb-5 mt-9">
                <HoldToCommit onDone={() => setTimeout(() => go('welcome'), 150)}>
                  <Femata mood="focused" tone="glow" onDark size={104} />
                </HoldToCommit>
              </div>
              <p className="text-[16px] font-extrabold" style={{ color: STAGE.sky }}>Tap and hold to commit</p>
            </div>
          )}
          {step === 'welcome' && <WelcomeBurst onDone={next} />}
          {step === 'notify' && (
            <div className="flex flex-1 flex-col">
              <Ask mood="wink">Can I give you a nudge when it's practice time?</Ask>
              <div className="mx-auto mt-6 w-full max-w-[300px] rounded-[18px] p-3.5" style={{ background: 'rgba(255,255,255,.08)' }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: STAGE.sky }}><Femata size={30} /></span>
                  <span className="min-w-0 text-[14px] font-extrabold leading-tight">Your streak is on the line!
                    <span className="block text-[12.5px] font-bold" style={{ color: STAGE.muted }}>{Math.min(10, a.minutes)} minutes keeps it going.</span>
                  </span>
                </div>
              </div>
              <p className="mx-auto mt-4 max-w-[300px] text-center text-[13px] font-semibold" style={{ color: STAGE.muted }}>
                Reminders, streak saves and messages from your teacher. You can change this any time in Settings.
              </p>
              <div className="mt-auto flex flex-col gap-1 pt-4">
                <BigButton onClick={() => { if (user) void updateUserProfile(user.uid, { reminderEnabled: true }).catch(() => {}); next() }}>TURN ON REMINDERS</BigButton>
                <BigButton kind="ghost" onClick={next}>NOT NOW</BigButton>
              </div>
            </div>
          )}
          {step === 'widget' && <WidgetStep onDone={finish} />}
        </motion.div>
      </AnimatePresence>
    </Stage>
  )
}

/* ── What do you play? ────────────────────────────────────── */
function InstrumentStep({ a, set, onNext, canGo }: { a: Answers; set: (p: Partial<Answers>) => void; onNext: () => void; canGo: boolean }) {
  const toggle = (id: string) => set({ picked: a.picked.includes(id) ? a.picked.filter((x) => x !== id) : [...a.picked, id] })
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <h2 className="text-[26px] font-black">What do you play?</h2>
      <p className="mb-2 mt-1 text-[14px] font-semibold" style={{ color: STAGE.muted }}>Pick everything you play. The first one is your main instrument.</p>
      <div className="no-scrollbar -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-3">
        {INSTRUMENT_GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-2 mt-4 text-[11.5px] font-black uppercase tracking-[.14em]" style={{ color: STAGE.muted }}>{g.title}</div>
            <div className="grid grid-cols-3 gap-2">
              {g.items.map((i) => {
                const n = a.picked.indexOf(i.id)
                const on = n >= 0
                return (
                  <button
                    key={i.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(i.id)}
                    className="relative flex flex-col items-center gap-1.5 rounded-[14px] px-1 pb-2.5 pt-3 text-[12.5px] font-extrabold leading-tight transition-[transform,background] duration-150 active:scale-95"
                    style={{ border: `2px solid ${on ? STAGE.sky : STAGE.ink3}`, background: on ? 'rgba(61,181,245,.16)' : 'rgba(14,22,38,.55)' }}
                  >
                    <InstrumentIcon instrument={i.glyph} size={30} style={{ color: on ? STAGE.sky : STAGE.cream }} />
                    {i.label}
                    {n === 0 && (
                      <span className="absolute right-1.5 top-1.5 rounded-full px-1.5 py-[1px] text-[9px] font-black tracking-[.08em]" style={{ background: STAGE.sky, color: '#04223A' }}>MAIN</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
        <div className="mb-2 mt-5 text-[11.5px] font-black uppercase tracking-[.14em]" style={{ color: STAGE.muted }}>Not listed?</div>
        <label className="flex items-center gap-2 rounded-[14px] px-4 py-3" style={{ border: `2px dashed ${a.other.trim() ? STAGE.sky : STAGE.ink3}` }}>
          <span className="text-[15px] font-extrabold" style={{ color: STAGE.muted }}>Other:</span>
          <input
            value={a.other}
            onChange={(e) => set({ other: e.target.value })}
            placeholder="Type your instrument"
            maxLength={30}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-extrabold outline-none"
            style={{ color: STAGE.cream }}
          />
        </label>
      </div>
      <div className="pt-2"><BigButton disabled={!canGo} onClick={onNext}>CONTINUE</BigButton></div>
    </div>
  )
}

/* ── How long: our own vertical picker ────────────────────── */
const ROW = 58
function MinutePicker({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [i, setI] = useState(Math.max(0, MINUTES.indexOf(value)))
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = Math.max(0, MINUTES.indexOf(value)) * ROW
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onScroll = () => {
    const el = ref.current
    if (!el) return
    const k = Math.max(0, Math.min(MINUTES.length - 1, Math.round(el.scrollTop / ROW)))
    if (k !== i) {
      setI(k)
      onChange(MINUTES[k])
      try { navigator.vibrate?.(5) } catch { /* not on this device */ }
    }
  }
  const fill = 8 + (i / (MINUTES.length - 1)) * 84
  return (
    <>
      <div className="relative flex min-h-[260px] flex-1 items-stretch gap-4">
        <div className="relative w-[54px] shrink-0 rounded-[27px]" style={{ background: STAGE.ink2, border: `2px solid ${STAGE.ink3}` }}>
          <div
            className="absolute inset-x-[5px] bottom-[5px] rounded-[22px] transition-[height] duration-300 [transition-timing-function:cubic-bezier(.3,1.4,.5,1)]"
            style={{ height: `${fill}%`, background: `linear-gradient(180deg, #7ACDF8, ${STAGE.skyDeep})` }}
          />
          <div
            className="absolute left-1/2 -ml-[26px] transition-[bottom] duration-300 [transition-timing-function:cubic-bezier(.3,1.4,.5,1)]"
            style={{ bottom: `calc(${fill}% - 4px)` }}
          >
            <Femata mood={i >= 8 ? 'excited' : 'happy'} tone="glow" onDark size={52} />
          </div>
        </div>
        <div className="relative min-w-0 flex-1">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 -mt-[29px] h-[58px] rounded-[18px]" style={{ background: 'rgba(61,181,245,.14)', border: `2px solid ${STAGE.sky}` }} />
          <div
            ref={ref}
            onScroll={onScroll}
            role="listbox"
            aria-label="Minutes a day"
            className="no-scrollbar absolute inset-0 snap-y snap-mandatory overflow-y-auto"
            style={{
              WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 32%, #000 68%, transparent)',
              maskImage: 'linear-gradient(180deg, transparent, #000 32%, #000 68%, transparent)',
            }}
          >
            <div style={{ height: `calc(50% - ${ROW / 2}px)` }} />
            {MINUTES.map((m, k) => (
              <button
                key={m}
                type="button"
                role="option"
                aria-selected={k === i}
                onClick={() => ref.current?.scrollTo({ top: k * ROW, behavior: 'smooth' })}
                className="flex w-full snap-center items-center justify-center gap-1.5 font-black transition-[font-size,color] duration-150"
                style={{ height: ROW, fontSize: k === i ? 36 : 22, color: k === i ? STAGE.cream : STAGE.muted }}
              >
                {m}<span className="text-[13px] font-extrabold">min</span>
              </button>
            ))}
            <div style={{ height: `calc(50% - ${ROW / 2}px)` }} />
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[14px] font-extrabold" style={{ color: STAGE.sky }}>{MINUTE_LINES[MINUTES[i]]}</p>
    </>
  )
}

/* ── The account ──────────────────────────────────────────── */
function AccountStep({ a, picks, onDone }: { a: Answers; picks: string[]; onDone: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mismatch = again.length > 0 && again !== password
  const ok = /\S+@\S+\.\S+/.test(email) && password.length >= 8 && again === password

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    setError('')
    try {
      const fields = instrumentFields(picks)
      const days = a.days ?? 5
      const user = await signUp(email.trim(), password, a.name.trim(), 'student', {
        instrument: fields.instrument,
        experienceLevel: a.level ?? 'beginner',
        dailyGoalMinutes: a.minutes,
        // The app reads the day's goal as a seventh of the week's, so the
        // week's is seven of the minutes they chose.
        weeklyGoalMinutes: Math.max(30, a.minutes * 7),
        extra: { instruments: fields.instruments, practiceDaysPerWeek: days, ...(fields.instrumentName ? { instrumentName: fields.instrumentName } : {}) },
      })
      localStorage.setItem(`maestro_role_${user.uid}`, 'student')
      onDone()
    } catch (err: unknown) {
      const ex = err as { code?: string; message?: string }
      setError(ex.code === 'auth/email-already-in-use' ? 'That email already has an account. Log in instead.'
        : ex.code === 'auth/invalid-email' ? 'That email address doesn’t look right.'
          : ex.code === 'auth/weak-password' ? 'Pick a stronger password: at least 8 characters.'
            : ex.message ?? 'Something went wrong. Try again.')
      setBusy(false)
    }
  }

  const field = (on: boolean) => ({ background: 'rgba(14,22,38,.55)', border: `2px solid ${on ? STAGE.sky : STAGE.ink3}`, color: STAGE.cream })
  return (
    <form className="flex flex-1 flex-col" onSubmit={submit}>
      <Ask mood="excited">Last thing{a.name ? `, ${a.name.trim().split(/\s+/)[0]}` : ''}: let's save your spot!</Ask>
      <h2 className="mb-3 text-[26px] font-black">Create your account</h2>
      <div className="flex flex-col gap-2.5">
        <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-[16px] px-4 py-3.5 text-[16px] font-bold outline-none" style={field(!!email)} />
        <div className="relative">
          <input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[16px] py-3.5 pl-4 pr-12 text-[16px] font-bold outline-none" style={field(!!password)} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center" style={{ color: STAGE.muted }}>
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter password" value={again} onChange={(e) => setAgain(e.target.value)}
          aria-invalid={mismatch || undefined}
          className="w-full rounded-[16px] px-4 py-3.5 text-[16px] font-bold outline-none" style={{ ...field(!!again), ...(mismatch ? { borderColor: '#FF8FA3' } : {}) }} />
      </div>
      {mismatch && <p className="mt-2 text-[13px] font-bold" style={{ color: '#FF8FA3' }}>The passwords don't match yet.</p>}
      {error && <p className="mt-3 text-[13.5px] font-bold" style={{ color: '#FF8FA3' }}>{error}</p>}
      <p className="mt-3 text-[13px] font-semibold" style={{ color: STAGE.muted }}>
        Already have an account? <Link to="/login" className="font-extrabold" style={{ color: STAGE.sky }}>Log in</Link>
      </p>
      <div className="mt-auto pt-4"><BigButton type="submit" disabled={!ok || busy}>{busy ? 'CREATING…' : 'CREATE ACCOUNT'}</BigButton></div>
    </form>
  )
}

/* ── Welcome to Femata! ───────────────────────────────────── */
function WelcomeBurst({ onDone }: { onDone: () => void }) {
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => { const t = setTimeout(() => done.current(), 2600); return () => clearTimeout(t) }, [])
  return (
    <motion.button
      type="button"
      onClick={() => done.current()}
      aria-label="Continue"
      className="fixed inset-0 z-10 flex flex-col items-center justify-center gap-8"
      style={{ background: STAGE.sky, color: '#fff' }}
      initial={{ clipPath: 'circle(0% at 50% 55%)' }}
      animate={{ clipPath: 'circle(150% at 50% 55%)' }}
      transition={{ duration: 0.75, ease: [0.6, 0, 0.2, 1] }}
    >
      <motion.h2
        className="text-center text-[40px] font-black leading-[1.02]"
        style={{ textShadow: '0 3px 0 rgba(10,70,120,.35)' }}
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45, type: 'spring', stiffness: 300, damping: 20 }}
      >
        WELCOME TO<br />FEMATA!
      </motion.h2>
      <motion.div
        className="grid h-[190px] w-[190px] place-items-center rounded-full"
        style={{ background: STAGE.ink }}
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 14 }}
      >
        <motion.div animate={{ y: [0, -14, 0] }} transition={{ delay: 1, duration: 0.5, repeat: 2, ease: 'easeOut' }}>
          <Femata mood="celebrate" tone="sunrise" size={140} />
        </motion.div>
      </motion.div>
    </motion.button>
  )
}

/* ── The widget (to come) ─────────────────────────────────── */
function WidgetStep({ onDone }: { onDone: () => void }) {
  const [soon, setSoon] = useState(false)
  return (
    <div className="flex flex-1 flex-col">
      <Ask mood="excited">I'll cheer you on from your Home Screen!</Ask>
      <div className="mx-auto mt-4 grid w-[230px] grid-cols-4 gap-3 rounded-[34px] p-5" style={{ background: STAGE.ink3 }}>
        <div className="col-span-2 row-span-2 flex aspect-square flex-col justify-between rounded-[18px] bg-white p-2.5 text-[12px] font-black" style={{ color: '#14202E' }}>
          <span className="text-[20px]" style={{ color: '#F2852A' }}>🔥 1</span>
          <span className="leading-tight">Ready to practise?</span>
          <span className="self-end"><Femata size={44} /></span>
        </div>
        {Array.from({ length: 8 }, (_, k) => <div key={k} className="aspect-square rounded-[12px]" style={{ background: '#3A4866' }} />)}
      </div>
      {soon && (
        <p className="mx-auto mt-5 max-w-[280px] text-center text-[14px] font-bold" style={{ color: STAGE.sky }}>
          The widget is on its way. I'll let you know when it's ready!
        </p>
      )}
      <div className="mt-auto flex flex-col gap-1 pt-4">
        <BigButton onClick={() => { if (soon) onDone(); else setSoon(true) }}>{soon ? "LET'S GO" : 'ADD WIDGET'}</BigButton>
        {!soon && <BigButton kind="ghost" onClick={onDone}>NOT NOW</BigButton>}
      </div>
    </div>
  )
}
