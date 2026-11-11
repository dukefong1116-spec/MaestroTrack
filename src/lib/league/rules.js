/**
 * Weekly leagues — every rule, in one place.
 *
 * Shared by the app (zones, countdowns, the streak line) and by the server
 * (api/league/*), which is the only thing that ever writes league data. One
 * copy means the green zone a student sees is exactly the one the server
 * will promote from.
 *
 * Plain JavaScript with types beside it (rules.d.ts), and no imports at
 * all: Vercel's functions load this file as it is, with no build step in
 * between, and nothing here can pull the rest of the app in after it.
 *
 * Dates are calendar days as 'yyyy-MM-dd' strings — a session's own `date`
 * field, which is the student's local day. Day arithmetic is done at UTC
 * noon so a daylight-saving change can never move a date.
 */

export const TIERS = [
  { id: 'pp', name: 'Pianissimo' },
  { id: 'p', name: 'Piano' },
  { id: 'mp', name: 'Mezzo-piano' },
  { id: 'f', name: 'Forte' },
  { id: 'ff', name: 'Fortissimo' },
]
export const TOP_TIER = TIERS.length - 1

export const ROOM_MAX = 30
/** Timer minutes per day that count. Past this, practice earns nothing more. */
export const DAILY_CAP = 120
/** Timer minutes that make a day a practice day. */
export const DAY_MIN = 10
/** For each practice day. */
export const DAY_BONUS = 10
/** Extra, on each practice day that is day STREAK_DAYS or later of a streak. */
export const STREAK_BONUS = 20
export const STREAK_DAYS = 7
/**
 * Days before Monday read for a streak carried in. Longer than the streak
 * itself, because a lesson day or a freeze can sit inside it.
 */
export const STREAK_LOOKBACK = 13
/** Time zones are grouped into bands this many hours wide. */
export const BAND_HOURS = 3
/** How far a room may reach into neighbouring bands when its own has none open. */
export const MAX_BAND_REACH = 2
/** Top three in the top tier finish as Maestro. */
export const MAESTRO_PLACES = 3

const DAY_MS = 86_400_000

const noon = (day) => new Date(`${day}T12:00:00Z`)
const fmt = (d) => d.toISOString().slice(0, 10)

export function addDays(day, n) {
  const d = noon(day)
  d.setUTCDate(d.getUTCDate() + n)
  return fmt(d)
}

/** The calendar day at `nowMs` for someone `offsetMin` minutes east of UTC. */
export function localDay(nowMs, offsetMin) {
  return fmt(new Date(nowMs + offsetMin * 60_000))
}

export function mondayOf(day) {
  const dow = (noon(day).getUTCDay() + 6) % 7 // Monday = 0
  return addDays(day, -dow)
}

