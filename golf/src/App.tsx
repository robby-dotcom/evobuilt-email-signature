import { useCallback, useEffect, useMemo, useState } from 'react'
import type { HoleEntry } from './lib/scoring'
import { computeRound, formatMoney } from './lib/scoring'
import * as store from './lib/store'
import type { LocalRound, StoredCourse } from './lib/store'
import Play from './screens/Play'
import Board from './screens/Board'
import SettleScreen from './screens/Settle'
import Setup, { type SetupResult } from './screens/Setup'
import CourseEditor from './screens/CourseEditor'
import { Button, Card, Empty, SyncBadge, inputClass } from './components/ui'

type View = 'home' | 'setup' | 'course' | 'play' | 'board' | 'settle'

const codeFromPath = () => {
  const m = window.location.pathname.match(/^\/r\/([A-Za-z0-9]{4,10})/)
  return m ? m[1].toUpperCase() : null
}

export default function App() {
  const [view, setView] = useState<View>(() => (codeFromPath() ? 'play' : 'home'))
  const [round, setRound] = useState<LocalRound | null>(null)
  const [hole, setHole] = useState(1)
  const [courses, setCourses] = useState<StoredCourse[]>(() => store.loadLocalCourses())
  const [pending, setPending] = useState(0)
  const [database, setDatabase] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  /* Health + course list. Both degrade to local-only without complaint. */
  useEffect(() => {
    void store.health().then((h) => setDatabase(Boolean(h.database && h.dbReady)))
    void store.fetchCourses().then((server: StoredCourse[]) => {
      if (Array.isArray(server) && server.length) {
        setCourses(store.mergeCourses(server, store.loadLocalCourses()))
      }
    })
  }, [])

  /* Keep the pending badge honest without hammering the network. */
  useEffect(() => {
    const tick = () => setPending(store.pendingCount())
    tick()
    const id = setInterval(() => { void store.flush().then(setPending) }, 8000)
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
    window.history.pushState({}, '', `/r/${next.code}`)
  }, [])

  const goHome = useCallback(() => {
    setRound(null)
    setView('home')
    window.history.pushState({}, '', '/')
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
    void store.pushRound(next).catch(() => { /* queued locally; nothing to do */ })
    setHole(1)
    openRound(next)
  }, [openRound])

  const saveCourse = useCallback((course: StoredCourse) => {
    setCourses(store.saveLocalCourse(course))
    void store.saveCourse(course)
      .then((saved: StoredCourse) => {
        setCourses(store.mergeCourses([saved], store.loadLocalCourses()))
      })
      .catch(() => { /* local copy already holds it */ })
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
    <div className="flex items-center gap-2 bg-emerald-800 px-3 pb-2 text-white safe-t">
      <button onClick={goHome} className="text-lg font-black tracking-tight">⛳ Hollywood</button>
      {round && view !== 'play' && (
        <button
          onClick={() => setView('play')}
          className="rounded-lg bg-emerald-700 px-2 py-1 text-xs font-bold"
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
        <h2 className="border-b border-slate-100 px-3 py-2 text-sm font-bold uppercase tracking-wide text-slate-500">
          Your rounds
        </h2>
        {rounds.length === 0 ? (
          <Empty title="Nothing yet">Start a round, then share its code with the other three.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rounds.map((r) => {
              const t = computeRound(r.course, r.players, r.entries, r.settings)
              return (
                <li key={r.code}>
                  <button onClick={() => onOpen(r)} className="w-full px-3 py-3 text-left active:bg-slate-100">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold">{r.course.name}</span>
                      <span className="ml-auto rounded bg-slate-900 px-1.5 py-0.5 text-xs font-bold tracking-widest text-white">
                        {r.code}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {r.playedOn} · {t.holesPlayed}/18
                      {r.seriesCode && ` · ${r.seriesCode}`}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-700 tnum">
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
        <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">Join a round</h2>
        <div className="flex gap-2">
          <input
            className={`${inputClass} flex-1 text-center text-lg font-bold uppercase tracking-widest`}
            placeholder="CODE" value={joinCode} maxLength={6} autoComplete="off"
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <Button onClick={onJoin}>Join</Button>
        </div>
        <p className="text-xs text-slate-500">
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
    <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-200 bg-white safe-b">
      {tabs.map(([key, label]) => (
        <button
          key={key}
          onClick={() => setView(key)}
          className={`flex-1 py-3 text-sm font-bold ${
            view === key ? 'text-emerald-700' : 'text-slate-400'
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
    <p className="text-lg font-semibold text-slate-600">{children}</p>
  </div>
)

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
