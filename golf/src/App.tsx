import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HoleEntry } from './lib/scoring'
import { computeRound, formatMoney } from './lib/scoring'
import * as store from './lib/store'
import { DEFAULT_PLAYERS, SEED_COURSES } from './lib/seedCourses'
import type { LocalRound, StoredCourse } from './lib/store'
import Play from './screens/Play'
import Board from './screens/Board'
import SettleScreen from './screens/Settle'
import Setup, { type SetupResult } from './screens/Setup'
import CourseEditor from './screens/CourseEditor'
import { Button, Card, Empty, SyncBadge, inputClass } from './components/ui'

type View = 'home' | 'setup' | 'course' | 'play' | 'board' | 'settle'

/**
 * Round links always carry the code in the hash.
 *
 * A path link only works where the host rewrites unknown paths back to the
 * app; on a plain static host — object storage, a bare file server, Pages
 * without a fallback — reloading one 404s and the round looks lost. The hash
 * costs nothing and works on every host, so it is not worth making the URL
 * shape depend on where this happens to be deployed. Paths are still read so
 * any link shared earlier keeps working.
 */
const codeFromPath = () => {
  const from = (s: string) => s.match(/\/r\/([A-Za-z0-9]{4,10})/)
  const m = from(window.location.hash) ?? from(window.location.pathname)
  return m ? m[1].toUpperCase() : null
}

const linkFor = (code: string) => `${window.location.pathname}#/r/${code}`