/** ISO-8601 week id, e.g. '2026-W46'. The week's Thursday decides its year. */
export function weekIdOf(day) {
  const monday = mondayOf(day)
  const year = noon(addDays(monday, 3)).getUTCFullYear()
  const firstMonday = mondayOf(`${year}-01-04`)
  const week = 1 + Math.round((noon(monday) - noon(firstMonday)) / (7 * DAY_MS))
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** The league week someone is in right now. */
export function weekOf(nowMs, offsetMin) {
  const today = localDay(nowMs, offsetMin)
  const start = mondayOf(today)
  return { id: weekIdOf(today), start, end: addDays(start, 6), today }
}

/** −4 … +5: UTC−12 lands in −4, UTC+14 in +5. */
export function bandFor(offsetMin) {
  return Math.round(offsetMin / (BAND_HOURS * 60))
}

/** The instant a room's week ends: the next Monday 00:00 in its band. */
export function weekEndsAt(weekStart, band) {
  return Date.parse(`${addDays(weekStart, 7)}T00:00:00Z`) - band * BAND_HOURS * 3_600_000
}

/**
 * Weekly XP from timer minutes.
 *
 * `sessions` are `{ date, minutes }` with minutes already credited — the
 * server decides how many minutes of each session are real (tickets,
 * timer readings) before this sees them. Sessions from up to
 * STREAK_LOOKBACK days before Monday may be included: they count for
 * nothing themselves, but a streak that started last week carries in.
 *
 * `holds` are days that keep the streak without practice — lesson days,
 * frozen days, comeback days (see holdDays in lib/streak/engine).
 *
 * Returns the week's total and a line per day, Monday first.
 */
export function weekXp(sessions, weekStart, holds) {
  const held = holds instanceof Set ? holds : new Set(holds ?? [])
  const byDay = new Map()
  for (const s of sessions) {
    if (!(s.minutes > 0)) continue
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.minutes)
  }
  const end = addDays(weekStart, 6)
  const days = []
  let xp = 0
  let streak = 0
  for (let d = addDays(weekStart, -STREAK_LOOKBACK); d <= end; d = addDays(d, 1)) {
    const minutes = byDay.get(d) ?? 0
    const practised = minutes >= DAY_MIN
    // A lesson day, frozen day or comeback day holds the streak: it
    // neither breaks it nor adds to it.
    streak = practised ? streak + 1 : held.has(d) ? streak : 0
    if (d < weekStart) continue
    const bonus = practised ? DAY_BONUS + (streak >= STREAK_DAYS ? STREAK_BONUS : 0) : 0
    const dayXp = Math.min(minutes, DAILY_CAP) + bonus
    days.push({ date: d, minutes, counted: Math.min(minutes, DAILY_CAP), bonus, streak, xp: dayXp })
    xp += dayXp
  }
  return { xp, days }
}

/**
 * The streak as it stands on `today`, from weekXp's day lines. A streak is
 * still alive on a day not yet practised: it only breaks once that day is
 * over. Never more than the lines can see — at most a week plus six days.
 */
export function streakOn(days, today) {
  const at = (day) => days.find((d) => d.date === day)
  const t = at(today)
  if (t && t.streak > 0) return t.streak
  return at(addDays(today, -1))?.streak ?? 0
}

/** Highest XP first; on a tie, whoever got there first. */
export function rankMembers(members) {
  return [...members].sort((a, b) =>
    b.xp - a.xp
    || String(a.xpAt ?? '').localeCompare(String(b.xpAt ?? ''))
    || String(a.uid).localeCompare(String(b.uid)))
}

/** How many move up and down at the end of a week, by room size. */
export function moveCounts(n) {
  if (n <= 0) return { up: 0, down: 0 }
  if (n <= 4) return { up: 1, down: 0 }
  if (n <= 9) return { up: 2, down: 1 }
  return { up: Math.round(n * 0.2), down: Math.round(n * 0.15) }
}

/**
 * Which zone a place falls in right now, for a room of `n` in `tier`.
 * Index is 0-based. Nobody moves up from the top tier or down from the
 * bottom one, and nobody moves up on zero XP.
 */
export function zoneOf(index, n, tier, xp = 1) {
  const { up, down } = moveCounts(n)
  if (index < up && tier < TOP_TIER && xp > 0) return 'up'
  if (index >= n - down && tier > 0) return 'down'
  return null
}

/** The end of a week, for every member: rank, where they go, Maestro. */
export function finalResults(members, tier) {
  const ranked = rankMembers(members)
  const n = ranked.length
  return ranked.map((m, i) => {
    const zone = zoneOf(i, n, tier, m.xp)
    const move = zone === 'up' ? 1 : zone === 'down' ? -1 : 0
    return {
      uid: m.uid,
      xp: m.xp,
      rank: i + 1,
      of: n,
      fromTier: tier,
      toTier: tier + move,
      maestro: tier === TOP_TIER && i < MAESTRO_PLACES && m.xp > 0,
    }
  })
}

/** What other players see: 'Sam Oyelaran' → 'Sam O.'. */
export function publicName(displayName) {
  const parts = String(displayName ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'Musician'
  const first = parts[0].slice(0, 20)
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first
}

/** A stable avatar colour per player, 0–5. */
export function colourFor(uid) {
  let h = 0
  for (const c of String(uid)) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 6
}
