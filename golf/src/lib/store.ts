/**
 * The phone is the source of truth during a round. Every change lands in
 * localStorage first and the network write is queued behind it, so a dead spot
 * on the course can never block score entry or lose a hole.
 */
import {
  type Course, type HoleEntry, type Player, type RoundSettings,
  DEFAULT_SETTINGS, emptyHole,
} from './scoring'

export interface LocalRound {
  code: string
  seriesCode: string
  name: string
  playedOn: string
  courseId?: string
  course: Course
  players: Player[]
  entries: HoleEntry[]
  settings: RoundSettings
  updatedAt: number
}

const ROUND_KEY = (code: string) => `hollywood:round:${code}`
const INDEX_KEY = 'hollywood:rounds'
const QUEUE_KEY = 'hollywood:queue'

const read = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch { return fallback }
}

const write = (key: string, value: unknown) => {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* private mode */ }
}

export const blankEntries = (): HoleEntry[] => Array.from({ length: 18 }, emptyHole)

export const newRound = (course: Course, players: Player[], opts: Partial<LocalRound> = {}):
LocalRound => ({
  code: opts.code ?? makeCode(),
  seriesCode: opts.seriesCode ?? '',
  name: opts.name ?? '',
  playedOn: opts.playedOn ?? new Date().toISOString().slice(0, 10),
  courseId: opts.courseId,
  course,
  players,
  entries: opts.entries ?? blankEntries(),
  settings: opts.settings ?? { ...DEFAULT_SETTINGS },
  updatedAt: Date.now(),
})

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const makeCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

export function saveRound(round: LocalRound) {
  const stamped = { ...round, updatedAt: Date.now() }
  write(ROUND_KEY(round.code), stamped)
  const index = read<string[]>(INDEX_KEY, [])
  if (!index.includes(round.code)) write(INDEX_KEY, [round.code, ...index].slice(0, 60))
  return stamped
}

export const loadRound = (code: string) => read<LocalRound | null>(ROUND_KEY(code), null)

export const listLocalRounds = (): LocalRound[] =>
  read<string[]>(INDEX_KEY, [])
    .map(loadRound)
    .filter((r): r is LocalRound => r != null)
    .sort((a, b) => b.updatedAt - a.updatedAt)

export function forgetRound(code: string) {
  try { localStorage.removeItem(ROUND_KEY(code)) } catch { /* ignore */ }
  write(INDEX_KEY, read<string[]>(INDEX_KEY, []).filter((c) => c !== code))
}

/* ---------------------------------------------------------------- network -- */

interface QueueItem { code: string; hole: number; body: unknown }

const queue = () => read<QueueItem[]>(QUEUE_KEY, [])
export const pendingCount = () => queue().length

const enqueue = (item: QueueItem) => {
  // One entry per hole — a later edit supersedes an unsent earlier one.
  const rest = queue().filter((q) => !(q.code === item.code && q.hole === item.hole))
  write(QUEUE_KEY, [...rest, item])
}

const api = async (path: string, init?: RequestInit) => {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export const health = () =>
  api('/health').catch(() => ({ ok: false, database: false, dbReady: false }))

export const fetchCourses = () => api('/courses').catch(() => [])

export const saveCourse = (course: Course & { id?: string; location?: string }) =>
  api('/courses', { method: 'POST', body: JSON.stringify(course) })

export const fetchRound = (code: string) => api(`/rounds/${code}`)

export const pushRound = (round: LocalRound) =>
  api('/rounds', {
    method: 'POST',
    body: JSON.stringify({
      code: round.code,
      seriesCode: round.seriesCode,
      courseId: round.courseId,
      name: round.name,
      playedOn: round.playedOn,
      stakeCents: round.settings.stakeCents,
      carryAcrossSegments: round.settings.carryAcrossSegments,
      oneSkinPerTeam: round.settings.oneSkinPerTeamPerCategory,
      players: round.players,
    }),
  })

export function queueHole(code: string, hole: number, entry: HoleEntry) {
  enqueue({
    code,
    hole,
    body: {
      hole,
      strokes: entry.strokes,
      inSand: entry.inSand,
      ctpSlot: entry.ctpSlot,
      longDriveSlot: entry.longDriveSlot,
    },
  })
  void flush()
}

let flushing = false

/** Drain the queue oldest first. Anything that fails stays queued for next time. */
export async function flush(): Promise<number> {
  if (flushing || !navigator.onLine) return pendingCount()
  flushing = true
  try {
    for (const item of queue()) {
      try {
        await api(`/rounds/${item.code}/holes`, {
          method: 'PUT',
          body: JSON.stringify(item.body),
        })
        write(QUEUE_KEY, queue().filter((q) => !(q.code === item.code && q.hole === item.hole)))
      } catch {
        break
      }
    }
  } finally {
    flushing = false
  }
  return pendingCount()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => void flush())
}

/* ---------------------------------------------------------------- courses -- */

const COURSE_KEY = 'hollywood:courses'
export type StoredCourse = Course & { id?: string; location?: string }

export const loadLocalCourses = (): StoredCourse[] => read<StoredCourse[]>(COURSE_KEY, [])

export function saveLocalCourse(course: StoredCourse): StoredCourse[] {
  const id = course.id ?? `local-${course.name.toLowerCase().replace(/\W+/g, '-')}`
  const stored = { ...course, id }
  const rest = loadLocalCourses().filter(
    (c) => c.id !== id && c.name.toLowerCase() !== course.name.toLowerCase(),
  )
  const next = [...rest, stored].sort((a, b) => a.name.localeCompare(b.name))
  write(COURSE_KEY, next)
  return next
}

/** Server list wins on conflict; anything only held locally is kept. */
export function mergeCourses(server: StoredCourse[], local: StoredCourse[]): StoredCourse[] {
  const names = new Set(server.map((c) => c.name.toLowerCase()))
  return [...server, ...local.filter((c) => !names.has(c.name.toLowerCase()))]
    .sort((a, b) => a.name.localeCompare(b.name))
}
