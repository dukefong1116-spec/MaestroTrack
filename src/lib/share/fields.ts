import { format, parseISO } from 'date-fns'
import type { PracticeSession, UserProfile } from '@/types'

/**
 * What is allowed to leave the device.
 *
 * A share card is public, and the things it could accidentally carry are
 * the most private things in the app: a session's notes are where someone
 * writes "this is awful and I hate it", and a profile carries the studio
 * code that lets a stranger join a teacher's studio.
 *
 * So the card renderer never sees a session or a profile. It takes this
 * and only this, which means a leak would have to be added to the type
 * first — a compile error rather than something to spot in review. The
 * same discipline that keeps notes out of practiceSummary.
 */
export interface ShareFields {
  minutes: number
  /** 'Sunday, 18 October' — already formatted, no date left to misread. */
  dateLabel: string
  /** Omitted entirely when sharing anonymously. */
  name?: string
  streakDays?: number
  pieceTitle?: string
  category?: string
  /** Minutes per day, Monday first, for the week strip. */
  week?: number[]
}

export interface ShareOptions {
  includeName: boolean
  includeStreak: boolean
  includePiece: boolean
}

export const DEFAULT_SHARE_OPTIONS: ShareOptions = {
  includeName: true,
  includeStreak: true,
  // Off by default. A piece title says more about someone than minutes do
  // — what they are working on, and how far along they are — so it is
  // offered rather than assumed.
  includePiece: false,
}

export function buildShareFields(input: {
  session: PracticeSession
  profile: Pick<UserProfile, 'displayName'>
  streakDays: number
  pieceTitle?: string
  week?: number[]
  options: ShareOptions
}): ShareFields {
  const { session, profile, streakDays, pieceTitle, week, options } = input

  const fields: ShareFields = {
    minutes: Math.max(0, Math.round(session.durationMinutes)),
    dateLabel: safeDate(session.date),
    week,
  }

  if (options.includeName && profile.displayName) fields.name = profile.displayName
  if (options.includeStreak && streakDays > 0) fields.streakDays = streakDays
  if (options.includePiece && pieceTitle) fields.pieceTitle = pieceTitle
  if (options.includePiece && session.category) fields.category = session.category

  return fields
}

/** parseISO, never new Date(string): the latter reads a date as UTC midnight. */
function safeDate(date: string): string {
  try {
    return format(parseISO(date), 'EEEE, d MMMM')
  } catch {
    return ''
  }
}

/** "1 minutes" on something somebody posts publicly is not a small thing. */
export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function buildShareText(f: ShareFields): string {
  const bits = [`${plural(f.minutes, 'minute')} of practice`]
  if (f.pieceTitle) bits.push(`on ${f.pieceTitle}`)
  if (f.streakDays) bits.push(`· ${f.streakDays}-day streak`)
  return `${bits.join(' ')} — tracked with MaestroTrack`
}
