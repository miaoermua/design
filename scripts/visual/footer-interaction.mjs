/**
 * Footer 设置区交互回归（真实点击，不是断言 DOM）
 *
 * 布局改了之后最容易坏的不是静态排版，而是：
 *   1. 语言菜单向上弹出后是否被视口裁掉（页脚在最底下，空间只剩页面高度）；
 *   2. 主题三档点击后 `data-theme` 与 localStorage 是否真的变了；
 *   3. 语言切换触发 `router.refresh()` 后，新语言是否真的落到页面上。
 *
 * 全部用 CDP 的 `Input.dispatchMouseEvent` 打真点击，坐标取自元素矩形——
 * 这样才能顺带证明「控件没有被浮标压住、真的可点」。
 *
 * 用法：node scripts/visual/footer-interaction.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchChrome, navigate, openPage, preparePage, screenshot, settle, sleep } from './cdp.mjs'

const OUT = join(process.env.TEMP ?? '.', 'folio-footer-interaction')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3000'

const problems = []
const notes = {}
const fail = (m) => problems.push(m)

const chrome = await launchChrome({ port: 9445 })
const client = await openPage(chrome.port)

/** 取元素中心点（视口坐标） */
const centerOf = (sel) =>
  client.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(sel)})
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })()`)

async function clickAt({ x, y }) {
  for (const type of ['mousePressed', 'mouseReleased']) {
    await client.send('Input.dispatchMouseEvent', {
      type,
      x,
      y,
      button: 'left',
      clickCount: 1,
    })
  }
  await sleep(260)
}

async function clickSel(sel) {
  const c = await centerOf(sel)
  if (!c) throw new Error(`element not found: ${sel}`)
  await clickAt(c)
}

/** 按索引点第 n 个匹配元素（`nth-of-type` 对 role 选择器不管用） */
async function clickNth(sel, index) {
  const c = await client.evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(sel)})][${index}]
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }
  })()`)
  if (!c) throw new Error(`element not found: ${sel}[${index}]`)
  await clickAt(c)
}

