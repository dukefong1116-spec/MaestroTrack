import { startOfWeek, parseISO, format } from 'date-fns'
import type { PracticeSession } from '@/types'
import { computeStreak } from './analytics'
import type { StreakPlan } from '@/lib/streak/plan'
import { categoriesOf } from '@/lib/utils/categories'
import { piecesOf } from './sessionPieces'

/**
 * XP and levels — entirely derived from the session log, so there is
 * nothing to store, nothing to migrate and nothing that can drift out of
 * sync with reality.
 */

const XP_PER_SESSION = 25
const XP_DAILY_GOAL_BONUS = 50
const XP_PER_MILESTONE = 100
const MILESTONES = [7, 14, 30, 50, 100, 200, 365]

/**
 * Past this many minutes in a day, further minutes earn half.
 *
 * The original formula was `minutes + 25/session`, which made the optimal
 * strategy leaving the timer running while you make a sandwich. A practice
 * app should not pay best for presence. Diminishing returns keep a long
 * honest session worth more than a short one without making an abandoned
 * timer the highest-scoring move available.
 */
const SOFT_CAP_MINUTES = 90
/** Returning to a piece on a different day — spaced repetition, not cramming. */
const XP_PER_RETURN_DAY = 15
/** Writing something down. The thoughts pad exists; reflection is worth paying for. */
const XP_PER_REFLECTION = 10
/** Three or more categories inside one week. */
const XP_WEEKLY_VARIETY = 40

/**
 * The day quality weighting arrived.
 *
 * Sessions logged before this are credited with whatever the old formula
 * would have paid, if that was more. Sessions after are valued purely by
 * the new one.
 *
 * Taking `max(old, new)` over the *whole* history instead would have let
 * an abandoned timer keep earning at the old flat rate forever, so the
 * new incentive would never bite for exactly the players it is aimed at —
 * and it left the XP bar frozen at 0% until the new total caught up,
 * which could take months of real practice.
 *
 * A constant, not a stored migration date: nothing to write, nothing to
 * back-fill, and every client agrees.
 */
const QUALITY_XP_FROM = '2026-09-20'

/** Cumulative XP needed to *reach* a level. Level 1 is the start. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0
  const n = level - 1
  return 150 * ((n * (n + 1)) / 2)
}

export function levelForXp(xp: number): number {
  let level = 1
  while (xp >= xpForLevel(level + 1)) level++
  return level
}

export interface Progression {
  totalXp: number
  level: number
  /** XP earned inside the current level. */
  xpIntoLevel: number
  /** XP the current level spans. */
  xpForThisLevel: number
  /** 0–100 through the current level. */
  percent: number
}

export function computeProgression(
  sessions: PracticeSession[],
  dailyGoalMinutes: number
): Progression {
  // Days where the daily goal was met earn a bonus, counted once per day.
  const byDay = new Map<string, number>()
  for (const s of sessions) {
    const day = s.date.substring(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + s.durationMinutes)
  }
  const goalDays =
    dailyGoalMinutes > 0
      ? [...byDay.values()].filter((m) => m >= dailyGoalMinutes).length
      : 0

  const { longest } = computeStreak(sessions)
  const milestonesHit = MILESTONES.filter((m) => longest >= m).length

  // Minutes, with diminishing returns past the soft cap *per day* — the
  // cap has to be daily, since a single 6-hour day and six honest hour-long
  // days are not the same practice and should not score the same.
  const minuteXp = [...byDay.values()].reduce((sum, m) => {
    const full = Math.min(m, SOFT_CAP_MINUTES)
    return sum + full + Math.floor(Math.max(0, m - SOFT_CAP_MINUTES) / 2)
  }, 0)

  const earned =
    minuteXp +
    sessions.length * XP_PER_SESSION +
    goalDays * XP_DAILY_GOAL_BONUS +
    milestonesHit * XP_PER_MILESTONE +
    returnDays(sessions) * XP_PER_RETURN_DAY +
    sessions.filter((s) => (s.notes ?? '').trim().length > 0).length * XP_PER_REFLECTION +
    variedWeeks(sessions) * XP_WEEKLY_VARIETY

  // Nobody may lose progress they already had. XP is fully derived, so
  // changing the formula reprices every session ever logged, and a player
  // who was level 7 yesterday waking up at level 5 is worse than never
  // having improved it. This credits the shortfall on pre-cutover history
  // once — a fixed number that stops growing, so the bar keeps moving and
  // future practice is valued by the new rules alone.
  const totalXp = earned + legacyShortfall(sessions, dailyGoalMinutes)

  const level = levelForXp(totalXp)
  const base = xpForLevel(level)
  const next = xpForLevel(level + 1)

  return {
    totalXp,
    level,
    xpIntoLevel: totalXp - base,
    xpForThisLevel: next - base,
    percent: Math.min(100, Math.round(((totalXp - base) / (next - base)) * 100)),
  }
}

