import { Activity, Suspense, lazy, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import BottomTabs from './BottomTabs'
import { usePrefs } from '@/hooks/usePrefs'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils/cn'
import { isNativeApp } from '@/lib/native'
import { useAppNativeTabs } from './useAppNativeTabs'
import { bootReady, isBootFinished, onBootFinished } from '@/lib/boot'
import { useMomentStore } from '@/stores/momentStore'

/**
 * The teacher's rail, tab bar and message dock, loaded only for teachers:
 * a student's app used to download all three (and the studio code under
 * them) on every start. Opening a teacher page starts the download at
 * once, alongside signing in, so they are there by the first draw.
 */
const loadRail = () => import('@/components/teacher/layout/TeacherRail')
const loadTabs = () => import('@/components/teacher/layout/TeacherTabs')
const loadDock = () => import('@/components/teacher/layout/MessageDock')
if (typeof window !== 'undefined' && window.location.pathname.startsWith('/teacher')) {
  void loadRail(); void loadTabs(); void loadDock()
}
const TeacherRail = lazy(loadRail)
const TeacherTabs = lazy(loadTabs)
const MessageDock = lazy(loadDock)

export default function AppLayout({ tabs }: { tabs?: Record<string, ReactNode> } = {}) {
  // Mounted once for the whole signed-in app: reading the preferences is
  // what puts them into effect, so the theme, accent, display size and
  // motion setting follow the profile rather than the device.
  usePrefs()
  const { profile, user } = useAuth()
  const cachedRole = user ? localStorage.getItem(`maestro_role_${user.uid}`) : null
  const teacher = (profile?.role ?? cachedRole) === 'teacher'
  // Pages whose colour runs to the top edge, behind the clock: they keep
  // their own content clear of it (LeaguePage, LeaguePlayerPage).
  const { pathname } = useLocation()
  const underStatusBar = /^\/student\/league\/?$|^\/student\/league\//.test(pathname)
  // The tab bar only on the tabs themselves, as in an iPhone app: a page
  // opened from one (a student's record, Settings, a badge, a player) has
  // the screen to itself and a back arrow. A student in a studio reaches
  // Settings from their photo rather than a tab, so for them it is one of
  // those pages too.
  const inStudio = !!profile?.teacherId
  const roots = teacher
    ? ['/teacher', '/teacher/calendar', '/teacher/students', '/teacher/review', '/teacher/more']
    : ['/student', '/student/practice', '/student/practice/progress', '/student/library', '/student/league', '/student/studio', ...(inStudio ? [] : ['/student/settings'])]
  const here = pathname.replace(/\/+$/, '') || '/'
  const showTabs = roots.includes(here)

  // The tabs' pages stay mounted once drawn, as an iPhone app keeps each
  // tab's screen: switching tabs only shows one that is already there
  // (React's <Activity>), instead of building the page from scratch while
  // the tab bar's selection has long since arrived. A hidden tab keeps its
  // state but runs no effects, so it holds no listeners open. Once the
  // first page is on screen the other tabs are drawn too, out of sight and
  // at the lowest priority, so even the first visit to each is immediate.
  const kept = tabs ? roots.filter((p) => p in tabs) : []
  const onTab = kept.includes(here)
  const [drawn, setDrawn] = useState(false)
  const markDrawn = useRef(() => { setDrawn(true); bootReady() }).current
  // Every tab visited stays; the rest are warmed one at a time while the
  // phone is idle, starting a little after the first page is up. Drawing
  // them all at once kept the phone busy just as the first taps came in,
  // which made the tab bar and Today's animations stutter at the start.
  const [warm, setWarm] = useState<string[]>([])
  if (onTab && !warm.includes(here)) setWarm([...warm, here])
  useEffect(() => {
    if (!drawn) return
    const next = kept.find((p) => !warm.includes(p))
    if (!next) return
    type Idle = (cb: () => void, o?: { timeout: number }) => number
    const ric = (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback
    let idle = 0
    const t = setTimeout(() => {
      const add = () => setWarm((w) => (w.includes(next) ? w : [...w, next]))
      if (ric) idle = ric(add, { timeout: 1500 })
      else add()
    }, warm.length <= 1 ? 2500 : 700)
    return () => {
      clearTimeout(t)
      const cic = (window as unknown as { cancelIdleCallback?: (n: number) => void }).cancelIdleCallback
      if (idle && cic) cic(idle)
    }
  }, [drawn, kept.join('|'), warm]) // eslint-disable-line react-hooks/exhaustive-deps
  const mounted = kept.filter((p) => warm.includes(p))

  // Each tab keeps its own place on the page, as it would in an app.
  const mainRef = useRef<HTMLElement>(null)
  const scrollAt = useRef<Record<string, number>>({})
  const lastHere = useRef(here)
  useLayoutEffect(() => {
    const prev = lastHere.current
    lastHere.current = here
    const main = mainRef.current
    if (!main || prev === here || !kept.includes(here)) return
    main.scrollTop = scrollAt.current[here] ?? 0
  })
  // Noted as you scroll: by the time the page has changed, the old one's
  // place is already gone.
  const noteScroll = () => {
    if (mainRef.current && kept.includes(lastHere.current)) scrollAt.current[lastHere.current] = mainRef.current.scrollTop
  }

  // The iPhone app's own tab bar waits for the page: it used to appear the
  // moment the layout mounted, over a page still waiting on its code or on
  // the account it shows.
  // …and steps aside while a full-screen moment (a badge, a streak goal)
  // is up: Apple's bar sits above the page and would cover its buttons.
  const momentOpen = useMomentStore((s) => s.open) > 0
  // …and waits for the launch screen to zoom away before it comes in.
  const [launched, setLaunched] = useState(isBootFinished)
  useEffect(() => (launched ? undefined : onBootFinished(() => setLaunched(true))), [launched])
  useAppNativeTabs(teacher, inStudio, here, showTabs && drawn && !!profile && !momentOpen && launched)

  return (
    <div
      // 100dvh, not 100vh: on mobile Safari the toolbar slides in and out,
      // and vh keeps reporting the taller figure.
      className="flex h-[100dvh] overflow-hidden"
      style={{ background: 'var(--clay-page)', color: 'var(--clay-ink)', fontFamily: 'var(--clay-font)' }}
    >
      {/* A teacher gets the studio's icon rail; a student keeps the sidebar. */}
      {teacher ? <Suspense fallback={null}><TeacherRail /></Suspense> : <Sidebar />}

      {/*
        A column, so the tab bar is a sibling of the scroll area rather than
        a fixed overlay on top of it. Fixed positioning resolves against the
        layout viewport, which on iOS Safari drifts away from the visual one
        while the toolbar animates — that gap is what showed through as a
        band under the content. Two boxes in the same flex column cannot
        come apart, and the content no longer needs padding to dodge a bar
        that is overlapping it.
      */}
      {/* The status bar's strip, kept clear: on a phone the app draws
          edge to edge (viewport-fit=cover), and without this the top of
          every page sat under the clock and the Dynamic Island. Its own
          height on each iPhone; nothing on a computer. Outside the scroll
          area, so content scrolls under it rather than into it. */}
      {/* The tab bar floats over the bottom of the page as a glass capsule
          (Liquid Glass), so content scrolls on behind it. It is placed
          inside this column, not fixed to the window, which keeps it clear
          of the iOS Safari drift the comment above describes. Every page
          ends with room for it (the pb- below). */}
      <div className="relative flex min-w-0 flex-1 flex-col" style={{ paddingTop: underStatusBar ? 0 : 'env(safe-area-inset-top)' }}>
        <main ref={mainRef} onScroll={noteScroll} className="no-scrollbar flex-1 overflow-y-auto overscroll-contain">
          <div
            className={teacher
              ? 'clay-zoom mx-auto max-w-[1320px] px-3 pt-4 pb-[var(--tab-room)] sm:px-5 lg:px-4 lg:pb-24'
              : 'clay-zoom max-w-7xl mx-auto px-6 pt-8 pb-[var(--tab-room)] lg:pb-8'}
            // Room at the end of the page for the floating tab bar, or just
            // the home indicator where there is no tab bar.
            style={{ '--tab-room': showTabs ? `calc(${teacher ? 96 : 104}px + env(safe-area-inset-bottom))` : 'calc(24px + env(safe-area-inset-bottom))' } as React.CSSProperties}
          >
            {mounted.map((p) => (
              <Activity key={p} mode={p === here ? 'visible' : 'hidden'}>
                <Suspense fallback={<PageLoading />}>
                  {tabs![p]}
                  <Drawn onDrawn={markDrawn} />
                </Suspense>
              </Activity>
            ))}
            {!onTab && <><Outlet /><Drawn onDrawn={markDrawn} /></>}
          </div>
        </main>
        {/* Inside the iPhone app Apple's own tab bar is shown instead
            (useNativeTabBar, below); this is the web's. */}
        <div className={cn('pointer-events-none absolute inset-x-0 bottom-0 z-30 px-3 lg:hidden', (!showTabs || isNativeApp) && 'hidden')} style={{ paddingBottom: 'calc(6px + env(safe-area-inset-bottom))' }}>
          <div className="pointer-events-auto">
            {teacher ? <Suspense fallback={null}><TeacherTabs /></Suspense> : <BottomTabs />}
          </div>
        </div>
      </div>
      {teacher && <Suspense fallback={null}><MessageDock /></Suspense>}
    </div>
  )
}

/** Mounted beside a page, so it commits only once the page itself has:
 *  two frames later the page is on the screen. */
function Drawn({ onDrawn }: { onDrawn: () => void }) {
  useEffect(() => {
    let b = 0
    const a = requestAnimationFrame(() => { b = requestAnimationFrame(onDrawn) })
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b) }
  }, [onDrawn])
  return null
}

function PageLoading() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full" style={{ border: '3px solid var(--clay-accent-soft)', borderTopColor: 'var(--clay-accent)' }} />
    </div>
  )
}
