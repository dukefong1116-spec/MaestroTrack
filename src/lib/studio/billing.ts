import type { Invoice, InvoiceLine, LessonType, Payment, RosterStudent, StudioSettings } from '@/types'
import type { CalendarItem } from './calendar'
import { addDays, dayKey } from './dates'
import { lessonPriceCents } from './settings'

/**
 * Make-up credits, worked out from the calendar rather than counted up
 * and down — so marking a lesson cancelled and then changing your mind
 * can never leave a credit behind.
 *
 * Earned: a lesson this student did not have because you cancelled, or
 * they cancelled with notice — as far as your policy gives credit for
 * those. Used: a make-up booked for them. Plus any correction you made by
 * hand.
 */
export function creditsFor(
  rosterId: string,
  items: CalendarItem[],
  settings: StudioSettings,
  adjust = 0,
  today: string = dayKey(new Date()),
): number {
  const since = settings.policy.creditExpiryDays ? addDays(today, -settings.policy.creditExpiryDays) : '0000-00-00'
  let earned = 0
  let used = 0
  for (const i of items) {
    const mark = i.attendance[rosterId]
    if (i.date >= since && i.date <= today) {
      if (mark === 'teacher_cancel' && settings.policy.teacherCancelCredit) earned++
      if (mark === 'student_cancel' && settings.policy.noticeCredit) earned++
    }
    if (i.makeupFor === rosterId && !i.cancelled) used++
  }
  return Math.max(0, earned - used + adjust)
}

/** Lessons that are billed: attended, or missed without notice. */
const BILLED = new Set(['present', 'missed'])

function groupType(types: LessonType[]): LessonType | undefined {
  return types.find((t) => t.group)
}

export interface InvoiceDraft {
  lines: InvoiceLine[]
  totalCents: number
  /** Lessons in the month with no attendance recorded — not on the invoice. */
  unrecorded: number
}

/**
 * A family's invoice for one month, from the lessons that happened.
 * Each student's own price; group classes at the group lesson type's
 * price; a make-up shows as a free line, since its lesson was paid for
 * when it was first booked.
 */
export function draftInvoice(
  students: RosterStudent[],
  monthItems: CalendarItem[],
  settings: StudioSettings,
): InvoiceDraft {
  const lines: InvoiceLine[] = []
  let unrecorded = 0
  const group = groupType(settings.lessonTypes)
  for (const r of students) {
    const mine = monthItems.filter((i) => i.rosterIds.includes(r.id) && !i.cancelled)
    const first = r.name.split(' ')[0]
    const price = lessonPriceCents(r, settings)
    const privateBilled = mine.filter((i) => i.rosterIds.length === 1 && !i.makeupFor && BILLED.has(i.attendance[r.id]))
    const groupBilled = mine.filter((i) => i.rosterIds.length > 1 && BILLED.has(i.attendance[r.id]))
    const makeups = mine.filter((i) => i.makeupFor === r.id && i.attendance[r.id] === 'present')
    unrecorded += mine.filter((i) => !i.attendance[r.id] && i.date <= dayKey(new Date())).length
    if (privateBilled.length) {
      lines.push({ rosterId: r.id, text: `${first} · ${privateBilled.length} lesson${privateBilled.length === 1 ? '' : 's'} × $${(price / 100).toFixed(price % 100 ? 2 : 0)}`, amountCents: privateBilled.length * price })
    }
    if (groupBilled.length) {
      const gp = group?.priceCents ?? 0
      lines.push({ rosterId: r.id, text: `${first} · ${groupBilled.length} group class${groupBilled.length === 1 ? '' : 'es'} × $${(gp / 100).toFixed(gp % 100 ? 2 : 0)}`, amountCents: groupBilled.length * gp })
    }
    if (makeups.length) {
      lines.push({ rosterId: r.id, text: `${first} · ${makeups.length} make-up${makeups.length === 1 ? '' : 's'} (credit, no charge)`, amountCents: 0 })
    }
  }
  return { lines, totalCents: lines.reduce((a, l) => a + l.amountCents, 0), unrecorded }
}

export function paidCents(inv: Pick<Invoice, 'payments'>): number {
  return (inv.payments ?? []).reduce((a, p) => a + p.amountCents, 0)
}

export function balanceCents(inv: Pick<Invoice, 'payments' | 'totalCents' | 'status'>): number {
  return inv.status === 'void' ? 0 : Math.max(0, inv.totalCents - paidCents(inv))
}