const homeLink = () => `${window.location.pathname}#/`
export default function App() {
  const [view, setView] = useState<View>(() => (codeFromPath() ? 'play' : 'home'))
  const [round, setRound] = useState<LocalRound | null>(null)
  const [hole, setHole] = useState(1)
  const [courses, setCourses] = useState<StoredCourse[]>(
    () => store.mergeCourses(store.loadLocalCourses(), SEED_COURSES),
  )
  const [pending, setPending] = useState(0)
  // null = not attempted, true = on the server and joinable, false = local only.
  const [shared, setShared] = useState<boolean | null>(null)
  const [database, setDatabase] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const sharedRef = useRef<boolean | null>(null)
  // A course you just entered is the one you meant to play; without this the
  // picker stays on whatever sorted first and the round uses the wrong card.
  const [pickedCourse, setPickedCourse] = useState<string | undefined>()
  const [busy, setBusy] = useState<string | null>(null)

  /* Health + course list. Both degrade to local-only without complaint. */
  useEffect(() => {
    void store.health().then((h) => setDatabase(Boolean(h.database && h.dbReady)))
    void store.fetchCourses().then((server: StoredCourse[]) => {
      const local = store.mergeCourses(store.loadLocalCourses(), SEED_COURSES)
      setCourses(Array.isArray(server) && server.length
        ? store.mergeCourses(server, local)
        : local)
    })
  }, [])

  /* Keep the pending badge honest without hammering the network. */
  useEffect(() => { sharedRef.current = shared }, [shared])

  useEffect(() => {
    const tick = () => setPending(store.pendingCount())
    tick()
    const id = setInterval(() => {
      void store.flush().then(setPending)
      setRound((r) => {
        if (r && sharedRef.current === false) {
          void store.shareRound(r).then((s) => { sharedRef.current = true; setShared(true); setRound(s) })
            .catch(() => {})
        }
        return r
      })
    }, 8000)
    return () => clearInterval(id)
  }, [])

  /* A shared /r/CODE link: local copy first, server only if we've never seen it. */
  useEffect(() => {
    const code = codeFromPath()
    if (!code) return
    const local = store.loadRound(code)
    if (local) { setRound(local); return }
    setBusy('Loading round…')
    store.fetchRound(code)
      .then((remote) => setRound(store.saveRound(fromServer(remote))))
      .catch(() => setBusy(`Couldn't find round ${code}`))
      .finally(() => setBusy(null))
  }, [])

  const openRound = useCallback((next: LocalRound, at: View = 'play') => {
    setRound(next)
    setView(at)
    window.history.pushState({}, '', linkFor(next.code))
  }, [])

  const goHome = useCallback(() => {
    setRound(null)
    setView('home')
    window.history.pushState({}, '', homeLink())
  }, [])

  const onEntry = useCallback((h: number, entry: HoleEntry) => {
    setRound((current) => {
      if (!current) return current
      const entries = current.entries.map((e, i) => (i === h - 1 ? entry : e))
      const next = store.saveRound({ ...current, entries })
      store.queueHole(next.code, h, entry)
      setPending(store.pendingCount())
      return next
    })
  }, [])

  const startRound = useCallback((result: SetupResult) => {
    const next = store.newRound(result.course, result.players, {
      courseId: result.course.id,
      seriesCode: result.seriesCode,
      settings: result.settings,
    })
    store.saveRound(next)
    setShared(null)
    void store.shareRound(next)
      .then((saved) => { setRound(saved); setShared(true) })
      .catch(() => setShared(false))
    setHole(1)
    openRound(next)
  }, [openRound])

  const saveCourse = useCallback((course: StoredCourse) => {
    // Seeds are always folded back in, or saving one course would drop the rest.
    const withSeeds = (list: StoredCourse[]) => store.mergeCourses(list, SEED_COURSES)
    const saved = store.saveLocalCourse(course)
    setCourses(withSeeds(saved))
    setPickedCourse(saved.find((c) => c.name === course.name)?.id)
    void store.saveCourse(course)
      .then((remote: StoredCourse) => {
        setCourses(withSeeds(store.mergeCourses([remote], store.loadLocalCourses())))
        if (remote?.id) setPickedCourse(remote.id)
      })
      .catch(() => { /* the local copy already holds it */ })
    setView('setup')
  }, [])

  const series = useMemo(() => {
    if (!round) return []
    const all = store.listLocalRounds()
    const tag = round.seriesCode.trim().toLowerCase()
    const inSeries = tag
      ? all.filter((r) => r.seriesCode.trim().toLowerCase() === tag)
      : all.filter((r) => r.code === round.code)
    return inSeries.map((r) => (r.code === round.code ? round : r))
  }, [round])

  if (busy) return <Splash>{busy}</Splash>

  const header = (
    <div className="flex items-center gap-2 bg-brand px-3 pb-2 text-brand-ink safe-t">
      <button onClick={goHome} className="text-lg font-black tracking-tight">⛳ Hollywood</button>
      {round && (
        <button
          onClick={() => {
            const link = `${location.origin}${location.pathname}#/r/${round.code}`
            navigator.clipboard?.writeText(link).then(
              () => window.alert(`Copied:\n${link}\n\nOr they can type the code ${round.code}`),
              () => window.alert(`Round code: ${round.code}`),
            )
          }}
          className={`rounded-lg px-2 py-1 text-xs font-black tracking-widest ${
            shared === false ? 'bg-gold text-surface' : 'bg-brand-ink/15'
          }`}
          title="Copy the link to share"
        >
          {shared === false ? 'not shared — tap' : round.code}
        </button>
      )}
      {round && view !== 'play' && (
        <button
          onClick={() => setView('play')}
          className="rounded-lg bg-brand-ink/15 px-2 py-1 text-xs font-bold text-brand-ink"
        >
          ‹ hole {hole}
        </button>
      )}
      <span className="ml-auto"><SyncBadge pending={pending} database={database} /></span>
    </div>
  )

  if (view === 'course') {
    return (
      <div className="min-h-full">
        {header}
        <CourseEditor onSave={saveCourse} onCancel={() => setView('setup')} />
      </div>
    )
  }

  if (view === 'setup') {
    return (
      <div className="min-h-full">
        {header}
        <Setup
          courses={courses}
          defaultSeries={store.listLocalRounds()[0]?.seriesCode ?? ''}
          defaultPlayers={lastLineUp()}
          initialCourseId={pickedCourse}
          onNewCourse={() => setView('course')}
          onStart={startRound}
          onCancel={goHome}
        />
      </div>
    )
  }

  if (!round) {
    return (
      <div className="min-h-full">
        {header}
        <Home
          rounds={store.listLocalRounds()}
          onOpen={(r) => { setHole(firstUnplayed(r)); openRound(r) }}
          onNew={() => setView('setup')}
          joinCode={joinCode}
          setJoinCode={setJoinCode}
          onJoin={() => {
            const code = joinCode.trim().toUpperCase()
            if (!code) return
            const local = store.loadRound(code)
            if (local) { setHole(firstUnplayed(local)); openRound(local); return }
            setBusy(`Looking for ${code}…`)
            store.fetchRound(code)
              .then((remote) => {
                const saved = store.saveRound(fromServer(remote))
                setHole(firstUnplayed(saved))
                openRound(saved)
              })
              .catch(() => window.alert(`No round called ${code}.`))
              .finally(() => setBusy(null))
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-full">
      {header}
      {view === 'play' && (
        <Play
          round={round}
          hole={hole}
          onHole={(h) => setHole(Math.min(18, Math.max(1, h)))}
          onEntry={onEntry}
          onBoard={() => setView('board')}
        />
      )}
      {view === 'board' && <Board round={round} onHole={(h) => { setHole(h); setView('play') }} />}
      {view === 'settle' && <SettleScreen round={round} series={series} />}
      {view !== 'play' && <div className="h-20" />}
      <Tabs view={view} setView={setView} />
    </div>
  )
}

/* --------------------------------------------------------------- home -- */

function Home({ rounds, onOpen, onNew, joinCode, setJoinCode, onJoin }: {
  rounds: LocalRound[]
  onOpen: (r: LocalRound) => void
  onNew: () => void
  joinCode: string
  setJoinCode: (v: string) => void
  onJoin: () => void
}) {
  return (
    <div className="space-y-3 p-3">
      <Button onClick={onNew} className="w-full text-lg">Start a round</Button>

      <Card className="overflow-hidden">
        <h2 className="border-b border-line px-3 py-2 text-sm font-bold uppercase tracking-wide text-ink-soft">
          Your rounds
        </h2>
        {rounds.length === 0 ? (
          <Empty title="Nothing yet">Start a round, then share its code with the other three.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {rounds.map((r) => {
              const t = computeRound(r.course, r.players, r.entries, r.settings)
              return (
                <li key={r.code}>
                  <button onClick={() => onOpen(r)} className="w-full px-3 py-3 text-left active:bg-surface-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold">{r.course.name}</span>
                      <span className="ml-auto rounded bg-ink px-1.5 py-0.5 text-xs font-bold tracking-widest text-white">
                        {r.code}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-soft">
                      {r.playedOn} · {t.holesPlayed}/18
                      {r.seriesCode && ` · ${r.seriesCode}`}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-ink tnum">
                      {r.players.map((p, i) => `${p.name} ${formatMoney(t.money[i])}`).join(' · ')}
                    </p>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">Join a round</h2>
        <div className="flex gap-2">
          <input
            className={`${inputClass} flex-1 text-center text-lg font-bold uppercase tracking-widest`}
            placeholder="CODE" value={joinCode} maxLength={6} autoComplete="off"
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <Button onClick={onJoin}>Join</Button>
        </div>
        <p className="text-xs text-ink-soft">
          Or just open the link the round was started on.
        </p>
      </Card>
    </div>
  )
}

/* --------------------------------------------------------------- bits -- */

function Tabs({ view, setView }: { view: View; setView: (v: View) => void }) {
  const tabs: [View, string][] = [['play', 'Play'], ['board', 'Board'], ['settle', 'Settle']]
  if (view === 'play') return null
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface safe-b">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          onClick={() => setView(key)}
          className={`flex-1 py-3 text-sm font-bold ${
            view === key ? 'text-team-a' : 'text-ink-faint'
          }`}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}

const Splash = ({ children }: { children: React.ReactNode }) => (
  <div className="grid min-h-full place-items-center p-8 text-center">
    <p className="text-lg font-semibold text-ink-soft">{children}</p>
  </div>
)

/** Saturday should not mean retyping Friday's names and handicaps. */
function lastLineUp() {
  const previous = store.listLocalRounds()[0]?.players
  if (previous?.length === 4) return previous
  return DEFAULT_PLAYERS.map((name) => ({ name, handicap: 0 }))
}

const firstUnplayed = (r: LocalRound) => {
  const at = r.entries.findIndex((e) => e.strokes.some((s) => s == null))
  return at === -1 ? 18 : at + 1
}

/** Server rows use snake-ish shapes and a flat course; normalise to LocalRound. */
function fromServer(remote: any): LocalRound {
  const entries = store.blankEntries()
  for (const h of remote.holes ?? []) {
    entries[h.hole - 1] = {
      strokes: (h.strokes ?? []).map((v: number | null) => (v == null ? null : Number(v))),
      inSand: h.inSand ?? [false, false, false, false],
      ctpSlot: h.ctpSlot ?? null,
      longDriveSlot: h.longDriveSlot ?? null,
    }
  }
  return {
    code: remote.code,
    seriesCode: remote.seriesCode ?? '',
    name: remote.name ?? '',
    playedOn: String(remote.playedOn ?? '').slice(0, 10),
    courseId: remote.courseId,
    course: {
      name: remote.courseName,
      pars: (remote.pars ?? []).map(Number),
      strokeIndex: (remote.strokeIndex ?? []).map(Number),
    },
    players: (remote.players ?? []).map((p: any) => ({ name: p.name, handicap: Number(p.handicap) })),
    entries,
    settings: {
      stakeCents: Number(remote.stakeCents ?? 500),
      carryAcrossSegments: remote.carryAcrossSegments ?? true,
      oneSkinPerTeamPerCategory: remote.oneSkinPerTeam ?? true,
    },
    updatedAt: Date.now(),
  }
}
