/**
 * The practice streak, worked out from the log.
 *
 * Shared by the app and the league server, so: plain JavaScript, no
 * imports, and days as 'yyyy-MM-dd' strings in the person's own time zone.
 * The caller says which day is today.
 *
 * What counts:
 *  - A day is done once its sessions add up to the daily minimum in force
 *    that day (none set: any session at all).
 *  - Your lesson day, missed, holds the streak. It does not add a day.
 *  - A frozen day holds the streak too. Freezes are earned, one for every
 *    7 days in a row, and you hold at most 2.
 *  - A comeback: one missed day with nothing to cover it, then the next
 *    two days practised, brings the old streak back — once a month.
 *    The missed day is then recorded as repaired and holds like a freeze.
 *
 * Rules change only from tomorrow (the app writes them that way), and each
 * day is judged by the rule that was in force on it, so changing your
 * minimum or lesson day never rewrites days already lived.
 *
 * Only the choices the app made on days with no practice are stored:
 * frozen days and repaired days. Everything else here is derived, so it
 * cannot drift from the log.
 */

export const MAX_FREEZES = 2
export const DAYS_PER_FREEZE = 7
/** A comeback is for a streak worth bringing back. */
export const COMEBACK_MIN_STREAK = 3
export const COMEBACK_DAYS = 2

const DAY_MS = 86_400_000
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const noon = (day) => Date.parse(`${day}T12:00:00Z`)

export function addDays(day, n) {
  return new Date(noon(day) + n * DAY_MS).toISOString().slice(0, 10)
}

/** Monday = 0 … Sunday = 6. */
export function dowOf(day) {
  return (new Date(noon(day)).getUTCDay() + 6) % 7
}

const NO_RULE = Object.freeze({ from: '0000-00-00', min: 0, lessonDay: null })

function cleanMin(v) {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.max(0, Math.min(240, n)) : 0
}

function cleanDow(v) {
  return Number.isInteger(v) && v >= 0 && v <= 6 ? v : null
}

/** Valid entries only, oldest first. Safe on anything a profile holds. */
export function cleanRules(rules) {
  if (!Array.isArray(rules)) return []
  return rules
    .filter((r) => r && typeof r.from === 'string' && DAY_RE.test(r.from))
    .map((r) => ({ from: r.from, min: cleanMin(r.min), lessonDay: cleanDow(r.lessonDay) }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0))
}

/** The rule in force on `day`, from cleaned rules. */
export function ruleOn(rules, day) {
  let r = NO_RULE
  for (const x of rules) {
    if (x.from <= day) r = x
    else break
  }
  return r
}

/**
 * Walks every day from the first session to today.
 *
 * Statuses: 'done', 'lesson', 'frozen', 'repaired', 'missed', and 'today'
 * for today while it is not yet done (today never breaks a streak — it is
 * not over).
 */
