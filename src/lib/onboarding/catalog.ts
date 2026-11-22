import type { ExperienceLevel, InstrumentType } from '@/types'

/**
 * What the first-run setup offers. The instruments the app has a type for
 * keep it; the other common ones are saved as 'other' with their own name
 * (UserProfile.instrumentName), drawn with the nearest family's glyph.
 */
export interface CatalogInstrument { id: string; label: string; glyph: InstrumentType; type?: InstrumentType }

export const INSTRUMENT_GROUPS: { title: string; items: CatalogInstrument[] }[] = [
  { title: 'Keys', items: [
    { id: 'piano', label: 'Piano', glyph: 'piano', type: 'piano' },
    { id: 'organ', label: 'Organ', glyph: 'piano' },
    { id: 'keyboard', label: 'Keyboard', glyph: 'piano' },
    { id: 'accordion', label: 'Accordion', glyph: 'piano' },
  ] },
  { title: 'Strings', items: [
    { id: 'violin', label: 'Violin', glyph: 'violin', type: 'violin' },
    { id: 'viola', label: 'Viola', glyph: 'viola', type: 'viola' },
    { id: 'cello', label: 'Cello', glyph: 'cello', type: 'cello' },
    { id: 'double-bass', label: 'Double Bass', glyph: 'cello' },
    { id: 'harp', label: 'Harp', glyph: 'guitar' },
  ] },
  { title: 'Guitar & folk', items: [
    { id: 'guitar', label: 'Guitar', glyph: 'guitar', type: 'guitar' },
    { id: 'electric-guitar', label: 'Electric Guitar', glyph: 'guitar' },
    { id: 'bass-guitar', label: 'Bass Guitar', glyph: 'guitar' },
    { id: 'ukulele', label: 'Ukulele', glyph: 'guitar' },
    { id: 'banjo', label: 'Banjo', glyph: 'guitar' },
    { id: 'mandolin', label: 'Mandolin', glyph: 'guitar' },
  ] },
  { title: 'Woodwinds', items: [
    { id: 'flute', label: 'Flute', glyph: 'flute', type: 'flute' },
    { id: 'piccolo', label: 'Piccolo', glyph: 'flute' },
    { id: 'recorder', label: 'Recorder', glyph: 'flute' },
    { id: 'clarinet', label: 'Clarinet', glyph: 'clarinet', type: 'clarinet' },
    { id: 'oboe', label: 'Oboe', glyph: 'clarinet' },
    { id: 'bassoon', label: 'Bassoon', glyph: 'clarinet' },
    { id: 'saxophone', label: 'Saxophone', glyph: 'saxophone', type: 'saxophone' },
  ] },
  { title: 'Brass', items: [
    { id: 'trumpet', label: 'Trumpet', glyph: 'trumpet', type: 'trumpet' },
    { id: 'french-horn', label: 'French Horn', glyph: 'trumpet' },
    { id: 'trombone', label: 'Trombone', glyph: 'trombone', type: 'trombone' },
    { id: 'euphonium', label: 'Euphonium', glyph: 'trombone' },
    { id: 'tuba', label: 'Tuba', glyph: 'trombone' },
  ] },
  { title: 'Percussion', items: [
    { id: 'drum-kit', label: 'Drum Kit', glyph: 'percussion' },
    { id: 'percussion', label: 'Percussion', glyph: 'percussion', type: 'percussion' },
    { id: 'marimba', label: 'Marimba', glyph: 'percussion' },
    { id: 'xylophone', label: 'Xylophone', glyph: 'percussion' },
  ] },
  { title: 'Voice', items: [
    { id: 'voice', label: 'Voice', glyph: 'voice', type: 'voice' },
  ] },
]

const BY_ID = new Map(INSTRUMENT_GROUPS.flatMap((g) => g.items).map((i) => [i.id, i]))

/** The profile fields for a pick (catalog ids, or free text from "Other:"), main first. */
export function instrumentFields(picked: string[]): { instrument: InstrumentType; instrumentName?: string; instruments: string[] } {
  const labels = picked.map((p) => BY_ID.get(p)?.label ?? p)
  const main = BY_ID.get(picked[0])
  if (main?.type) return { instrument: main.type, instruments: labels }
  return { instrument: 'other', instrumentName: labels[0], instruments: labels }
}

export const EXPERIENCE: { value: ExperienceLevel; label: string; line: string }[] = [
  { value: 'beginner', label: 'Beginner', line: 'Learning the basics' },
  { value: 'intermediate', label: 'Intermediate', line: 'A solid foundation' },
  { value: 'advanced', label: 'Advanced', line: 'Years of playing' },
  { value: 'professional', label: 'Professional', line: 'Music is my work' },
]

/** The minutes the "how long" picker offers. */
export const MINUTES = [5, 10, 15, 20, 25, 30, 40, 45, 60, 75, 90, 120]

export const MINUTE_LINES: Record<number, string> = {
  5: 'Every minute counts!', 10: 'Short and sweet.', 15: 'A quick daily dose.', 20: 'Nice and steady.',
  25: 'Good rhythm.', 30: 'A solid half hour. Nice!', 40: "Now we're playing.", 45: 'Serious practice!',
  60: 'A full hour? Impressive.', 75: 'Big goals!', 90: 'Wow, dedicated!', 120: 'Practice like a pro!',
}

/** Streak goals, each a step up from the last. */
export const STREAK_GOALS: { days: number; label: string }[] = [
  { days: 7, label: 'Warm-up' },
  { days: 14, label: 'On a roll' },
  { days: 30, label: 'Habit maker' },
  { days: 50, label: 'Legend' },
  { days: 100, label: 'Century' },
  { days: 200, label: 'Marathon' },
  { days: 365, label: 'A whole year' },
]

/** The four goals worth offering once `reached` days are behind you. */
export function nextGoals(reached: number): { days: number; label: string }[] {
  const ahead = STREAK_GOALS.filter((g) => g.days > reached)
  if (ahead.length >= 4) return ahead.slice(0, 4)
  // Near the top of the list: carry on past it, a year at a time.
  const more = [1, 2, 3, 4].map((k) => {
    const days = Math.max(365, Math.ceil(reached / 365) * 365) + 365 * (k - (reached >= 365 ? 0 : 1))
    return { days, label: `${Math.round(days / 365)} years` }
  })
  return [...ahead, ...more.filter((g) => g.days > reached && !ahead.some((a) => a.days === g.days))].slice(0, 4)
}
