/**
 * Hollywood (666 / Sixes / Round Robin) played as 4BBB Stableford for skins.
 *
 * Nothing here is persisted. The database stores gross scores and a handful of
 * taps; every skin, point and dollar below is derived from those on each render.
 * That is what lets a score mistyped on hole 3 be fixed from the 17th tee.
 */
import { SLOTS, type Slot, stablefordPoints, strokesReceived } from './stableford'

export { SLOTS, type Slot } from './stableford'

export type SkinType = 'hole' | 'birdie' | 'sandie' | 'ctp' | 'longDrive'
export const SKIN_TYPES: SkinType[] = ['hole', 'birdie', 'sandie', 'ctp', 'longDrive']

export const SKIN_LABELS: Record<SkinType, string> = {
  hole: 'Hole', birdie: 'Birdie', sandie: 'Sandie', ctp: 'Closest', longDrive: 'Long drive',
}

export type Team = 0 | 1
export type Pair = readonly [Slot, Slot]

export interface Course {
  name: string
  /** 18 entries, hole 1 first. */
  pars: number[]
  /** 18 entries, hole 1 first. A permutation of 1..18. */
  strokeIndex: number[]
}

export interface Player {
  name: string
  /** Playing handicap — the number written on the card. */
  handicap: number
}

export interface HoleEntry {
  /** Gross strokes per slot; null means not yet entered. */
  strokes: (number | null)[]
  inSand: boolean[]
  /** Par 3s only. */
  ctpSlot: Slot | null
  /** Par 5s only. */
  longDriveSlot: Slot | null
}

export interface RoundSettings {
  stakeCents: number
  /** Does a tied hole's skin survive the partnership swap at 6 and 12? */
  carryAcrossSegments: boolean
  /** Two birdies on one team: one skin (true) or two (false)? */
  oneSkinPerTeamPerCategory: boolean
}

export const DEFAULT_SETTINGS: RoundSettings = {
  stakeCents: 500,
  carryAcrossSegments: true,
  oneSkinPerTeamPerCategory: true,
}

export interface SkinEvent {
  type: SkinType
  team: Team
  skins: number
  /** Who triggered it, for junk. Null for a hole win. */
  bySlot: Slot | null
}

export interface HoleResult {
  hole: number
  par: number
  strokeIndex: number
  teams: readonly [Pair, Pair]
  /** Gross strokes as entered; null where a score is still missing. */
  gross: (number | null)[]
  shots: number[]
  points: number[]
  teamPoints: [number, number]
  /** Null when the hole is halved or not yet complete. */
  winner: Team | null
  settled: boolean
  events: SkinEvent[]
  carryIn: number
  carryOut: number
  /** Cents, per slot, from this hole alone. Always sums to zero. */
  money: number[]
}

export const emptyHole = (): HoleEntry => ({
  strokes: [null, null, null, null],
  inSand: [false, false, false, false],
  ctpSlot: null,
  longDriveSlot: null,
})

/**
 * The 6-6-6 rotation. Each player partners each other player once.
 * Holes 1-6 P1&P2 v P3&P4, 7-12 P1&P3 v P2&P4, 13-18 P1&P4 v P2&P3.
 */
export function teamsForHole(hole: number): readonly [Pair, Pair] {
  const segment = Math.floor((clampHole(hole) - 1) / 6)
  if (segment === 0) return [[0, 1], [2, 3]] as const
  if (segment === 1) return [[0, 2], [1, 3]] as const
  return [[0, 3], [1, 2]] as const
}

export const segmentOf = (hole: number) => Math.floor((clampHole(hole) - 1) / 6)

const clampHole = (hole: number) => Math.min(18, Math.max(1, Math.round(hole)))

const teamOf = (slot: Slot, teams: readonly [Pair, Pair]): Team =>
  teams[0].includes(slot) ? 0 : 1

export interface RoundTotals {
  holes: HoleResult[]
  /** Skins per slot, broken down by type. */
  skins: Record<SkinType, number>[]
  totalSkins: number[]
  /** Stableford points per slot across entered holes. */
  points: number[]
  /** Cents per slot. Always sums to zero. */
  money: number[]
  /** Live carryover pot waiting on the next hole. */
  carry: number
  holesPlayed: number
}

