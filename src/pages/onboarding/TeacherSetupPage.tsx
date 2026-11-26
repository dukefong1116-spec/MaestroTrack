import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Eye, EyeOff } from 'lucide-react'
import Femata from '@/components/femata/Femata'
import QRCode from '@/components/ui/QRCode'
import ImageCropper from '@/components/profile/ImageCropper'
import { Ask, BigButton, Choice, HoldToCommit, STAGE, Stage, TopBar } from '@/components/onboarding/stage'
import { InstrumentStep, WelcomeBurst, WidgetStep } from '@/pages/onboarding/SetupPage'
import { instrumentFields } from '@/lib/onboarding/catalog'
import { signUp, socialSignUp, type SocialProvider } from '@/lib/firebase/auth'
import SocialButtons from '@/components/auth/SocialButtons'
import { saveStudioSettings } from '@/lib/firebase/studio'
import { checkAvatarFile, uploadAvatar } from '@/lib/firebase/avatar'
import { createInvite, type NewInvite } from '@/lib/firebase/invites'
import { DEFAULT_LESSON_TYPES } from '@/lib/studio/settings'
import { enableNotifications } from '@/lib/notify/push'
import { isNativeApp } from '@/lib/native'
import { haptic } from '@/lib/haptics'
import { useAuth } from '@/hooks/useAuth'

/**
 * A teacher's first run, on the same night stage as a student's (SetupPage):
 * one question a screen, Femata asking. Their name as students will see
 * it, the studio's name (with a preview of how it looks to a student),
 * what they teach, a usual lesson and its price (so Billing works from
 * the first day), then the account — asked last, once they have put
 * something in. After it: a photo, holding to open the studio, the
 * welcome, a first invitation, notifications and (in the iPhone app) the
 * widget. The teacher tutorial carries on in the app.
 *
 * Answers are kept for the visit (sessionStorage), so a reload mid-way
 * does not start over.
 */
type Step = 'name' | 'studio' | 'teach' | 'lesson' | 'account' | 'photo' | 'commit' | 'welcome' | 'invite' | 'notify' | 'widget'
const ORDER: Step[] = ['name', 'studio', 'teach', 'lesson', 'account', 'photo', 'commit', 'welcome', 'invite', 'notify', ...(isNativeApp ? ['widget' as const] : [])]

interface Answers { name: string; studio: string; picked: string[]; other: string; minutes: number; price: string }
const START: Answers = { name: '', studio: '', picked: [], other: '', minutes: 30, price: '' }
const KEY = 'femata_studio_setup'
const LENGTHS = [30, 45, 60]

function load(): { step: Step; a: Answers } {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null')
    if (saved?.a && ORDER.includes(saved.step)) return { step: saved.step, a: { ...START, ...saved.a } }
  } catch { /* nothing kept, or no storage */ }
  return { step: 'name', a: START }
}

const TITLE = /^(ms|mrs|mr|miss|dr|prof)\.?$/i
/** "Ms Harper" → "Harper"; "Duke" → "Duke": the word a studio is usually named after. */
function studioWord(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return (TITLE.test(words[0] ?? '') ? words[words.length - 1] : words[0]) ?? ''
}
/** What Femata calls them: "Ms Harper" stays whole; "Duke Fong" → "Duke". */
function callName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return TITLE.test(words[0] ?? '') ? words.join(' ') : words[0] ?? ''
}

const input = (on: boolean) => ({ background: 'rgba(14,22,38,.55)', border: `2px solid ${on ? STAGE.sky : STAGE.ink3}`, color: STAGE.cream })
const fieldCls = 'w-full rounded-[16px] px-4 py-3.5 text-[18px] font-extrabold outline-none placeholder:font-bold'

