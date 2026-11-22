import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import Femata, { type FemataMood } from '@/components/femata/Femata'

/**
 * The first-run screens' own world: a navy stage with blue stave lines
 * glowing behind Femata ("Night stave"). Fixed colours on purpose — these
 * screens look the same whatever theme the app is later set to.
 */
export const STAGE = {
  ink: '#0E1626', ink2: '#18233A', ink3: '#25324D', sky: '#3DB5F5', skyDeep: '#1F8FD1',
  cream: '#F5F7FB', muted: '#9AA8C0',
}

export function Stage({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
      style={{
        background: `radial-gradient(120% 70% at 50% 34%, #1D3B6B 0%, ${STAGE.ink} 62%)`,
        color: STAGE.cream,
        fontFamily: 'var(--clay-font)',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -left-[120px] -top-[90px] h-[300px] w-[300px] rounded-full" style={{ background: '#1B2F52' }} />
      <div aria-hidden className="pointer-events-none absolute -right-[120px] bottom-[18%] h-[280px] w-[280px] rounded-full" style={{ background: '#1B2F52' }} />
      {staff && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'repeating-linear-gradient(180deg, transparent 0 26px, rgba(61,181,245,.2) 26px 27.5px)',
            WebkitMaskImage: 'linear-gradient(180deg, transparent 12%, #000 30%, #000 52%, transparent 70%)',
            maskImage: 'linear-gradient(180deg, transparent 12%, #000 30%, #000 52%, transparent 70%)',
          }}
        />
      )}
      <div className="relative mx-auto flex w-full max-w-[460px] flex-1 flex-col px-5 pb-4 pt-3 min-h-0">{children}</div>
    </div>
  )
}

/** The back arrow and how far along the setup is. */
export function TopBar({ progress, onBack }: { progress: number; onBack?: () => void }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="-ml-1 grid h-9 w-9 place-items-center rounded-full transition-opacity active:opacity-60"
        style={{ visibility: onBack ? 'visible' : 'hidden', color: STAGE.cream }}
      >
        <ChevronLeft size={26} />
      </button>
      <div className="h-[10px] flex-1 overflow-hidden rounded-full" style={{ background: STAGE.ink3 }}>
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(4, progress * 100)}%`, background: STAGE.sky }}
        />
      </div>
      <span className="w-9" />
    </div>
  )
}

/** Femata asking the question, in a speech bubble. */
export function Ask({ mood = 'happy', children }: { mood?: FemataMood; children: ReactNode }) {
  return (
    <div className="mb-5 mt-2 flex items-center gap-2.5">
      <Femata mood={mood} tone="glow" onDark size={66} className="shrink-0" />
      <div
        className="relative flex-1 rounded-[18px] px-4 py-3 text-center text-[16px] font-extrabold leading-snug"
        style={{ border: `2px solid ${STAGE.ink3}`, background: 'rgba(14,22,38,.6)' }}
      >
        <span
          aria-hidden
          className="absolute -left-[9px] top-1/2 -mt-[7px] h-0 w-0"
          style={{ borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderRight: `8px solid ${STAGE.ink3}` }}
        />
        {children}
      </div>
    </div>
  )
}

export function Choice({ on, onClick, children, right }: { on: boolean; onClick: () => void; children: ReactNode; right?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex w-full items-center justify-between gap-3 rounded-[16px] px-4 py-3.5 text-left text-[16px] font-extrabold transition-[transform,background,color] duration-150 active:scale-[.98]"
      style={on
        ? { background: STAGE.cream, color: STAGE.ink, border: `2px solid ${STAGE.cream}` }
        : { background: 'rgba(14,22,38,.55)', color: STAGE.cream, border: `2px solid ${STAGE.ink3}` }}
    >
      <span className="flex min-w-0 items-center gap-3">{children}</span>
      {right}
    </button>
  )
}

export function BigButton({ children, onClick, disabled, kind = 'primary', type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: 'primary' | 'ghost'; type?: 'button' | 'submit'
}) {
  const primary = kind === 'primary'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-[16px] py-4 text-[14px] font-black tracking-[.12em] transition-[transform,opacity] duration-100 active:translate-y-[2px] disabled:active:translate-y-0"
      style={primary
        ? disabled
          ? { background: STAGE.ink3, color: STAGE.muted }
          : { background: STAGE.sky, color: '#04223A', boxShadow: `0 4px 0 ${STAGE.skyDeep}` }
        : { background: 'transparent', color: STAGE.cream, opacity: 0.85 }}
    >
      {children}
    </button>
  )
}

/**
 * Press and hold to commit: the ring fills while held and drains back if
 * let go early. Keyboard: hold Space or Enter.
 */
export function HoldToCommit({ onDone, children, ms = 1600 }: { onDone: () => void; children: ReactNode; ms?: number }) {
  const [p, setP] = useState(0)
  const [pressed, setPressed] = useState(false)
  const dir = useRef(0)
  const done = useRef(false)
  const pRef = useRef(0)
  const raf = useRef(0)
  const last = useRef(0)
  const quarter = useRef(0)
  const finish = useRef(onDone)
  finish.current = onDone

  const loop = (t: number) => {
    const dt = last.current ? t - last.current : 16
    last.current = t
    const next = Math.max(0, Math.min(1, pRef.current + dir.current * dt / (dir.current > 0 ? ms : 450)))
    pRef.current = next
    setP(next)
    const q = Math.floor(next * 4)
    if (q > quarter.current && dir.current > 0) { try { navigator.vibrate?.(12) } catch { /* not on this device */ } }
    quarter.current = q
    if (next >= 1 && !done.current) {
      done.current = true
      dir.current = 0
      setPressed(false)
      try { navigator.vibrate?.(40) } catch { /* not on this device */ }
      finish.current()
    }
    if ((dir.current > 0 && next < 1) || (dir.current < 0 && next > 0)) raf.current = requestAnimationFrame(loop)
    else { raf.current = 0; last.current = 0 }
  }
  const go = (d: number) => {
    if (done.current) return
    dir.current = d
    setPressed(d > 0)
    if (!raf.current) raf.current = requestAnimationFrame(loop)
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const R = 76, LEN = 2 * Math.PI * R
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Press and hold to commit"
      className="relative h-[190px] w-[190px] cursor-pointer select-none outline-none [touch-action:none] [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-[#3DB5F5] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0E1626] rounded-full"
      onPointerDown={(e) => { e.preventDefault(); go(1) }}
      onPointerUp={() => go(-1)}
      onPointerLeave={() => go(-1)}
      onPointerCancel={() => go(-1)}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); go(1) } }}
      onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') go(-1) }}
    >
      <svg viewBox="0 0 170 170" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="85" cy="85" r={R} fill="none" stroke={STAGE.ink3} strokeWidth="14" />
        <circle cx="85" cy="85" r={R} fill="none" stroke={STAGE.sky} strokeWidth="14" strokeLinecap="round" strokeDasharray={LEN} strokeDashoffset={LEN * (1 - p)} />
      </svg>
      <div
        className="absolute inset-[24px] grid place-items-center rounded-full transition-transform duration-200"
        style={{ background: STAGE.ink2, transform: pressed ? 'scale(.94)' : 'none' }}
      >
        {children}
      </div>
    </div>
  )
}
