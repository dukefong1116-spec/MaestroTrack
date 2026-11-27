import { create } from 'zustand'
import type { FemataMood } from '@/components/femata/Femata'
import type { ShareFields, ShareOptions } from '@/lib/share/fields'
import type { ShareKind } from '@/lib/share/link'
import type { RedditStreak } from '@/lib/share/story'

/**
 * What to share, and how: asked for from anywhere (a celebration, the
 * week's chart, a badge), drawn by the one share window (ShareHost).
 */
export interface ShareRequest {
  kind: ShareKind
  /** The window's title: "Share your streak". */
  title: string
  /**
   * The card's fields for the choices made: nothing private goes in that
   * the person has not switched on.
   */
  build: (options: ShareOptions) => ShareFields
  /** Which on/off choices make sense for this moment. */
  toggles: { name?: boolean; streak?: boolean; piece?: boolean }
  /** A badge shows its own art; everything else shows Femata. */
  badgeId?: string
  /** Femata's face to start with. */
  mood?: FemataMood
  /** Offers the Reddit picture (a streak, from the streak page). */
  reddit?: RedditStreak
}

export const useShareStore = create<{ request: ShareRequest | null }>(() => ({ request: null }))

export const openShare = (request: ShareRequest) => useShareStore.setState({ request })
export const closeShare = () => useShareStore.setState({ request: null })
