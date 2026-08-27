import type { Course } from './scoring'

export type SeedCourse = Course & { id: string; location: string }

/**
 * Courses offered before anything is saved, so the app is playable the moment
 * it opens. Anything entered in the app supersedes these.
 */
export const SEED_COURSES: SeedCourse[] = [
  {
    id: 'seed-ocean-shores-black',
    name: 'Ocean Shores — Black tees',
    location: '',
    tee: 'Black',
    rating: 76.5,
    slope: 130,
    pars: [5, 3, 4, 4, 5, 3, 5, 4, 3, 4, 4, 4, 4, 5, 3, 4, 5, 3],
    strokeIndex: [7, 17, 1, 11, 9, 15, 5, 3, 13, 2, 16, 6, 14, 8, 12, 4, 10, 18],
  },
]

/**
 * Par layouts worth one tap when entering a card from scratch. The first
 * matches the seeded course, so a second set of tees there is quick to add.
 */
export const PAR_PRESETS: { label: string; hint: string; pars: number[] }[] = [
  {
    label: 'Ocean Shores',
    hint: 'The layout above — five 3s, eight 4s, five 5s',
    pars: [5, 3, 4, 4, 5, 3, 5, 4, 3, 4, 4, 4, 4, 5, 3, 4, 5, 3],
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