try {
  // ── 桌面端：语言菜单向上弹出、主题三档、语言切换 ──────────────
  await preparePage(client, { width: 1280, height: 800, theme: 'light' })
  await navigate(client, `${BASE}/`)
  await settle(client)
  await client.evaluate(`(() => {
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, document.documentElement.scrollHeight)
    try { localStorage.removeItem('folio-theme') } catch (e) {}
  })()`)
  await sleep(400)

  // 1) 语言菜单
  await clickSel('.footer-lang__trigger')
  const menu = await client.evaluate(`(() => {
    const m = document.querySelector('.footer-lang__menu')
    if (!m) return null
    const r = m.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right),
             viewportH: window.innerHeight, viewportW: window.innerWidth,
             items: document.querySelectorAll('[role="menuitemradio"]').length }
  })()`)
  notes.menu = menu
  if (!menu) fail('语言菜单未打开')
  else {
    if (menu.items !== 2) fail(`语言菜单项 ${menu.items} 个（应为 2）`)
    if (menu.top < 0) fail(`语言菜单溢出视口顶部（top=${menu.top}）`)
    if (menu.bottom > menu.viewportH) fail(`语言菜单溢出视口底部（bottom=${menu.bottom}）`)
    if (menu.left < 0 || menu.right > menu.viewportW) fail('语言菜单横向溢出')
    // 向上弹：菜单底边应在触发器上方附近（菜单在页脚末尾，向下弹会被裁）
    const trigger = await centerOf('.footer-lang__trigger')
    if (trigger && menu.bottom > trigger.y + 8) fail('语言菜单未向上展开')
  }
  writeFileSync(join(OUT, 'menu-open.png'), await screenshot(client))

  // 2) 选 English → cookie + 页面语言
  await clickNth('[role="menuitemradio"]', 1)
  await sleep(1600)
  const afterLocale = await client.evaluate(`(() => ({
    cookie: document.cookie,
    lang: document.documentElement.lang,
    trigger: document.querySelector('.footer-lang__trigger')?.textContent?.trim(),
    menuOpen: !!document.querySelector('.footer-lang__menu'),
    h1: document.querySelector('h1')?.textContent?.trim()?.slice(0, 40) ?? null,
  }))()`)
  notes.locale = afterLocale
  if (!/folio-lang=en/.test(afterLocale.cookie))
    fail(`切换语言后 cookie 不含 folio-lang=en → ${afterLocale.cookie}`)
  if (afterLocale.lang !== 'en') fail(`<html lang> 仍为 ${afterLocale.lang}`)
  if (afterLocale.menuOpen) fail('选完语言菜单没有关闭')

  // 3) 主题三档（在英文页面里继续点，证明布局与语言无关）
  await client.evaluate(`window.scrollTo(0, document.documentElement.scrollHeight)`)
  await sleep(350)
  const themeStates = []
  // `system` 不做字面量比较：它按 prefers-color-scheme 解析，当前环境是 light，
  // 所以期望值就是 light；真正要断言的是「键被删除」。
  for (const step of [
    { idx: 2, name: 'dark', expect: 'dark' },
    { idx: 0, name: 'light', expect: 'light' },
    { idx: 1, name: 'system', expect: 'light' },
  ]) {
    await clickNth('.footer-theme__option', step.idx)
    const state = await client.evaluate(`(() => ({
      theme: document.documentElement.dataset.theme ?? 'light',
      stored: localStorage.getItem('folio-theme'),
      active: document.querySelector('.footer-theme__option[data-active="true"] input')?.value ?? null,
    }))()`)
    themeStates.push({ clicked: step.name, ...state })
    if (state.theme !== step.expect) {
      fail(`主题档 ${step.name}：data-theme=${state.theme}（期望 ${step.expect}）`)
    }
    if (state.active !== step.name) fail(`主题档 ${step.name}：选中态是 ${state.active}`)
    if (step.name === 'system' && state.stored !== null) fail('system 档应删除 localStorage 键')
    if (step.name !== 'system' && state.stored !== step.name) {
      fail(`主题档 ${step.name}：localStorage=${state.stored}`)
    }
  }
  notes.themes = themeStates
  writeFileSync(join(OUT, 'theme-after.png'), await screenshot(client))

  // 4) 手机端：菜单向上弹出是否仍在视口内、点击是否可命中
  await preparePage(client, { width: 390, height: 844, theme: 'light' })
  await navigate(client, `${BASE}/`)
  await settle(client)
  await client.evaluate(`(() => {
    document.documentElement.style.scrollBehavior = 'auto'
    window.scrollTo(0, document.documentElement.scrollHeight)
  })()`)
  await sleep(400)
  await clickSel('.footer-lang__trigger')
  const mobileMenu = await client.evaluate(`(() => {
    const m = document.querySelector('.footer-lang__menu')
    if (!m) return null
    const r = m.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right),
             viewportH: window.innerHeight, viewportW: window.innerWidth }
  })()`)
  notes.mobileMenu = mobileMenu
  if (!mobileMenu) fail('手机端语言菜单未打开')
  else {
    if (mobileMenu.top < 0) fail(`手机端菜单溢出顶部（top=${mobileMenu.top}）`)
    if (mobileMenu.right > mobileMenu.viewportW) fail('手机端菜单横向溢出')
  }
  writeFileSync(join(OUT, 'mobile-menu.png'), await screenshot(client))
} finally {
  await chrome.close()
}

console.log(JSON.stringify(notes, null, 2))
if (problems.length > 0) {
  console.log('\n❌ FAIL')
  for (const p of problems) console.log('  - ' + p)
  process.exitCode = 1
} else {
  console.log(`\n✅ 交互回归通过（截图在 ${OUT}）`)
}
