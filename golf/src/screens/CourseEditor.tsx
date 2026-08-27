import { useMemo, useState } from 'react'
import { validatePars, validateStrokeIndex, type Course } from '../lib/scoring'
import { PAR_PRESETS } from '../lib/seedCourses'
import { Button, Card, Field, inputClass } from '../components/ui'

/**
 * Enter a card once and it's kept. This is how every other course in the country
 * gets added, so it validates hard: pars 3-6, and a stroke index that is a real
 * permutation of 1-18 rather than whatever got fat-fingered on the first tee.
 */
export default function CourseEditor({ initial, onSave, onCancel }: {
  initial?: Course & { id?: string; location?: string }
  onSave: (course: Course & { id?: string; location?: string }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [tee, setTee] = useState(initial?.tee ?? '')
  const [rating, setRating] = useState(initial?.rating != null ? String(initial.rating) : '')
  const [slope, setSlope] = useState(initial?.slope != null ? String(initial.slope) : '')
  const [pars, setPars] = useState<number[]>(initial?.pars ?? Array(18).fill(4))
  const [index, setIndex] = useState<number[]>(
    initial?.strokeIndex ?? [1, 3, 5, 7, 9, 11, 13, 15, 17, 2, 4, 6, 8, 10, 12, 14, 16, 18],
  )

  const parError = validatePars(pars)
  const indexError = validateStrokeIndex(index)
  const totalPar = pars.reduce((a, b) => a + b, 0)

  const mix = useMemo(() => {
    const count = (p: number) => pars.filter((v) => v === p).length
    return { threes: count(3), fours: count(4), fives: count(5) }
  }, [pars])

  const setAt = (list: number[], i: number, v: number) =>
    list.map((old, j) => (j === i ? v : old))

  const canSave = !parError && !indexError && name.trim().length > 0

  return (
    <div className="space-y-3 p-3 pb-28">
      <Card className="space-y-3 p-3">
        <Field label="Course">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ocean Shores Country Club" autoComplete="off" />
        </Field>
        <Field label="Where" hint="Optional — handy once there are a few dozen of these.">
          <input className={inputClass} value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder="Ocean Shores" autoComplete="off" />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Tees">
            <input className={inputClass} value={tee} onChange={(e) => setTee(e.target.value)}
              placeholder="Black" autoComplete="off" />
          </Field>
          <Field label="Rating">
            <input type="number" inputMode="decimal" step={0.1} className={`${inputClass} tnum`}
              value={rating} onChange={(e) => setRating(e.target.value)} placeholder="76.5" />
          </Field>
          <Field label="Slope">
            <input type="number" inputMode="numeric" className={`${inputClass} tnum`}
              value={slope} onChange={(e) => setSlope(e.target.value)} placeholder="130" />
          </Field>
        </div>
        <p className="text-xs text-ink-soft">
          Both are printed on the card, next to the tee colour. With them, players
          enter a GA index and the app works out the shots; without them, they
          enter shots directly.
        </p>
      </Card>

      <Card className="p-3">
        <p className="mb-2 text-sm font-bold text-ink">Start from a layout</p>
        <div className="flex gap-1">
          {PAR_PRESETS.map((preset) => (
            <button
              key={preset.label}
              title={preset.hint}
              onClick={() => setPars([...preset.pars])}
              className="min-h-[3rem] flex-1 rounded-xl bg-surface-2 px-1 text-sm font-bold active:bg-line"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          Then correct any hole below and type the stroke index off the card.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-baseline gap-2 border-b border-line px-3 py-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">The card</h2>
          <span className="ml-auto text-sm font-bold tnum">
            par {totalPar}
          </span>
          <span className="text-xs text-ink-soft tnum">
            {mix.threes}×3 · {mix.fours}×4 · {mix.fives}×5
          </span>
        </div>

        <div className="grid grid-cols-[2.5rem_1fr_1fr] gap-x-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
          <span>Hole</span><span>Par</span><span>Stroke index</span>
        </div>

        <ul className="divide-y divide-line">
          {Array.from({ length: 18 }, (_, i) => (
            <li key={i} className="grid grid-cols-[2.5rem_1fr_1fr] items-center gap-x-2 px-3 py-1.5">
              <span className="text-sm font-bold tnum">{i + 1}</span>
              <div className="flex gap-1">
                {[3, 4, 5].map((p) => (
                  <button
                    key={p}
                    data-testid={`par-${i + 1}-${p}`}
                    onClick={() => setPars(setAt(pars, i, p))}
                    className={`h-10 flex-1 rounded-lg text-sm font-bold tnum ${
                      pars[i] === p ? 'bg-team-a text-white' : 'bg-surface-2 active:bg-line'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                data-testid={`si-${i + 1}`}
                type="number" inputMode="numeric" min={1} max={18}
                className="h-10 w-full rounded-lg border border-line px-2 text-center text-sm font-bold tnum"
                value={index[i]}
                onChange={(e) => setIndex(setAt(index, i, Number(e.target.value)))}
              />
            </li>
          ))}
        </ul>
      </Card>

      {(parError || indexError) && (
        <p className="rounded-xl bg-coral-wash px-3 py-2 text-sm font-semibold text-coral">
          {parError ?? indexError}
        </p>
      )}
      {!indexError && totalPar !== 72 && (
        <p className="rounded-xl bg-gold-wash px-3 py-2 text-sm font-medium text-gold">
          That adds up to {totalPar}, not the usual 72. Fine if the course really is —
          worth a second look if not.
        </p>
      )}

      <div className="flex gap-2">
        <Button variant="subtle" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button
          className="flex-[2]"
          disabled={!canSave}
          onClick={() => onSave({
            id: initial?.id,
            name: name.trim(),
            location,
            pars,
            strokeIndex: index,
            ...(tee.trim() ? { tee: tee.trim() } : {}),
            ...(rating !== '' && slope !== ''
              ? { rating: Number(rating), slope: Number(slope) }
              : {}),
          })}
        >
          Save course
        </Button>
      </div>
    </div>
  )
}
