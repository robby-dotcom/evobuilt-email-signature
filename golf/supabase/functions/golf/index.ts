/**
 * The golf API, run inside Supabase so no database credential ever leaves the
 * project. The `golf` schema is not exposed through the project's REST API at
 * all; this function is its only reader, using the connection string Supabase
 * injects at runtime.
 */
import postgres from 'npm:postgres@3.4.5'

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, {
  max: 1,
  prepare: false,          // the pooler runs in transaction mode
  idle_timeout: 20,
})

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })

/** Six unambiguous characters — no O/0 or I/1 to misread off a phone screen. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const makeCode = () =>
  Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('')

async function getRound(code: string) {
  const [round] = await sql`
    select r.code, r.series_code as "seriesCode", r.name, r.played_on as "playedOn",
           r.stake_cents as "stakeCents",
           r.carry_across_segments as "carryAcrossSegments",
           r.one_skin_per_team as "oneSkinPerTeam", r.status,
           c.id as "courseId", c.name as "courseName", c.location as "courseLocation",
           c.pars, c.stroke_index as "strokeIndex"
    from golf.rounds r join golf.courses c on c.id = r.course_id
    where r.code = ${code}`
  if (!round) return null
  round.players = await sql`
    select slot, name, handicap from golf.round_players
    where round_id = (select id from golf.rounds where code = ${code}) order by slot`
  round.holes = await sql`
    select hole, strokes, in_sand as "inSand", ctp_slot as "ctpSlot",
           long_drive_slot as "longDriveSlot"
    from golf.hole_results
    where round_id = (select id from golf.rounds where code = ${code}) order by hole`
  return round
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // Everything after /functions/v1/golf is the route.
  const path = new URL(req.url).pathname.replace(/^\/functions\/v1\/golf/, '') || '/'
  const parts = path.split('/').filter(Boolean)

  try {
    if (parts[0] === 'health') return json({ ok: true, database: true, dbReady: true })

    if (parts[0] === 'courses') {
      if (req.method === 'GET') {
        return json(await sql`
          select id, name, location, pars, stroke_index as "strokeIndex"
          from golf.courses order by name`)
      }
      const body = await req.json()
      const { name, location = '', pars, strokeIndex } = body ?? {}
      if (!name || !Array.isArray(pars) || pars.length !== 18) {
        return json({ error: 'bad_course' }, 400)
      }
      if (!Array.isArray(strokeIndex) || new Set(strokeIndex).size !== 18) {
        return json({ error: 'bad_stroke_index' }, 400)
      }
      const [saved] = await sql`
        insert into golf.courses (name, location, pars, stroke_index)
        values (${name}, ${location}, ${pars}, ${strokeIndex})
        on conflict (lower(name)) do update
          set location = excluded.location, pars = excluded.pars,
              stroke_index = excluded.stroke_index
        returning id, name, location, pars, stroke_index as "strokeIndex"`
      return json(saved)
    }

    if (parts[0] === 'rounds') {
      // /rounds
      if (parts.length === 1) {
        if (req.method === 'GET') {
          const series = new URL(req.url).searchParams.get('series')
          return json(series
            ? await sql`
                select r.code, r.series_code as "seriesCode", r.name,
                       r.played_on as "playedOn", r.status, c.name as "courseName"
                from golf.rounds r join golf.courses c on c.id = r.course_id
                where r.series_code = ${series}
                order by r.played_on desc, r.created_at desc limit 100`
            : await sql`
                select r.code, r.series_code as "seriesCode", r.name,
                       r.played_on as "playedOn", r.status, c.name as "courseName"
                from golf.rounds r join golf.courses c on c.id = r.course_id
                order by r.played_on desc, r.created_at desc limit 100`)
        }
        const b = await req.json()
        const code = b.code || makeCode()
        await sql`
          insert into golf.rounds
            (code, series_code, course_id, name, played_on, stake_cents,
             carry_across_segments, one_skin_per_team)
          values (${code}, ${b.seriesCode ?? ''}, ${b.courseId}, ${b.name ?? ''},
                  ${b.playedOn ?? new Date().toISOString().slice(0, 10)},
                  ${b.stakeCents ?? 500}, ${b.carryAcrossSegments ?? true},
                  ${b.oneSkinPerTeam ?? true})
          on conflict (code) do update set updated_at = now()`
        for (const [slot, p] of (b.players ?? []).entries()) {
          await sql`
            insert into golf.round_players (round_id, slot, name, handicap)
            values ((select id from golf.rounds where code = ${code}),
                    ${slot}, ${p.name}, ${p.handicap ?? 0})
            on conflict (round_id, slot) do update
              set name = excluded.name, handicap = excluded.handicap`
        }
        return json(await getRound(code))
      }

      const code = parts[1].toUpperCase()

      // /rounds/:code/holes
      if (parts[2] === 'holes' && (req.method === 'PUT' || req.method === 'POST')) {
        const b = await req.json()
        const holes = Array.isArray(b?.holes) ? b.holes : [b]
        for (const h of holes) {
          await sql`
            insert into golf.hole_results
              (round_id, hole, strokes, in_sand, ctp_slot, long_drive_slot, updated_at)
            values ((select id from golf.rounds where code = ${code}),
                    ${h.hole}, ${h.strokes}, ${h.inSand},
                    ${h.ctpSlot}, ${h.longDriveSlot}, now())
            on conflict (round_id, hole) do update
              set strokes = excluded.strokes, in_sand = excluded.in_sand,
                  ctp_slot = excluded.ctp_slot,
                  long_drive_slot = excluded.long_drive_slot, updated_at = now()`
        }
        await sql`update golf.rounds set updated_at = now() where code = ${code}`
        return json({ ok: true, saved: holes.length })
      }

      // /rounds/:code
      const round = await getRound(code)
      return round ? json(round) : json({ error: 'not_found' }, 404)
    }

    return json({ error: 'not_found' }, 404)
  } catch (err) {
    console.error(req.method, path, err)
    return json({ error: 'server_error', message: String((err as Error).message ?? err) }, 500)
  }
})
