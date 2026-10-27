import type { InstrumentType } from '@/types'

export interface InstrumentTheme {
  primary: string
  secondary: string
  accent: string
  bg: string
  darkBg: string
  gradient: string
  label: string
  description: string
}

export const INSTRUMENT_THEMES: Record<InstrumentType, InstrumentTheme> = {
  piano: {
    primary: '#6366f1',
    secondary: '#818cf8',
    accent: '#c7d2fe',
    bg: 'from-indigo-950 to-slate-950',
    darkBg: 'bg-indigo-950/30',
    gradient: 'from-indigo-500 to-purple-600',
    label: 'Piano',
    description: 'Keys & Harmony',
  },
  violin: {
    primary: '#b45309',
    secondary: '#d97706',
    accent: '#fde68a',
    bg: 'from-amber-950 to-stone-950',
    darkBg: 'bg-amber-950/30',
    gradient: 'from-amber-600 to-orange-700',
    label: 'Violin',
    description: 'Strings & Song',
  },
  viola: {
    primary: '#92400e',
    secondary: '#b45309',
    accent: '#fcd34d',
    bg: 'from-orange-950 to-amber-950',
    darkBg: 'bg-orange-950/30',
    gradient: 'from-orange-600 to-red-700',
    label: 'Viola',
    description: 'Rich Tones',
  },
  cello: {
    primary: '#7c2d12',
    secondary: '#9a3412',
    accent: '#fed7aa',
    bg: 'from-red-950 to-stone-950',
    darkBg: 'bg-red-950/30',
    gradient: 'from-red-700 to-rose-800',
    label: 'Cello',
    description: 'Deep Resonance',
  },
  flute: {
    primary: '#0e7490',
    secondary: '#0891b2',
    accent: '#a5f3fc',
    bg: 'from-cyan-950 to-teal-950',
    darkBg: 'bg-cyan-950/30',
    gradient: 'from-cyan-500 to-teal-600',
    label: 'Flute',
    description: 'Air & Grace',
  },
  clarinet: {
    primary: '#065f46',
    secondary: '#047857',
    accent: '#a7f3d0',
    bg: 'from-emerald-950 to-teal-950',
    darkBg: 'bg-emerald-950/30',
    gradient: 'from-emerald-600 to-green-700',
    label: 'Clarinet',
    description: 'Woodwind Magic',
  },
  saxophone: {
    primary: '#d97706',
    secondary: '#f59e0b',
    accent: '#fef3c7',
    bg: 'from-yellow-950 to-amber-950',
    darkBg: 'bg-yellow-950/30',
    gradient: 'from-yellow-500 to-amber-600',
    label: 'Saxophone',
    description: 'Jazz Soul',
  },
  trumpet: {
    primary: '#b45309',
    secondary: '#ca8a04',
    accent: '#fef08a',
    bg: 'from-yellow-950 to-orange-950',
    darkBg: 'bg-yellow-950/30',
    gradient: 'from-yellow-600 to-orange-600',
    label: 'Trumpet',
    description: 'Brass Power',
  },
  trombone: {
    primary: '#78350f',
    secondary: '#92400e',
    accent: '#fed7aa',
    bg: 'from-orange-950 to-stone-950',
    darkBg: 'bg-orange-950/30',
    gradient: 'from-orange-700 to-amber-700',
    label: 'Trombone',
    description: 'Slide & Sound',
  },
  percussion: {
    primary: '#1e1b4b',
    secondary: '#312e81',
    accent: '#c7d2fe',
    bg: 'from-slate-950 to-indigo-950',
    darkBg: 'bg-slate-950/30',
    gradient: 'from-slate-600 to-indigo-700',
    label: 'Percussion',
    description: 'Rhythm & Drive',
  },
  voice: {
    primary: '#9d174d',
    secondary: '#be185d',
    accent: '#fbcfe8',
    bg: 'from-pink-950 to-rose-950',
    darkBg: 'bg-pink-950/30',
    gradient: 'from-pink-600 to-rose-600',
    label: 'Voice',
    description: 'The Human Instrument',
  },
  guitar: {
    primary: '#14532d',
    secondary: '#166534',
    accent: '#bbf7d0',
    bg: 'from-green-950 to-emerald-950',
    darkBg: 'bg-green-950/30',
    gradient: 'from-green-600 to-teal-600',
    label: 'Guitar',
    description: 'Strings & Rhythm',
  },
  other: {
    primary: '#5b5177',
    secondary: '#7c6f9c',
    accent: '#ded7ee',
    bg: 'from-violet-950 to-slate-950',
    darkBg: 'bg-violet-950/30',
    gradient: 'from-violet-500 to-indigo-600',
    label: 'Other',
    description: 'Not on the list',
  },
}

/** Order shown in every instrument picker. 'other' stays last: it is the
 *  fallback, not a choice competing with the named ones. */
export const INSTRUMENT_LIST: InstrumentType[] = [
  'piano', 'violin', 'viola', 'cello', 'flute', 'clarinet',
  'saxophone', 'trumpet', 'trombone', 'percussion', 'voice', 'guitar',
  'other',
]

export function getTheme(instrument?: InstrumentType): InstrumentTheme {
  // Falls back rather than indexing blind: a value stored before this list
  // last changed would otherwise return undefined and take the page with it.
  return (instrument && INSTRUMENT_THEMES[instrument]) || INSTRUMENT_THEMES.piano
}
