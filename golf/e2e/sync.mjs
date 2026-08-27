import { chromium } from 'playwright'
const BASE = 'http://localhost:3001'
const log = []
const ok = (n, p, d = '') => { log.push(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!p) process.exitCode = 1 }

let b
try {
  b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const phone = async () => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    return { ctx, page: await ctx.newPage() }
  }

  // ---- phone one starts the round -----------------------------------------
  const a = await phone()
  await a.page.goto(BASE, { waitUntil: 'networkidle' })
  await a.page.getByRole('button', { name: 'Start a round' }).click()
  await a.page.waitForTimeout(400)
  // The course saved through the API earlier should already be in the dropdown.
  const options = await a.page.locator('select option').allInnerTexts()
  ok('course list comes back from the database', options.some((o) => o.includes('Ocean Shores CC')),
     JSON.stringify(options))

  for (let i = 0; i < 4; i++) {
    await a.page.getByPlaceholder(`Player ${i + 1}`).fill(['Robby', 'Dean', 'Spiros', 'Cleo'][i])
    await a.page.locator('input[type=number]').nth(i).fill(String([12, 4, 18, 22][i]))
  }
  await a.page.locator('input[placeholder="Aug long weekend"]').fill('byron-weekend')
  await a.page.getByRole('button', { name: 'Start round' }).click()
  await a.page.waitForTimeout(600)

  const code = await a.page.evaluate(() => location.pathname.split('/').pop())
  ok('round got a shareable code', /^[A-Z0-9]{6}$/.test(code || ''), code)

  // Hole 1: par 4, everyone makes 4.
  for (let s = 0; s < 4; s++) await a.page.getByTestId(`score-${s}-4`).click()
  await a.page.waitForTimeout(1200)

  // ---- phone two joins by code --------------------------------------------
  const c = await phone()
  await c.page.goto(`${BASE}/r/${code}`, { waitUntil: 'networkidle' })
  await c.page.waitForTimeout(1200)
  const seen = await c.page.locator('body').innerText()
  ok('second phone loads the round by its link', seen.includes('Robby') && seen.includes('Cleo'))
  ok('second phone sees hole 1 already scored', seen.includes('h/cap 22 · +2 shots'))
  ok('second phone agrees on the result', seen.includes('Spiros & Cleo'),
     seen.split('\n').filter((l) => l.includes('$')).slice(0, 2).join(' | '))

  // ---- phone one goes into a dead spot -------------------------------------
  await a.ctx.setOffline(true)
  await a.page.getByRole('button', { name: '→' }).click()
  await a.page.waitForTimeout(200)
  for (let s = 0; s < 4; s++) await a.page.getByTestId(`score-${s}-3`).click()   // hole 2, par 3
  await a.page.waitForTimeout(300)
  ok('scores still go in with no signal', (await a.page.locator('body').innerText()).includes('pts'))
  const badge = await a.page.locator('text=/pending/').first().innerText().catch(() => 'none')
  ok('unsent holes are flagged as pending', badge.includes('pending'), badge)

  // ---- back into reception -------------------------------------------------
  await a.ctx.setOffline(false)
  await a.page.waitForTimeout(9000)   // the flush timer runs every 8s
  const after = await a.page.locator('body').innerText()
  ok('queue drains once signal returns', after.includes('synced'),
     after.split('\n').slice(0, 3).join(' | '))

  const res = await fetch(`${BASE}/api/rounds/${code}`)
  const saved = await res.json()
  const hole2 = (saved.holes || []).find((h) => h.hole === 2)
  ok('the hole entered offline reached the database',
     hole2 != null && String(hole2.strokes) === '3,3,3,3', JSON.stringify(hole2))
} catch (err) {
  process.exitCode = 1
  log.push(`FAIL  threw — ${String(err).split('\n')[0]}`)
} finally {
  console.log(log.join('\n'))
  await b?.close()
}
