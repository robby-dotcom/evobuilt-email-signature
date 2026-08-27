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

/**
 * WHS course handicap from an exact GA index.
 *
 *   course handicap = round(index × slope ÷ 113 + (rating − par))
 *
 * The rating term is what people miss: a tee rated above par is harder than par
 * by that margin, and the difference is given back as shots. Off a 76.5/130 tee
 * at par 72, a 9.9 index plays off 16, not 10 — the 4.5 comes from the tees, not
 * from the format or the opposition.
 */
export function courseHandicap(
  index: number,
  rating: number,
  slope: number,
  par: number,
): number {
  return Math.round(index * (slope / 113) + (rating - par))
}

/**
 * Shots actually received after any competition allowance. 100% is full shots;
 * Golf Australia's fourball standard is 85%. Applied to the rounded course
 * handicap, per WHS, not folded into the line above.
 */
export const playingHandicap = (courseHcp: number, allowancePercent = 100): number =>
  Math.round((courseHcp * allowancePercent) / 100)
