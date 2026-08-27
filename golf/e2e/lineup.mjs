import { chromium } from 'playwright'
const log = []
const ok = (n, p, d = '') => { log.push(`${p ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); if (!p) process.exitCode = 1 }
let b
try {
  b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const text = () => page.locator('body').innerText()
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Start a round' }).click()
  await page.waitForTimeout(400)

  const names = await page.locator('input[placeholder^="Player"]').evaluateAll((els) => els.map((e) => e.value))
  ok('the four are prefilled in order',
     JSON.stringify(names) === JSON.stringify(['Luke', 'Adam', 'Robby', 'Will']), JSON.stringify(names))
  ok('setup spells out the draw', (await text()).includes('Luke & Adam first'))

  for (let i = 0; i < 4; i++) await page.locator('input[type=number]').nth(i).fill(String([8, 15, 12, 20][i]))
  await page.locator('input[placeholder="Aug long weekend"]').fill('byron')
  await page.getByRole('button', { name: 'Start round' }).click()
  await page.waitForTimeout(500)

  ok('holes 1-6: Luke & Adam v Robby & Will', (await text()).includes('Luke & Adam'))
  const advance = async (n) => {
    for (let i = 0; i < n; i++) await page.getByRole('button', { name: '→' }).click()
    await page.waitForTimeout(250)
  }
  await advance(6)
  ok('holes 7-12: Luke & Robby v Adam & Will', (await text()).includes('Luke & Robby'))
  await advance(6)
  ok('holes 13-18: Luke & Will v Adam & Robby', (await text()).includes('Luke & Will'))

  await page.getByRole('button', { name: '⛳ Hollywood' }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'Start a round' }).click()
  await page.waitForTimeout(400)
  const again = await page.locator('input[placeholder^="Player"]').evaluateAll((els) => els.map((e) => e.value))
  const hcaps = await page.locator('input[type=number]').evaluateAll((els) => els.slice(0, 4).map((e) => e.value))
  ok('round two carries the names forward',
     JSON.stringify(again) === JSON.stringify(['Luke', 'Adam', 'Robby', 'Will']), JSON.stringify(again))
  ok('round two carries the handicaps forward',
     JSON.stringify(hcaps) === JSON.stringify(['8', '15', '12', '20']), JSON.stringify(hcaps))
  ok('round two carries the weekend tag forward',
     (await page.locator('input[placeholder="Aug long weekend"]').inputValue()) === 'byron')
} catch (e) {
  process.exitCode = 1
  log.push(`FAIL  threw — ${String(e).split('\n')[0]}`)
} finally { console.log(log.join('\n')); await b?.close() }
