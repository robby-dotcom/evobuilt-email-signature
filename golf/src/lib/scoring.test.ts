import { describe, it, expect } from 'vitest'
import { strokesReceived, stablefordPoints, SLOTS, type Slot } from './stableford'
import {
  computeRound, teamsForHole, settle, validateStrokeIndex, validatePars,
  emptyHole, DEFAULT_SETTINGS, formatMoney,
  type Course, type Player, type HoleEntry, type RoundSettings,
} from './scoring'

/** Par 72 with six 3s, six 4s and six 5s — the Ocean Shores shape. */
const COURSE: Course = {
  name: 'Test 6/6/6',
  pars: [4, 3, 5, 4, 3, 5, 4, 3, 5, 4, 3, 5, 4, 3, 5, 4, 3, 5],
  strokeIndex: [1, 3, 5, 7, 9, 11, 13, 15, 17, 2, 4, 6, 8, 10, 12, 14, 16, 18],
}

const scratch = (): Player[] =>
  ['P1', 'P2', 'P3', 'P4'].map((name) => ({ name, handicap: 0 }))

const blank = (): HoleEntry[] => Array.from({ length: 18 }, emptyHole)

/** Fill a hole with gross scores, leaving the rest untouched. */
function play(entries: HoleEntry[], hole: number, strokes: number[], extra: Partial<HoleEntry> = {}) {
  entries[hole - 1] = { ...emptyHole(), strokes: [...strokes], ...extra }
}

/** Every hole halved in regulation, so nothing is owed. */
function allSquare(entries: HoleEntry[]) {
  for (let h = 1; h <= 18; h++) play(entries, h, Array(4).fill(COURSE.pars[h - 1]))
}

describe('handicap stroke allocation', () => {
  it('gives an 18 marker a shot on every hole', () => {
    for (let si = 1; si <= 18; si++) expect(strokesReceived(18, si)).toBe(1)
  })

  it('gives a 9 marker shots on stroke index 1-9 only', () => {
    for (let si = 1; si <= 9; si++) expect(strokesReceived(9, si)).toBe(1)
    for (let si = 10; si <= 18; si++) expect(strokesReceived(9, si)).toBe(0)
  })

  it('gives a 22 marker two shots on the hardest four', () => {
    for (let si = 1; si <= 4; si++) expect(strokesReceived(22, si)).toBe(2)
    for (let si = 5; si <= 18; si++) expect(strokesReceived(22, si)).toBe(1)
  })

  it('takes shots back from a plus marker on the easiest holes', () => {
    expect(strokesReceived(-2, 18)).toBe(-1)
    expect(strokesReceived(-2, 17)).toBe(-1)
    expect(strokesReceived(-2, 16)).toBe(0)
    expect(strokesReceived(-2, 1)).toBe(0)
  })

  it('gives a scratch player nothing', () => {
    for (let si = 1; si <= 18; si++) expect(strokesReceived(0, si)).toBe(0)
  })
})

describe('stableford points', () => {
  it('scores the standard bands off par 4', () => {
    expect(stablefordPoints(7, 4, 0)).toBe(0)  // triple
    expect(stablefordPoints(6, 4, 0)).toBe(0)  // double
    expect(stablefordPoints(5, 4, 0)).toBe(1)  // bogey
    expect(stablefordPoints(4, 4, 0)).toBe(2)  // par
    expect(stablefordPoints(3, 4, 0)).toBe(3)  // birdie
    expect(stablefordPoints(2, 4, 0)).toBe(4)  // eagle
    expect(stablefordPoints(1, 4, 0)).toBe(5)  // albatross
  })

  it('applies shots received', () => {
    expect(stablefordPoints(5, 4, 1)).toBe(2)  // net par
    expect(stablefordPoints(6, 4, 2)).toBe(2)
  })

  it('wipes a hole with no score', () => {
    expect(stablefordPoints(null, 4, 3)).toBe(0)
  })
})

