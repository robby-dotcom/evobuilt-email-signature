/** Stableford scoring and handicap stroke allocation. Pure, no I/O. */

/** Player position 0..3. Drives the 6-6-6 partnership rotation. */
export type Slot = 0 | 1 | 2 | 3
export const SLOTS: Slot[] = [0, 1, 2, 3]

/**
 * Shots a player receives on a hole.
 *
 * A 9-marker gets one shot on stroke index 1-9. An 18-marker gets one everywhere.
 * A 22-marker gets two on SI 1-4 and one elsewhere. A plus-2 gives one back on
 * the two easiest holes (SI 17-18).
 */
export function strokesReceived(handicap: number, strokeIndex: number): number {
  if (handicap >= 0) {
    return Math.floor(handicap / 18) + (strokeIndex <= handicap % 18 ? 1 : 0)
  }
  const givesBack = -handicap
  return strokeIndex >= 19 - givesBack ? -1 : 0
}

/**
 * Stableford points: 0 double bogey or worse, 1 bogey, 2 par, 3 birdie,
 * 4 eagle, 5 albatross. A null gross (no score / picked up) is a wipe.
 */
export function stablefordPoints(
  gross: number | null,
  par: number,
  strokes: number,
): number {
  if (gross == null) return 0
  return Math.max(0, 2 - (gross - strokes - par))
}
