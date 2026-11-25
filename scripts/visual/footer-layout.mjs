/**
 * Footer 左右分区验收（真实几何，不靠肉眼）
 *
 * 只做三件事：
 *   1. 量出「信息区」与「设置区」的真实矩形，判断并排 / 堆叠是否符合断点意图；
 *   2. 量第二行（出处 + 备案 + 自定义链接）实际占了几条视觉行、有没有横向溢出；
 *   3. 滚到页底，用元素矩形的**相交面积**判断右下工具浮标（`.toolbar-dock`）
 *      与移动端贴底导航（`.site-nav`）有没有盖住页脚的可交互元素。
 *
 * 为什么用矩形相交而不是中心点命中：设置区容器是整列宽的，
 * 它的中心点可能落在空白里；只有逐个比对「控件 / 链接矩形 × 浮标矩形」
 * 才能回答「有没有被盖住」。
 *
 * 全部是测量：不改 DOM、不注入样式。截图与 report.json 落在 %TEMP%/folio-footer。
 * 用法：node scripts/visual/footer-layout.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchChrome, navigate, openPage, preparePage, screenshot, settle, sleep } from './cdp.mjs'

const OUT = join(process.env.TEMP ?? '.', 'folio-footer')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3000'
const PATH = process.env.FOLIO_PATH ?? '/'

/**
 * 任务要求的五档 + 三个边界：
 *   320  极窄（iPhone SE 一代）—— 控件组最容易被浮标顶到
 *   1152 版心宽度本身 —— 居中余量刚好为 0，避让量应达上限
 *   1216 居中余量开始生效的过渡带 —— 避让量应连续衰减，不应跳变
 */
const VIEWPORTS = [
  { w: 320, h: 700, name: 'tiny' },
  { w: 390, h: 844, name: 'mobile' },
  { w: 768, h: 1024, name: 'tablet' },
  { w: 1024, h: 768, name: 'laptop' },
  { w: 1152, h: 800, name: 'container' },
  { w: 1216, h: 800, name: 'transition' },
  { w: 1280, h: 800, name: 'desktop' },
  { w: 1440, h: 900, name: 'wide' },
]

const THEMES = (process.env.FOLIO_THEMES ?? 'light,dark').split(',')
/** zh-CN 默认；`FOLIO_LOCALE=en` 复跑一遍，验证更长的英文文案不会挤坏折行 */
const LOCALE = process.env.FOLIO_LOCALE ?? 'zh-CN'

const problems = []
const rows = []
const fail = (msg) => problems.push(msg)

/** 先滚到页底再量：fixed 元素与页脚的真实上下关系只在这个位置出现 */
const SCROLL = `(() => {
  document.documentElement.style.scrollBehavior = 'auto'
  window.scrollTo(0, document.documentElement.scrollHeight)
  return { y: Math.round(window.scrollY), height: document.documentElement.scrollHeight }
})()`

