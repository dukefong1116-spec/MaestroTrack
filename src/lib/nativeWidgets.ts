import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { isNativeApp } from '@/lib/native'

/**
 * The iPhone app's widgets and practice Live Activity (FemataWidgetsPlugin
 * and the FemataWidgets extension in ios/App). The web app hands over the
 * numbers; the widgets and the Dynamic Island draw them. Does nothing
 * outside the iPhone app.
 */
export interface WidgetSnapshot {
  role: 'student' | 'teacher'
  day: string
  name: string
  streak: number
  todayLit: boolean
  todayMinutes: number
  goalMinutes: number
  /** Monday … Sunday: practised. */
  week: boolean[]
  todayIndex: number
  streakGoal: number
  nextLessonTitle?: string
  /** ms since 1970 */
  nextLessonStart?: number
  toReview: number
}

export interface LiveState {
  /** ms since 1970: when the clock would have started had it never paused. */
  startedAt: number
  /** Seconds on the clock, while paused. */
  pausedElapsed?: number
  category: string
  piece: string
  todayMinutesBefore: number
  goalMinutes: number
}

interface Plugin {
  update(o: { snapshot: WidgetSnapshot }): Promise<void>
  liveStart(o: LiveState): Promise<void>
  liveUpdate(o: LiveState): Promise<void>
  liveEnd(o: { doneMinutes?: number }): Promise<void>
  takePending(): Promise<{ actions: string[] }>
  addListener(e: 'open', fn: (d: { url: string }) => void): Promise<PluginListenerHandle>
}
const Widgets = registerPlugin<Plugin>('FemataWidgets')

let lastSnapshot = ''
/** Saved for the widgets, only when something in it changed. */
export function updateWidgets(s: WidgetSnapshot) {
  if (!isNativeApp) return
  const json = JSON.stringify(s)
  if (json === lastSnapshot) return
  lastSnapshot = json
  void Widgets.update({ snapshot: s }).catch(() => {})
}

/* ── the practice Live Activity ───────────────────────────── */

let live = false
let lastLive = ''
let endTimer: ReturnType<typeof setTimeout> | undefined
let piece = ''
let lastState: LiveState | null = null

/** The piece being practised, from the session page. */
export function setLivePiece(title: string) {
  if (title === piece) return
  piece = title
  if (live && lastState) liveShow({ ...lastState, piece: title })
}
export function livePiece() { return piece }

export function liveShow(s: LiveState) {
  if (!isNativeApp) return
  clearTimeout(endTimer)
  lastState = s
  const json = JSON.stringify(s)
  if (live && json === lastLive) return
  lastLive = json
  if (live) void Widgets.liveUpdate(s).catch(() => {})
  else { live = true; void Widgets.liveStart(s).catch(() => {}) }
}

/**
 * The clock was cleared. A saved session says so straight after
 * (liveDone), which celebrates; otherwise (discarded) it just goes.
 */
export function liveCleared() {
  if (!isNativeApp || !live) return
  clearTimeout(endTimer)
  endTimer = setTimeout(() => { live = false; lastLive = ''; void Widgets.liveEnd({}).catch(() => {}) }, 2500)
}

/** The session was saved: a moment of celebration in the Island, then it goes. */
export function liveDone(minutes: number) {
  if (!isNativeApp || !live) return
  clearTimeout(endTimer)
  live = false
  lastLive = ''
  void Widgets.liveEnd({ doneMinutes: minutes }).catch(() => {})
}

/** Pause / Resume pressed on the Live Activity since we last looked. */
export async function takeLiveActions(): Promise<string[]> {
  if (!isNativeApp) return []
  try { return (await Widgets.takePending()).actions ?? [] } catch { return [] }
}

/** femata:// links opened from a widget or the Live Activity. */
export function onWidgetLink(fn: (url: string) => void): () => void {
  if (!isNativeApp) return () => {}
  let handle: PluginListenerHandle | undefined
  let on = true
  void Widgets.addListener('open', (d) => fn(d.url)).then((h) => { if (on) handle = h; else void h.remove() })
  return () => { on = false; void handle?.remove() }
}

/** Where a femata:// link goes in the app. */
export function routeForLink(url: string): string | null {
  try {
    const u = new URL(url)
    const where = u.host || u.pathname.replace(/^\/+/, '')
    const finish = u.searchParams.get('finish') === '1'
    switch (where) {
      case 'session': return finish ? '/student/session?finish=1' : '/student/session'
      case 'student': return '/student'
      case 'teacher': return '/teacher'
      case 'review': return '/teacher/review'
      case 'calendar': return '/teacher/calendar'
      default: return null
    }
  } catch { return null }
}
