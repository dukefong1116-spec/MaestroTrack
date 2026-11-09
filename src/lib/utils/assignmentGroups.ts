import { differenceInCalendarDays, parseISO } from 'date-fns'
import { awaitingStudent, isDaily, normaliseStatus } from './assignments'
import type { Assignment } from '@/types'

/**
 * How a student's full assignment list is organised: three tabs by where
 * the work is, and the To do tab grouped by when it is due.
 *
 *   To do      — waiting on the student: Overdue · Today · This week ·
 *                Later · No due date. A daily target is today's work.
 *   Handed in  — waiting on the teacher, newest first.
 *   Done       — approved, newest first.
 *
 * Generic over anything carrying an assignment, so the page can pass its
 * richer items straight through.
 */

export type AssignmentTab = 'todo' | 'handed' | 'done'
export type DueGroup = 'overdue' | 'today' | 'week' | 'later' | 'none'

export const GROUP_LABEL: Record<DueGroup, string> = {
  overdue: 'Overdue', today: 'Today', week: 'This week', later: 'Later', none: 'No due date',
}

const GROUP_ORDER: DueGroup[] = ['overdue', 'today', 'week', 'later', 'none']

export function tabOf(a: Assignment): AssignmentTab | null {
  if (awaitingStudent(a)) return 'todo'
  const s = normaliseStatus(a.status)
  if (s === 'submitted') return 'handed'
  if (s === 'approved') return 'done'
  return null // withdrawn: shown nowhere
}

export function dueGroup(a: Assignment, now: Date): DueGroup {
  if (isDaily(a)) return 'today'
  if (!a.dueDate) return 'none'
  const days = differenceInCalendarDays(parseISO(a.dueDate.substring(0, 10)), now)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 6) return 'week'
  return 'later'
}

const latest = (a: Assignment) => a.updatedAt || a.createdAt

export function organise<T extends { assignment: Assignment }>(items: T[], now: Date) {
  const tabs: Record<AssignmentTab, T[]> = { todo: [], handed: [], done: [] }
  for (const x of items) {
    const tab = tabOf(x.assignment)
    if (tab) tabs[tab].push(x)
  }
  // To do: soonest due first within each group (no date last, oldest
  // set first among those). The others read newest first.
  const due = (x: T) => x.assignment.dueDate?.substring(0, 10) ?? '9999'
  tabs.todo.sort((a, b) => due(a).localeCompare(due(b)) || a.assignment.createdAt.localeCompare(b.assignment.createdAt))
  tabs.handed.sort((a, b) => latest(b.assignment).localeCompare(latest(a.assignment)))
  tabs.done.sort((a, b) => latest(b.assignment).localeCompare(latest(a.assignment)))
  const groups = GROUP_ORDER
    .map((g) => ({ group: g, items: tabs.todo.filter((x) => dueGroup(x.assignment, now) === g) }))
    .filter((g) => g.items.length > 0)
  return { tabs, groups, mostPressing: groups.flatMap((g) => g.items) }
}
