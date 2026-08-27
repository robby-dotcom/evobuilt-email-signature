import { useMemo } from 'react'
import {
  computeRound, formatMoney, segmentOf, SKIN_LABELS,
  type HoleEntry, type Slot,
} from '../lib/scoring'
import type { LocalRound } from '../lib/store'
import { Button, Card, TEAM_STYLE } from '../components/ui'

interface Props {
  round: LocalRound
  hole: number
  onHole: (hole: number) => void
  onEntry: (hole: number, entry: HoleEntry) => void
  onBoard: () => void
}

export default function Play({ round, hole, onHole, onEntry, onBoard }: Props) {
  const totals = useMemo(
    () => computeRound(round.course, round.players, round.entries, round.settings),
    [round],
  )
  const result = totals.holes[hole - 1]
  const entry = round.entries[hole - 1]
  const { par, strokeIndex, teams, shots, points } = result

  const set = (patch: Partial<HoleEntry>) => onEntry(hole, { ...entry, ...patch })

  const setScore = (slot: Slot, value: number | null) => {
    const strokes = [...entry.strokes]
    strokes[slot] = value
    set({ strokes })
  }

  const toggleSand = (slot: Slot) => {
    const inSand = [...entry.inSand]
    inSand[slot] = !inSand[slot]
    set({ inSand })
  }

  const teamOf = (slot: Slot) => (teams[0].includes(slot) ? 0 : 1)
  const partnerOf = (slot: Slot) => teams[teamOf(slot)].find((s) => s !== slot)!
  const name = (slot: Slot) => round.players[slot]?.name || `P${slot + 1}`

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="flex items-baseline justify-between px-4 pt-3">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-black tnum">{hole}</span>
            <span className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Par {par} · SI {strokeIndex}
            </span>
          </div>
          {result.carryIn > 0 && (
            <span className="rounded-full bg-amber-500 px-3 py-1 text-sm font-bold text-white tnum">
              carry {result.carryIn}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 px-4 pb-2 pt-1 text-sm font-bold">
          <span className={TEAM_STYLE[0].text}>
            {name(teams[0][0])} &amp; {name(teams[0][1])}
          </span>
          <span className="text-slate-400">v</span>
          <span className={TEAM_STYLE[1].text}>
            {name(teams[1][0])} &amp; {name(teams[1][1])}
          </span>
          <span className="ml-auto text-xs font-semibold text-slate-400">
            leg {segmentOf(hole) + 1}/3
          </span>
        </div>
      </header>

      <div className="space-y-3 p-3">
        {([0, 1, 2, 3] as Slot[]).map((slot) => {
          const team = teamOf(slot)
          const style = TEAM_STYLE[team]
          const gross = entry.strokes[slot]
          const isBirdie = gross != null && gross < par
          const isSandie = entry.inSand[slot] && gross != null && gross <= par
          return (
            <Card key={slot} className={`overflow-hidden ${gross == null ? 'opacity-95' : ''}`}>
              <div className={`flex items-center gap-2 px-3 py-2 ${style.soft}`}>
                <span className={`text-base font-bold ${style.text}`}>{name(slot)}</span>
                <span className="text-xs font-medium text-slate-500 tnum">
                  h/cap {round.players[slot]?.handicap ?? 0}
                  {shots[slot] !== 0 && ` · ${shots[slot] > 0 ? '+' : ''}${shots[slot]} shot${
                    Math.abs(shots[slot]) === 1 ? '' : 's'}`}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {isBirdie && <Tag tone="emerald">birdie</Tag>}
                  {isSandie && <Tag tone="amber">sandie</Tag>}
                  <span className="rounded-lg bg-slate-900 px-2 py-1 text-sm font-bold text-white tnum">
                    {points[slot]} pt{points[slot] === 1 ? '' : 's'}
                  </span>
                </span>
              </div>

              <div className="flex gap-1 px-2 py-2">
                {scoreChoices(par, gross).map((value) => (
                  <button
                    key={value}
                    data-testid={`score-${slot}-${value}`}
                    onClick={() => setScore(slot, gross === value ? null : value)}
                    className={`h-12 flex-1 rounded-lg text-lg font-bold tnum ${
                      gross === value
                        ? `${style.bg} text-white`
                        : 'bg-slate-100 text-slate-700 active:bg-slate-200'
                    }`}
                  >
                    {value}
                  </button>
                ))}
                <button
                  onClick={() => setScore(slot, (gross ?? par + 3) + 1)}
                  aria-label={`Worse score for ${name(slot)}`}
                  className="h-12 w-11 rounded-lg bg-slate-100 text-lg font-bold text-slate-500 active:bg-slate-200"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => toggleSand(slot)}
                className={`flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-sm font-semibold ${
                  entry.inSand[slot] ? 'bg-amber-50 text-amber-800' : 'text-slate-400'
                }`}
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 ${
                  entry.inSand[slot] ? 'border-amber-600 bg-amber-500 text-white' : 'border-slate-300'
                }`}>
                  {entry.inSand[slot] ? '✓' : ''}
                </span>
                out of a bunker
                {entry.inSand[slot] && gross != null && gross > par && (
                  <span className="ml-auto text-xs font-medium text-slate-500">
                    no sandie — needs par
                  </span>
                )}
              </button>
            </Card>
          )
        })}

        {par === 3 && (
          <Picker
            label="Closest to the pin"
            names={round.players.map((p, i) => p.name || `P${i + 1}`)}
            value={entry.ctpSlot}
            onChange={(v) => set({ ctpSlot: v })}
            teamOf={teamOf}
          />
        )}
        {par === 5 && (
          <Picker
            label="Long drive"
            names={round.players.map((p, i) => p.name || `P${i + 1}`)}
            value={entry.longDriveSlot}
            onChange={(v) => set({ longDriveSlot: v })}
            teamOf={teamOf}
          />
        )}

        <Outcome
          result={result}
          names={([0, 1, 2, 3] as Slot[]).map(name)}
          partnerOf={partnerOf}
          stake={round.settings.stakeCents}
        />
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 flex gap-2 border-t border-slate-200 bg-white px-3 pt-2 safe-b">
        <Button variant="subtle" onClick={() => onHole(hole - 1)} disabled={hole === 1} className="flex-1">
          ←
        </Button>
        <button
          onClick={onBoard}
          aria-label="Board"
          className="flex flex-1 flex-col items-center justify-center rounded-xl px-1 active:bg-slate-100"
        >
          <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
            through {totals.holesPlayed} · board ›
          </span>
          <span className="text-sm font-bold tnum">
            {([0, 1, 2, 3] as Slot[]).map((s) => formatMoney(totals.money[s])).join(' · ')}
          </span>
        </button>
        <Button onClick={() => onHole(hole + 1)} disabled={hole === 18} className="flex-1">
          →
        </Button>
      </nav>
    </div>
  )
}

/** Scores worth one tap: eagle through triple, plus whatever is already entered. */
function scoreChoices(par: number, gross: number | null): number[] {
  const base = [par - 2, par - 1, par, par + 1, par + 2, par + 3].filter((v) => v >= 1)
  if (gross != null && !base.includes(gross)) return [...base.slice(1), gross].sort((a, b) => a - b)
  return base
}

function Tag({ tone, children }: { tone: 'emerald' | 'amber'; children: React.ReactNode }) {
  const map = { emerald: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800' }
  return <span className={`rounded px-1.5 py-0.5 text-[0.65rem] font-bold uppercase ${map[tone]}`}>
    {children}
  </span>
}

function Picker({ label, names, value, onChange, teamOf }: {
  label: string
  names: string[]
  value: Slot | null
  onChange: (v: Slot | null) => void
  teamOf: (s: Slot) => number
}) {
  return (
    <Card className="p-3">
      <p className="mb-2 text-sm font-bold text-slate-700">{label}</p>
      <div className="flex gap-1">
        {([0, 1, 2, 3] as Slot[]).map((slot) => (
          <button
            key={slot}
            data-testid={`pick-${slot}`}
            onClick={() => onChange(value === slot ? null : slot)}
            className={`h-12 flex-1 truncate rounded-lg px-1 text-sm font-bold ${
              value === slot
                ? `${TEAM_STYLE[teamOf(slot)].bg} text-white`
                : 'bg-slate-100 text-slate-700 active:bg-slate-200'
            }`}
          >
            {names[slot]}
          </button>
        ))}
      </div>
    </Card>
  )
}

function Outcome({ result, names, partnerOf, stake }: {
  result: ReturnType<typeof computeRound>['holes'][number]
  names: string[]
  partnerOf: (s: Slot) => Slot
  stake: number
}) {
  if (!result.settled) {
    return (
      <p className="py-2 text-center text-sm font-medium text-slate-400">
        Enter all four scores to settle the hole
      </p>
    )
  }

  const skins = result.events.reduce((n, e) => n + e.skins, 0)
  if (result.events.length === 0) {
    return (
      <Card className="bg-slate-50 p-3 text-center text-sm font-bold text-slate-600">
        <span data-testid="outcome">Halved — nothing on it</span>
      </Card>
    )
  }

  const byTeam = [0, 1].map((t) =>
    result.events.filter((e) => e.team === t).reduce((n, e) => n + e.skins, 0))
  const lead = byTeam[0] === byTeam[1] ? null : byTeam[0] > byTeam[1] ? 0 : 1

  return (
    <Card className="overflow-hidden">
      <div data-testid="outcome"
        className={`px-3 py-2 text-white ${lead == null ? 'bg-slate-500' : TEAM_STYLE[lead].bg}`}>
        <p className="text-base font-bold">
          {lead == null
            ? 'Skins wash — nobody moves'
            : `${names[result.teams[lead][0]]} & ${names[result.teams[lead][1]]} · +${
                formatMoney(Math.abs(result.money[result.teams[lead][0]]))}`}
        </p>
      </div>
      <ul className="divide-y divide-slate-100">
        {result.events.map((ev, i) => (
          <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${TEAM_STYLE[ev.team].bg}`} />
            <span className="font-semibold">{SKIN_LABELS[ev.type]}</span>
            <span className="text-slate-500">
              {ev.bySlot != null
                ? `${names[ev.bySlot]} (+ ${names[partnerOf(ev.bySlot)]})`
                : `${names[result.teams[ev.team][0]]} & ${names[result.teams[ev.team][1]]}`}
            </span>
            <span className="ml-auto font-bold tnum">
              {ev.skins} skin{ev.skins === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
      <p className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500 tnum">
        {skins} skin{skins === 1 ? '' : 's'} at {formatMoney(stake)} each
        {result.carryOut > 0 && ` · ${result.carryOut} carried to the next hole`}
      </p>
    </Card>
  )
}
