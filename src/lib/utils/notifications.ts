import { addDays, getDay, parseISO, set, startOfDay, differenceInCalendarDays } from 'date-fns'
import type { Assignment, LeagueResult, LeagueRoom, LessonSlot, Message, NotifyKind, StudioRequest, UserProfile } from '@/types'
import { moveCounts, rankMembers, zoneOf, TIERS } from '@/lib/league/rules'
import type { StickerName } from '@/components/stickers/Sticker'

/**
 * Notifications, derived rather than stored.
 *
 * Nothing writes a notification. Every one of them is already implied by
 * data the app subscribes to — an assignment that exists, a feedback entry
 * that was appended, a lesson whose weekly slot comes round again — so
 * they are recomputed from that data instead of being fanned out into a
 * collection of their own. No new documents, no new queries, and nothing
 * for the security rules to govern.
 *
 * The only thing worth persisting is whether they have been seen, and
 * that is one timestamp on the profile: everything older has been read.
 */

export type NotificationKind =
  | 'assignment-new'
  | 'assignment-returned'
  | 'assignment-approved'
  | 'lesson-tomorrow'
  | 'lesson-soon'
  | 'submission-received'
  | 'join-request'
  | 'message-new'
  | 'league-passed'
  | 'league-last-day'
  | 'league-results'
  | 'studio-joined'

export interface AppNotification {
  /** Deterministic, so "seen" survives a reload without storing anything. */
  id: string
  kind: NotificationKind
  title: string
  body?: string
  /** When this became true. Compared against the read watermark. */
  at: string
  /** Where clicking it should go. */
  to: string
  priority: number
  sticker: StickerName
}

/** Which NotificationKinds each Settings category switches off. */
export const KINDS_BY_CATEGORY: Record<NotifyKind, readonly NotificationKind[]> = {
  assignments: ['assignment-new'],
  feedback: ['assignment-returned', 'assignment-approved'],
  lessons: ['lesson-tomorrow', 'lesson-soon'],
  submissions: ['submission-received'],
  league: ['league-passed', 'league-last-day', 'league-results'],
  // 'message-new' is absent too: a message is a person talking to you.
  // So is 'studio-joined': it happens once, and it is the answer to
  // something you asked for.
  // 'join-request' is deliberately absent, and so stays on whatever the
  // Settings switches say. Somebody is standing at the door: a request
  // nobody is told about is a student who thinks they were ignored. It
  // is also rare — a handful a year for most studios. applyNotifyPrefs
  // only drops kinds that appear here, so leaving it out is the switch
  // being absent rather than a switch that does nothing.
  // Not a bell notification at all — the prompts on Today. Listed so the
  // categories are one set, and skipped by the filter below.
  nudges: [],
}

/** Drops the kinds whose category has been switched off in Settings. */
export function applyNotifyPrefs(
  items: AppNotification[],
  notify: Partial<Record<NotifyKind, boolean>>
): AppNotification[] {
  const off = new Set<NotificationKind>()
  for (const [category, kinds] of Object.entries(KINDS_BY_CATEGORY) as [NotifyKind, readonly NotificationKind[]][]) {
    if (notify[category] === false) for (const k of kinds) off.add(k)
  }
  return off.size ? items.filter((n) => !off.has(n.kind)) : items
}

/**
 * Where a notification about one assignment should land you.
 *
 * Every notification used to say `/student`, which is clickable but not
 * useful: being told your scales came back for another go and then being
 * put on Today leaves you to find the thing yourself. The Library already
 * keeps its tab in the URL, so the assignment rides along beside it and
 * the panel opens that one.
 *
 * Lessons are the exception and still point at `/student` — the next
 * lesson is shown on Today, so that is already where the answer is.
 */
function assignmentHref(assignmentId: string): string {
  return `/student/studio/assignments?open=${encodeURIComponent(assignmentId)}`
}

export interface BuildOptions {
  now: Date
  /** Ignore anything older than this. Unbounded history is unbounded work. */
  sinceDays?: number
  /** A list nobody will scroll is a list nobody will read. */
  cap?: number
}

