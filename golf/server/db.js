import pg from 'pg'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * The app runs without a database — every screen works from localStorage alone.
 * A missing DATABASE_URL degrades to phones-only rather than taking the app down,
 * which matters more than persistence on the morning of a tee time.
 */
export const configured = Boolean(process.env.DATABASE_URL)

/**
 * Supabase and most hosts terminate TLS with a chain Node won't verify, so we
 * accept it there. A local or explicitly disabled connection gets no SSL at all,
 * which is what lets this run against a plain Postgres.
 */
function sslFor(url) {
  if (/sslmode=disable/.test(url)) return false
  if (/@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url) || url.startsWith('postgres://golf@/')) {
    return false
  }
  return { rejectUnauthorized: false }
}

export const pool = configured
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: sslFor(process.env.DATABASE_URL),
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : null

export async function migrate() {
  if (!pool) return { ok: false, reason: 'DATABASE_URL not set' }
  const sql = await readFile(join(here, '..', 'supabase', '001_golf.sql'), 'utf8')
  await pool.query(sql)
  return { ok: true }
}

export const q = async (text, params) => (await pool.query(text, params)).rows

/** Six unambiguous characters — no O/0 or I/1 to misread off a phone screen. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const makeCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

export async function listCourses() {
  return q(`select id, name, location, tee, rating, slope,
                   pars, stroke_index as "strokeIndex"
            from golf.courses order by name`)
}

export async function upsertCourse({ id, name, location, pars, strokeIndex }) {
  if (id) {
    const rows = await q(
      `update golf.courses set name = $2, location = $3, pars = $4, stroke_index = $5
       where id = $1
       returning id, name, location, pars, stroke_index as "strokeIndex"`,
      [id, name, location ?? '', pars, strokeIndex],
    )
    if (rows[0]) return rows[0]
  }
  const rows = await q(
    `insert into golf.courses (name, location, pars, stroke_index)
     values ($1, $2, $3, $4)
     on conflict (lower(name)) do update
       set location = excluded.location, pars = excluded.pars,
           stroke_index = excluded.stroke_index
     returning id, name, location, pars, stroke_index as "strokeIndex"`,
    [name, location ?? '', pars, strokeIndex],
  )
  return rows[0]
}

export async function createRound(round) {
  const code = round.code || makeCode()
  const [row] = await q(
    `insert into golf.rounds
       (code, series_code, course_id, name, played_on, stake_cents,
        carry_across_segments, one_skin_per_team)
     values ($1, $2, $3, $4, coalesce($5, current_date), $6, $7, $8)
     on conflict (code) do update set updated_at = now()
     returning code`,
    [code, round.seriesCode ?? '', round.courseId, round.name ?? '', round.playedOn ?? null,
     round.stakeCents ?? 500, round.carryAcrossSegments ?? true, round.oneSkinPerTeam ?? true],
  )
  for (const [slot, p] of (round.players ?? []).entries()) {
    await q(
      `insert into golf.round_players (round_id, slot, name, handicap)
       values ((select id from golf.rounds where code = $1), $2, $3, $4)
       on conflict (round_id, slot) do update
         set name = excluded.name, handicap = excluded.handicap`,
      [row.code, slot, p.name, p.handicap ?? 0],
    )
  }
  return getRound(row.code)
}

export async function getRound(code) {
  const [round] = await q(
    `select r.code, r.series_code as "seriesCode", r.name, r.played_on as "playedOn",
            r.stake_cents as "stakeCents",
            r.carry_across_segments as "carryAcrossSegments",
            r.one_skin_per_team as "oneSkinPerTeam", r.status,
            c.id as "courseId", c.name as "courseName", c.location as "courseLocation",
            c.pars, c.stroke_index as "strokeIndex"
     from golf.rounds r join golf.courses c on c.id = r.course_id
     where r.code = $1`,
    [code],
  )
  if (!round) return null
  round.players = await q(
    `select slot, name, handicap from golf.round_players
     where round_id = (select id from golf.rounds where code = $1) order by slot`,
    [code],
  )
  round.holes = await q(
    `select hole, strokes, in_sand as "inSand", ctp_slot as "ctpSlot",
            long_drive_slot as "longDriveSlot"
     from golf.hole_results
     where round_id = (select id from golf.rounds where code = $1) order by hole`,
    [code],
  )
  return round
}

export async function saveHole(code, hole) {
  await q(
    `insert into golf.hole_results
       (round_id, hole, strokes, in_sand, ctp_slot, long_drive_slot, updated_at)
     values ((select id from golf.rounds where code = $1), $2, $3, $4, $5, $6, now())
     on conflict (round_id, hole) do update
       set strokes = excluded.strokes, in_sand = excluded.in_sand,
           ctp_slot = excluded.ctp_slot, long_drive_slot = excluded.long_drive_slot,
           updated_at = now()`,
    [code, hole.hole, hole.strokes, hole.inSand, hole.ctpSlot, hole.longDriveSlot],
  )
  await q(`update golf.rounds set updated_at = now() where code = $1`, [code])
}

export async function listRounds(seriesCode) {
  const where = seriesCode ? `where r.series_code = $1` : ``
  return q(
    `select r.code, r.series_code as "seriesCode", r.name, r.played_on as "playedOn",
            r.status, c.name as "courseName"
     from golf.rounds r join golf.courses c on c.id = r.course_id
     ${where} order by r.played_on desc, r.created_at desc limit 100`,
    seriesCode ? [seriesCode] : [],
  )
}
