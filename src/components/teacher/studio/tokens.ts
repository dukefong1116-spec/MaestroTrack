/** Colours and input styling shared by the studio pages. */

export type Tone = 'success' | 'warning' | 'danger' | 'purple' | 'info' | 'neutral' | 'accent'
export const TONES: Record<Tone, [string, string]> = {
  success: ['var(--clay-success-bg)', '#1F6B4A'],
  warning: ['var(--clay-warning-bg)', '#7A4F05'],
  danger: ['var(--clay-danger-bg)', '#B3263C'],
  purple: ['var(--clay-purple-bg)', '#5B3FA8'],
  info: ['var(--clay-tint-sky)', '#24558F'],
  neutral: ['var(--clay-bg-deep)', '#4F4766'],
  accent: ['var(--clay-accent-soft)', '#C2452B'],
}

export function toneColors(tone: Tone): [string, string] {
  return TONES[tone]
}

export const inputCls = 'block w-full min-h-[40px] rounded-[10px] border-0 px-3 text-[14px] font-semibold outline-none focus:ring-2'
export const inputStyle: React.CSSProperties = { background: 'var(--clay-bg)', color: 'var(--clay-ink)' }

const PALETTE = ['#E05539', '#C98A12', '#3B7DD8', '#2E8B62', '#7A5AC4', '#D64257', '#1F8A96', '#7D7495']
/** A steady colour per person, for avatars without a photo. */
export function colorFor(id: string): string {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}
