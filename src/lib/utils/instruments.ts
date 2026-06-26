import type { InstrumentType } from '@/types'

export interface InstrumentTheme {
  primary: string
  secondary: string
  accent: string
  bg: string
  darkBg: string
  gradient: string
  emoji: string
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
    emoji: '🎹',
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
    emoji: '🎻',
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
    emoji: '🎻',
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
    emoji: '🎻',
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
    emoji: '🎵',
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
    emoji: '🎷',
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
    emoji: '🎷',
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
    emoji: '🎺',
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
    emoji: '🎺',
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
    emoji: '🥁',
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
    emoji: '🎤',
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
    emoji: '🎸',
    label: 'Guitar',
    description: 'Strings & Rhythm',
  },
}

export const INSTRUMENT_LIST: InstrumentType[] = [
  'piano', 'violin', 'viola', 'cello', 'flute', 'clarinet',
  'saxophone', 'trumpet', 'trombone', 'percussion', 'voice', 'guitar',
]

export function getTheme(instrument?: InstrumentType): InstrumentTheme {
  return instrument ? INSTRUMENT_THEMES[instrument] : INSTRUMENT_THEMES.piano
}
