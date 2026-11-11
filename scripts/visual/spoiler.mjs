/**
 * Phase 4D Spoiler 验收（禁用 JS / 鼠标 / Enter / Space / 焦点环）
 *
 * 为什么单独写：Spoiler 是唯一「默认可见、增强后才模糊」的组件，
 * 只看 CSS 源码无法证明「禁用 JS 时用户真的读得到」。
 *
 * 用法：`node scripts/visual/spoiler.mjs`（需要 3021 端口的生产构建）
 * 输出：docs/audits/assets/phase-4d/spoiler.json + spoiler-*.png
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  applyTheme,
  launchChrome,
  navigate,
  openPage,
  preparePage,
  screenshot,
  settle,
  sleep,
} from './cdp.mjs'

const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3021'
const OUT_DIR = 'docs/audits/assets/phase-4d'
const SHOT_DIR = join(OUT_DIR, 'screenshots')
const ROUTE = '/visual-tests/markdown'

const RESULTS = []
const SHOTS = []

function record(item) {
  RESULTS.push({ ...item, at: new Date().toISOString() })
  console.log(`${item.status.padEnd(10)} ${item.check}${item.detail ? ` — ${item.detail}` : ''}`)
}

/** 滚到 Spoiler 所在小节 */
async function scrollToSpoiler(client) {
  const ok = await client.evaluate(`(() => {
    const node = document.querySelector('.md-spoiler')
    if (!node) return false
    node.scrollIntoView({ block: 'center', behavior: 'instant' })
    return true
  })()`)
  await sleep(260)
  return ok
}

const SPOILER_PROBE = `(() => {
  const node = document.querySelector('.md-spoiler')
  if (!node) return { found: false }
  const style = getComputedStyle(node)
  const parentStyle = getComputedStyle(node.parentElement)
  const rect = node.getBoundingClientRect()

  // Tailwind v4 的计算颜色可能是 oklab()/oklch()，正则拆数字会算出错误的亮度，
  // 所以统一交给 canvas 换算成 sRGB：这在 DevTools 侧调用，禁用页面 JS 时也成立。
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const resolve = (value) => {
    if (!value) return null
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return { r, g, b, a: a / 255 }
  }
  const luminance = ({ r, g, b }) => {
    const channel = (v) => {
      const s = v / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const contrast = (fg, bg) => {
    const f = luminance(fg)
    const b = luminance(bg)
    return (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05)
  }

  const fg = resolve(style.color)
  // 背景可能落在最近的祖先上，逐层向上找第一个不透明背景
  let bgNode = node
  let bg = null
  let bgValue = null
  while (bgNode && !bg) {
    const raw = getComputedStyle(bgNode).backgroundColor
    const candidate = resolve(raw)
    if (candidate && candidate.a > 0.9) {
      bg = candidate
      bgValue = raw
    }
    bgNode = bgNode.parentElement
  }

  return {
    found: true,
    text: node.textContent.trim().slice(0, 40),
    ready: node.dataset.spoilerReady ?? null,
    revealed: node.dataset.revealed ?? null,
    role: node.getAttribute('role'),
    tabIndex: node.tabIndex,
    ariaExpanded: node.getAttribute('aria-expanded'),
    filter: style.filter,
    color: style.color,
    backgroundColor: style.backgroundColor,
    outlineWidth: style.outlineWidth,
    outlineStyle: style.outlineStyle,
    outlineColor: style.outlineColor,
    outlineOffset: style.outlineOffset,
    visibility: style.visibility,
    opacity: style.opacity,
    userSelect: style.userSelect,
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    contrast: fg && bg ? Number(contrast(fg, bg).toFixed(2)) : null,
    bgResolved: bg,
    bgValue,
    fgResolved: fg,
    parentColor: parentStyle.color,
  }
})()`

const ACTIVE_PROBE = `(() => {
  const el = document.activeElement
  if (!el) return null
  return {
    tag: el.tagName.toLowerCase(),
    className: typeof el.className === 'string' ? el.className : '',
    isSpoiler: el.classList.contains('md-spoiler'),
    outlineWidth: getComputedStyle(el).outlineWidth,
    outlineStyle: getComputedStyle(el).outlineStyle,
    outlineColor: getComputedStyle(el).outlineColor,
    outlineOffset: getComputedStyle(el).outlineOffset,
  }
})()`

async function tabUntilSpoiler(client, max = 90) {
  await client.evaluate(
    'document.body.focus(); document.activeElement && document.activeElement.blur()',
  )
  for (let index = 0; index < max; index += 1) {
    await client.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
      code: 'Tab',
      key: 'Tab',
    })
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
      code: 'Tab',
      key: 'Tab',
    })
    const active = await client.evaluate(ACTIVE_PROBE)
    if (active?.isSpoiler) return { tabs: index + 1, active }
  }
  return { tabs: max, active: await client.evaluate(ACTIVE_PROBE) }
}

