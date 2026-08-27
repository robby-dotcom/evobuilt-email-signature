import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const SHOT = process.env.SP + '/shots'
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const log = []
const ok = (name, pass, detail = '') => {
  log.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!pass) process.exitCode = 1
}

let browser
try {
  browser = await chromium.launch({ executablePath: CHROME })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    // 503s are the app running without DATABASE_URL on purpose; anything else is real.
    if (m.type() === 'error' && !m.text().includes('503')) errors.push(m.text())
  })

  const body = () => page.locator('body').innerText()
  const has = async (needle) => (await body()).toLowerCase().includes(needle.toLowerCase())
  const enter = async (scores) => {
    for (let s = 0; s < 4; s++) await page.getByTestId(`score-${s}-${scores[s]}`).click()
    await page.waitForTimeout(100)
  }
  const next = async () => {
    await page.getByRole('button', { name: '→' }).click()
    await page.waitForTimeout(150)
  }

  await page.goto(BASE, { waitUntil: 'networkidle' })
  ok('home renders', await page.getByRole('button', { name: 'Start a round' }).isVisible())

  // ---- course card ---------------------------------------------------------
  await page.getByRole('button', { name: 'Start a round' }).click()
  await page.getByRole('button', { name: '+ Add a course' }).click()
  await page.getByPlaceholder('Ocean Shores Country Club').fill('Ocean Shores CC')
  await page.getByPlaceholder('Ocean Shores, NSW').fill('Ocean Shores, NSW')
  for (let h = 1; h <= 18; h++) {
    const par = h % 3 === 2 ? 3 : h % 3 === 0 ? 5 : 4
    if (par !== 4) await page.getByTestId(`par-${h}-${par}`).click()
  }
  ok('card totals par 72', await has('par 72'))
  ok('card reports the 6/6/6 mix', await has('6×3 · 6×4 · 6×5'))

  // A stroke index typo must be refused rather than silently corrupting scoring.
  await page.getByTestId('si-2').fill('1')
  await page.waitForTimeout(150)
  ok('duplicate stroke index blocks save',
     await has('exactly once')
     && await page.getByRole('button', { name: 'Save course' }).isDisabled())
  await page.getByTestId('si-2').fill('3')
  await page.waitForTimeout(150)
  await page.getByRole('button', { name: 'Save course' }).click()
  await page.waitForTimeout(300)

  // ---- players -------------------------------------------------------------
  const names = ['Robby', 'Dean', 'Spiros', 'Cleo']
  const hcaps = [12, 4, 18, 22]
  for (let i = 0; i < 4; i++) {
    await page.getByPlaceholder(`Player ${i + 1}`).fill(names[i])
    await page.locator('input[type=number]').nth(i).fill(String(hcaps[i]))
  }
  await page.getByRole('button', { name: 'Start round' }).click()
  await page.waitForTimeout(400)
  ok('round opens on hole 1 with the first pairing', await has('Robby & Dean'))
  await page.screenshot({ path: `${SHOT}/1-play-empty.png` })

  // ---- hole 1: par 4, all fours. Shots make it 3-3, so halved and carried. --
  await enter([4, 4, 4, 4])
  ok('handicap gives Cleo two shots on stroke index 1', await has('h/cap 22 · +2 shots'))
  ok('hole 1 goes to the side carrying the shots', await has('Spiros & Cleo · +$5'))
  await page.screenshot({ path: `${SHOT}/2-play-hole1.png` })

  // ---- hole 2: par 3, Robby holes it, and is closest ----------------------
  await next()
  ok('par 3 asks for closest to the pin', await has('Closest to the pin'))
  await enter([2, 3, 3, 3])
  await page.getByTestId('pick-0').click()
  await page.waitForTimeout(150)
  const h2 = (await body()).toLowerCase()
  ok('hole 2 pays a gross birdie skin', h2.includes('birdie'))
  ok('hole 2 pays the closest to pin skin', h2.includes('closest'))
  ok('hole 2 pays exactly the two junk skins, no hole skin',
     h2.includes('2 skins at $5 each') && !/hole\s+robby/.test(h2))
  await page.screenshot({ path: `${SHOT}/3-par3.png`, fullPage: true })

  // ---- hole 3: par 5, long drive offered instead of closest ---------------
  await next()
  ok('par 5 asks for long drive', await has('Long drive'))
  ok('par 5 does not ask for closest', !(await has('Closest to the pin')))
  await enter([4, 6, 6, 6])
  await page.getByTestId('pick-0').click()
  await page.waitForTimeout(150)
  await page.screenshot({ path: `${SHOT}/4-par5.png`, fullPage: true })

  // ---- rotation ------------------------------------------------------------
  for (let h = 3; h < 7; h++) { await enter([5, 5, 5, 5]); await next() }
  ok('partners swap at hole 7', await has('Robby & Spiros'))
  for (let h = 7; h < 13; h++) { await enter([5, 5, 5, 5]); await next() }
  ok('partners swap again at hole 13', await has('Robby & Cleo'))
  for (let h = 13; h <= 18; h++) { await enter([5, 5, 5, 5]); if (h < 18) await next() }

  // ---- board ---------------------------------------------------------------
  ok('board is reachable from the play screen',
     await page.getByRole('button', { name: 'Board' }).isVisible())
  await page.getByRole('button', { name: 'Board' }).click()
  await page.waitForTimeout(300)
  ok('board shows the money through 18', await has('money · through 18 holes'))
  ok('board breaks skins down by type', await has('where the skins came from'))
  await page.screenshot({ path: `${SHOT}/5-board.png`, fullPage: true })

  // ---- settle --------------------------------------------------------------
  await page.getByRole('button', { name: 'Settle' }).click()
  await page.waitForTimeout(300)
  ok('settle names who pays who', await has('who pays who'))
  await page.screenshot({ path: `${SHOT}/6-settle.png`, fullPage: true })

  // The weekend ledger must net to zero.
  const weekend = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('li')]
      .map((li) => li.textContent || '')
      .filter((t) => /-?\$\d/.test(t))
    return rows.slice(0, 4).map((t) => {
      const m = t.match(/(-?)\$(\d+(?:\.\d+)?)/)
      return m ? (m[1] ? -1 : 1) * Number(m[2]) : 0
    })
  })
  const sum = weekend.reduce((a, b) => a + b, 0)
  ok('weekend ledger nets to zero', Math.abs(sum) < 0.001, `sum=${sum} of ${JSON.stringify(weekend)}`)

  ok('no runtime errors anywhere', errors.length === 0, errors.slice(0, 2).join(' | '))

  // ---- reload with no signal ----------------------------------------------
  await ctx.setOffline(true)
  await page.goto(BASE, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(800)
  const offline = await body().catch(() => '')
  ok('opens and keeps the round with no signal',
     offline.includes('Robby') && offline.includes('Ocean Shores'),
     offline.split('\n').slice(0, 6).join(' / '))
  await page.screenshot({ path: `${SHOT}/7-offline.png`, fullPage: true })
  await ctx.setOffline(false)
} catch (err) {
  process.exitCode = 1
  log.push(`FAIL  threw — ${String(err).split('\n')[0]}`)
} finally {
  console.log(log.join('\n'))
  await browser?.close()
}