/**
 * What pre-cutover history would have lost to the new weighting, credited
 * back once. Zero for anyone who started after the change, and zero for
 * anyone the new formula already pays more.
 */
function legacyShortfall(sessions: PracticeSession[], dailyGoalMinutes: number): number {
  const before = sessions.filter((s) => s.date.substring(0, 10) < QUALITY_XP_FROM)
  if (before.length === 0) return 0

  const byDay = new Map<string, number>()
  for (const s of before) {
    const day = s.date.substring(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + s.durationMinutes)
  }
  const goalDays =
    dailyGoalMinutes > 0 ? [...byDay.values()].filter((m) => m >= dailyGoalMinutes).length : 0

  // The old formula, exactly as it stood: flat minutes, flat per session.
  const old =
    before.reduce((sum, s) => sum + s.durationMinutes, 0) +
    before.length * XP_PER_SESSION +
    goalDays * XP_DAILY_GOAL_BONUS

  // The same history under the new weighting, so the credit covers only
  // the genuine difference.
  const fresh =
    [...byDay.values()].reduce((sum, m) => {
      const full = Math.min(m, SOFT_CAP_MINUTES)
      return sum + full + Math.floor(Math.max(0, m - SOFT_CAP_MINUTES) / 2)
    }, 0) +
    before.length * XP_PER_SESSION +
    goalDays * XP_DAILY_GOAL_BONUS +
    returnDays(before) * XP_PER_RETURN_DAY +
    before.filter((s) => (s.notes ?? '').trim().length > 0).length * XP_PER_REFLECTION +
    variedWeeks(before) * XP_WEEKLY_VARIETY

  return Math.max(0, old - fresh)
}

/**
 * Days spent on a piece already practised on an earlier day. Coming back to
 * something after a night's sleep is how it actually gets learned, so it is
 * the one behaviour here worth paying a bonus for.
 */
function returnDays(sessions: PracticeSession[]): number {
  const firstDay = new Map<string, string>()
  const counted = new Set<string>()
  let returns = 0

  for (const s of [...sessions].sort((a, b) => a.date.localeCompare(b.date))) {
    const day = s.date.substring(0, 10)
    // Every piece a session was on, so one shared between two still
    // counts as coming back to each.
    for (const piece of piecesOf(s)) {
      const first = firstDay.get(piece)
      if (first === undefined) {
        firstDay.set(piece, day)
        continue
      }
      // One bonus per piece per day, so three sessions in an evening are not
      // three returns.
      const key = `${piece}|${day}`
      if (day !== first && !counted.has(key)) {
        counted.add(key)
        returns++
      }
    }
  }
  return returns
}

/** Weeks containing three or more distinct categories. */
function variedWeeks(sessions: PracticeSession[]): number {
  const byWeek = new Map<string, Set<string>>()
  for (const s of sessions) {
    // parseISO + format, never toISOString: the latter converts a local
    // week boundary to UTC, which shifts it to the previous day west of
    // Greenwich. It grouped consistently by luck here, but this is the
    // exact shape of two date bugs this codebase has already paid for.
    const week = format(startOfWeek(parseISO(s.date.substring(0, 10))), 'yyyy-MM-dd')
    if (!byWeek.has(week)) byWeek.set(week, new Set())
    for (const c of categoriesOf(s)) byWeek.get(week)!.add(c)
  }
  return [...byWeek.values()].filter((cats) => cats.size >= 3).length
}

/* ── Badges ──────────────────────────────────────────────────────────
 * Single source of truth, shared by the Progress page and the unlock
 * moment so the two can never describe a badge differently.
 */

/** The domain owns these ids; the artwork conforms to them, not the reverse. */
export type BadgeId =
  | 'first_session'
  | 'week_warrior'
  | 'century'
  | 'marathon'
  | 'consistency'
  | 'ten_hours'
  | 'early_bird'
  | 'night_owl'
  | 'weekend'
  | 'fortnight'
  | 'unbreakable'
  | 'half_century'
  | 'fifty_hours'
  | 'deep_focus'
  | 'encore'
  | 'mastered'

/** What a badge is counting, so the detail screen can say it in words. */
export type BadgeUnit = 'sessions' | 'days' | 'minutes' | 'level' | 'weekends' | 'recordings' | 'pieces'

/** Tiered badges belong to a family; the grid shows one tile per family. */
export type BadgeFamily = 'hours' | 'sessions' | 'streak' | 'level' | 'session_length'
  | 'early' | 'night' | 'weekend' | 'recordings' | 'repertoire'

