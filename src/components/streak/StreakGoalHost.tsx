import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import Femata from '@/components/femata/Femata'
import StreakFlame from '@/components/icons/StreakFlame'
import { useAuth } from '@/hooks/useAuth'
import { useStreak } from '@/hooks/useStreak'
import { useHoldMoment, useMomentStore } from '@/stores/momentStore'
import { useAuthStore } from '@/stores/authStore'
import { updateUserProfile } from '@/lib/firebase/teacher'
import { nextGoals } from '@/lib/onboarding/catalog'
import { playBadgeCharge } from '@/lib/utils/sound'
import { enableNotifications, notifyPermission } from '@/lib/notify/push'

/**
 * The streak commitment, on Today.
 *
 *  - First: once a streak has started and no goal is set yet (a new
 *    student after their first session, or anyone who has never picked
 *    one): "1 day streak!", then pick a goal and lock it in.
 *  - Then, every time the goal is reached: a celebration, and the next,
 *    bigger goal to commit to.
 *
 * Counted as a moment on screen, so the tour and badge moments wait for it.
 */
type Mode = 'first' | 'reached'

const LINES: Record<number, string> = {
  7: "A full week? Let's warm up!", 14: "14 days in a row? We've got this.", 30: 'A whole month! Habits start here.',
  50: '50 days?! Legend mode.', 100: 'One hundred days. Whoa.', 200: 'Two hundred! Unstoppable.', 365: 'A whole year of music!',
}
const lineFor = (d: number) => LINES[d] ?? `${d} days? Let's do it!`

export default function StreakGoalHost() {
  const { profile } = useAuth()
  const { pathname } = useLocation()
  const live = useStreak()
  const busy = useMomentStore((s) => s.open)
  const [open, setOpen] = useState<null | { mode: Mode; reached: number }>(null)

  const goal = profile?.streakGoal ?? 0
  const celebrated = profile?.streakGoalReached ?? 0
  const onToday = pathname === '/student' || pathname === '/student/'
  const due: Mode | null = profile?.role !== 'student' ? null
    : !goal ? (live.current >= 1 && live.todayLit ? 'first' : null)
      : live.current >= goal && celebrated < goal ? 'reached' : null

  // Waits for Today, and for any other moment to finish first.
  useEffect(() => {
    if (!open && due && onToday && busy === 0) {
      // A breath after Today appears, and only if nothing else took the
      // screen in the meantime.
      const t = setTimeout(() => {
        if (useMomentStore.getState().open === 0) setOpen({ mode: due, reached: due === 'reached' ? goal : 0 })
      }, 900)
      return () => clearTimeout(t)
    }
  }, [open, due, onToday, busy, goal])

  useHoldMoment(!!open)
  return (
    <AnimatePresence>
    {open && profile && <GoalFlow
      key={open.mode + open.reached}
      mode={open.mode}
      reached={open.reached}
      streak={live.current}
      firstName={(profile.displayName ?? '').trim().split(/\s+/)[0]}
      onCommit={(days) => {
        if (!open) return
        const patch = open.mode === 'reached' ? { streakGoal: days, streakGoalReached: open.reached } : { streakGoal: days }
        const p = useAuthStore.getState().profile
        if (p) useAuthStore.getState().setProfile({ ...p, ...patch })
        void updateUserProfile(p?.uid ?? profile!.uid, patch).catch(() => {})
      }}
      onClose={() => setOpen(null)}
    />}
    </AnimatePresence>
  )
}

type Screen = 'intro' | 'pick' | 'locked'

