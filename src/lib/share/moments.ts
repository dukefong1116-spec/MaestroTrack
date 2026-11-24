import type { ShareRequest } from '@/stores/shareStore'
import type { ShareOptions } from './fields'

/**
 * The share requests for each moment, in one place, so every entry point
 * (a celebration, the week's chart, a badge) builds its card the same way
 * and under the same rule: the name only when "My name" is on, the streak
 * only when "Streak" is on, a piece only when "Piece" is on.
 */

const named = (o: ShareOptions, name?: string) => (o.includeName && name ? { name } : {})
const today = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

/** Streak days worth a "share it" at the moment they are reached. */
export function isStreakMilestone(days: number): boolean {
  return [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365].includes(days) || (days > 365 && days % 100 === 0)
}

export function streakShare(days: number, minutesToday: number, name?: string): ShareRequest {
  return {
    kind: 'streak',
    title: 'Share your streak',
    toggles: { name: true },
    mood: 'celebrate',
    build: (o) => ({ minutes: Math.max(0, Math.round(minutesToday)), dateLabel: today(), streakDays: days, ...named(o, name) }),
  }
}

export function badgeShare(badge: { id: string; label: string; description?: string }, wonAt?: string, name?: string): ShareRequest {
  return {
    kind: 'badge',
    title: 'Share your badge',
    toggles: { name: true },
    badgeId: badge.id,
    build: (o) => ({
      minutes: 0,
      dateLabel: wonAt ? new Date(wonAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '',
      badgeId: badge.id,
      badgeLabel: badge.label,
      ...(badge.description ? { subline: badge.description.slice(0, 120) } : {}),
      ...named(o, name),
    }),
  }
}

export function leagueShare(headline: string, subline: string, name?: string, streakDays?: number): ShareRequest {
  return {
    kind: 'league',
    title: 'Share your league result',
    toggles: { name: true, streak: !!streakDays },
    mood: 'proud',
    build: (o) => ({
      minutes: 0, dateLabel: today(), headline, subline,
      ...(o.includeStreak && streakDays ? { streakDays } : {}),
      ...named(o, name),
    }),
  }
}

export function weekShare(week: number[], label: string, name?: string, streakDays?: number): ShareRequest {
  const total = Math.round(week.reduce((a, m) => a + m, 0))
  return {
    kind: 'week',
    title: 'Share your week',
    toggles: { name: true, streak: !!streakDays },
    mood: 'proud',
    build: (o) => ({
      minutes: total, dateLabel: label, week: week.map((m) => Math.round(m)),
      ...(o.includeStreak && streakDays ? { streakDays } : {}),
      ...named(o, name),
    }),
  }
}

export function pieceShare(title: string, how: 'learned' | 'performed', name?: string, line?: string): ShareRequest {
  return {
    kind: 'piece',
    title: how === 'learned' ? 'Share your new piece' : 'Share your performance',
    toggles: { name: true },
    mood: 'proud',
    build: (o) => ({
      minutes: 0, dateLabel: today(), pieceTitle: title.slice(0, 120),
      headline: how === 'learned' ? 'Piece learned' : 'Performed',
      ...(line ? { subline: line.slice(0, 120) } : {}),
      ...named(o, name),
    }),
  }
}

export function recapShare(r: { month: string; minutes: number; style: string; styleLine: string; bestStreak: number; topPiece?: string }, name?: string): ShareRequest {
  return {
    kind: 'recap',
    title: `Share your ${r.month}`,
    toggles: { name: true, streak: r.bestStreak > 0, piece: !!r.topPiece },
    mood: 'cool',
    build: (o) => ({
      minutes: Math.round(r.minutes), dateLabel: r.month, headline: r.style, subline: r.styleLine,
      ...(o.includeStreak && r.bestStreak ? { streakDays: r.bestStreak } : {}),
      ...(o.includePiece && r.topPiece ? { pieceTitle: r.topPiece.slice(0, 120) } : {}),
      ...named(o, name),
    }),
  }
}
