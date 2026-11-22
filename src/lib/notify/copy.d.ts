/** Types for copy.js — see the comments there. */

export type NotifyCategory =
  | 'streak' | 'lateStreak' | 'assignments' | 'feedback' | 'lessons'
  | 'studio' | 'league' | 'submissions' | 'digest'

export interface CopyEntry {
  cat: NotifyCategory
  mood: string
  to: string
  exempt?: boolean
  lines: [string, string][]
}

export type NotifyId = keyof typeof COPY
export const COPY: Record<string, CopyEntry>

export interface Composed {
  kind: string
  title: string
  body: string
  index: number
  mood: string
  to: string
  cat: NotifyCategory
  exempt: boolean
}

export function compose(kind: string, vars?: Record<string, string | number | undefined | null>, recent?: number[], seed?: number): Composed | null
export const RECENT: number
export const DAILY_CAP: number
export const QUIET_FROM: number
export const QUIET_TO: number
export function isQuiet(hour: number): boolean
