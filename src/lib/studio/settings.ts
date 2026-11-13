import type { CalendarTag, LessonType, RosterStudent, StudioSettings } from '@/types'

/**
 * Lengths and prices, in three levels — each overriding the one above:
 * the studio default, a student's own, and a single lesson (which lives on
 * the lesson itself, not here).
 */

export const DEFAULT_TAGS: CalendarTag[] = [
  { id: 'private', name: 'Private lesson', color: '#FF7A5C' },
  { id: 'group', name: 'Group class', color: '#7A5AC4' },
  { id: 'makeup', name: 'Make-up', color: '#2E8B62' },
  { id: 'event', name: 'Recital or event', color: '#3B7DD8' },
  { id: 'cancelled', name: 'Cancelled', color: '#8B82A3' },
]

/** Eight colours, each at least 3:1 against white so a bar or dot reads. */
export const TAG_SWATCHES: { color: string; name: string }[] = [
  { color: '#FF7A5C', name: 'Coral' },
  { color: '#C98A12', name: 'Amber' },
  { color: '#2E8B62', name: 'Green' },
  { color: '#1F8A96', name: 'Teal' },
  { color: '#3B7DD8', name: 'Blue' },
  { color: '#7A5AC4', name: 'Purple' },
  { color: '#D64257', name: 'Red' },
  { color: '#7D7495', name: 'Grey' },
]

export const DEFAULT_LESSON_TYPES: LessonType[] = [
  { id: 't30', name: 'Private lesson', minutes: 30, priceCents: 3000 },
  { id: 't45', name: 'Private lesson', minutes: 45, priceCents: 4500 },
  { id: 't60', name: 'Private lesson', minutes: 60, priceCents: 6000 },
]

export function defaultSettings(teacherId: string): StudioSettings {
  return {
    teacherId,
    defaultLessonMinutes: 30,
    lessonTypes: DEFAULT_LESSON_TYPES,
    tags: DEFAULT_TAGS,
    policy: { teacherCancelCredit: true, noticeCredit: true, creditExpiryDays: 60 },
    dayStart: 8,
    dayEnd: 20,
    updatedAt: '',
  }
}

/** A stored document with anything missing filled from the defaults. */
export function withDefaults(teacherId: string, stored: Partial<StudioSettings> | null | undefined): StudioSettings {
  const d = defaultSettings(teacherId)
  if (!stored) return d
  return {
    ...d,
    ...stored,
    teacherId,
    lessonTypes: Array.isArray(stored.lessonTypes) ? stored.lessonTypes : d.lessonTypes,
    tags: Array.isArray(stored.tags) && stored.tags.length ? stored.tags : d.tags,
    policy: { ...d.policy, ...(stored.policy ?? {}) },
  }
}

export const LENGTH_CHOICES = [15, 20, 30, 40, 45, 60, 75, 90, 120]

export function hasOwnLength(r: Pick<RosterStudent, 'lessonMinutes'>): boolean {
  return r.lessonMinutes != null
}

export function hasOwnPrice(r: Pick<RosterStudent, 'priceCents'>): boolean {
  return r.priceCents != null
}

export function lessonMinutes(r: Pick<RosterStudent, 'lessonMinutes'> | undefined, s: StudioSettings): number {
  return r?.lessonMinutes ?? s.defaultLessonMinutes
}

/**
 * The price of a lesson of this length: the private lesson type with that
 * length, else the default-length type scaled to it, else nothing.
 */
export function typePriceCents(minutes: number, s: StudioSettings): number {
  const exact = s.lessonTypes.find((t) => !t.group && t.minutes === minutes)
  if (exact) return exact.priceCents
  const base = s.lessonTypes.find((t) => !t.group && t.minutes === s.defaultLessonMinutes)
    ?? s.lessonTypes.find((t) => !t.group)
  if (!base || !base.minutes) return 0
  return Math.round((base.priceCents * minutes) / base.minutes / 100) * 100
}

export function lessonPriceCents(r: Pick<RosterStudent, 'lessonMinutes' | 'priceCents'> | undefined, s: StudioSettings): number {
  if (r?.priceCents != null) return r.priceCents
  return typePriceCents(lessonMinutes(r, s), s)
}

export function tagFor(tags: CalendarTag[], id: string | undefined): CalendarTag {
  return tags.find((t) => t.id === id) ?? { id: id ?? 'none', name: 'No tag', color: '#7D7495' }
}
