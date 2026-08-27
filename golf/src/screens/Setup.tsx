import { useEffect, useMemo, useState } from 'react'
import type { Course, Player, RoundSettings } from '../lib/scoring'
import { DEFAULT_SETTINGS, isRated } from '../lib/scoring'
import { courseHandicap, playingHandicap } from '../lib/stableford'
import { Button, Card, Field, inputClass } from '../components/ui'

export interface SetupResult {
  course: Course & { id?: string }
  players: Player[]
  seriesCode: string
  settings: RoundSettings
}

interface Entry {
  name: string
  /** Exact GA index as typed. */
  index: number
  /** Shots received. Computed from the index unless someone has set it by hand. */
  handicap: number
  overridden: boolean
}

export default function Setup({
  courses, onNewCourse, onStart, onCancel, defaultSeries, defaultPlayers, initialCourseId,
}: {
  courses: (Course & { id?: string; location?: string })[]
  onNewCourse: () => void
  onStart: (result: SetupResult) => void
  onCancel: () => void
  defaultSeries: string
  defaultPlayers: Player[]
  /** A course just entered in the editor, which should come back selected. */
  initialCourseId?: string
}) {
  const [courseId, setCourseId] = useState(initialCourseId ?? courses[0]?.id ?? '')

  useEffect(() => {
    if (initialCourseId) setCourseId(initialCourseId)
  }, [initialCourseId])
  const [seriesCode, setSeriesCode] = useState(defaultSeries)
  const [stake, setStake] = useState(5)
  const [allowance, setAllowance] = useState(100)
  const [carry, setCarry] = useState(DEFAULT_SETTINGS.carryAcrossSegments)
  const [oneSkin, setOneSkin] = useState(DEFAULT_SETTINGS.oneSkinPerTeamPerCategory)
  const [editing, setEditing] = useState<number | null>(null)

  const [players, setPlayers] = useState<Entry[]>(() =>
    Array.from({ length: 4 }, (_, i) => ({
      name: defaultPlayers[i]?.name ?? '',
      index: defaultPlayers[i]?.index ?? 0,
      handicap: defaultPlayers[i]?.handicap ?? 0,
      overridden: false,
    })),
  )

  const course = courses.find((c) => c.id === courseId) ?? courses[0]
  const rated = course != null && isRated(course)
  const par = useMemo(
    () => (course ? course.pars.reduce((a, b) => a + b, 0) : 72),
    [course],
  )

  const shotsFor = (index: number) =>
    course && rated
      ? playingHandicap(courseHandicap(index, course.rating!, course.slope!, par), allowance)
      : 0

  // Recompute anyone who has not been set by hand, whenever the inputs move.
  useEffect(() => {
    if (!rated) return
    setPlayers((current) =>
      current.map((p) => (p.overridden ? p : { ...p, handicap: shotsFor(p.index) })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, allowance, rated, par])

  const setPlayer = (i: number, patch: Partial<Entry>) =>
    setPlayers(players.map((p, j) => {
      if (j !== i) return p
      const next = { ...p, ...patch }
      if ('index' in patch && !next.overridden && rated) next.handicap = shotsFor(next.index)
      return next
    }))

  const named = players.filter((p) => p.name.trim()).length
  const ready = course != null && named === 4

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
        {course && rated && (
          <p className="text-xs font-medium text-slate-500 tnum">
            {course.tee ? `${course.tee} tees · ` : ''}par {par} · rating {course.rating} · slope {course.slope}
          </p>
        )}
        <Button variant="subtle" onClick={onNewCourse} className="w-full">
          + Add a course
        </Button>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-3 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Players</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Order sets the draw: {name(players, 0)} &amp; {name(players, 1)} first,
            then {name(players, 0)} &amp; {name(players, 2)},
            then {name(players, 0)} &amp; {name(players, 3)}.
          </p>
        </div>

        <div className="grid grid-cols-[1.25rem_1fr_4rem_4.5rem] items-center gap-x-2 px-3 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
          <span />
          <span>Name</span>
          <span className="text-center">{rated ? 'Index' : 'Shots'}</span>
          <span className="text-center">{rated ? 'Shots' : ''}</span>
        </div>

        <ul className="divide-y divide-slate-100">
          {players.map((p, i) => (
            <li key={i} className="px-3 py-2">
              <div className="grid grid-cols-[1.25rem_1fr_4rem_4.5rem] items-center gap-x-2">
                <span className="text-sm font-bold text-slate-400 tnum">{i + 1}</span>
                <input
                  className={inputClass}
                  placeholder={`Player ${i + 1}`}
                  value={p.name}
                  autoComplete="off"
                  onChange={(e) => setPlayer(i, { name: e.target.value })}
                />
                <input
                  type="number" inputMode="decimal" step={rated ? 0.1 : 1}
                  className={`${inputClass} px-1 text-center tnum`}
                  value={rated ? p.index : p.handicap}
                  onChange={(e) => setPlayer(i, rated
                    ? { index: Number(e.target.value) || 0 }
                    : { handicap: Number(e.target.value) || 0 })}
                />
                {rated && (editing === i ? (
                  <input
                    type="number" inputMode="numeric" autoFocus
                    className={`${inputClass} px-1 text-center font-bold tnum`}
                    value={p.handicap}
                    onBlur={() => setEditing(null)}
                    onChange={(e) =>
                      setPlayer(i, { handicap: Number(e.target.value) || 0, overridden: true })}
                  />
                ) : (
                  <button
                    onClick={() => setEditing(i)}
                    className={`min-h-[3rem] rounded-xl text-lg font-black tnum ${
                      p.overridden
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-emerald-700 text-white'
                    }`}
                  >
                    {p.handicap}
                  </button>
                ))}
              </div>

              {rated && (
                <p className="mt-1 pl-7 text-[0.7rem] text-slate-500 tnum">
                  {p.overridden
                    ? <>set by hand ·{' '}
                        <button
                          className="font-semibold text-emerald-700 underline"
                          onClick={() => setPlayer(i, { overridden: false, handicap: shotsFor(p.index) })}
                        >
                          use {shotsFor(p.index)}
                        </button>
                      </>
                    : `${p.index} → ${p.handicap} shots (${course!.rating}/${course!.slope}${
                        allowance !== 100 ? `, ${allowance}%` : ''})`}
                </p>
              )}
            </li>
          ))}
        </ul>

        <p className="bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {rated
            ? 'Enter your exact GA index. Shots are worked out from the tee’s rating and slope — tap the number to set it by hand.'
            : 'This course has no rating, so enter the shots you get directly.'}
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
        <Field
          label="Handicap allowance %"
          hint="100% is full shots. Golf Australia's fourball standard is 85%."
        >
          <input type="number" inputMode="numeric" className={`${inputClass} tnum`} value={allowance}
            onChange={(e) => setAllowance(Number(e.target.value) || 100)} />
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
              ...(rated ? { index: p.index } : {}),
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

const name = (players: Entry[], i: number) => players[i]?.name.trim() || `P${i + 1}`

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