describe('6-6-6 rotation', () => {
  it('pairs 1&2 v 3&4 for the first six', () => {
    for (const h of [1, 6]) expect(teamsForHole(h)).toEqual([[0, 1], [2, 3]])
  })
  it('pairs 1&3 v 2&4 for the middle six', () => {
    for (const h of [7, 12]) expect(teamsForHole(h)).toEqual([[0, 2], [1, 3]])
  })
  it('pairs 1&4 v 2&3 for the last six', () => {
    for (const h of [13, 18]) expect(teamsForHole(h)).toEqual([[0, 3], [1, 2]])
  })
  it('gives every player each partner exactly once', () => {
    const partners = new Map<Slot, Slot[]>(SLOTS.map((s) => [s, []]))
    for (const h of [1, 7, 13]) {
      for (const pair of teamsForHole(h)) {
        partners.get(pair[0])!.push(pair[1])
        partners.get(pair[1])!.push(pair[0])
      }
    }
    for (const s of SLOTS) {
      expect([...partners.get(s)!].sort()).toEqual(SLOTS.filter((o) => o !== s))
    }
  })
})

describe('winning a hole', () => {
  it('awards it to the HIGHEST stableford points, not the lowest', () => {
    // Regression guard: gross better-ball is lowest-wins, stableford is highest-wins.
    // Getting this backwards pays the wrong team on all 18 holes and looks plausible.
    const e = blank()
    allSquare(e)
    play(e, 1, [3, 4, 4, 4])          // P1 birdies par 4 -> 3 pts v 2 pts
    const r = computeRound(COURSE, scratch(), e)
    expect(r.holes[0].teamPoints).toEqual([3, 2])
    expect(r.holes[0].winner).toBe(0)
    expect(r.money[0]).toBeGreaterThan(0)
    expect(r.money[2]).toBeLessThan(0)
  })

  it('uses the better ball of the pair, not the worse', () => {
    const e = blank()
    allSquare(e)
    play(e, 1, [8, 3, 4, 4])          // P1 wipes, P2 birdies -> team still 3 pts
    const r = computeRound(COURSE, scratch(), e)
    expect(r.holes[0].teamPoints).toEqual([3, 2])
    expect(r.holes[0].winner).toBe(0)
  })

  it('halves the hole on equal points', () => {
    const e = blank()
    allSquare(e)
    const r = computeRound(COURSE, scratch(), e)
    expect(r.holes[0].winner).toBeNull()
    expect(r.money).toEqual([0, 0, 0, 0])
  })

  it('leaves a hole unsettled until all four scores are in', () => {
    const e = blank()
    play(e, 1, [4, 4, 4, null as unknown as number])
    const r = computeRound(COURSE, scratch(), e)
    expect(r.holes[0].settled).toBe(false)
    expect(r.holesPlayed).toBe(0)
  })
})

describe('carryover', () => {
  it('rolls a halved hole into the next', () => {
    const e = blank()
    allSquare(e)
    play(e, 3, [3, 4, 4, 4])          // win after two halves
    const r = computeRound(COURSE, scratch(), e)
    expect(r.holes[0].carryOut).toBe(1)
    expect(r.holes[1].carryOut).toBe(2)
    const holeWin = r.holes[2].events.find((ev) => ev.type === 'hole')!
    expect(holeWin.skins).toBe(3)
    expect(r.holes[2].money[0]).toBe(3 * 500)
    expect(r.holes[2].money[2]).toBe(-3 * 500)
    expect(r.holes[2].carryOut).toBe(0)
  })

  it('carries across the partnership swap by default', () => {
    const e = blank()
    allSquare(e)
    play(e, 7, [3, 4, 4, 4])
    const r = computeRound(COURSE, scratch(), e)
    expect(r.holes[6].carryIn).toBe(6)
    expect(r.holes[6].events.find((ev) => ev.type === 'hole')!.skins).toBe(7)
  })

  it('kills the pot at the swap when carrying is disabled', () => {
    const settings: RoundSettings = { ...DEFAULT_SETTINGS, carryAcrossSegments: false }
    const e = blank()
    allSquare(e)
    play(e, 7, [3, 4, 4, 4])
    const r = computeRound(COURSE, scratch(), e, settings)
    expect(r.holes[5].carryOut).toBe(0)
    expect(r.holes[6].carryIn).toBe(0)
    expect(r.holes[6].events.find((ev) => ev.type === 'hole')!.skins).toBe(1)
  })

  it('still pays junk on a halved hole', () => {
    const e = blank()
    allSquare(e)
    // Hole 2, par 3: both sides make 2, so the hole is halved, but P1 is closest.
    play(e, 2, [2, 3, 2, 3], { ctpSlot: 0 })
    const r = computeRound(COURSE, scratch(), e)
    expect(r.holes[1].winner).toBeNull()
    expect(r.holes[1].carryOut).toBe(2)   // hole 1 halved too
    const junk = r.holes[1].events.filter((ev) => ev.type !== 'hole')
    expect(junk.map((ev) => ev.type).sort()).toEqual(['birdie', 'birdie', 'ctp'])
    // Both teams birdied, so the birdies wash; the closest-to-pin decides the money.
    expect(r.holes[1].money[0]).toBe(500)
    expect(r.holes[1].money[2]).toBe(-500)
  })
})

