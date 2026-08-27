import type { Course } from './scoring'

export type SeedCourse = Course & { id: string; location: string }

/**
 * Courses offered before anything is saved, so the app is playable the moment
 * it opens. Anything entered in the app supersedes these.
 */
export const SEED_COURSES: SeedCourse[] = [
  {
    id: 'seed-ocean-shores',
    name: 'Ocean Shores',
    location: '',
    // Straight off the club's own scorecard: six par 3s, six 4s, six 5s.
    pars: [5, 4, 3, 5, 4, 3, 4, 3, 5, 4, 5, 3, 4, 5, 3, 4, 3, 5],
    // Provisional. A 10 handicap on the club card takes a shot on holes
    // 2, 4, 5, 9, 10, 11, 12, 13, 14 and 16, so those ten are stroke index
    // 1-10 and the other eight are 11-18. The order inside each group is a
    // guess until the printed index is to hand — check it before playing.
    strokeIndex: [11, 1, 13, 2, 3, 15, 16, 17, 4, 5, 6, 7, 8, 9, 12, 10, 14, 18],
  },
]

/**
 * Par layouts worth one tap when entering a card from scratch. The first
 * matches the seeded course, so a second set of tees there is quick to add.
 */
export const PAR_PRESETS: { label: string; hint: string; pars: number[] }[] = [
  {
    label: 'Ocean Shores',
    hint: 'Six 3s, six 4s, six 5s — the club card',
    pars: [5, 4, 3, 5, 4, 3, 4, 3, 5, 4, 5, 3, 4, 5, 3, 4, 3, 5],
  },
  {
    label: 'Standard 72',
    hint: 'Four 3s, ten 4s, four 5s — the usual par 72',
    pars: [4, 5, 4, 3, 4, 4, 3, 5, 4, 4, 4, 3, 5, 4, 4, 3, 5, 4],
  },
  {
    label: 'All 4s',
    hint: 'Start flat and set each hole yourself',
    pars: Array(18).fill(4),
  },
]

/**
 * Tomorrow's four, in the order that sets the draw: 1&2, then 1&3, then 1&4.
 * Only used when there is no previous round to carry a line-up forward from.
 */
export const DEFAULT_PLAYERS = ['Luke', 'Adam', 'Robby', 'Will']
