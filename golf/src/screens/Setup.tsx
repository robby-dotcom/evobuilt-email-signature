import { useState } from 'react'
import type { Course, Player, RoundSettings } from '../lib/scoring'
import { DEFAULT_SETTINGS } from '../lib/scoring'
import { Button, Card, Field, inputClass } from '../components/ui'

export interface SetupResult {
  course: Course & { id?: string }
  players: Player[]
  seriesCode: string
  settings: RoundSettings
}

export default function Setup({
  courses, onNewCourse, onStart, onCancel, defaultSeries, defaultPlayers,
}: {
  courses: (Course & { id?: string; location?: string })[]
  onNewCourse: () => void
  onStart: (result: SetupResult) => void
  onCancel: () => void
  defaultSeries: string
  defaultPlayers: Player[]
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '')
  const [players, setPlayers] = useState<Player[]>(() =>
    Array.from({ length: 4 }, (_, i) => ({
      name: defaultPlayers[i]?.name ?? '',
      handicap: defaultPlayers[i]?.handicap ?? 0,
    })),
  )
  const [seriesCode, setSeriesCode] = useState(defaultSeries)
  const [stake, setStake] = useState(5)
  const [carry, setCarry] = useState(DEFAULT_SETTINGS.carryAcrossSegments)
  const [oneSkin, setOneSkin] = useState(DEFAULT_SETTINGS.oneSkinPerTeamPerCategory)

  const course = courses.find((c) => c.id === courseId) ?? courses[0]
  const named = players.filter((p) => p.name.trim()).length
  const ready = course != null && named === 4

  const setPlayer = (i: number, patch: Partial<Player>) =>
    setPlayers(players.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  return (
    <div className="space-y-3 p-3 pb-28">
      <Card className="space-y-3 p-3">
        <Field label="Course">
          {courses.length > 0 ? (
            <select className={inputClass} value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => (
                <option key={c.id ?? c.name} value={c.id ?? ''}>
                  {c.name}{c.location ? ` — ${c.location}` : ''}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              No courses yet. Add one from the card — pars and stroke index.
            </p>
          )}
        </Field>
        <Button variant="subtle" onClick={onNewCourse} className="w-full">
          + Add a course
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-3 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Players</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Order sets the draw: {playerName(players, 0)} &amp; {playerName(players, 1)} first,
            then {playerName(players, 0)} &amp; {playerName(players, 2)},
            then {playerName(players, 0)} &amp; {playerName(players, 3)}.
          </p>
        </div>
        <ul className="divide-y divide-slate-100">
          {players.map((p, i) => (
            <li key={i} className="flex items-center gap-2 px-3 py-2">
              <span className="w-5 text-sm font-bold text-slate-400 tnum">{i + 1}</span>
              <input
                className={`${inputClass} flex-1`}
                placeholder={`Player ${i + 1}`}
                value={p.name}
                autoComplete="off"
                onChange={(e) => setPlayer(i, { name: e.target.value })}
              />
              <div className="w-24">
                <input
                  type="number" inputMode="numeric"
                  className={`${inputClass} text-center tnum`}
                  value={p.handicap}
                  onChange={(e) => setPlayer(i, { handicap: Number(e.target.value) || 0 })}
                />
              </div>
            </li>
          ))}
        </ul>
        <p className="bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Playing handicap — the number you'd write on the card, not a GA index.
        </p>
      </Card>

      <Card className="space-y-3 p-3">
        <Field label="Weekend" hint="Rounds sharing this tag add up into one ledger.">
          <input className={inputClass} value={seriesCode} autoComplete="off"
            onChange={(e) => setSeriesCode(e.target.value)} placeholder="Aug long weekend" />
        </Field>
        <Field label="Dollars per skin">
          <input type="number" inputMode="decimal" className={`${inputClass} tnum`} value={stake}
            onChange={(e) => setStake(Number(e.target.value) || 0)} />
        </Field>
        <Toggle checked={carry} onChange={setCarry}
          label="Carry a halved hole past the partner swap"
          hint="Off: any live pot dies at holes 6 and 12." />
        <Toggle checked={oneSkin} onChange={setOneSkin}
          label="Two birdies on a team is one skin"
          hint="Off: each birdie pays separately." />
      </Card>

      <div className="flex gap-2">
        <Button variant="subtle" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button
          className="flex-[2]"
          disabled={!ready}
          onClick={() => onStart({
            course: course!,
            players: players.map((p, i) => ({
              name: p.name.trim() || `Player ${i + 1}`,
              handicap: p.handicap,
            })),
            seriesCode: seriesCode.trim(),
            settings: {
              stakeCents: Math.round(stake * 100),
              carryAcrossSegments: carry,
              oneSkinPerTeamPerCategory: oneSkin,
            },
          })}
        >
          {ready ? 'Start round' : `${4 - named} more name${4 - named === 1 ? '' : 's'}`}
        </Button>
      </div>
    </div>
  )
}

const playerName = (players: Player[], i: number) => players[i]?.name.trim() || `P${i + 1}`

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint: string
}) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-start gap-3 text-left">
      <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-sm font-bold ${
        checked ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-300 text-transparent'
      }`}>✓</span>
      <span>
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="block text-xs text-slate-500">{hint}</span>
      </span>
    </button>
  )
}