describe('junk is gross, not net', () => {
  it('does not pay a birdie skin for a net birdie', () => {
    const e = blank()
    play(e, 1, [4, 4, 4, 4])          // par 4, everyone makes 4; rest of card unplayed
    const players = scratch()
    players[0].handicap = 18          // P1 has a shot: net 3, worth 3 points
    const r = computeRound(COURSE, players, e)
    expect(r.holes[0].points[0]).toBe(3)
    expect(r.holes[0].winner).toBe(0)                       // wins the hole on net
    expect(r.holes[0].events.some((ev) => ev.type === 'birdie')).toBe(false)
    expect(r.skins[0].hole).toBe(1)
    expect(r.skins[0].birdie).toBe(0)
  })

  it('pays a birdie skin for a real birdie', () => {
    const e = blank()
    allSquare(e)
    play(e, 1, [3, 4, 4, 4])
    const r = computeRound(COURSE, scratch(), e)
    expect(r.skins[0].birdie).toBe(1)
    expect(r.skins[1].birdie).toBe(1)   // partner collects too
    expect(r.skins[2].birdie).toBe(0)
  })
})

describe('sandies', () => {
  const withSand = (slot: number) => {
    const inSand = [false, false, false, false]
    inSand[slot] = true
    return inSand
  }

  it('pays for an up and down to par from a bunker', () => {
    const e = blank()
    allSquare(e)
    play(e, 1, [4, 4, 4, 4], { inSand: withSand(0) })
    const r = computeRound(COURSE, scratch(), e)
    expect(r.skins[0].sandie).toBe(1)
    expect(r.skins[1].sandie).toBe(1)
  })

  it('pays nothing for a bogey out of sand', () => {
    const e = blank()
    allSquare(e)
    play(e, 1, [5, 5, 4, 4], { inSand: withSand(0) })
    const r = computeRound(COURSE, scratch(), e)
    expect(r.skins[0].sandie).toBe(0)
  })
})

describe('closest to pin and long drive', () => {
  it('only counts closest to pin on a par 3', () => {
    const e = blank()
    allSquare(e)
    play(e, 1, [4, 4, 4, 4], { ctpSlot: 0 })   // hole 1 is a par 4
    play(e, 2, [3, 3, 3, 3], { ctpSlot: 0 })   // hole 2 is a par 3
    const r = computeRound(COURSE, scratch(), e)
    expect(r.holes[0].events.some((ev) => ev.type === 'ctp')).toBe(false)
    expect(r.holes[1].events.some((ev) => ev.type === 'ctp')).toBe(true)
    expect(r.skins[0].ctp).toBe(1)
  })

  it('only counts long drive on a par 5', () => {
    const e = blank()
    allSquare(e)
    play(e, 1, [4, 4, 4, 4], { longDriveSlot: 0 })   // par 4
    play(e, 3, [5, 5, 5, 5], { longDriveSlot: 0 })   // par 5
    const r = computeRound(COURSE, scratch(), e)
    expect(r.holes[0].events.some((ev) => ev.type === 'longDrive')).toBe(false)
    expect(r.holes[2].events.some((ev) => ev.type === 'longDrive')).toBe(true)
    expect(r.skins[0].longDrive).toBe(1)
  })
})

