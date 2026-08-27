import { useMemo } from 'react'
import { computeRound, formatMoney, settle, combineMoney, type Slot } from '../lib/scoring'
import type { LocalRound } from '../lib/store'
import { Card, Empty } from '../components/ui'

/**
 * Two ledgers: this round, and every round sharing the series code. The weekend
 * one is what actually gets paid, so it leads.
 */
export default function Settle({ round, series }: { round: LocalRound; series: LocalRound[] }) {
  const slots: Slot[] = [0, 1, 2, 3]
  const name = (s: Slot) => round.players[s]?.name || `P${s + 1}`

  const thisRound = useMemo(
    () => computeRound(round.course, round.players, round.entries, round.settings).money,
    [round],
  )

  // Players are matched by name so a round entered in a different seat still nets
  // correctly across the weekend.
  const weekend = useMemo(() => {
    const key = (n: string) => n.trim().toLowerCase()
    const order = round.players.map((p) => key(p.name))
    const rounds = series.map((r) => {
      const money = computeRound(r.course, r.players, r.entries, r.settings).money
      const mapped = [0, 0, 0, 0]
      r.players.forEach((p, i) => {
        const at = order.indexOf(key(p.name))
        if (at >= 0) mapped[at] += money[i]
      })
      return mapped
    })
    return combineMoney(rounds)
  }, [series, round.players])

  const weekendPayments = settle(weekend)

  return (
    <div className="space-y-3 p-3 pb-24">
      <Card className="overflow-hidden">
        <h2 className="border-b border-line bg-team-a px-3 py-2 text-sm font-bold uppercase tracking-wide text-white">
          Weekend · {series.length} round{series.length === 1 ? '' : 's'}
        </h2>
        <ul className="divide-y divide-line">
          {[...slots].sort((a, b) => weekend[b] - weekend[a]).map((slot) => (
            <li key={slot} className="flex items-center px-3 py-3">
              <span className="text-base font-bold">{name(slot)}</span>
              <span className={`ml-auto text-2xl font-black tnum ${
                weekend[slot] > 0 ? 'text-team-a'
                  : weekend[slot] < 0 ? 'text-coral' : 'text-ink-faint'
              }`}>
                {formatMoney(weekend[slot])}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="overflow-hidden">
        <h2 className="border-b border-line px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
          Who pays who
        </h2>
        {weekendPayments.length === 0 ? (
          <Empty title="All square">Nothing owed either way.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {weekendPayments.map((p, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-3">
                <span className="text-base font-bold text-coral">{name(p.from as Slot)}</span>
                <span className="text-sm text-ink-faint">pays</span>
                <span className="text-base font-bold text-team-a">{name(p.to as Slot)}</span>
                <span className="ml-auto text-xl font-black tnum">{formatMoney(p.cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden">
        <h2 className="border-b border-line px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
          This round only
        </h2>
        <ul className="divide-y divide-line">
          {slots.map((slot) => (
            <li key={slot} className="flex items-center px-3 py-2 text-sm">
              <span className="font-semibold">{name(slot)}</span>
              <span className="ml-auto font-bold tnum">{formatMoney(thisRound[slot])}</span>
            </li>
          ))}
        </ul>
      </Card>

      {series.length > 1 && (
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
            Round by round
          </h2>
          <ul className="divide-y divide-line">
            {series.map((r) => {
              const m = computeRound(r.course, r.players, r.entries, r.settings)
              return (
                <li key={r.code} className="px-3 py-2">
                  <p className="text-sm font-bold">
                    {r.course.name}
                    <span className="ml-2 font-medium text-ink-faint">
                      {r.playedOn} · {m.holesPlayed}/18
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft tnum">
                    {r.players.map((p, i) => `${p.name} ${formatMoney(m.money[i])}`).join(' · ')}
                  </p>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