/**
 * A badge is a target and a way of reading the current number off the
 * context — never a predicate.
 *
 * It used to be `earned: (ctx) => boolean`, which was fine while nothing
 * showed progress. A progress bar needs the number *and* the target, and
 * writing both by hand means they drift: a bar at 100% beside a badge that
 * is still locked. Deriving `earned` from the same two values makes that
 * disagreement impossible to express.
 */
export interface BadgeDef {
  id: BadgeId
  label: string
  /** What it means, for the detail screen. */
  description: string
  family: BadgeFamily
  /** 1-based position within the family. */
  tier: number
  unit: BadgeUnit
  target: number
  current: (ctx: BadgeContext) => number
}

export interface BadgeContext {
  sessionCount: number
  currentStreak: number
  longestStreak: number
  longestSessionMinutes: number
  totalMinutes: number
  level: number
  /** Timer sessions started before 8 AM (and after 4 AM). */
  earlySessions: number
  /** Timer sessions still going at 9 PM or later. */
  lateSessions: number
  /** Weekends with practice on both the Saturday and the Sunday. */
  fullWeekends: number
  recordings: number
  masteredPieces: number
}

export const BADGES: BadgeDef[] = [
  { id: 'first_session', label: 'First Note', description: 'Logged your first practice session',
    family: 'sessions', tier: 1, unit: 'sessions', target: 1, current: (c) => c.sessionCount },
  { id: 'half_century', label: 'Half Century', description: 'Logged 50 practice sessions',
    family: 'sessions', tier: 2, unit: 'sessions', target: 50, current: (c) => c.sessionCount },
  { id: 'century', label: 'Century Club', description: 'Logged 100 practice sessions',
    family: 'sessions', tier: 3, unit: 'sessions', target: 100, current: (c) => c.sessionCount },

  { id: 'week_warrior', label: 'Week Warrior', description: 'Practised every day for a week',
    family: 'streak', tier: 1, unit: 'days', target: 7, current: (c) => c.longestStreak },
  { id: 'fortnight', label: 'Fortnight Flame', description: 'Reached a 14-day streak',
    family: 'streak', tier: 2, unit: 'days', target: 14, current: (c) => c.longestStreak },
  { id: 'consistency', label: 'Iron Discipline', description: 'Reached a 30-day streak',
    family: 'streak', tier: 3, unit: 'days', target: 30, current: (c) => c.longestStreak },
  { id: 'unbreakable', label: 'Unbreakable', description: 'Reached a 100-day streak',
    family: 'streak', tier: 4, unit: 'days', target: 100, current: (c) => c.longestStreak },

  { id: 'marathon', label: 'Marathon', description: 'Practised 60+ minutes in one session',
    family: 'session_length', tier: 1, unit: 'minutes', target: 60, current: (c) => c.longestSessionMinutes },
  { id: 'deep_focus', label: 'Deep Focus', description: 'Practised 90+ minutes in one session',
    family: 'session_length', tier: 2, unit: 'minutes', target: 90, current: (c) => c.longestSessionMinutes },

  { id: 'ten_hours', label: '10 Hours Strong', description: 'Accumulated 600 minutes of practice',
    family: 'hours', tier: 1, unit: 'minutes', target: 600, current: (c) => c.totalMinutes },
  { id: 'fifty_hours', label: 'Fifty Hours', description: 'Accumulated 3,000 minutes of practice',
    family: 'hours', tier: 2, unit: 'minutes', target: 3000, current: (c) => c.totalMinutes },

  { id: 'early_bird', label: 'Early Bird', description: 'Practised with the timer before 8 AM',
    family: 'early', tier: 1, unit: 'sessions', target: 1, current: (c) => c.earlySessions },
  { id: 'night_owl', label: 'Night Owl', description: 'Practised with the timer after 9 PM',
    family: 'night', tier: 1, unit: 'sessions', target: 1, current: (c) => c.lateSessions },
  { id: 'weekend', label: 'Weekend Regular', description: 'Practised on the Saturday and the Sunday of one weekend',
    family: 'weekend', tier: 1, unit: 'weekends', target: 1, current: (c) => c.fullWeekends },
  { id: 'encore', label: 'Encore', description: 'Saved your first recording',
    family: 'recordings', tier: 1, unit: 'recordings', target: 1, current: (c) => c.recordings },
  { id: 'mastered', label: 'Mastered', description: 'Marked your first piece as mastered',
    family: 'repertoire', tier: 1, unit: 'pieces', target: 1, current: (c) => c.masteredPieces },
]

/** Won, or not. The one definition — nothing else decides this. */
export function isEarned(badge: BadgeDef, ctx: BadgeContext): boolean {
  return badge.current(ctx) >= badge.target
}

/** 0 to 1, for the bar. Capped, so an overshoot does not overflow it. */
export function badgeProgress(badge: BadgeDef, ctx: BadgeContext): number {
  if (badge.target <= 0) return 1
  return Math.max(0, Math.min(1, badge.current(ctx) / badge.target))
}