export default function TeacherSetupPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const initial = useMemo(load, [])
  const [step, setStep] = useState<Step>(initial.step)
  const [a, setA] = useState<Answers>(initial.a)
  const [dir, setDir] = useState(1)
  const set = (patch: Partial<Answers>) => setA((x) => ({ ...x, ...patch }))

  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ step, a })) } catch { /* fine without it */ }
  }, [step, a])

  // Someone already signed in has nothing to set up here — unless they
  // are partway through the screens after the account (photo onwards).
  const accountMade = ORDER.indexOf(step) > ORDER.indexOf('account')
  useEffect(() => {
    if (user && !accountMade) navigate(profile?.role === 'student' ? '/student' : '/teacher', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const go = (to: Step) => { setDir(ORDER.indexOf(to) >= ORDER.indexOf(step) ? 1 : -1); setStep(to) }
  const next = () => {
    const at = ORDER.indexOf(step)
    if (at === ORDER.length - 1) return finish()
    go(ORDER[at + 1])
  }
  const back = step === 'name' ? () => navigate('/start') : accountMade ? undefined : () => go(ORDER[ORDER.indexOf(step) - 1])
  const progress = (ORDER.indexOf(step) + 1) / ORDER.length
  const picks = useMemo(() => {
    const other = a.other.trim()
    return other ? [...a.picked, other] : a.picked
  }, [a.picked, a.other])
  const word = studioWord(a.name)
  const studio = a.studio.trim() || (word ? `${word}'s Studio` : 'Your studio')

  function finish() {
    try { sessionStorage.removeItem(KEY) } catch { /* fine */ }
    navigate('/teacher', { replace: true })
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
          {step === 'name' && (
            <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); if (a.name.trim().length >= 2) next() }}>
              <Ask mood="happy">Welcome, maestro! 🎼 What should your students call you?</Ask>
              <h2 className="mb-3 text-[26px] font-black">Your name</h2>
              <input autoFocus value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ms Harper"
                autoComplete="name" maxLength={40} className={fieldCls} style={input(!!a.name)} />
              <p className="mt-2 text-[13px] font-semibold" style={{ color: STAGE.muted }}>Students see this on their Studio page.</p>
              <div className="mt-auto pt-4"><BigButton type="submit" disabled={a.name.trim().length < 2}>CONTINUE</BigButton></div>
            </form>
          )}

          {step === 'studio' && (
            <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); next() }}>
              <Ask mood="excited">What's your studio called?</Ask>
              <h2 className="mb-3 text-[26px] font-black">Studio name</h2>
              <input autoFocus value={a.studio} onChange={(e) => set({ studio: e.target.value })} placeholder={studio}
                maxLength={60} className={fieldCls} style={input(!!a.studio)} />
              {/* How it looks to a student, as they type. */}
              <p className="mb-2 mt-5 text-[11.5px] font-black uppercase tracking-[.14em]" style={{ color: STAGE.muted }}>Your students will see</p>
              <div className="flex items-center gap-3 rounded-[18px] p-3.5" style={{ background: STAGE.cream, color: '#14202E' }}>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[17px] font-black" style={{ background: '#E6DDFB', color: '#5B3FA8' }}>
                  {studio.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[16px] font-black">{studio}</span>
                  <span className="block truncate text-[12.5px] font-bold" style={{ color: '#6B7280' }}>{a.name.trim() || 'Your name'}</span>
                </span>
              </div>
              <div className="mt-auto pt-4"><BigButton type="submit">CONTINUE</BigButton></div>
            </form>
          )}

          {step === 'teach' && (
            <InstrumentStep a={a} set={set} onNext={next} canGo={picks.length > 0}
              title="What do you teach?" hint="Pick everything you teach. The first one is your main instrument." />
          )}

          {step === 'lesson' && (
            <form className="flex flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); next() }}>
              <Ask mood="focused">A usual lesson: how long, and what do you charge?</Ask>
              <div className="flex gap-2.5">
                {LENGTHS.map((m) => (
                  <div key={m} className="flex-1">
                    <Choice on={a.minutes === m} onClick={() => set({ minutes: m })}>
                      <span className="w-full text-center">{m}<span className="text-[13px] font-extrabold"> min</span></span>
                    </Choice>
                  </div>
                ))}
              </div>
              <label className="mt-4 flex items-center gap-2 rounded-[16px] px-4 py-3.5" style={input(!!a.price)}>
                <span className="text-[20px] font-black" style={{ color: STAGE.muted }}>$</span>
                <input value={a.price} onChange={(e) => set({ price: e.target.value.replace(/[^\d.]/g, '').slice(0, 7) })}
                  inputMode="decimal" placeholder={String((DEFAULT_LESSON_TYPES.find((t) => t.minutes === a.minutes)?.priceCents ?? 3000) / 100)}
                  aria-label="Price per lesson" className="min-w-0 flex-1 bg-transparent text-[20px] font-black outline-none placeholder:font-bold" style={{ color: STAGE.cream }} />
                <span className="text-[14px] font-extrabold" style={{ color: STAGE.muted }}>per lesson</span>
              </label>
              <p className="mt-2 text-[13px] font-semibold" style={{ color: STAGE.muted }}>Billing uses this. You can change it any time.</p>
              <div className="mt-auto flex flex-col gap-1 pt-4">
                <BigButton type="submit" disabled={!!a.price && !(Number(a.price) > 0)}>CONTINUE</BigButton>
                <BigButton kind="ghost" onClick={() => { set({ price: '' }); next() }}>SET LATER</BigButton>
              </div>
            </form>
          )}

          {step === 'account' && <AccountStep a={a} studio={studio} picks={picks} onDone={() => go('photo')} />}

          {step === 'photo' && <PhotoStep name={a.name} onDone={next} />}

          {step === 'commit' && (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <h2 className="text-[26px] font-black">{studio}</h2>
              <p className="mt-2 max-w-[300px] text-[16px] font-bold leading-snug" style={{ color: STAGE.muted }}>
                is ready for its first students.
              </p>
              <div className="mb-5 mt-9">
                <HoldToCommit onDone={() => setTimeout(() => go('welcome'), 150)}>
                  <Femata mood="focused" tone="glow" onDark size={104} />
                </HoldToCommit>
              </div>
              <p className="text-[16px] font-extrabold" style={{ color: STAGE.sky }}>Hold to open your studio doors</p>
            </div>
          )}

          {step === 'welcome' && (
            <WelcomeBurst onDone={next} title={<span className="block max-w-[320px] break-words">{studio.toUpperCase()}<br />IS OPEN!</span>} />
          )}

          {step === 'invite' && <InviteStep studio={studio} name={a.name} onDone={next} profileReady={!!profile} />}

          {step === 'notify' && (
            <div className="flex flex-1 flex-col">
              <Ask mood="wink">Can I tell you when students hand in work?</Ask>
              <div className="mx-auto mt-6 w-full max-w-[300px] rounded-[18px] p-3.5" style={{ background: 'rgba(255,255,255,.08)' }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[11px]" style={{ background: STAGE.sky }}><Femata size={30} /></span>
                  <span className="min-w-0 text-[14px] font-extrabold leading-tight">Ana handed in her scales 🎻
                    <span className="block text-[12.5px] font-bold" style={{ color: STAGE.muted }}>Tap to listen and review.</span>
                  </span>
                </div>
              </div>
              <p className="mx-auto mt-4 max-w-[300px] text-center text-[13px] font-semibold" style={{ color: STAGE.muted }}>
                Handed-in work, messages and lesson reminders. You can change this any time in Settings.
              </p>
              <div className="mt-auto flex flex-col gap-1 pt-4">
                <BigButton onClick={() => { void enableNotifications().finally(next) }}>TURN ON NOTIFICATIONS</BigButton>
                <BigButton kind="ghost" onClick={next}>NOT NOW</BigButton>
              </div>
            </div>
          )}

          {step === 'widget' && (
            <WidgetStep onDone={finish} ask="Your next lesson, right on your Home Screen!" preview={(
              <>
                <span className="text-[11px]" style={{ color: '#1F8FD1' }}>NEXT LESSON</span>
                <span className="text-[15px] leading-tight">4:00 PM</span>
                <span className="font-bold leading-tight" style={{ color: '#6B7280' }}>Ana · 45 min</span>
              </>
            )} />
          )}
        </motion.div>
      </AnimatePresence>
    </Stage>
  )
}