const PROBE = `(() => {
  const rectOf = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1),
             right: +r.right.toFixed(1), bottom: +r.bottom.toFixed(1) }
  }
  const area = (a, b) => {
    if (!a || !b) return 0
    const w = Math.min(a.right, b.right) - Math.max(a.x, b.x)
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)
    return w > 0 && h > 0 ? +(w * h).toFixed(1) : 0
  }

  const q = (s) => document.querySelector(s)
  const inner = q('.site-footer__inner')
  const info = q('.site-footer__info')
  const settings = q('.site-footer__settings')
  const lang = q('.footer-lang__trigger')
  const theme = q('.footer-theme')
  const dock = q('.toolbar-dock')
  const nav = q('.site-nav')
  const navCard = q('.site-nav .nav-card')
  const footer = q('footer')
  const footerNav = q('.site-footer__nav')
  const navList = q('.site-footer__nav-list')

  // 第二行占了几条视觉行：按 unit 的 top 归并（±6px 容差）
  const units = Array.from(document.querySelectorAll('.site-footer__meta-unit'))
  const tops = []
  for (const el of units) {
    const t = Math.round(el.getBoundingClientRect().top)
    if (!tops.some((v) => Math.abs(v - t) <= 6)) tops.push(t)
  }

  // 单元是否被拆开：一个 unit 内部所有子元素应共享同一条基线所在的 top
  const splitUnits = units.filter((u) => {
    const kids = [...u.children]
    if (kids.length < 2) return false
    const ys = kids.map((k) => k.getBoundingClientRect().top)
    return Math.max(...ys) - Math.min(...ys) > 2
  }).length

  const dockRect = rectOf(dock)
  const navRect = rectOf(navCard)

  // 设置区里**真正可交互的控件**右边缘（不含为浮标预留的内边距）
  const controlRight = Math.max(
    ...[lang, theme].filter(Boolean).map((el) => el.getBoundingClientRect().right),
  )

  // 每个可交互元素：与浮标 / 移动端导航的相交面积
  const interactive = [...document.querySelectorAll('footer a, footer button, footer label')].map((el) => {
    const r = rectOf(el)
    return {
      text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 18),
      rect: r,
      dock: area(r, dockRect),
      nav: area(r, navRect),
    }
  })

  const coveredByDock = interactive.filter((i) => i.dock > 0).map((i) => i.text)
  const coveredByNav = interactive.filter((i) => i.nav > 0).map((i) => i.text)

  // 页脚最后一行内容到「移动端导航上沿」的净空
  const lowest = interactive.reduce((m, i) => (i.rect && i.rect.bottom > (m ?? -1e9) ? i.rect.bottom : m), null)

  return {
    viewport: { w: window.innerWidth, h: window.innerHeight },
    scrollY: Math.round(window.scrollY),
    scrollHeight: document.documentElement.scrollHeight,
    overflowX: document.documentElement.scrollWidth - window.innerWidth,
    footer: rectOf(footer),
    footerNav: rectOf(footerNav),
    footerNavBeforeInfo: !footerNav || !info || footerNav.getBoundingClientRect().bottom <= info.getBoundingClientRect().top + 1,
    footerNavOverflow: footerNav ? footerNav.scrollWidth - footerNav.clientWidth : 0,
    footerNavDirection: navList ? getComputedStyle(navList).flexDirection : null,
    inner: rectOf(inner),
    info: rectOf(info),
    settings: rectOf(settings),
    lang: rectOf(lang),
    theme: rectOf(theme),
    dock: dockRect,
    nav: navRect,
    metaLines: tops.length,
    splitUnits,
    controlRight: +controlRight.toFixed(1),
    dockOverlaps: { settings: area(dockRect, rectOf(settings)), lang: area(dockRect, rectOf(lang)), theme: area(dockRect, rectOf(theme)) },
    coveredByDock,
    coveredByNav,
    clearanceAboveNav: navRect && lowest != null ? +(navRect.y - lowest).toFixed(1) : null,
    settingsDisplay: settings ? getComputedStyle(settings).justifyContent : null,
    innerCols: inner ? getComputedStyle(inner).gridTemplateColumns : null,
    innerGap: inner ? getComputedStyle(inner).rowGap : null,
  }
})()`

const chrome = await launchChrome({ port: 9443 })
const client = await openPage(chrome.port)

