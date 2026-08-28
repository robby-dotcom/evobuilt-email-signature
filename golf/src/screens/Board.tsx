import { useMemo } from 'react'
import {
  computeRound, formatMoney, SKIN_LABELS, SKIN_TYPES, type Slot,
} from '../lib/scoring'
import type { LocalRound } from '../lib/store'
import { Card, TEAM_STYLE } from '../components/ui'

export default function Board({ round, onHole }: { round: LocalRound; onHole: (h: number) => void }) {
  const totals = useMemo(
    () => computeRound(round.course, round.players, round.entries, round.settings),
    [round],
  )
  const slots: Slot[] = [0, 1, 2, 3]
  const name = (s: Slot) => round.players[s]?.name || `P${s + 1}`
  const ranked = [...slots].sort((a, b) => totals.money[b] - totals.money[a])

  return (
    <div className="space-y-3 p-3 pb-24">
      <Card className="overflow-hidden">
        <h2 className="border-b border-line px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
          Money · through {totals.holesPlayed} hole{totals.holesPlayed === 1 ? '' : 's'}
        </h2>
        <ul className="divide-y divide-line">
          {ranked.map((slot) => (
            <li key={slot} className="flex items-center gap-3 px-3 py-3">
              <span className="text-base font-bold">{name(slot)}</span>
              <span className="rounded-md bg-surface-2 px-2 py-1 text-xs font-bold text-ink tnum">
                {totals.points[slot]} pts · {totals.totalSkins[slot]} skins
              </span>
              <span
                className={`ml-auto text-xl font-black tnum ${
                  totals.money[slot] > 0 ? 'text-team-a'
                    : totals.money[slot] < 0 ? 'text-coral' : 'text-ink-faint'
                }`}
              >
                {formatMoney(totals.money[slot])}
              </span>
            </li>
          ))}
        </ul>
        {totals.carry > 0 && (
          <p className="bg-gold-wash px-3 py-2 text-sm font-bold text-gold tnum">
            {totals.carry} skin{totals.carry === 1 ? '' : 's'} carried and still live
          </p>
        )}
      </Card>

      <Card className="overflow-hidden">
        <h2 className="border-b border-line px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
          Where the skins came from
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-3 py-2 font-semibold">Skin</th>
                {slots.map((s) => (
                  <th key={s} className="px-2 py-2 text-right font-semibold">{name(s)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {SKIN_TYPES.map((type) => (
                <tr key={type}>
                  <td className="px-3 py-2 font-semibold text-ink">{SKIN_LABELS[type]}</td>
                  {slots.map((s) => (
                    <td key={s} className="px-2 py-2 text-right tnum">
                      {totals.skins[s][type] || <span className="text-ink-faint">–</span>}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-surface-2 font-bold">
                <td className="px-3 py-2">Total</td>
                {slots.map((s) => (
                  <td key={s} className="px-2 py-2 text-right tnum">{totals.totalSkins[s]}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <h2 className="border-b border-line px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
          Card
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-faint">
                <th className="px-2 py-2 text-left font-semibold">Hole</th>
                <th className="px-1 py-2 text-right font-semibold">Par</th>
                {slots.map((s) => (
                  <th key={s} className="px-1 py-2 text-right font-semibold">
                    {name(s).slice(0, 4)}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-semibold">Won</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {totals.holes.map((h) => (
                <tr
                  key={h.hole}
                  onClick={() => onHole(h.hole)}
                  className={`cursor-pointer active:bg-surface-2 ${h.settled ? '' : 'text-ink-faint'}`}
                >
                  <td className="px-2 py-1.5 font-bold tnum">{h.hole}</td>
                  <td className="px-1 py-1.5 text-right text-ink-soft tnum">{h.par}</td>
                  {slots.map((s) => (
                    <td key={s} className="px-1 py-1.5 text-right tnum">
                      {h.gross[s] ?? <span className="text-ink-faint">·</span>}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right">
                    {h.winner == null
                      ? <span className="text-ink-faint">–</span>
                      : <span className={`font-bold ${TEAM_STYLE[h.winner].text}`}>
                          {name(h.teams[h.winner][0]).slice(0, 3)}/{name(h.teams[h.winner][1]).slice(0, 3)}
                        </span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