/**
 * The level is passed in rather than defaulted.
 *
 * It used to default to 1 and rely on every caller remembering to spread
 * the real one over the top — which useGamification does, so the app was
 * right, but the function still returned something untrue on its own and
 * any new caller would have inherited that quietly.
 */
export function buildBadgeContext(
  sessions: PracticeSession[],
  plan: StreakPlan | string[] = [],
  level = 1,
  extra: { recordings?: number; masteredPieces?: number } = {}
): BadgeContext {
  const { current, longest } = computeStreak(sessions, plan)
  const totalMinutes = sessions.reduce((s, p) => s + p.durationMinutes, 0)
  return {
    sessionCount: sessions.length,
    currentStreak: current,
    longestStreak: longest,
    longestSessionMinutes: sessions.reduce((m, s) => Math.max(m, s.durationMinutes), 0),
    totalMinutes,
    level,
    ...timeOfDay(sessions),
    fullWeekends: fullWeekends(sessions),
    recordings: extra.recordings ?? 0,
    masteredPieces: extra.masteredPieces ?? 0,
  }
}

/**
 * Early and late sessions, from timer sessions only: their saved time is
 * when the timer stopped, so the start is that minus the minutes. A
 * session typed in later carries the time it was typed, not played.
 */
function timeOfDay(sessions: PracticeSession[]): { earlySessions: number; lateSessions: number } {
  let earlySessions = 0
  let lateSessions = 0
  for (const s of sessions) {
    if (s.source !== 'timer') continue
    const end = new Date(s.createdAt)
    if (Number.isNaN(end.getTime())) continue
    const start = new Date(end.getTime() - s.durationMinutes * 60_000)
    const sh = start.getHours()
    const eh = end.getHours()
    if (sh >= 4 && sh < 8) earlySessions++
    if (eh >= 21 || eh < 4) lateSessions++
  }
  return { earlySessions, lateSessions }
}

/** Weekends with a session on both the Saturday and the Sunday after it. */
function fullWeekends(sessions: PracticeSession[]): number {
  const days = new Set(sessions.map((s) => s.date.slice(0, 10)))
  let n = 0
  for (const d of days) {
    const [y, m, dd] = d.split('-').map(Number)
    const sat = new Date(y, m - 1, dd)
    if (sat.getDay() !== 6) continue
    const sun = new Date(y, m - 1, dd + 1)
    const key = `${sun.getFullYear()}-${String(sun.getMonth() + 1).padStart(2, '0')}-${String(sun.getDate()).padStart(2, '0')}`
    if (days.has(key)) n++
  }
  return n
}

/** What each family is called where a person reads it. */
export const FAMILY_LABEL: Record<BadgeFamily, string> = {
  sessions: 'Sessions logged',
  streak: 'Streak',
  hours: 'Hours practised',
  level: 'Level',
  session_length: 'One long session',
  early: 'Early mornings',
  night: 'Late nights',
  weekend: 'Weekends',
  recordings: 'Recordings',
  repertoire: 'Pieces mastered',
}

export interface FamilyState {
  family: BadgeFamily
  label: string
  /** Every tier, lowest first. */
  tiers: BadgeDef[]
  /** The highest tier won, or null before the first. */
  highest: BadgeDef | null
  /** The next one to go for, or null once the family is complete. */
  next: BadgeDef | null
  /** What the grid tile draws: the one won, else the one being worked toward. */
  display: BadgeDef
  /** 0 to 1 toward `next`; 1 when the family is complete. */
  progress: number
}

/**
 * The badges grouped the way the grid shows them — one tile per family,
 * carrying the highest tier won and how far along the next one is.
 *
 * Grouped here rather than in the component so the grid, the detail sheet
 * and anything later all read the same ladder.
 */
export function badgeFamilies(ctx: BadgeContext): FamilyState[] {
  const order: BadgeFamily[] = ['sessions', 'streak', 'hours', 'session_length', 'early', 'night', 'weekend', 'recordings', 'repertoire', 'level']
  const out: FamilyState[] = []

  for (const family of order) {
    const tiers = BADGES.filter((b) => b.family === family).sort((a, b) => a.tier - b.tier)
    if (tiers.length === 0) continue
    const won = tiers.filter((b) => isEarned(b, ctx))
    const highest = won.length ? won[won.length - 1] : null
    const next = tiers.find((b) => !isEarned(b, ctx)) ?? null
    out.push({
      family,
      label: FAMILY_LABEL[family],
      tiers,
      highest,
      next,
      display: highest ?? tiers[0],
      progress: next ? badgeProgress(next, ctx) : 1,
    })
  }
  return out
}

export function earnedBadges(ctx: BadgeContext): BadgeDef[] {
  return BADGES.filter((b) => isEarned(b, ctx))
}
