/**
 * 验证右下工具胶囊与顶栏是同一块玻璃 / 同一套光效。
 *
 * 检查四件事：
 *   1. 胶囊内有 `.nav-glass.glass-nav` 与 `.nav-spotlight` 两层，且 z-index 在内容之下
 *   2. 胶囊的 backdrop-filter 与顶栏卡片一致（同一 Token，不是另写一套数值）
 *   3. 鼠标在胶囊内移动后 `--nav-pointer-x/y` 会跟着变（光斑真的跟随）
 *   4. 三个按钮自身没有独立冰面（无 backdrop-filter / 无 border），只有悬停浅底
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { launchChrome, openPage, preparePage, navigate, settle, screenshot, sleep } from './cdp.mjs'

const BASE = process.env.FOLIO_BASE ?? 'http://127.0.0.1:3100'
const OUT = '/tmp/folio-dock-shots'

const chrome = await launchChrome({ port: 9335 })
const client = await openPage(chrome.port)
const report = { url: '', checks: {}, shots: [] }

try {
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/`)
  await settle(client)
  report.url = await client.evaluate('location.href')

  // ── 1 / 2：胶囊结构与材质 ─────────────────────────────────────
  report.checks.dock = await client.evaluate(`(() => {
    const dock = document.querySelector('.toolbar-dock')
    if (!dock) return { error: 'no .toolbar-dock' }
    const glass = dock.querySelector(':scope > .nav-glass.glass-nav')
    const spot = dock.querySelector(':scope > .nav-spotlight')
    const group = dock.querySelector('[role="group"]')
    const card = document.querySelector('.nav-card')
    const cardGlass = card?.querySelector(':scope > .nav-glass.glass-nav')

    const gs = glass ? getComputedStyle(glass) : null
    const cs = cardGlass ? getComputedStyle(cardGlass) : null
    const dockBox = dock.getBoundingClientRect()

    return {
      hasGlass: Boolean(glass),
      hasSpotlight: Boolean(spot),
      glassBackdrop: gs?.backdropFilter ?? null,
      cardBackdrop: cs?.backdropFilter ?? null,
      glassBackground: gs?.backgroundColor ?? null,
      cardBackground: cs?.backgroundColor ?? null,
      glassRadius: gs?.borderRadius ?? null,
      spotOpacityIdle: spot ? getComputedStyle(spot).opacity : null,
      groupZ: group ? getComputedStyle(group).zIndex : null,
      dockBox: { x: Math.round(dockBox.x), y: Math.round(dockBox.y), w: Math.round(dockBox.width), h: Math.round(dockBox.height) },
      dockRadius: getComputedStyle(dock).borderRadius,
      dockPadding: getComputedStyle(dock).padding,
    }
  })()`)

  // ── 3：光斑跟随 ───────────────────────────────────────────────
  const box = report.checks.dock.dockBox
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: box.x + box.w * 0.3,
    y: box.y + box.h * 0.25,
    pointerType: 'mouse',
  })
  await sleep(160)
  const first = await client.evaluate(
    `getComputedStyle(document.querySelector('.toolbar-dock')).getPropertyValue('--nav-pointer-x').trim()`,
  )
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: box.x + box.w * 0.7,
    y: box.y + box.h * 0.75,
    pointerType: 'mouse',
  })
  await sleep(200)

  report.checks.spotlight = await client.evaluate(`(() => {
    const dock = document.querySelector('.toolbar-dock')
    const spot = dock.querySelector(':scope > .nav-spotlight')
    return {
      x: dock.style.getPropertyValue('--nav-pointer-x').trim(),
      y: dock.style.getPropertyValue('--nav-pointer-y').trim(),
      opacity: spot ? getComputedStyle(spot).opacity : null,
      background: spot ? getComputedStyle(spot).backgroundImage.slice(0, 120) : null,
    }
  })()`)
  report.checks.spotlight.firstSampleX = first

  // ── 4：按钮自身没有独立冰面 ───────────────────────────────────
  report.checks.buttons = await client.evaluate(`(() => {
    const list = Array.from(document.querySelectorAll('.toolbar-dock button'))
    return list.map((el) => {
      const s = getComputedStyle(el)
      const r = el.getBoundingClientRect()
      return {
        label: el.getAttribute('aria-label'),
        w: Math.round(r.width),
        h: Math.round(r.height),
        borderRadius: s.borderRadius,
        backdropFilter: s.backdropFilter,
        borderWidth: s.borderTopWidth,
        background: s.backgroundColor,
        boxShadow: s.boxShadow,
      }
    })
  })()`)

  // 悬停态：只换底色，不加边框/不改模糊
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: box.x + box.w / 2,
    y: box.y + box.h / 2,
    pointerType: 'mouse',
  })
  await sleep(260)
  report.checks.hover = await client.evaluate(`(() => {
    const el = document.querySelector('.toolbar-dock button')
    const s = getComputedStyle(el)
    return { background: s.backgroundColor, borderWidth: s.borderTopWidth, backdropFilter: s.backdropFilter }
  })()`)

  await mkdir(OUT, { recursive: true })
  const shoot = async (name) => {
    const buffer = await screenshot(client)
    await writeFile(`${OUT}/${name}.png`, buffer)
    report.shots.push(`${OUT}/${name}.png`)
  }
  /** 只截胶囊附近并放大，便于肉眼检查玻璃/光斑/边框细节 */
  const zoomDock = async (name) => {
    const b = report.checks.dock.dockBox
    const pad = 28
    const { data } = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
      clip: {
        x: Math.max(0, b.x - pad),
        y: Math.max(0, b.y - pad),
        width: b.w + pad * 2,
        height: b.h + pad * 2,
        scale: 5,
      },
    })
    await writeFile(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
    report.shots.push(`${OUT}/${name}.png`)
  }
  await shoot('01-desktop-dock-hover')
  await zoomDock('01z-desktop-dock-zoom')

  // 暗色
  await client.evaluate(`document.documentElement.dataset.theme='dark'`)
  await sleep(320)
  report.checks.dark = await client.evaluate(`(() => {
    const dock = document.querySelector('.toolbar-dock')
    const glass = dock.querySelector(':scope > .nav-glass.glass-nav')
    const s = getComputedStyle(glass)
    return { background: s.backgroundColor, backdropFilter: s.backdropFilter }
  })()`)
  await shoot('02-desktop-dock-dark')

  // 移动端
  await client.evaluate(`delete document.documentElement.dataset.theme`)
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
    screenWidth: 390,
    screenHeight: 844,
  })
  await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
  await sleep(500)
  report.checks.mobile = await client.evaluate(`(() => {
    const dock = document.querySelector('.toolbar-dock')
    const r = dock.getBoundingClientRect()
    const spot = dock.querySelector(':scope > .nav-spotlight')
    return {
      box: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      bottomGap: Math.round(window.innerHeight - r.bottom),
      rightGap: Math.round(window.innerWidth - r.right),
      spotlightDisplay: spot ? getComputedStyle(spot).display : null,
      scrollW: document.documentElement.scrollWidth,
      viewportW: window.innerWidth,
    }
  })()`)
  await shoot('03-mobile-dock')

  console.log(JSON.stringify(report, null, 2))
} finally {
  client.close()
  await chrome.close()
}
