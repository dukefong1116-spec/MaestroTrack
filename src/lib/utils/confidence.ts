import type { StickerName } from '@/components/stickers/Sticker'

/**
 * How a session went, asked the same way wherever a session is recorded.
 *
 * Three points on the 1–10 scale the data has always stored. Three, not
 * ten: asking someone to be precise about a feeling gets the answer 7
 * every time. The live session has asked this way for a while; logging
 * one after the fact used a 1–10 slider, so the two kinds of entry said
 * different things in the same history. Both read from here now.
 */
export const CONFIDENCE_CHOICES = [
  { value: 4, label: 'Rough', hint: 'Fought me the whole way', sticker: 'footprints', tint: '#9AA6B8' },
  { value: 7, label: 'Okay', hint: 'Steady, nothing surprising', sticker: 'note', tint: '#7CA9E8' },
  { value: 9, label: 'Really good', hint: 'It clicked', sticker: 'bolt', tint: '#FF7A5C' },
] as const satisfies readonly { value: number; label: string; hint: string; sticker: StickerName; tint: string }[]

/** What a session answered when nobody said otherwise. */
export const DEFAULT_CONFIDENCE = 7

/**
 * The word for a stored confidence value.
 *
 * Sessions logged before the scale was shared carry anything from 1 to
 * 10, so this reads bands rather than the three exact values — an old
 * entry of 8 still comes out as a word that means something.
 */
export function confidenceLabel(value: number): string {
  if (value <= 5) return 'Rough'
  if (value >= 9) return 'Really good'
  return 'Okay'
}
