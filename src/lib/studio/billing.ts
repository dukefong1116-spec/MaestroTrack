import type { Invoice, InvoiceLine, LessonType, RosterStudent, StudioSettings } from '@/types'
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
