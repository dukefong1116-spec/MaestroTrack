import type { PracticeSession } from '@/types'
import type { StickerName } from '@/components/stickers/Sticker'
import { computeStreak } from './analytics'

/**
 * XP and levels — entirely derived from the session log, so there is
 * nothing to store, nothing to migrate and nothing that can drift out of
 * sync with reality.
 */

const XP_PER_SESSION = 25
const XP_DAILY_GOAL_BONUS = 50
const XP_PER_MILESTONE = 100
const MILESTONES = [7, 14, 30, 50, 100, 200, 365]

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
  const minutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0)

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

  const totalXp =
    minutes +
    sessions.length * XP_PER_SESSION +
    goalDays * XP_DAILY_GOAL_BONUS +
    milestonesHit * XP_PER_MILESTONE

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

/* ── Badges ──────────────────────────────────────────────────────────
 * Single source of truth, shared by the Progress page and the unlock
 * moment so the two can never describe a badge differently.
 */

export interface BadgeDef {
  id: string
  label: string
  description: string
  icon: StickerName
  earned: (ctx: BadgeContext) => boolean
}

export interface BadgeContext {
  sessionCount: number
  currentStreak: number
  longestStreak: number
  longestSessionMinutes: number
  totalMinutes: number
  level: number
}

export const BADGES: BadgeDef[] = [
  { id: 'first_session', label: 'First Note', description: 'Logged your first practice session', icon: 'note', earned: (c) => c.sessionCount >= 1 },
  { id: 'week_warrior', label: 'Week Warrior', description: 'Practised every day for a week', icon: 'sword', earned: (c) => c.longestStreak >= 7 },
  { id: 'century', label: 'Century Club', description: 'Logged 100 practice sessions', icon: 'trophy', earned: (c) => c.sessionCount >= 100 },
  { id: 'marathon', label: 'Marathon', description: 'Practised 60+ minutes in one session', icon: 'footprints', earned: (c) => c.longestSessionMinutes >= 60 },
  { id: 'consistency', label: 'Iron Discipline', description: 'Reached a 30-day streak', icon: 'target', earned: (c) => c.longestStreak >= 30 },
  { id: 'ten_hours', label: '10 Hours Strong', description: 'Accumulated 600 minutes of practice', icon: 'clock', earned: (c) => c.totalMinutes >= 600 },
]

export function buildBadgeContext(
  sessions: PracticeSession[],
  frozen: string[] = []
): BadgeContext {
  const { current, longest } = computeStreak(sessions, frozen)
  const totalMinutes = sessions.reduce((s, p) => s + p.durationMinutes, 0)
  return {
    sessionCount: sessions.length,
    currentStreak: current,
    longestStreak: longest,
    longestSessionMinutes: sessions.reduce((m, s) => Math.max(m, s.durationMinutes), 0),
    totalMinutes,
    level: 1,
  }
}

export function earnedBadges(ctx: BadgeContext): BadgeDef[] {
  return BADGES.filter((b) => b.earned(ctx))
}