describe('two birdies on one team', () => {
  const e = () => {
    const x = blank()
    allSquare(x)
    play(x, 1, [3, 3, 4, 4])
    return x
  }

  it('pays one skin by default', () => {
    const r = computeRound(COURSE, scratch(), e())
    expect(r.skins[0].birdie).toBe(1)
  })

  it('pays two when configured that way', () => {
    const r = computeRound(COURSE, scratch(), e(),
      { ...DEFAULT_SETTINGS, oneSkinPerTeamPerCategory: false })
    expect(r.skins[0].birdie).toBe(2)
  })
})

describe('the ledger', () => {
  it('gives both winners a skin each and charges both losers', () => {
    const e = blank()
    // Par 5, no carry in front of it: team A wins the hole, P1 birdies and
    // wins long drive -> 3 skins, each worth $5 to both winners.
    play(e, 3, [4, 5, 5, 5], { longDriveSlot: 0 })
    const r = computeRound(COURSE, scratch(), e)
    expect(r.holes[2].events).toHaveLength(3)
    expect(r.holes[2].events.every((ev) => ev.skins === 1)).toBe(true)
    expect(r.money).toEqual([1500, 1500, -1500, -1500])
    expect(formatMoney(r.money[0])).toBe('$15')
    expect(formatMoney(r.money[2])).toBe('-$15')
  })

  it('always sums to zero across a randomised round', () => {
    let seed = 20260828
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed % n
    }
    for (let trial = 0; trial < 200; trial++) {
      const e = blank()
      const players = scratch().map((p, i) => ({ ...p, handicap: [0, 7, 14, 24][i] }))
      for (let h = 1; h <= 18; h++) {
        const par = COURSE.pars[h - 1]
        const inSand = [0, 1, 2, 3].map(() => rand(4) === 0)
        play(e, h, [0, 1, 2, 3].map(() => par - 1 + rand(4)), {
          inSand,
          ctpSlot: par === 3 && rand(3) > 0 ? (rand(4) as Slot) : null,
          longDriveSlot: par === 5 && rand(3) > 0 ? (rand(4) as Slot) : null,
        })
      }
      const r = computeRound(COURSE, players, e)
      expect(r.money.reduce((a, b) => a + b, 0)).toBe(0)
      expect(settle(r.money).reduce((a, p) => a + p.cents, 0))
        .toBe(r.money.filter((c) => c > 0).reduce((a, b) => a + b, 0))
    }
  })

  it('recomputes cleanly when an early hole is corrected late', () => {
    const e = blank()
    allSquare(e)
    play(e, 1, [3, 4, 4, 4])
    play(e, 17, [2, 3, 3, 3])
    const before = computeRound(COURSE, scratch(), e)
    expect(before.money[0]).toBeGreaterThan(0)

    play(e, 1, [4, 4, 4, 3])           // hole 1 was mistyped: the other side won it
    const after = computeRound(COURSE, scratch(), e)
    expect(after.money.reduce((a, b) => a + b, 0)).toBe(0)
    expect(after.money[0]).toBeLessThan(before.money[0])
    expect(after.holes[0].winner).toBe(1)
  })
})

describe('settlement', () => {
  it('nets balances into payments that clear them', () => {
    const payments = settle([3000, 1000, -2500, -1500])
    for (const p of payments) expect(p.cents).toBeGreaterThan(0)
    const net = [0, 0, 0, 0]
    for (const p of payments) { net[p.from] -= p.cents; net[p.to] += p.cents }
    expect(net).toEqual([3000, 1000, -2500, -1500])
  })

  it('returns nothing when everyone is square', () => {
    expect(settle([0, 0, 0, 0])).toEqual([])
  })
})

describe('course card validation', () => {
  it('accepts a real stroke index', () => {
    expect(validateStrokeIndex(COURSE.strokeIndex)).toBeNull()
    expect(validatePars(COURSE.pars)).toBeNull()
  })

  it('rejects a duplicated stroke index', () => {
    const bad = [...COURSE.strokeIndex]
    bad[5] = bad[4]
    expect(validateStrokeIndex(bad)).toMatch(/exactly once/)
  })

  it('rejects a short card', () => {
    expect(validateStrokeIndex([1, 2, 3])).toMatch(/18 holes/)
    expect(validatePars([4, 4, 4])).toMatch(/18 holes/)
  })

  it('rejects a nonsense par', () => {
    const bad = [...COURSE.pars]
    bad[0] = 9
    expect(validatePars(bad)).toMatch(/between 3 and 6/)
  })
})
