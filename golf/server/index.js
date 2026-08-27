import express from 'express'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as db from './db.js'

const here = dirname(fileURLToPath(import.meta.url))
const dist = join(here, '..', 'dist')
const app = express()
app.use(express.json({ limit: '256kb' }))

let dbReady = false
let dbError = null

const guard = (handler) => async (req, res) => {
  if (!db.configured) return res.status(503).json({ error: 'no_database', dbReady: false })
  try {
    await handler(req, res)
  } catch (err) {
    console.error(`${req.method} ${req.path}`, err)
    res.status(500).json({ error: 'server_error', message: String(err.message ?? err) })
  }
}

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, database: db.configured, dbReady, dbError }))

app.get('/api/courses', guard(async (_req, res) => res.json(await db.listCourses())))

app.post('/api/courses', guard(async (req, res) => {
  const { name, pars, strokeIndex } = req.body ?? {}
  if (!name || !Array.isArray(pars) || pars.length !== 18) {
    return res.status(400).json({ error: 'bad_course' })
  }
  if (!Array.isArray(strokeIndex) || new Set(strokeIndex).size !== 18) {
    return res.status(400).json({ error: 'bad_stroke_index' })
  }
  res.json(await db.upsertCourse(req.body))
}))

app.get('/api/rounds', guard(async (req, res) =>
  res.json(await db.listRounds(req.query.series))))

app.post('/api/rounds', guard(async (req, res) => {
  const round = await db.createRound(req.body ?? {})
  res.json(round)
}))

app.get('/api/rounds/:code', guard(async (req, res) => {
  const round = await db.getRound(req.params.code.toUpperCase())
  round ? res.json(round) : res.status(404).json({ error: 'not_found' })
}))

// The phone is the source of truth mid-round; this is the durable copy.
app.put('/api/rounds/:code/holes', guard(async (req, res) => {
  const holes = Array.isArray(req.body?.holes) ? req.body.holes : [req.body]
  for (const hole of holes) await db.saveHole(req.params.code.toUpperCase(), hole)
  res.json({ ok: true, saved: holes.length })
}))

app.use(express.static(dist, { maxAge: '1h', index: false }))
app.get('*', (_req, res) => res.sendFile(join(dist, 'index.html')))

const port = process.env.PORT || 3000
app.listen(port, '0.0.0.0', async () => {
  console.log(`hollywood golf listening on ${port}`)
  if (!db.configured) {
    console.warn('DATABASE_URL not set — running phones-only, nothing is persisted')
    return
  }
  try {
    await db.migrate()
    dbReady = true
    console.log('golf schema ready')
  } catch (err) {
    dbError = String(err.message ?? err)
    console.error('migration failed — app still serving, persistence off:', dbError)
  }
})
