/** Types for rules.js — see the comments there. */

export interface Tier { id: 'pp' | 'p' | 'mp' | 'f' | 'ff'; name: string }
export const TIERS: Tier[]
export const TOP_TIER: number
export const ROOM_MAX: number
export const DAILY_CAP: number
export const DAY_MIN: number
export const DAY_BONUS: number
export const STREAK_BONUS: number
export const STREAK_DAYS: number
export const STREAK_LOOKBACK: number
export const BAND_HOURS: number
export const MAX_BAND_REACH: number
export const MAESTRO_PLACES: number

export interface LeagueWeek { id: string; start: string; end: string; today: string }
export interface DayLine { date: string; minutes: number; counted: number; bonus: number; streak: number; xp: number }
export interface Ranked { uid: string; xp: number; xpAt?: string }
export interface Result { uid: string; xp: number; rank: number; of: number; fromTier: number; toTier: number; maestro: boolean }
export type Zone = 'up' | 'down' | null

export function addDays(day: string, n: number): string
export function localDay(nowMs: number, offsetMin: number): string
export function mondayOf(day: string): string
export function weekIdOf(day: string): string
export function weekOf(nowMs: number, offsetMin: number): LeagueWeek
export function bandFor(offsetMin: number): number
export function weekEndsAt(weekStart: string, band: number): number
export function weekXp(sessions: { date: string; minutes: number }[], weekStart: string, holds?: Iterable<string>): { xp: number; days: DayLine[] }
export function streakOn(days: DayLine[], today: string): number
export function rankMembers<T extends Ranked>(members: T[]): T[]
export function moveCounts(n: number): { up: number; down: number }
export function zoneOf(index: number, n: number, tier: number, xp?: number): Zone
export function finalResults(members: Ranked[], tier: number): Result[]
export function publicName(displayName: string | undefined | null): string
export function colourFor(uid: string): number
