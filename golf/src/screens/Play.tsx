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
      <header className="sticky top-0 z-20 border-b border-line bg-surface">
        <div className="flex items-center gap-3 px-4 pt-3">
          <span className="display text-5xl font-black leading-none">{hole}</span>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-widest text-ink-faint tnum">
              Par {par} · Index {strokeIndex}
            </span>
            <span className="text-xs font-semibold text-ink-faint">
              leg {segmentOf(hole) + 1} of 3
            </span>
          </div>
          {result.carryIn > 0 && (
            <span className="pop ml-auto rounded-full bg-gold px-3 py-1.5 text-sm font-black text-surface tnum">
              +{result.carryIn} carried
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 px-4 pb-2 pt-2 text-sm font-bold">
          <span className={`flex items-center gap-1.5 ${TEAM_STYLE[0].text}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${TEAM_STYLE[0].bg}`} />
            {name(teams[0][0])} &amp; {name(teams[0][1])}
          </span>
          <span className="text-ink-faint">v</span>
          <span className={`flex items-center gap-1.5 ${TEAM_STYLE[1].text}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${TEAM_STYLE[1].bg}`} />
            {name(teams[1][0])} &amp; {name(teams[1][1])}
          </span>
        </div>

        {/* Where you are, what is left, and who took what — one tap per hole. */}
        <div className="flex gap-[3px] px-3 pb-2">
          {totals.holes.map((h) => (
            <button
              key={h.hole}
              onClick={() => onHole(h.hole)}
              aria-label={`Hole ${h.hole}`}
              className={`h-1.5 flex-1 rounded-full transition-[background-color] ${
                h.hole === hole ? 'bg-ink'
                  : h.winner === 0 ? TEAM_STYLE[0].bg
                  : h.winner === 1 ? TEAM_STYLE[1].bg
                  : h.settled ? 'bg-ink-faint'
                  : 'bg-line'
              }`}
            />
          ))}
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
                <span className="text-xs font-medium text-ink-soft tnum">
                  h/cap {round.players[slot]?.handicap ?? 0}
                  {shots[slot] !== 0 && ` · ${shots[slot] > 0 ? '+' : ''}${shots[slot]} shot${
                    Math.abs(shots[slot]) === 1 ? '' : 's'}`}
                </span>
                <span className="ml-auto flex items-center gap-1">
                  {isBirdie && <Tag tone="emerald">birdie</Tag>}
                  {isSandie && <Tag tone="amber">sandie</Tag>}
                  <span className="rounded-lg bg-ink px-2 py-1 text-sm font-bold text-white tnum">
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
                    className={`h-14 flex-1 rounded-xl text-xl font-black tnum transition-transform active:scale-95 ${
                      gross === value
                        ? `${style.bg} ${style.on} shadow-sm`
                        : value < par
                          ? 'bg-surface-2 text-team-a ring-1 ring-inset ring-line'
                          : value === par
                            ? 'bg-surface-2 text-ink ring-1 ring-inset ring-ink-faint/40'
                            : 'bg-surface-2 text-ink-soft'
                    }`}
                  >
                    {value}
                  </button>
                ))}
                <button
                  onClick={() => setScore(slot, (gross ?? par + 3) + 1)}
                  aria-label={`Worse score for ${name(slot)}`}
                  className="h-14 w-11 rounded-xl bg-surface-2 text-lg font-bold text-ink-faint active:bg-line"
                >
                  +
                </button>
              </div>

              <button
                onClick={() => toggleSand(slot)}
                className={`flex w-full items-center gap-2 border-t border-line px-3 py-2 text-left text-sm font-semibold ${
                  entry.inSand[slot] ? 'bg-gold-wash text-gold' : 'text-ink-faint'
                }`}
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded border-2 ${
                  entry.inSand[slot] ? 'border-gold bg-gold text-white' : 'border-line'
                }`}>
                  {entry.inSand[slot] ? '✓' : ''}
                </span>
                out of a bunker
                {entry.inSand[slot] && gross != null && gross > par && (
                  <span className="ml-auto text-xs font-medium text-ink-soft">
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

      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-stretch gap-2 border-t border-line bg-surface px-3 pt-2 safe-b">
        <button
          onClick={() => onHole(hole - 1)}
          disabled={hole === 1}
          aria-label="Previous hole"
          className="w-14 shrink-0 rounded-xl bg-surface-2 text-xl font-black text-ink disabled:opacity-30 active:brightness-95"
        >
          ‹
        </button>

        {/* The ledger is the reason anyone is here; tapping it opens the board. */}
        <button
          onClick={onBoard}
          aria-label="Board"
          className="flex min-w-0 flex-1 flex-col justify-center rounded-xl px-2 active:bg-surface-2"
        >
          <span className="text-[0.6rem] font-bold uppercase tracking-widest text-ink-faint">
            through {totals.holesPlayed} · board ›
          </span>
          <span className="flex gap-2 overflow-hidden text-sm font-black tnum">
            {([0, 1, 2, 3] as Slot[]).map((s) => (
              <span key={s} className={totals.money[s] > 0 ? 'text-team-a'
                : totals.money[s] < 0 ? 'text-coral' : 'text-ink-faint'}>
                {formatMoney(totals.money[s])}
              </span>
            ))}
          </span>
        </button>

        <button
          onClick={() => onHole(hole + 1)}
          disabled={hole === 18}
          aria-label="Next hole"
          className="w-20 shrink-0 rounded-xl bg-team-a text-2xl font-black text-team-a-ink disabled:opacity-30 active:brightness-90"
        >
          ›
        </button>
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
  const map = { emerald: 'bg-team-a-wash text-team-a', amber: 'bg-gold-wash text-gold' }
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
      <p className="mb-2 text-sm font-bold text-ink">{label}</p>
      <div className="flex gap-1">
        {([0, 1, 2, 3] as Slot[]).map((slot) => (
          <button
            key={slot}
            data-testid={`pick-${slot}`}
            onClick={() => onChange(value === slot ? null : slot)}
            className={`h-12 flex-1 truncate rounded-lg px-1 text-sm font-bold ${
              value === slot
                ? `${TEAM_STYLE[teamOf(slot)].bg} ${TEAM_STYLE[teamOf(slot)].on}`
                : 'bg-surface-2 text-ink active:bg-line'
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
      <p className="py-2 text-center text-sm font-medium text-ink-faint">
        Enter all four scores to settle the hole
      </p>
    )
  }

  const skins = result.events.reduce((n, e) => n + e.skins, 0)
  if (result.events.length === 0) {
    return (
      <Card className="bg-surface-2 p-3 text-center text-sm font-bold text-ink-soft">
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
        className={`px-3 py-2 text-white ${lead == null ? 'bg-ink-soft' : TEAM_STYLE[lead].bg}`}>
        {lead == null ? (
          <p className="text-base font-bold">Skins wash — nobody moves</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <p className="text-base font-bold">
              {names[result.teams[lead][0]]} &amp; {names[result.teams[lead][1]]}
            </p>
            <p className="display ml-auto text-2xl font-black">
              +{formatMoney(Math.abs(result.money[result.teams[lead][0]]))}
            </p>
          </div>
        )}
      </div>
      <ul className="divide-y divide-line">
        {result.events.map((ev, i) => (
          <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${TEAM_STYLE[ev.team].bg}`} />
            <span className="font-semibold">{SKIN_LABELS[ev.type]}</span>
            <span className="text-ink-soft">
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
      <p className="bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink-soft tnum">
        {skins} skin{skins === 1 ? '' : 's'} at {formatMoney(stake)} each
        {result.carryOut > 0 && ` · ${result.carryOut} carried to the next hole`}
      </p>
    </Card>
  )
}