const DEFAULTS = { sinceDays: 30, cap: 40 }

/**
 * When does this weekly slot next come round?
 *
 * LessonSlot is a recurring weekday and time, not a dated appointment, so
 * there is no timestamp to compare against — it has to be built. Done with
 * date-fns `addDays` rather than arithmetic on milliseconds, because a
 * week containing a daylight-saving change is not 7 × 86,400,000 ms and
 * this app has shipped that bug more than once.
 */
export function nextOccurrence(slot: LessonSlot, now: Date): Date {
  const [h, m] = slot.startTime.split(':').map((n) => parseInt(n, 10))
  const daysAhead = (slot.dayOfWeek - getDay(now) + 7) % 7
  let when = set(addDays(startOfDay(now), daysAhead), {
    hours: Number.isFinite(h) ? h : 0,
    minutes: Number.isFinite(m) ? m : 0,
    seconds: 0,
    milliseconds: 0,
  })
  // Today, but already gone: the next one is next week.
  if (when.getTime() <= now.getTime()) when = addDays(when, 7)
  return when
}

/** 'yyyy-MM-dd' without going through UTC, which shifts the day west of Greenwich. */
function dayKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function withinHorizon(iso: string, now: Date, sinceDays: number): boolean {
  try {
    return differenceInCalendarDays(now, parseISO(iso)) <= sinceDays
  } catch {
    return false
  }
}

/**
 * Newest first, and the cap keeps the newest.
 *
 * Priority used to lead, which sorted the list by how important each kind
 * of thing is in general rather than by what has just happened. A lesson
 * reminder from this morning outranked a teacher's feedback from a minute
 * ago, so the one new thing someone opened the panel to see sat below
 * something they had already read. Priority still decides ties, which is
 * where it belongs: of two things that happened at the same moment, the
 * more urgent goes first.
 *
 * The sort runs before the cap, so a long list keeps the most recent
 * rather than the most important.
 */
function finish(out: AppNotification[], cap: number): AppNotification[] {
  return out
    .sort((a, b) => b.at.localeCompare(a.at) || (b.priority - a.priority))
    .slice(0, cap)
}

/* ── the student's side ───────────────────────────────────────────── */

/** What a message says in a notification: its words, or what it shared. */
function messagePreview(m: Message): string {
  if (m.text) return m.text.length > 90 ? `${m.text.slice(0, 89)}…` : m.text
  return m.attachment?.kind === 'recording' ? 'Shared a recording' : 'Shared an assignment'
}

