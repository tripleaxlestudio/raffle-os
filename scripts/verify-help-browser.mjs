import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Uses an existing test runtime; does not install a browser or change app dependencies.
const require = createRequire(import.meta.url)
const { chromium } = require(process.argv[2])
const executablePath = process.argv[3]
const origin = process.argv[4] ?? 'http://127.0.0.1:5179'
const output = resolve('docs/technical/evidence/help-slice2')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ executablePath, headless: true, args: ['--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=127.0.0.1;localhost'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const externalRequests = []
const failures = []
const results = []
await context.route('**/*', async (route) => {
  const url = new URL(route.request().url())
  if (url.origin === origin) await route.continue()
  else { externalRequests.push({ host: url.hostname, pathname: url.pathname }); await route.abort('internetdisconnected') }
})
context.on('requestfailed', (request) => failures.push({ host: new URL(request.url()).hostname, error: request.failure()?.errorText }))
const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (error) => pageErrors.push(error.message))
const routes = [['whats-new', 'Yang Baru di Kocokan'], ['guide', 'Panduan Pengguna'], ['support', 'Dukungan Kocokan'], ['licenses', 'Lisensi & Open Source']]
try {
  // A refused proxy plus context abort rules isolate internet while keeping loopback runtime available.
  const probe = await context.newPage()
  await assert.rejects(probe.goto('https://example.com', { timeout: 10000 }))
  await probe.close()
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    await page.setViewportSize(viewport)
    for (const [route, heading] of routes) {
      await page.goto(`${origin}/help/${route}`)
      await page.getByRole('heading', { name: heading, exact: true, level: 1 }).waitFor()
      await page.reload()
      await page.getByRole('heading', { name: heading, exact: true, level: 1 }).waitFor()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      assert.equal(overflow, false, `${route} must not overflow horizontally`)
      if (route === 'guide') {
        await page.getByRole('link', { name: 'Checklist Sebelum Acara', exact: true }).focus()
        await page.keyboard.press('Enter')
        await page.waitForURL('**/guide#checklist-sebelum-acara')
        const anchor = await page.locator('#checklist-sebelum-acara').evaluate((element) => ({ focused: element === document.activeElement, y: element.getBoundingClientRect().top, outline: getComputedStyle(element).outlineStyle }))
        assert.equal(anchor.focused, true)
        assert.ok(anchor.y >= 65 && anchor.y < viewport.height - 40, `anchor visible below header: ${anchor.y}`)
        await page.getByRole('checkbox', { name: /^Opsional:/ }).check()
        await page.screenshot({ path: resolve(output, `guide-checklist-${viewport.width}.png`) })
        await page.getByRole('link', { name: 'Alur Cepat Kocokan', exact: true }).focus()
        await page.keyboard.press('Enter')
        await page.screenshot({ path: resolve(output, `guide-journey-${viewport.width}.png`) })
      }
      if (route === 'support') {
        const summary = page.locator('summary').first()
        await summary.focus()
        await page.keyboard.press('Enter')
        assert.equal(await page.locator('details').first().getAttribute('open'), '')
        const focusStyle = await summary.evaluate((element) => ({ outline: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth }))
        assert.notEqual(focusStyle.outline, 'none')
        await page.screenshot({ path: resolve(output, `support-${viewport.width}.png`) })
        await page.getByRole('link', { name: 'Lihat Tampilan Audiens dan Persiapan AV', exact: true }).focus()
        await page.keyboard.press('Enter')
        await page.waitForURL('**/guide#tampilan-audiens-dan-persiapan-av')
        assert.equal(await page.locator('#tampilan-audiens-dan-persiapan-av').evaluate((el) => el === document.activeElement), true)
      }
      if (route === 'licenses') {
        const summary = page.locator('summary').filter({ hasText: 'Node.js' })
        await summary.focus()
        await page.keyboard.press('Enter')
        const pre = page.getByLabel('Teks lisensi Node.js', { exact: true })
        await pre.focus()
        assert.ok(await pre.evaluate((el) => el.scrollHeight > el.clientHeight))
        await page.keyboard.press('PageDown')
        await page.waitForFunction(() => document.activeElement?.scrollTop > 0)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
        await page.screenshot({ path: resolve(output, `licenses-${viewport.width}.png`) })
      }
      await page.getByRole('link', { name: 'Kembali ke Settings → Tentang' }).click()
      await page.getByRole('tab', { name: 'Tentang', exact: true }).waitFor()
      assert.equal(await page.getByRole('tab', { name: 'Tentang', exact: true }).getAttribute('aria-selected'), 'true')
      results.push({ viewport, route, directAndRefresh: 'passed', keyboardAndLayout: 'passed', returnToAbout: 'passed' })
    }
  }
  assert.equal(externalRequests.length, 1, 'Help must fetch no external content (only probe attempted)')
  await page.goto(`${origin}/help/support`)
  assert.ok(await page.getByText(/Google Forms membutuhkan koneksi internet/).isVisible())
  await page.getByRole('button', { name: 'Laporkan Masalah', exact: true }).click()
  await page.getByLabel('Judul masalah', { exact: false }).fill('Uji Help offline')
  await page.getByLabel('Kategori', { exact: false }).selectOption({ index: 1 })
  await page.getByLabel('Tingkat dampak', { exact: false }).selectOption({ index: 1 })
  for (const label of ['Apa yang terjadi?', 'Apa yang seharusnya terjadi?', 'Langkah untuk mengulang masalah']) await page.getByLabel(label, { exact: false }).fill('Uji koneksi pada browser terisolasi; tanpa data acara atau peserta.')
  await page.getByRole('button', { name: 'Tinjau Laporan' }).click()
  const popupPromise = context.waitForEvent('page')
  await page.getByRole('button', { name: 'Buka Form Feedback' }).click()
  const popup = await popupPromise
  await popup.waitForLoadState('domcontentloaded').catch(() => {})
  await page.getByRole('dialog', { name: 'Laporkan Masalah' }).waitFor()
  await page.keyboard.press('Escape')
  await page.getByRole('heading', { name: 'Dukungan Kocokan', level: 1 }).waitFor()
  await page.getByRole('link', { name: 'Buka Panduan Pengguna' }).click()
  await page.getByRole('heading', { name: 'Panduan Pengguna', level: 1 }).waitFor()
  assert.ok(externalRequests.some((item) => item.host === 'docs.google.com'))
  assert.deepEqual(pageErrors, [])
  writeFileSync(resolve(output, 'browser-verification.json'), JSON.stringify({ browser: await browser.version(), isolation: 'Internet blocked by refused proxy and request abort; local HTTP runtime retained. No service worker/server-stop offline claim.', results, externalRequests, failures, pageErrors, googleFormsFailureAppSurvives: true }, null, 2) + '\n')
  console.log('PASS: routes/refresh, anchors, keyboard, both viewports, local notices, blocked Google Forms with app intact.')
} finally { await browser.close() }