/* ── The account ──────────────────────────────────────────── */
function AccountStep({ a, studio, picks, onDone }: { a: Answers; studio: string; picks: string[]; onDone: () => void }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [legalAccepted, setLegalAccepted] = useState(false)
  const mismatch = again.length > 0 && again !== password
  const ok = /\S+@\S+\.\S+/.test(email) && password.length >= 8 && again === password && legalAccepted

  /** The setup's answers, for whichever way the account is made. */
  function newAccount() {
    const fields = instrumentFields(picks)
    return {
      studioName: studio,
      instrument: fields.instrument,
      legalAccepted,
      extra: { instruments: fields.instruments, ...(fields.instrumentName ? { instrumentName: fields.instrumentName } : {}) },
    }
  }

  async function opened(uid: string) {
    localStorage.setItem(`maestro_role_${uid}`, 'teacher')
    // The usual lesson and its price: the other lengths priced in
    // proportion, so Billing has a price for whichever one a student has.
    const price = Number(a.price)
    await saveStudioSettings(uid, {
      defaultLessonMinutes: a.minutes,
      ...(price > 0 ? {
        lessonTypes: DEFAULT_LESSON_TYPES.map((t) => ({ ...t, priceCents: Math.round((price * t.minutes) / a.minutes) * 100 })),
      } : {}),
    }).catch((err) => console.warn('[setup] could not save the lesson settings', err))
  }

  /** Google or Apple: one that already has an account just goes home. */
  async function social(p: SocialProvider) {
    const { user, existing } = await socialSignUp(p, a.name, 'teacher', newAccount())
    if (existing) { navigate('/', { replace: true }); return }
    await opened(user.uid)
    onDone()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    setError('')
    try {
      const user = await signUp(email.trim(), password, a.name.trim(), 'teacher', newAccount())
      await opened(user.uid)
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

  return (
    <form className="flex flex-1 flex-col" onSubmit={submit}>
      <Ask mood="excited">Last thing{a.name.trim() ? `, ${callName(a.name)}` : ''}: let's save your studio!</Ask>
      <h2 className="mb-3 text-[26px] font-black">Create your account</h2>
      <div className="flex flex-col gap-2.5">
        <input type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-[16px] px-4 py-3.5 text-[16px] font-bold outline-none" style={input(!!email)} />
        <div className="relative">
          <input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-[16px] py-3.5 pl-4 pr-12 text-[16px] font-bold outline-none" style={input(!!password)} />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center" style={{ color: STAGE.muted }}>
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        <input type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Re-enter password" value={again} onChange={(e) => setAgain(e.target.value)}
          aria-invalid={mismatch || undefined}
          className="w-full rounded-[16px] px-4 py-3.5 text-[16px] font-bold outline-none" style={{ ...input(!!again), ...(mismatch ? { borderColor: '#FF8FA3' } : {}) }} />
      </div>
      {mismatch && <p className="mt-2 text-[13px] font-bold" style={{ color: '#FF8FA3' }}>The passwords don't match yet.</p>}
      <label className="mt-3 flex items-start gap-2 text-[12px] font-semibold leading-relaxed" style={{ color: STAGE.muted }}><input type="checkbox" checked={legalAccepted} onChange={(e) => setLegalAccepted(e.target.checked)} className="mt-0.5" /><span>I agree to the <a className="underline" href="https://femataus.com/terms" target="_blank" rel="noreferrer">Terms</a> and acknowledge the <a className="underline" href="https://femataus.com/privacy" target="_blank" rel="noreferrer">Privacy Notice</a>.</span></label>
      {error && <p className="mt-3 text-[13.5px] font-bold" style={{ color: '#FF8FA3' }}>{error}</p>}
      <SocialButtons dark run={social} />
      <p className="mt-3 text-[13px] font-semibold" style={{ color: STAGE.muted }}>
        Already have an account? <Link to="/login" className="font-extrabold" style={{ color: STAGE.sky }}>Log in</Link>
      </p>
      <div className="mt-auto pt-4"><BigButton type="submit" disabled={!ok || busy}>{busy ? 'CREATING…' : 'CREATE STUDIO'}</BigButton></div>
    </form>
  )
}

/* ── A photo, so students know whose studio it is ────────── */
function PhotoStep({ name, onDone }: { name: string; onDone: () => void }) {
  const pick = useRef<HTMLInputElement>(null)
  const [cropping, setCropping] = useState<File | null>(null)
  const [shown, setShown] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => () => { if (shown) URL.revokeObjectURL(shown) }, [shown])

  async function save(file: File) {
    setBusy(true)
    setError('')
    setShown(URL.createObjectURL(file))
    try {
      await uploadAvatar(file)
      haptic('success')
    } catch {
      setShown(null)
      setError('That photo did not upload. Try another, or skip for now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Ask mood="happy">Add a photo so your students recognise you 📸</Ask>
      <button type="button" onClick={() => pick.current?.click()} aria-label="Choose a photo"
        className="mx-auto mt-6 grid h-[150px] w-[150px] place-items-center overflow-hidden rounded-full"
        style={{ background: STAGE.ink2, border: `3px dashed ${shown ? STAGE.sky : STAGE.ink3}` }}>
        {shown
          ? <img src={shown} alt="" className="h-full w-full object-cover" />
          : <span className="flex flex-col items-center gap-1.5 text-[13px] font-extrabold" style={{ color: STAGE.muted }}><Camera size={30} />{(studioWord(name) || 'Photo').charAt(0).toUpperCase()}</span>}
      </button>
      <input ref={pick} type="file" accept="image/*" className="hidden" onChange={(e) => {
        const f = e.target.files?.[0]
        e.target.value = ''
        if (!f) return
        const problem = checkAvatarFile(f)
        if (problem) { setError(problem); return }
        setCropping(f)
      }} />
      {error && <p className="mt-3 text-center text-[13.5px] font-bold" style={{ color: '#FF8FA3' }}>{error}</p>}
      <div className="mt-auto flex flex-col gap-1 pt-4">
        {shown
          ? <BigButton disabled={busy} onClick={onDone}>{busy ? 'SAVING…' : 'CONTINUE'}</BigButton>
          : <BigButton onClick={() => pick.current?.click()}>CHOOSE A PHOTO</BigButton>}
        {!shown && <BigButton kind="ghost" onClick={onDone}>SKIP FOR NOW</BigButton>}
      </div>
      {cropping && (
        <ImageCropper file={cropping} aspect={1} round outputWidth={800} title="Move and zoom your photo"
          onCancel={() => setCropping(null)} onDone={(f) => { setCropping(null); void save(f) }} />
      )}
    </div>
  )
}

/* ── A first student ──────────────────────────────────────── */
function InviteStep({ studio, name, onDone, profileReady }: { studio: string; name: string; onDone: () => void; profileReady: boolean }) {
  const { profile } = useAuth()
  const [invite, setInvite] = useState<NewInvite | null>(null)
  const [error, setError] = useState('')
  const asked = useRef(false)
  // One invitation, made once the new profile has arrived.
  useEffect(() => {
    if (!profileReady || !profile || asked.current) return
    asked.current = true
    createInvite(profile).then(setInvite).catch(() => setError('The invitation could not be made. You can invite students from the app.'))
  }, [profileReady, profile])

  async function share() {
    if (!invite) return
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `Join ${studio} on Femata`, text: `${name.trim()} has invited you to join ${studio} on Femata.`, url: invite.url })
      } else {
        await navigator.clipboard.writeText(invite.url)
      }
    } catch { /* a cancelled share is not a failure */ }
  }

  return (
    <div className="flex flex-1 flex-col">
      <Ask mood="wink">Invite your first student? They scan, you accept.</Ask>
      <div className="mx-auto mt-4 grid h-[212px] w-[212px] place-items-center rounded-[22px] bg-white p-3">
        {invite ? <QRCode value={invite.url} size={188} />
          : error ? <p className="px-3 text-center text-[13px] font-bold" style={{ color: '#B3263C' }}>{error}</p>
            : <div className="h-8 w-8 animate-spin rounded-full" style={{ border: '3px solid #D5DCE6', borderTopColor: STAGE.skyDeep }} />}
      </div>
      {invite && (
        <p className="mt-3 text-center text-[14px] font-bold" style={{ color: STAGE.muted }}>
          Or the code <span className="font-black tracking-[.12em]" style={{ color: STAGE.cream }}>{invite.code}</span> · good for 7 days
        </p>
      )}
      <div className="mt-auto flex flex-col gap-1 pt-4">
        <BigButton disabled={!invite} onClick={() => { void share() }}>SHARE INVITE LINK</BigButton>
        <BigButton kind="ghost" onClick={onDone}>{invite ? 'DONE' : 'LATER'}</BigButton>
      </div>
    </div>
  )
}