try {
  // 先落语言 cookie：页脚文案由 RSC 按 cookie 渲染，导航之后才生效
  await preparePage(client, { width: 1280, height: 800, theme: 'light' })
  await navigate(client, `${BASE}${PATH}`)
  await client.evaluate(`(() => {
    document.cookie = 'folio-lang=${LOCALE}; path=/; max-age=31536000; samesite=lax'
  })()`)

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      await preparePage(client, { width: vp.w, height: vp.h, theme })
      await navigate(client, `${BASE}${PATH}`)
      await settle(client)
      const lang = await client.evaluate(`document.documentElement.lang`)
      if (lang !== LOCALE) fail(`${vp.name}: 语言未生效（${lang}，期望 ${LOCALE}）`)
      await client.evaluate(`(() => {
        try { localStorage.setItem('folio-theme', ${JSON.stringify(theme)}) } catch (e) {}
        const root = document.documentElement
        if (${JSON.stringify(theme)} === 'dark') root.dataset.theme = 'dark'
        else delete root.dataset.theme
      })()`)
      await sleep(220)
      await client.evaluate(SCROLL)
      await sleep(450)
      const m = await client.evaluate(PROBE)
      await sleep(120)
      const key = `${vp.name}-${theme}`
      const desktop = vp.w >= 768
      const sideBySide = m.settings.y < m.info.bottom - 8 && m.settings.x > m.info.x + 40
      const stacked = m.settings.y >= m.info.bottom - 1

      rows.push({
        key,
        cols: m.innerCols,
        layout: sideBySide ? 'side-by-side' : stacked ? 'stacked' : 'unclear',
        info: m.info,
        settings: m.settings,
        metaLines: m.metaLines,
        overflowX: m.overflowX,
        dock: m.dock,
        nav: m.nav,
        footerNav: m.footerNav,
        footerNavBeforeInfo: m.footerNavBeforeInfo,
        footerNavOverflow: m.footerNavOverflow,
        footerNavDirection: m.footerNavDirection,
        dockOverlaps: m.dockOverlaps,
        coveredByDock: m.coveredByDock,
        coveredByNav: m.coveredByNav,
        clearanceAboveNav: m.clearanceAboveNav,
      })

      // ── 断言 ─────────────────────────────────────────────
      if (!m.info || !m.settings) fail(`${key}: 缺少信息区或设置区`)
      if (m.overflowX > 0) fail(`${key}: 横向溢出 ${m.overflowX}px`)
      if (m.footerNav && !m.footerNavBeforeInfo) fail(`${key}: 分类导航没有位于信息区上方`)
      if (m.footerNavOverflow > 0) fail(`${key}: 分类导航内部横向溢出 ${m.footerNavOverflow}px`)
      if (m.footerNav && m.footerNavDirection !== (desktop ? 'row' : 'column')) {
        fail(`${key}: 分类导航方向=${m.footerNavDirection}，期望 ${desktop ? 'row' : 'column'}`)
      }

      const normalizedJustify = m.settingsDisplay?.replace(/^flow-/, 'flex-')
      if (desktop) {
        if (!sideBySide) {
          fail(`${key}: 应左右并排（settings.y=${m.settings?.y}, info.bottom=${m.info?.bottom}）`)
        }
        const gap = m.settings.x - m.info.right
        if (gap < 16) fail(`${key}: 两列间距过小 ${gap.toFixed(1)}px`)

        // 两列必须把 grid 铺满：否则右侧会留下一片无内容的死区
        const used = m.info.w + gap + m.settings.w
        if (Math.abs(used - m.inner.w) > 1.5) {
          fail(`${key}: 两列只占 ${used.toFixed(1)}/${m.inner.w.toFixed(1)}px，右侧有死区`)
        }

        // 设置区贴右；为浮标让位时，让出的宽度必须是「刚好够、不多给」
        if (normalizedJustify !== 'flex-end')
          fail(`${key}: 设置区 justify-content=${m.settingsDisplay}`)
        const inset = +(m.inner.right - m.controlRight).toFixed(1)
        const clearOfDock = !m.dock || m.controlRight <= m.dock.x - 4
        if (!clearOfDock && m.dock) {
          fail(`${key}: 控件右缘 ${m.controlRight} 侵入浮标左缘 ${m.dock.x}`)
        }
        if (inset > 64) fail(`${key}: 设置区右缩进 ${inset}px，为浮标让位过多（留白过大）`)
        if (inset > 0 && !clearOfDock) fail(`${key}: 有缩进但仍在浮标下方`)
      } else {
        if (!stacked) fail(`${key}: 手机端应上下排列`)
        if (normalizedJustify !== 'flex-start')
          fail(`${key}: 手机端设置区应靠左（${m.settingsDisplay}）`)
      }

      if (m.coveredByDock.length > 0) {
        fail(`${key}: 页脚元素被回顶浮标覆盖 → ${m.coveredByDock.join(' / ')}`)
      }
      if (m.coveredByNav.length > 0) {
        fail(`${key}: 页脚元素被贴底导航覆盖 → ${m.coveredByNav.join(' / ')}`)
      }
      // 净空只在手机端有意义：≥768px 导航贴在视口顶部，页脚与它不相邻
      if (!desktop && m.clearanceAboveNav != null && m.clearanceAboveNav < 12) {
        fail(`${key}: 页脚最后一行距底部导航仅 ${m.clearanceAboveNav}px（应 ≥12px）`)
      }

      // 第二行：桌面端应尽量在同一视觉行，手机端允许换行但不超过 3 行
      const maxLines = vp.w >= 1024 ? 1 : vp.w >= 768 ? 3 : 3
      if (m.metaLines > maxLines) fail(`${key}: 第二行折成 ${m.metaLines} 行（上限 ${maxLines}）`)
      // 分隔符必须跟着它后面的链接走：任何单元都不该被拆成两行
      if (m.splitUnits > 0) fail(`${key}: ${m.splitUnits} 个链接单元被拆到两行`)

      writeFileSync(join(OUT, `${key}.png`), await screenshot(client))
    }
  }
} finally {
  await chrome.close()
}

const pad = (v, n) => String(v ?? '-').padStart(n)
console.log(
  'viewport      layout        cols                      meta  ovf  covers(dock/nav)  clearance  metaLines',
)
for (const r of rows) {
  console.log(
    `${r.key.padEnd(14)}${r.layout.padEnd(14)}${String(r.cols).padEnd(26)}${pad(r.metaLines, 3)}${pad(r.overflowX, 5)}` +
      `  ${String(r.coveredByDock.length + '/' + r.coveredByNav.length).padEnd(16)}${pad(r.clearanceAboveNav, 8)}  ` +
      `dock.y=${r.dock ? `${r.dock.y}..${r.dock.bottom}` : 'none'} nav.y=${r.nav ? `${r.nav.y}..${r.nav.bottom}` : 'none'}`,
  )
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify({ rows, problems }, null, 2))

if (problems.length > 0) {
  console.log('\n❌ FAIL')
  for (const p of problems) console.log('  - ' + p)
  process.exitCode = 1
} else {
  console.log(`\n✅ 全部通过（截图与 report.json 在 ${OUT}）`)
}