async function pressKey(client, key) {
  const map = {
    Enter: { windowsVirtualKeyCode: 13, code: 'Enter' },
    Space: { windowsVirtualKeyCode: 32, code: 'Space' },
  }
  const spec = map[key]
  await client.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    windowsVirtualKeyCode: spec.windowsVirtualKeyCode,
    nativeVirtualKeyCode: spec.windowsVirtualKeyCode,
    code: spec.code,
    key: key === 'Space' ? ' ' : key,
  })
  await client.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    windowsVirtualKeyCode: spec.windowsVirtualKeyCode,
    nativeVirtualKeyCode: spec.windowsVirtualKeyCode,
    code: spec.code,
    key: key === 'Space' ? ' ' : key,
  })
  await sleep(240)
}

async function clickSpoiler(client) {
  const point = await client.evaluate(`(() => {
    const node = document.querySelector('.md-spoiler')
    if (!node) return null
    const rect = node.getBoundingClientRect()
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
  })()`)
  if (!point) return false
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseMoved',
    x: point.x,
    y: point.y,
    button: 'none',
  })
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  })
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  })
  await sleep(320)
  return true
}

async function shoot(client, file, note) {
  const buffer = await screenshot(client)
  writeFileSync(join(SHOT_DIR, file), buffer)
  SHOTS.push({
    file: `screenshots/${file}`,
    note,
    bytes: buffer.length,
    at: new Date().toISOString(),
  })
  console.log(`  ↳ shot ${file} (${Math.round(buffer.length / 1024)}KB)`)
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true })
  const chrome = await launchChrome({ port: 9334 })
  const client = await openPage(chrome.port)
  const viewport = { width: 1280, height: 800 }

  // ── A. 禁用 JavaScript ─────────────────────────────────────────
  for (const theme of ['light', 'dark']) {
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Emulation.setScriptExecutionDisabled', { value: true })
    await preparePage(client, { ...viewport, theme })
    await navigate(client, `${BASE}${ROUTE}`)
    // 脚本被禁用，主题只能靠 DevTools 侧设置
    await applyTheme(client, theme)

    const scrolled = await scrollToSpoiler(client)
    await sleep(300)
    const probe = await client.evaluate(SPOILER_PROBE)

    await shoot(client, `spoiler-nojs-${theme}-1280.png`, `禁用 JS · ${theme} · Spoiler 原始文本`)

    record({
      check: `禁用 JS · ${theme} · 文本可读`,
      status: probe.found && probe.filter === 'none' && probe.contrast >= 4.5 ? 'PASS' : 'FAIL',
      detail: `filter=${probe.filter}, contrast=${probe.contrast}:1, ready=${probe.ready}, revealed=${probe.revealed}, 尺寸=${probe.width}×${probe.height}, 定位成功=${scrolled}`,
      probe,
    })
    record({
      check: `禁用 JS · ${theme} · 无增强痕迹`,
      status:
        probe.ready === null && probe.revealed === null && probe.role === null ? 'PASS' : 'FAIL',
      detail: `role=${probe.role}, tabindex=${probe.tabIndex}, aria-expanded=${probe.ariaExpanded}`,
    })
  }

  await client.send('Emulation.setScriptExecutionDisabled', { value: false })

  // ── B. 启用 JavaScript ─────────────────────────────────────────
  await preparePage(client, { ...viewport, theme: 'light' })
  await navigate(client, `${BASE}${ROUTE}`)
  await applyTheme(client, 'light')
  await client.evaluate(`(async () => {
    const deadline = Date.now() + 5000
    while (Date.now() < deadline) {
      const nodes = Array.from(document.querySelectorAll('.md-spoiler'))
      if (nodes.length && nodes.every((n) => n.dataset.spoilerReady === 'true')) return true
      await new Promise((r) => setTimeout(r, 100))
    }
    return false
  })()`)
  await settle(client)
  await scrollToSpoiler(client)

  const initial = await client.evaluate(SPOILER_PROBE)
  await shoot(client, 'spoiler-js-blurred-light-1280.png', 'JS 正常 · 初始（模糊）')
  record({
    check: 'JS 正常 · 初始化状态',
    status:
      initial.ready === 'true' &&
      initial.revealed === null &&
      initial.role === 'button' &&
      initial.tabIndex === 0 &&
      initial.ariaExpanded === 'false'
        ? 'PASS'
        : 'FAIL',
    detail: `ready=${initial.ready}, revealed=${initial.revealed}, role=${initial.role}, tabindex=${initial.tabIndex}, aria-expanded=${initial.ariaExpanded}`,
    probe: initial,
  })
  record({
    check: 'JS 正常 · 模糊生效',
    status: initial.filter !== 'none' && initial.filter.includes('blur') ? 'PASS' : 'FAIL',
    detail: `filter=${initial.filter}（样式声明为 blur(0.34em)）`,
  })

  // 鼠标点击
  await clickSpoiler(client)
  const afterClick = await client.evaluate(SPOILER_PROBE)
  await shoot(client, 'spoiler-js-revealed-light-1280.png', 'JS 正常 · 鼠标点击后展开')
  record({
    check: 'JS 正常 · 鼠标点击展开',
    status: afterClick.revealed === 'true' && afterClick.ariaExpanded === 'true' ? 'PASS' : 'FAIL',
    detail: `revealed=${afterClick.revealed}, aria-expanded=${afterClick.ariaExpanded}, filter=${afterClick.filter}`,
  })

  // 键盘：Enter
  await navigate(client, `${BASE}${ROUTE}`)
  await applyTheme(client, 'light')
  await settle(client)
  await scrollToSpoiler(client)
  const enterFocus = await tabUntilSpoiler(client)
  const beforeEnter = await client.evaluate(SPOILER_PROBE)
  await pressKey(client, 'Enter')
  const afterEnter = await client.evaluate(SPOILER_PROBE)
  record({
    check: 'JS 正常 · Enter 展开',
    status:
      enterFocus.active?.isSpoiler &&
      beforeEnter.revealed === null &&
      afterEnter.revealed === 'true'
        ? 'PASS'
        : 'FAIL',
    detail: `Tab ${enterFocus.tabs} 次聚焦到 Spoiler；展开前 revealed=${beforeEnter.revealed}，展开后 revealed=${afterEnter.revealed}`,
  })
  record({
    check: 'JS 正常 · 焦点环可见',
    status:
      enterFocus.active?.outlineStyle !== 'none' &&
      Number.parseFloat(enterFocus.active?.outlineWidth ?? '0') > 0
        ? 'PASS'
        : 'FAIL',
    detail: `outline=${enterFocus.active?.outlineWidth} ${enterFocus.active?.outlineStyle} ${enterFocus.active?.outlineColor} offset=${enterFocus.active?.outlineOffset}`,
    probe: enterFocus.active,
  })
  await shoot(
    client,
    'spoiler-js-focus-enter-1280.png',
    'JS 正常 · 键盘聚焦后的焦点环 + Enter 展开',
  )

  // 键盘：Space
  await navigate(client, `${BASE}${ROUTE}`)
  await applyTheme(client, 'dark')
  await settle(client)
  await scrollToSpoiler(client)
  const spaceFocus = await tabUntilSpoiler(client)
  const beforeSpace = await client.evaluate(SPOILER_PROBE)
  await pressKey(client, 'Space')
  const afterSpace = await client.evaluate(SPOILER_PROBE)
  record({
    check: 'JS 正常 · Space 展开',
    status:
      spaceFocus.active?.isSpoiler &&
      beforeSpace.revealed === null &&
      afterSpace.revealed === 'true'
        ? 'PASS'
        : 'FAIL',
    detail: `Tab ${spaceFocus.tabs} 次聚焦；展开前 revealed=${beforeSpace.revealed}，展开后 revealed=${afterSpace.revealed}`,
  })
  await shoot(client, 'spoiler-js-space-dark-1280.png', 'JS 正常 · 暗色 · Space 展开')

  // 暗色模糊态
  await navigate(client, `${BASE}${ROUTE}`)
  await applyTheme(client, 'dark')
  await settle(client)
  await scrollToSpoiler(client)
  const darkInitial = await client.evaluate(SPOILER_PROBE)
  await shoot(client, 'spoiler-js-blurred-dark-1280.png', 'JS 正常 · 暗色 · 初始（模糊）')
  record({
    check: 'JS 正常 · 暗色模糊态',
    status: darkInitial.filter !== 'none' && darkInitial.revealed === null ? 'PASS' : 'FAIL',
    detail: `filter=${darkInitial.filter}, revealed=${darkInitial.revealed}`,
  })

  writeFileSync(
    join(OUT_DIR, 'spoiler.json'),
    `${JSON.stringify(
      {
        stage: 'Phase 4D-0 Spoiler 验收',
        generatedAt: new Date().toISOString(),
        route: ROUTE,
        viewport: '1280×800',
        browser: chrome.version.browser,
        results: RESULTS,
        shots: SHOTS,
      },
      null,
      2,
    )}\n`,
  )

  const failed = RESULTS.filter((item) => item.status !== 'PASS')
  console.log(`\n${RESULTS.length} 项检查，非 PASS ${failed.length} 项`)
  client.close()
  await chrome.close()
  if (failed.length) process.exitCode = 0 // 结果写进 JSON，不在此处中断
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