export type FamilyStanding = 'paid' | 'unpaid' | 'overdue'

export function standing(invoices: Invoice[], today: string = dayKey(new Date())): FamilyStanding {
  const open = invoices.filter((i) => balanceCents(i) > 0)
  if (!open.length) return 'paid'
  return open.some((i) => i.dueOn < today) ? 'overdue' : 'unpaid'
}

/** Comma-separated, quoted where needed — opens in any spreadsheet. */
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) => r.map((c) => {
      const s = String(c)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join(','))
    .join('\n')
}

/* ── Monthly billing, one student at a time ───────────────────────────
 * Each student gets one invoice a month, made at the start of it from the
 * lessons on the calendar: that month's lessons at their price. Whatever
 * changed in the month before is settled on it too: a lesson charged but
 * then cancelled comes back as a credit (unless a make-up was given for
 * it), and a lesson that happened without being charged is added.
 */

/** 'yyyy-MM' → its first and last day. */
export function monthRange(period: string): [string, string] {
  const [y, m] = period.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return [`${period}-01`, `${period}-${String(last).padStart(2, '0')}`]
}

export function prevPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

export function periodName(period: string, year = false): string {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', year ? { month: 'long', year: 'numeric' } : { month: 'long' })
}

const dollars = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Whether a lesson is one the student is not charged for, by your policy. */
function excused(i: CalendarItem, rosterId: string, settings: StudioSettings): boolean {
  if (i.cancelled) return true
  const mark = i.attendance[rosterId]
  return (mark === 'teacher_cancel' && settings.policy.teacherCancelCredit) || (mark === 'student_cancel' && settings.policy.noticeCredit)
}

/** The lessons a monthly fee counts: theirs, not make-ups (already paid for). */
function chargeable(r: RosterStudent, items: CalendarItem[]) {
  return items.filter((i) => i.rosterIds.includes(r.id) && !i.makeupFor)
}

export interface StudentDraft {
  rosterId: string
  lines: InvoiceLine[]
  totalCents: number
  /** Lessons charged this month. */
  lessons: number
  /** They have private lessons but no price to charge for them. */
  noRate: boolean
}

/**
 * One student's invoice for `period`. `monthItems` are that month's
 * calendar items, `prevItems` the month before's, and `prev` the invoice
 * they had for the month before, if any (only then is it settled up).
 */
export function draftMonthly(
  r: RosterStudent,
  period: string,
  monthItems: CalendarItem[],
  prevItems: CalendarItem[],
  prev: Invoice | undefined,
  settings: StudioSettings,
): StudentDraft {
  const first = r.name.split(' ')[0]
  const price = lessonPriceCents(r, settings)
  const groupPrice = groupType(settings.lessonTypes)?.priceCents ?? 0
  const priceOf = (i: CalendarItem) => (i.rosterIds.length > 1 ? groupPrice : price)
  const lines: InvoiceLine[] = []

  const now = chargeable(r, monthItems).filter((i) => !excused(i, r.id, settings))
  const privates = now.filter((i) => i.rosterIds.length === 1)
  const groups = now.filter((i) => i.rosterIds.length > 1)
  const month = periodName(period)
  if (privates.length) {
    lines.push({ rosterId: r.id, kind: 'lessons', keys: privates.map((i) => i.key), text: `${first} · ${plural(privates.length, 'lesson')} in ${month} × ${dollars(price)}`, amountCents: privates.length * price })
  }
  if (groups.length) {
    lines.push({ rosterId: r.id, kind: 'group', keys: groups.map((i) => i.key), text: `${first} · ${plural(groups.length, 'group class', 'group classes')} in ${month} × ${dollars(groupPrice)}`, amountCents: groups.length * groupPrice })
  }

  // Settling up last month, against what its invoice charged.
  if (prev && prev.status !== 'void') {
    const last = periodName(prev.period)
    const billed = new Set(prev.lines.filter((l) => l.kind === 'lessons' || l.kind === 'group').flatMap((l) => l.keys ?? []))
    const byKey = new Map(prevItems.map((i) => [i.key, i]))
    // Charged but did not happen (cancelled, excused, or taken off the calendar).
    const gone = [...billed].filter((k) => { const i = byKey.get(k); return !i || excused(i, r.id, settings) })
    // A make-up given in its place already made up for one.
    const makeups = prevItems.filter((i) => i.makeupFor === r.id && !i.cancelled).length
    const owed = gone.slice(makeups)
    if (owed.length) {
      const amount = owed.reduce((a, k) => { const i = byKey.get(k); return a + (i ? priceOf(i) : price) }, 0)
      lines.push({ rosterId: r.id, kind: 'credit', keys: owed, text: `${first} · ${plural(owed.length, 'cancelled lesson')} in ${last} (credit)`, amountCents: -amount })
    }
    // Happened but was not charged (added after the invoice was made).
    const extra = chargeable(r, prevItems).filter((i) => !billed.has(i.key) && (i.attendance[r.id] === 'present' || i.attendance[r.id] === 'missed'))
    if (extra.length) {
      lines.push({ rosterId: r.id, kind: 'extra', keys: extra.map((i) => i.key), text: `${first} · ${plural(extra.length, 'extra lesson')} in ${last}`, amountCents: extra.reduce((a, i) => a + priceOf(i), 0) })
    }
  }

  return {
    rosterId: r.id,
    lines,
    totalCents: lines.reduce((a, l) => a + l.amountCents, 0),
    lessons: now.length,
    noRate: privates.length > 0 && price === 0,
  }
}