export function computeRound(
  course: Course,
  players: Player[],
  entries: HoleEntry[],
  settings: RoundSettings = DEFAULT_SETTINGS,
): RoundTotals {
  const holes: HoleResult[] = []
  const skins = SLOTS.map(() => zeroSkins())
  const money = [0, 0, 0, 0]
  const points = [0, 0, 0, 0]
  let carry = 0
  let holesPlayed = 0

  for (let hole = 1; hole <= 18; hole++) {
    const entry = entries[hole - 1] ?? emptyHole()
    const par = course.pars[hole - 1]
    const si = course.strokeIndex[hole - 1]
    const teams = teamsForHole(hole)

    const shots = SLOTS.map((s) => strokesReceived(players[s]?.handicap ?? 0, si))
    const holePoints = SLOTS.map((s) => stablefordPoints(entry.strokes[s], par, shots[s]))
    const settled = entry.strokes.every((v) => v != null)

    // Highest points wins — the inverse of gross better-ball. Guarded by a test.
    const teamPoints: [number, number] = [
      Math.max(holePoints[teams[0][0]], holePoints[teams[0][1]]),
      Math.max(holePoints[teams[1][0]], holePoints[teams[1][1]]),
    ]

    const carryIn = carry
    const events: SkinEvent[] = []
    let winner: Team | null = null
    let carryOut = carry

    if (settled) {
      holesPlayed++
      SLOTS.forEach((s) => { points[s] += holePoints[s] })

      if (teamPoints[0] !== teamPoints[1]) {
        winner = teamPoints[0] > teamPoints[1] ? 0 : 1
        events.push({ type: 'hole', team: winner, skins: carryIn + 1, bySlot: null })
        carryOut = 0
      } else {
        carryOut = carryIn + 1
      }

      // Junk is gross and always pays on the hole it happens — it never carries.
      // Handicaps decide who wins the hole; junk rewards real golf.
      for (const s of SLOTS) {
        const gross = entry.strokes[s]
        if (gross == null) continue
        if (gross < par) push(events, 'birdie', teamOf(s, teams), s, settings)
        if (entry.inSand[s] && gross <= par) push(events, 'sandie', teamOf(s, teams), s, settings)
      }
      if (par === 3 && entry.ctpSlot != null) {
        push(events, 'ctp', teamOf(entry.ctpSlot, teams), entry.ctpSlot, settings)
      }
      if (par === 5 && entry.longDriveSlot != null) {
        push(events, 'longDrive', teamOf(entry.longDriveSlot, teams), entry.longDriveSlot, settings)
      }
    }

    // Losers fund every skin: winners +stake each, losers -stake each. Nets to zero.
    const holeMoney = [0, 0, 0, 0]
    for (const ev of events) {
      const value = ev.skins * settings.stakeCents
      for (const s of teams[ev.team]) {
        skins[s][ev.type] += ev.skins
        holeMoney[s] += value
      }
      for (const s of teams[1 - ev.team as Team]) holeMoney[s] -= value
    }
    SLOTS.forEach((s) => { money[s] += holeMoney[s] })

    // A pot still alive at the partnership swap dies unless carrying is enabled.
    if (!settings.carryAcrossSegments && (hole === 6 || hole === 12)) carryOut = 0
    carry = carryOut

    holes.push({
      hole, par, strokeIndex: si, teams, gross: [...entry.strokes], shots,
      points: holePoints, teamPoints,
      winner, settled, events, carryIn, carryOut, money: holeMoney,
    })
  }

  return {
    holes,
    skins,
    totalSkins: skins.map((s) => SKIN_TYPES.reduce((n, t) => n + s[t], 0)),
    points,
    money,
    carry,
    holesPlayed,
  }
}

function push(
  events: SkinEvent[], type: SkinType, team: Team, bySlot: Slot, settings: RoundSettings,
) {
  if (settings.oneSkinPerTeamPerCategory && events.some((e) => e.type === type && e.team === team)) {
    return
  }
  events.push({ type, team, skins: 1, bySlot })
}

const zeroSkins = (): Record<SkinType, number> =>
  ({ hole: 0, birdie: 0, sandie: 0, ctp: 0, longDrive: 0 })

export interface Payment { from: number; to: number; cents: number }

/** Net a set of balances into the fewest payments that settle them. */
export function settle(money: number[]): Payment[] {
  const debtors = money.map((c, i) => ({ i, c })).filter((x) => x.c < 0)
    .sort((a, b) => a.c - b.c)
  const creditors = money.map((c, i) => ({ i, c })).filter((x) => x.c > 0)
    .sort((a, b) => b.c - a.c)

  const payments: Payment[] = []
  let d = 0, c = 0
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(-debtors[d].c, creditors[c].c)
    if (amount > 0) payments.push({ from: debtors[d].i, to: creditors[c].i, cents: amount })
    debtors[d].c += amount
    creditors[c].c -= amount
    if (debtors[d].c === 0) d++
    if (creditors[c].c === 0) c++
  }
  return payments
}

/** Sum several rounds' per-slot money into one weekend ledger. */
export function combineMoney(rounds: number[][]): number[] {
  return rounds.reduce((acc, r) => acc.map((v, i) => v + (r[i] ?? 0)), [0, 0, 0, 0])
}

export const formatMoney = (cents: number): string => {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}$${(abs / 100).toFixed(abs % 100 === 0 ? 0 : 2)}`
}

/** A valid stroke index row is a permutation of 1..18. */
export function validateStrokeIndex(index: number[]): string | null {
  if (index.length !== 18) return 'Need all 18 holes'
  const seen = new Set(index)
  if (seen.size !== 18) return 'Each stroke index 1-18 must appear exactly once'
  for (let i = 1; i <= 18; i++) if (!seen.has(i)) return `Stroke index ${i} is missing`
  return null
}

export function validatePars(pars: number[]): string | null {
  if (pars.length !== 18) return 'Need all 18 holes'
  if (pars.some((p) => p < 3 || p > 6)) return 'Pars must be between 3 and 6'
  return null
}