export function buildStudentNotifications(input: {
  assignments: Assignment[]
  lessons: LessonSlot[]
  /** From the current teacher, not yet read in the conversation. */
  messages?: Message[]
  teacherName?: string
  /** The weekly league: your open room, and last week's result if unseen. */
  league?: { uid: string; room: LeagueRoom | null; result?: LeagueResult; seenWeek?: string }
  /** The teacher accepted your request to join: when, and into what. */
  joined?: { teacherId: string; at: string; studioName?: string }
  options: BuildOptions
}): AppNotification[] {
  const { assignments, lessons, messages = [], teacherName, joined } = input
  const leagueItems = input.league ? leagueNotifications(input.league, input.options.now) : []
  const { now, sinceDays = DEFAULTS.sinceDays, cap = DEFAULTS.cap } = input.options
  const out: AppNotification[] = []

  if (joined && withinHorizon(joined.at, now, sinceDays)) {
    out.push({
      id: `studio:joined:${joined.teacherId}`,
      kind: 'studio-joined',
      title: joined.studioName ? `You've joined ${joined.studioName}` : "You've joined the studio",
      body: teacherName ? `${teacherName} accepted your request.` : 'Your teacher accepted your request.',
      at: joined.at,
      to: '/student/studio',
      priority: 90,
      sticker: 'users',
    })
  }

  for (const a of assignments) {
    if (withinHorizon(a.createdAt, now, sinceDays)) {
      out.push({
        id: `assignment:${a.id}:new`,
        kind: 'assignment-new',
        title: 'New assignment',
        body: a.title,
        at: a.createdAt,
        to: assignmentHref(a.id),
        priority: 60,
        sticker: 'book',
      })
    }

    // One per entry rather than one per assignment: a second round of
    // feedback is a second thing to be told about, and keying the id on
    // the entry's own timestamp means marking the first read does not
    // swallow the second.
    for (const f of a.feedback ?? []) {
      if (!withinHorizon(f.at, now, sinceDays)) continue
      const approved = f.verdict === 'approved'
      out.push({
        id: `assignment:${a.id}:fb:${f.at}`,
        kind: approved ? 'assignment-approved' : 'assignment-returned',
        title: approved ? 'Work approved' : 'Sent back for another go',
        body: f.note ? `${a.title} — ${f.note}` : a.title,
        at: f.at,
        to: assignmentHref(a.id),
        priority: approved ? 70 : 85,
        sticker: approved ? 'trophy' : 'note',
      })
    }
  }

  for (const slot of lessons) {
    const when = nextOccurrence(slot, now)
    const minutesAway = (when.getTime() - now.getTime()) / 60_000
    const key = dayKey(when)

    // Each window gets its own id, keyed to the occurrence, so next week's
    // lesson is a new notification rather than a repeat of this week's.
    if (minutesAway <= 60) {
      out.push({
        id: `lesson:${slot.id}:${key}:1h`,
        kind: 'lesson-soon',
        title: 'Lesson within the hour',
        body: `${slot.startTime} — ${Math.max(1, Math.round(minutesAway))} min away`,
        at: new Date(when.getTime() - 60 * 60_000).toISOString(),
        to: '/student',
        priority: 95,
        sticker: 'calendar',
      })
    } else if (minutesAway <= 24 * 60) {
      out.push({
        id: `lesson:${slot.id}:${key}:24h`,
        kind: 'lesson-tomorrow',
        title: 'Lesson tomorrow',
        body: `${slot.startTime}`,
        at: new Date(when.getTime() - 24 * 60 * 60_000).toISOString(),
        to: '/student',
        priority: 65,
        sticker: 'calendar',
      })
    }
  }

  for (const m of messages) {
    if (!withinHorizon(m.createdAt, now, sinceDays)) continue
    out.push({
      id: `message:${m.id}`,
      kind: 'message-new',
      title: `${teacherName || 'Your teacher'} sent a message`,
      body: messagePreview(m),
      at: m.createdAt,
      to: '/student/studio/messages',
      priority: 80,
      sticker: 'message',
    })
  }

  out.push(...leagueItems)
  return finish(out, cap)
}

/* ── the teacher's side ───────────────────────────────────────────── */

export function buildTeacherNotifications(input: {
  assignments: Assignment[]
  students: UserProfile[]
  requests?: StudioRequest[]
  /** From students, not yet read in each conversation. */
  messages?: Message[]
  options: BuildOptions
}): AppNotification[] {
  const { assignments, students, requests = [], messages = [] } = input
  const { now, sinceDays = DEFAULTS.sinceDays, cap = DEFAULTS.cap } = input.options
  const nameOf = new Map(students.map((s) => [s.uid, s.displayName]))
  const out: AppNotification[] = []

  for (const a of assignments) {
    for (const s of a.submissions ?? []) {
      if (!withinHorizon(s.at, now, sinceDays)) continue
      // Already reviewed: a teacher does not need telling about work they
      // have answered. Feedback later than the submission settles it.
      const answered = (a.feedback ?? []).some((f) => f.at > s.at)
      if (answered) continue
      out.push({
        id: `submission:${a.id}:${s.at}`,
        kind: 'submission-received',
        title: `${nameOf.get(a.studentId) ?? 'A student'} handed work in`,
        body: a.title,
        at: s.at,
        to: `/teacher/students/${a.studentId}?review=${a.id}`,
        priority: 90,
        sticker: 'book',
      })
    }
  }

  // Above the handed-in work: somebody waiting to be let in is blocked
  // on the teacher entirely, where a submission is only waiting to be read.
  for (const r of requests) {
    if (r.status !== 'pending') continue
    out.push({
      id: `join:${r.id}`,
      kind: 'join-request',
      title: `${r.studentName || 'Someone'} asked to join your studio`,
      body: 'Accept or decline on your students page.',
      at: r.createdAt,
      to: '/teacher/students',
      priority: 95,
      sticker: 'users',
    })
  }

  for (const m of messages) {
    if (!withinHorizon(m.createdAt, now, sinceDays)) continue
    out.push({
      id: `message:${m.id}`,
      kind: 'message-new',
      title: `${nameOf.get(m.studentId) ?? 'A student'} sent a message`,
      body: messagePreview(m),
      at: m.createdAt,
      to: `/teacher/students/${m.studentId}`,
      priority: 85,
      sticker: 'message',
    })
  }

  return finish(out, cap)
}

