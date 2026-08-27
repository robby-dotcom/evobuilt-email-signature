import type { Course } from './scoring'

export type SeedCourse = Course & { id: string; location: string; note?: string }

/**
 * Courses the picker offers before anything is saved, so a fresh install is
 * playable without a database. Anything entered in the app supersedes these.
 */
export const SEED_COURSES: SeedCourse[] = [
  {
    id: 'seed-ocean-shores-wa-usa',
    name: 'Ocean Shores GC (Washington, USA)',
    location: 'Ocean Shores, WA, United States',
    note: 'Not the NSW club — yardage is in yards and the mix is 5/8/5, not 6/6/6.',
    pars: [5, 3, 4, 4, 5, 3, 5, 4, 3, 4, 4, 4, 4, 5, 3, 4, 5, 3],
    strokeIndex: [7, 17, 1, 11, 9, 15, 5, 3, 13, 2, 16, 6, 14, 8, 12, 4, 10, 18],
  },
]

/**
 * Par layouts worth one tap. The 6/6/6 shape is what Ocean Shores CC in NSW is
 * documented to be, so that card only needs its stroke index typing in.
 */
export const PAR_PRESETS: { label: string; hint: string; pars: number[] }[] = [
  {
    label: '6 / 6 / 6',
    hint: 'Six 3s, six 4s, six 5s — the Ocean Shores CC (NSW) shape',
    pars: [4, 3, 5, 4, 3, 5, 4, 3, 5, 4, 3, 5, 4, 3, 5, 4, 3, 5],
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
