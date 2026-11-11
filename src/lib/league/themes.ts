/**
 * Each league tier's look — its colours and trophy name — and the avatar
 * colours players are drawn in. The drawings themselves are in
 * components/league/TierArt.
 */

export interface TierTheme {
  id: 'pp' | 'p' | 'mp' | 'f' | 'ff'
  name: string
  trophy: string
  /** Metal shades, light to dark. */
  metal: [string, string, string]
  background: string
  ink: string
  sub: string
  dark?: boolean
}

export const TIER_THEMES: TierTheme[] = [
  { id: 'pp', name: 'Pianissimo', trophy: 'Bronze quaver', metal: ['#F6D2AE', '#C98A55', '#7E4A26'], background: 'linear-gradient(160deg,#FFF3E8,#F4D3B8)', ink: '#5E3418', sub: '#9A6A45' },
  { id: 'p', name: 'Piano', trophy: 'Silver tuning fork', metal: ['#F4F7FC', '#AEB9CF', '#5F6B84'], background: 'linear-gradient(160deg,#F6F9FD,#D3DDEE)', ink: '#323D55', sub: '#68748D' },
  { id: 'mp', name: 'Mezzo-piano', trophy: 'Golden lyre', metal: ['#FFEDB0', '#E5B53A', '#946A0C'], background: 'linear-gradient(160deg,#FFFAE6,#FFE09A)', ink: '#5E4204', sub: '#93690B' },
  { id: 'f', name: 'Forte', trophy: 'Ruby metronome', metal: ['#FFA8B5', '#E2475E', '#8E1A2E'], background: 'linear-gradient(160deg,#FFEEF0,#FFBCC7)', ink: '#6E1222', sub: '#AE3549' },
  { id: 'ff', name: 'Fortissimo', trophy: 'Maestro cup', metal: ['#E2D8FF', '#8C6CF0', '#4127A6'], background: 'linear-gradient(160deg,#241650,#5A3DCB)', ink: '#FFFFFF', sub: '#CFC3FF', dark: true },
]

export const themeFor = (tier: number | undefined): TierTheme =>
  TIER_THEMES[Math.max(0, Math.min(TIER_THEMES.length - 1, tier ?? 0))]

export const AVATAR_COLOURS: [string, string][] = [
  ['#FDE2D3', '#B4532A'], ['#DDEBFF', '#2C5BA8'], ['#E2F5EA', '#2E7D55'],
  ['#F3E3FF', '#7A3DB8'], ['#FFF0C9', '#8A6206'], ['#E0F4F7', '#1F6F7C'],
]
