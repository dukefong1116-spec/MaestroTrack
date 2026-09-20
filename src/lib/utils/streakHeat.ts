/**
 * Maps a streak length onto a 0..1 heat value with diminishing returns, so
 * the flame keeps growing without a 400-day streak rendering as a bonfire.
 *
 * Lives here rather than beside the icon so that file exports only a
 * component, which React Fast Refresh needs to reload it cleanly.
 */
export function streakHeat(streak: number): number {
  if (streak <= 0) return 0
  // 1 day -> .18, 7 -> .55, 30 -> .85, 100+ -> ~1
  return Math.min(1, Math.log10(streak + 1) / 2.1)
}