/**
 * When a monthly invoice is due: two weeks into the month, or a week from
 * the day it is made if that is later (an invoice made late is never
 * overdue the moment it exists).
 */
export function dueOnFor(period: string, today: string = dayKey(new Date())): string {
  const usual = addDays(monthRange(period)[0], 14)
  const week = addDays(today, 7)
  return week > usual ? week : usual
}

export interface Account {
  /** Charged less paid: above 0 they owe, below 0 they are in credit. */
  balanceCents: number
  standing: FamilyStanding
  /** Each invoice with what is still owed on it, oldest first. */
  invoices: { inv: Invoice; owedCents: number }[]
  /** Earliest due date still owed on ('' when nothing is). */
  dueOn: string
}

const byAge = (a: Invoice, b: Invoice) => a.period.localeCompare(b.period) || a.createdAt.localeCompare(b.createdAt)

/**
 * Where a student (or a group) stands across all their invoices. Payments
 * and credits pay off the oldest invoice first, wherever they were
 * recorded, so paying ahead or a credit carries into the next month.
 */
export function accountOf(invoices: Invoice[], today: string = dayKey(new Date())): Account {
  const live = invoices.filter((i) => i.status !== 'void').sort(byAge)
  let pool = live.reduce((a, i) => a + paidCents(i) + Math.max(0, -i.totalCents), 0)
  const rows = live.map((inv) => {
    const charge = Math.max(0, inv.totalCents)
    const paid = Math.min(pool, charge)
    pool -= paid
    return { inv, owedCents: charge - paid }
  })
  const open = rows.filter((r) => r.owedCents > 0)
  const dueOn = open.map((r) => r.inv.dueOn).sort()[0] ?? ''
  return {
    balanceCents: live.reduce((a, i) => a + i.totalCents - paidCents(i), 0),
    standing: !open.length ? 'paid' : dueOn < today ? 'overdue' : 'unpaid',
    invoices: rows,
    dueOn,
  }
}

/**
 * A payment for several invoices (a group's, or one student's): split over
 * what is owed, oldest first. Anything left over goes on the newest
 * invoice, where it counts as credit.
 */
export function splitPayment(amountCents: number, owed: { inv: Invoice; owedCents: number }[]): { id: string; amountCents: number }[] {
  const out = new Map<string, number>()
  let left = amountCents
  for (const o of [...owed].sort((a, b) => byAge(a.inv, b.inv))) {
    if (left <= 0) break
    const take = Math.min(left, o.owedCents)
    if (take > 0) { out.set(o.inv.id, (out.get(o.inv.id) ?? 0) + take); left -= take }
  }
  if (left > 0 && owed.length) {
    const newest = [...owed].sort((a, b) => byAge(b.inv, a.inv))[0].inv.id
    out.set(newest, (out.get(newest) ?? 0) + left)
  }
  return [...out].map(([id, amountCents]) => ({ id, amountCents }))
}

/** Ways a payment can come in, as the teacher picks them. */
export const METHODS: [Payment['method'], string][] = [
  ['cash', 'Cash'], ['venmo', 'Venmo'], ['zelle', 'Zelle'], ['card', 'Card'], ['check', 'Check'], ['transfer', 'Bank transfer'], ['other', 'Other'],
]