function GoalFlow({ mode, reached, streak, firstName, onCommit, onClose }: {
  mode: Mode; reached: number; streak: number; firstName: string; onCommit: (days: number) => void; onClose: () => void
}) {
  const goals = useMemo(() => nextGoals(mode === 'reached' ? reached : 0), [mode, reached])
  const [screen, setScreen] = useState<Screen>('intro')
  const [pick, setPick] = useState(goals[Math.min(1, goals.length - 1)]?.days ?? 7)
  const hop = useRef(0)
  const [hopKey, setHopKey] = useState(0)

  function lockIn() {
    onCommit(pick)
    setScreen('locked')
    try { playBadgeCharge('commit') } catch { /* no audio */ }
    // The moment someone commits is the moment a reminder makes sense to
    // them: ask now (once; iOS never asks twice).
    void notifyPermission().then((p) => { if (p === 'prompt') void enableNotifications() })
    setTimeout(onClose, 3000)
  }

  return (
    <motion.div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: 'var(--clay-page)', color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      role="dialog"
      aria-modal="true"
      aria-label="Streak goal"
    >
      <div className="relative mx-auto flex w-full max-w-[460px] flex-1 flex-col items-center px-5 pb-5 pt-6 text-center min-h-0">
        <AnimatePresence mode="wait">
          {screen === 'intro' && (
            <motion.div key="intro" className="flex w-full flex-1 flex-col items-center" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
              {mode === 'first' ? (
                <>
                  <motion.div className="mt-8" initial={{ scale: 0.3, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 13 }}>
                    <StreakFlame streak={Math.max(1, streak)} size={150} />
                  </motion.div>
                  <Rise delay={0.65}><div className="mt-2 text-[64px] font-black leading-none" style={{ color: '#F2852A' }}>{Math.max(1, streak)}</div></Rise>
                  <Rise delay={0.8}><div className="text-[26px] font-black" style={{ color: '#F2852A' }}>day streak!</div></Rise>
                  <Rise delay={1}><p className="mt-4 max-w-[300px] text-[15px] font-bold" style={{ color: 'var(--clay-dim)' }}>
                    A streak counts the days you've practised in a row.
                  </p></Rise>
                  <Rise delay={1.25} className="mt-auto flex flex-col items-center">
                    <Bubble>{streak <= 1 ? "Day one, done! Let's pick a goal." : "You're on a roll! Let's pick a goal."}</Bubble>
                    <Femata mood="proud" size={96} />
                  </Rise>
                </>
              ) : (
                <>
                  <Confetti />
                  <motion.div className="mt-6" initial={{ scale: 0.3 }} animate={{ scale: [0.3, 1.15, 1] }} transition={{ duration: 0.7 }}>
                    <StreakFlame streak={streak} size={150} />
                  </motion.div>
                  <div className="mt-2 text-[22px] font-black" style={{ color: '#F2852A' }}>Goal reached!</div>
                  <div className="text-[44px] font-black leading-tight">{reached} days</div>
                  <p className="mt-3 max-w-[300px] text-[15px] font-bold" style={{ color: 'var(--clay-dim)' }}>
                    You kept your promise{firstName ? `, ${firstName}` : ''}. That's a real habit.
                  </p>
                  <div className="mt-auto flex flex-col items-center">
                    <Bubble>{goals.length ? 'Ready for the next one?' : 'I knew you could do it!'}</Bubble>
                    <motion.div animate={{ y: [0, -18, 0] }} transition={{ duration: 0.55, repeat: 2, delay: 0.5 }}>
                      <Femata mood="celebrate" tone="sunrise" size={110} />
                    </motion.div>
                  </div>
                </>
              )}
              <Rise delay={mode === 'first' ? 1.5 : 1.1} className="w-full">
                <PrimaryButton onClick={() => (goals.length ? setScreen('pick') : onClose())}>{goals.length ? 'CONTINUE' : 'DONE'}</PrimaryButton>
              </Rise>
            </motion.div>
          )}

          {screen === 'pick' && (
            <motion.div key="pick" className="flex w-full flex-1 flex-col items-center" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -28 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
              <h2 className="mt-4 text-[26px] font-black">{mode === 'first' ? 'How far will we go?' : 'Your next goal'}</h2>
              <p className="mb-5 mt-1 text-[14.5px] font-bold" style={{ color: 'var(--clay-dim)' }}>Choose a streak to aim for.</p>
              <div className="grid w-full grid-cols-2 gap-3">
                {goals.map((g, k) => {
                  const on = g.days === pick
                  return (
                    <button
                      key={g.days}
                      type="button"
                      aria-pressed={on}
                      onClick={() => { setPick(g.days); hop.current += 1; setHopKey(hop.current) }}
                      className="relative flex h-[136px] flex-col items-center justify-end rounded-[20px] px-2 pb-3 transition-[transform,background,border-color] duration-150 active:scale-[.97]"
                      style={{
                        border: `2px solid ${on ? '#3DB5F5' : 'var(--clay-line)'}`,
                        background: on ? 'rgba(61,181,245,.10)' : 'var(--clay-surface)',
                        transform: on ? 'translateY(-3px)' : 'none',
                      }}
                    >
                      <span
                        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full transition-[opacity,transform] duration-200"
                        style={{ background: '#3DB5F5', color: '#fff', opacity: on ? 1 : 0, transform: on ? 'scale(1)' : 'scale(.4)' }}
                        aria-hidden
                      >
                        <Check size={14} strokeWidth={3.5} />
                      </span>
                      <StreakFlame streak={g.days} size={26 + k * 7} still={!on} />
                      <b className="mt-1 text-[28px] font-black leading-none" style={{ color: on ? '#1F8FD1' : 'var(--clay-ink)' }}>{g.days}</b>
                      <span className="text-[11px] font-extrabold uppercase tracking-[.08em]" style={{ color: 'var(--clay-dim)' }}>days</span>
                      <span className="mt-0.5 text-[13px] font-extrabold" style={{ color: 'var(--clay-dim)' }}>{g.label}</span>
                    </button>
                  )
                })}
              </div>
              <div className="mt-auto flex flex-col items-center pt-4">
                <Bubble><b style={{ color: '#1F8FD1' }}>{lineFor(pick)}</b></Bubble>
                <motion.div key={hopKey} animate={hopKey ? { y: [0, -14, 0] } : undefined} transition={{ duration: 0.35 }}>
                  <Femata mood="excited" tone="sunrise" size={96} />
                </motion.div>
              </div>
              <PrimaryButton onClick={lockIn}>LOCK IN MY GOAL</PrimaryButton>
            </motion.div>
          )}

          {screen === 'locked' && (
            <motion.button
              type="button"
              key="locked"
              onClick={onClose}
              aria-label="Close"
              className="flex w-full flex-1 flex-col items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="relative grid h-[260px] w-[260px] place-items-center">
                {[0, 1].map((r) => (
                  <motion.span
                    key={r}
                    className="absolute inset-[70px] rounded-full"
                    style={{ border: `6px solid ${r ? '#3DB5F5' : '#F2852A'}` }}
                    initial={{ scale: 0.5, opacity: 1 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 1.1, delay: 0.8 + r * 0.25, ease: 'easeOut' }}
                  />
                ))}
                <motion.div className="absolute top-2" initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 11 }}>
                  <StreakFlame streak={pick} size={120} />
                </motion.div>
                <motion.div
                  className="relative mt-24"
                  initial={{ y: 70, scale: 0.4, opacity: 0 }}
                  animate={{ y: [70, 0, 0, -22, 0, -22, 0], scale: 1, opacity: 1 }}
                  transition={{ duration: 2, times: [0, 0.35, 0.6, 0.7, 0.8, 0.9, 1], ease: 'easeOut' }}
                >
                  <Femata mood="celebrate" tone="sunrise" size={140} />
                </motion.div>
                <Confetti delay={0.9} />
              </div>
              <motion.h3 className="text-[28px] font-black" style={{ color: '#F2852A' }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}>
                {pick}-day goal set!
              </motion.h3>
              <motion.p className="mt-1 text-[15px] font-bold" style={{ color: 'var(--clay-dim)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
                See you tomorrow{firstName ? `, ${firstName}` : ''}.
              </motion.p>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

function Bubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mb-3 max-w-[300px] rounded-[16px] px-4 py-2.5 text-[14.5px] font-bold" style={{ border: '2px solid var(--clay-line)', background: 'var(--clay-surface)' }}>
      {children}
      <span aria-hidden className="absolute -bottom-[9px] left-1/2 -ml-[7px] h-0 w-0" style={{ borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '8px solid var(--clay-line)' }} />
    </div>
  )
}

function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-4 w-full rounded-[16px] py-4 text-[14px] font-black tracking-[.12em] text-white transition-transform active:translate-y-[2px]"
      style={{ background: '#3DB5F5', boxShadow: '0 4px 0 #1F8FD1' }}
    >
      {children}
    </button>
  )
}

const COLS = ['#F2852A', '#FFC93C', '#3DB5F5', '#FF8FA3', '#7FE3A0']
function Confetti({ delay = 0.2 }: { delay?: number }) {
  const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => {
    const a = Math.random() * Math.PI * 2, d = 110 + Math.random() * 110
    return { i, x: Math.cos(a) * d, y: Math.sin(a) * d - 40, r: Math.random() * 540 - 270, c: COLS[i % COLS.length] }
  }), [])
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-[40%]">
      {bits.map((b) => (
        <motion.i
          key={b.i}
          className="absolute h-[7px] w-[10px] rounded-[2px]"
          style={{ background: b.c }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: b.x, y: b.y, rotate: b.r, opacity: 0 }}
          transition={{ duration: 1.6, delay, ease: [0.2, 0.7, 0.4, 1] }}
        />
      ))}
    </div>
  )
}

/** Fades and lifts in, after `delay` seconds. */
function Rise({ delay, className, children }: { delay: number; className?: string; children: React.ReactNode }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.45, ease: 'easeOut' }}>
      {children}
    </motion.div>
  )
}