export function walkStreak({ sessions = [], rules = [], frozen = [], repaired = [], today }) {
  const totals = new Map()
  for (const s of sessions) {
    const day = String(s?.date ?? '').slice(0, 10)
    if (!DAY_RE.test(day) || day > today) continue
    const t = totals.get(day) ?? { minutes: 0, count: 0 }
    t.minutes += Number(s.durationMinutes) || 0
    t.count += 1
    totals.set(day, t)
  }

  const plan = cleanRules(rules)
  const frozenSet = new Set(frozen ?? [])
  const repairedSet = new Set(repaired ?? [])
  const todayRule = ruleOn(plan, today)

  const out = {
    current: 0,
    longest: 0,
    held: 0,
    nextFreezeIn: DAYS_PER_FREEZE,
    todayLit: false,
    todayMinutes: totals.get(today)?.minutes ?? 0,
    todayRule: { min: todayRule.min, lessonDay: todayRule.lessonDay },
    flameFrozen: false,
    comeback: null,
    days: [],
  }

  let first = null
  for (const day of totals.keys()) if (first === null || day < first) first = day
  if (first === null) return out

  let streak = 0
  let longest = 0
  let held = 0
  let lastMissed = null
  let lastBreak = null

  for (let d = first; d <= today; d = addDays(d, 1)) {
    const t = totals.get(d)
    const rule = ruleOn(plan, d)
    let status
    if (t && t.minutes >= rule.min) {
      streak++
      if (streak > longest) longest = streak
      if (streak % DAYS_PER_FREEZE === 0 && held < MAX_FREEZES) held++
      status = 'done'
    } else if (d === today) {
      status = 'today'
    } else if (rule.lessonDay === dowOf(d)) {
      status = 'lesson'
    } else if (streak > 0 && repairedSet.has(d)) {
      status = 'repaired'
    } else if (streak > 0 && frozenSet.has(d)) {
      // Honoured even with none held — a freeze spent under the old rules
      // was a promise kept, and taking it back now would break a streak.
      status = 'frozen'
      held = Math.max(0, held - 1)
    } else {
      status = 'missed'
      lastMissed = d
      if (streak > 0) lastBreak = { date: d, before: streak }
      streak = 0
    }
    out.days.push({ date: d, status, minutes: t?.minutes ?? 0, streak, held })
  }

  out.current = streak
  out.longest = longest
  out.held = held
  out.nextFreezeIn = held >= MAX_FREEZES ? null : DAYS_PER_FREEZE - (streak % DAYS_PER_FREEZE)
  out.todayLit = out.days[out.days.length - 1].status === 'done'

  // The flame wears ice from a frozen day until it is practised again;
  // a lesson day in between does not thaw it.
  if (!out.todayLit) {
    for (let i = out.days.length - 2; i >= 0; i--) {
      const s = out.days[i].status
      if (s === 'lesson') continue
      out.flameFrozen = s === 'frozen'
      break
    }
  }

  // A comeback: the most recent missed day ended a real streak, nothing
  // has been missed since, and none was used this month. It lives only
  // in the two practice days right after the miss (lesson days skipped)
  // and the morning after them — never for an old gap.
  if (lastBreak && lastBreak.date === lastMissed && lastBreak.before >= COMEBACK_MIN_STREAK) {
    const month = lastBreak.date.slice(0, 7)
    const used = [...repairedSet].some((r) => String(r).slice(0, 7) === month)
    const window = []
    for (let d = addDays(lastBreak.date, 1); window.length < COMEBACK_DAYS && window.length < 7; d = addDays(d, 1)) {
      if (ruleOn(plan, d).lessonDay !== dowOf(d)) window.push(d)
    }
    if (!used && today <= addDays(window[window.length - 1], 1)) {
      const done = out.days.filter((x) => window.includes(x.date) && x.status === 'done').length
      out.comeback = {
        missed: lastBreak.date,
        restore: lastBreak.before,
        done,
        complete: done >= COMEBACK_DAYS,
      }
    }
  }

  return out
}

/**
 * The days a freeze should cover now, if any: the run of missed days
 * ending yesterday (lesson days skipped over), when a streak stood before
 * it and enough freezes were held to cover all of it. Empty otherwise.
 */
export function freezesToSpend(walk) {
  const days = walk.days
  const gap = []
  let i = days.length - 2
  for (; i >= 0; i--) {
    const s = days[i].status
    if (s === 'lesson') continue
    if (s === 'missed') { gap.push(days[i].date); continue }
    break
  }
  if (gap.length === 0 || gap.length > MAX_FREEZES || i < 0) return []
  const before = days[i]
  if (!(before.streak > 0) || before.held < gap.length) return []
  return gap.reverse()
}

/**
 * Days that hold the league's own streak, for the league server: lesson
 * days, frozen days and repaired days between `from` and `to`.
 *
 * The profile fields behind these are the owner's to write, so each kind
 * is capped at what playing fair could ever produce: one lesson day a
 * week, two frozen days in any seven, one repaired day a month.
 */
export function holdDays({ rules = [], frozen = [], repaired = [], from, to }) {
  const plan = cleanRules(rules)
  const out = new Set()

  const lessonWeeks = new Set()
  for (let d = from; d <= to; d = addDays(d, 1)) {
    if (ruleOn(plan, d).lessonDay !== dowOf(d)) continue
    const week = addDays(d, -dowOf(d))
    if (lessonWeeks.has(week)) continue
    lessonWeeks.add(week)
    out.add(d)
  }

  const inRange = (list) => [...new Set(Array.isArray(list) ? list : [])]
    .filter((d) => typeof d === 'string' && DAY_RE.test(d) && d >= addDays(from, -6) && d <= to)
    .sort()

  const accepted = []
  for (const d of inRange(frozen)) {
    const recent = accepted.filter((a) => a > addDays(d, -7)).length
    if (recent >= MAX_FREEZES) continue
    accepted.push(d)
    if (d >= from) out.add(d)
  }

  const months = new Set()
  for (const d of inRange(repaired)) {
    const m = d.slice(0, 7)
    if (months.has(m)) continue
    months.add(m)
    if (d >= from) out.add(d)
  }

  return out
}