/* ── read state ───────────────────────────────────────────────────── */

export function isUnread(n: AppNotification, readAt?: string): boolean {
  if (!readAt) return true
  return n.at > readAt
}

export function unreadCount(all: AppNotification[], readAt?: string): number {
  return all.reduce((n, item) => n + (isUnread(item, readAt) ? 1 : 0), 0)
}

/**
 * The league's three bell items, all derived from the room you are
 * already listening to and your profile — nothing stored for them.
 *
 *   passed    someone overtook you. The server keeps only the latest on
 *             your entry, and the id is per day, so it is at most one a
 *             day, the newest winning.
 *   last day  the final 24 hours, when where you stand decides the week.
 *   results   last week's room has finished and you have not seen how.
 */
export function leagueNotifications(
  league: { uid: string; room: LeagueRoom | null; result?: LeagueResult; seenWeek?: string },
  now: Date,
): AppNotification[] {
  const out: AppNotification[] = []
  const { uid, room, result, seenWeek } = league
  const to = '/student/league'

  if (room && room.status === 'open' && room.members?.[uid]) {
    const me = room.members[uid]
    const tierName = TIERS[room.tier]?.name ?? 'your'
    if (me.passedBy && differenceInCalendarDays(now, parseISO(me.passedBy.at)) <= 1) {
      out.push({
        id: `league:passed:${room.id}:${me.passedBy.at.slice(0, 10)}`,
        kind: 'league-passed',
        title: `${me.passedBy.name} passed you`,
        body: `${tierName} league · time to take it back`,
        at: me.passedBy.at,
        to,
        priority: 55,
        sticker: 'trophy',
      })
    }
    const left = room.endsAt - now.getTime()
    if (left > 0 && left <= 24 * 3_600_000) {
      const list = rankMembers(Object.entries(room.members).map(([id, m]) => ({ uid: id, ...m })))
      const i = list.findIndex((m) => m.uid === uid)
      const n = list.length
      const zone = zoneOf(i, n, room.tier, me.xp)
      const { up } = moveCounts(n)
      const title = zone === 'up' ? "Last day: you're in the move-up zone"
        : zone === 'down' ? "Last day: you're in the drop zone"
          : i === up && room.tier < TIERS.length - 1 ? 'Last day: 1 place from moving up'
            : null
      if (title) {
        out.push({
          id: `league:lastday:${room.id}`,
          kind: 'league-last-day',
          title,
          body: zone === 'up' ? 'One more session keeps you there.' : 'One more session could change it.',
          at: new Date(room.endsAt - 24 * 3_600_000).toISOString(),
          to,
          priority: 65,
          sticker: 'trophy',
        })
      }
    }
  }

  if (result && result.week !== seenWeek && result.at) {
    out.push({
      id: `league:results:${result.week}`,
      kind: 'league-results',
      title: 'Your league results are in',
      body: `${TIERS[result.fromTier]?.name ?? ''} league, last week`,
      at: result.at,
      to,
      priority: 75,
      sticker: 'trophy',
    })
  }
  return out
}
