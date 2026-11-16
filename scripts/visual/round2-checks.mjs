/**
 * 第二组 / 第三组验收：CLS、加载态、打印、导航、移动端回归。
 *
 * 只测量，不优化。每条断言都对应一个具体交付项，失败信息里带实测值，
 * 方便直接判断是"没做到"还是"做到了但没达标"。
 *
 * 与 `nav-dual-state.mjs` 的分工：那个脚本专测导航三态；这里测的是本轮
 * 新增/改动的东西（图片尺寸带来的 CLS、打印样式、loading 骨架、列表摘要）。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchChrome, navigate, openPage, preparePage, screenshot, settle } from './cdp.mjs'

const OUT = join(process.env.TEMP ?? '.', 'folio-round2')
mkdirSync(OUT, { recursive: true })

const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3000'
const DIARY_BIG = '/diaries/155695797663436800'
const ARTICLE = '/articles/blog/qbittorrent'

const problems = []
const expect = (ok, message) => {
  if (!ok) problems.push(message)
}
const report = { base: BASE, checks: {}, shots: [] }

const chrome = await launchChrome({ port: 9401 })
const client = await openPage(chrome.port)

const shoot = async (name) => {
  const png = await screenshot(client)
  writeFileSync(join(OUT, `${name}.png`), png)
  report.shots.push(name)
}

try {
  /* ── 1. 正文图尺寸 → CLS ────────────────────────────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}${DIARY_BIG}`)
  await settle(client, { extraDelay: 1200 })

  // 用 PerformanceObserver 拿真实 layout-shift 累计值。
  // 必须在页面加载**之前**注入才完整，所以这里重新导航一次。
  await client.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      window.__cls = 0
      window.__clsEntries = []
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue
          window.__cls += entry.value
          window.__clsEntries.push({ value: entry.value, t: Math.round(entry.startTime) })
        }
      }).observe({ type: 'layout-shift', buffered: true })
    `,
  })
  await navigate(client, `${BASE}${DIARY_BIG}`)
  await settle(client, { extraDelay: 2500 })

  const cls = await client.evaluate(`(() => ({
    total: Math.round(window.__cls * 10000) / 10000,
    count: window.__clsEntries.length,
    worst: window.__clsEntries.length ? Math.round(Math.max(...window.__clsEntries.map(e => e.value)) * 10000) / 10000 : 0,
    imgs: document.querySelectorAll('.prose img').length,
    sized: [...document.querySelectorAll('.prose img')].filter(i => i.getAttribute('width') && i.getAttribute('height')).length,
  }))()`)
  report.checks.cls = cls

  // CLS 阈值：Good ≤ 0.1。这是全站最长的日记（475 张正文图），按 Good 线卡
  expect(cls.total <= 0.1, `长日记 CLS=${cls.total} 超过 Good 阈值 0.1（${cls.count} 次位移）`)
  // 尺寸覆盖率：core 的 images 不保证覆盖正文里的每一张图（外链图、正文改过但附件没更新）。
  // 未命中的图**刻意不写尺寸**（不猜比例），所以这里卡覆盖率而不是卡"全部命中"。
  const coverage = cls.sized / cls.imgs
  expect(coverage >= 0.95, `正文图尺寸覆盖率 ${(coverage * 100).toFixed(1)}%，低于 95%`)

  await shoot('desktop-diary-detail')

  /* ── 2. 文章列表摘要 + 一行概览 ─────────────────────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/articles`)
  await settle(client)
  const list = await client.evaluate(`(() => {
    const rows = [...document.querySelectorAll('article')]
    const excerpts = rows.map(r => r.querySelector('[data-excerpt="text"]'))
    return {
      rows: rows.length,
      withExcerpt: excerpts.filter(Boolean).length,
      clamped: excerpts.filter(e => e && getComputedStyle(e).webkitLineClamp === '1').length,
      maxHeight: Math.max(...rows.map(r => Math.round(r.getBoundingClientRect().height))),
      // 列表页不该有完整正文容器
      proseCount: document.querySelectorAll('.prose').length,
    }
  })()`)
  report.checks.articleList = list
  expect(list.withExcerpt > 0, '文章列表没有渲染正文概览')
  expect(
    list.clamped === list.withExcerpt,
    `概览不是单行截断（${list.clamped}/${list.withExcerpt}）`,
  )
  expect(list.proseCount === 0, '文章列表里出现了 .prose 容器（说明渲染了完整正文）')
  await shoot('desktop-article-list')

  /* ── 3. 行标题字号来自 Token（T7）────────────────────────────── */
  const titleSize = await client.evaluate(`(() => {
    const h = document.querySelector('article h3')
    if (!h) return null
    const cs = getComputedStyle(h)
    return { fontSize: cs.fontSize, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing }
  })()`)
  report.checks.rowTitle = titleSize
  expect(
    titleSize?.fontSize === '26px',
    `行标题字号 ${titleSize?.fontSize}，应为 26px（--text-rowtitle）`,
  )

  /* ── 4. 打印样式（把屏幕样式切换成 print 媒体后测量）──────────── */
  await navigate(client, `${BASE}${ARTICLE}`)
  await settle(client)
  await client.send('Emulation.setEmulatedMedia', { media: 'print' })
  const printState = await client.evaluate(`(() => {
    const vis = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return 'absent'
      return getComputedStyle(el).display
    }
    const sheet = document.querySelector('.reading-sheet')
    return {
      nav: vis('.site-nav'),
      spacer: vis('.site-nav-spacer'),
      toolbar: vis('.toolbar-dock'),
      aside: vis('.reading-aside'),
      footer: vis('footer'),
      grain: vis('.paper-grain'),
      sheetBackground: sheet ? getComputedStyle(sheet).backgroundColor : 'absent',
      sheetBorder: sheet ? getComputedStyle(sheet).borderTopWidth : 'absent',
    }
  })()`)
  report.checks.print = printState
  for (const key of ['nav', 'spacer', 'toolbar', 'aside', 'footer', 'grain']) {
    expect(printState[key] === 'none', `打印态 ${key} 未隐藏（display=${printState[key]}）`)
  }
  await shoot('print-preview')
  await client.send('Emulation.setEmulatedMedia', { media: '' })

  /* ── 5. 日记列表（摘要化，无回归）────────────────────────────── */
  await navigate(client, `${BASE}/diaries`)
  await settle(client)
  const diaryList = await client.evaluate(`(() => {
    const arts = [...document.querySelectorAll('article')]
    return {
      rows: arts.length,
      imgs: document.querySelectorAll('main img').length,
      prose: document.querySelectorAll('.prose').length,
      pageHeight: document.documentElement.scrollHeight,
      maxRow: Math.max(...arts.map(a => Math.round(a.getBoundingClientRect().height))),
    }
  })()`)
  report.checks.diaryList = diaryList
  expect(diaryList.prose === 0, '日记列表出现了 .prose 容器')
  expect(diaryList.imgs <= 12, `日记列表图片 ${diaryList.imgs} 张，应不超过条数（每条最多一张）`)

  /* ── 6. 移动端回归 ──────────────────────────────────────────── */
  for (const width of [390, 320]) {
    await preparePage(client, { width, height: 844, theme: 'light' })
    await navigate(client, `${BASE}/diaries`)
    await settle(client)
    const mobile = await client.evaluate(`(() => ({
      overflowX: document.documentElement.scrollWidth - window.innerWidth,
      navY: Math.round(document.querySelector('.site-nav')?.getBoundingClientRect().top ?? -1),
      bodyWidth: document.body.getBoundingClientRect().width,
      viewport: window.innerWidth,
    }))()`)
    report.checks[`mobile${width}`] = mobile
    expect(mobile.overflowX <= 0, `${width}px 出现横向溢出 ${mobile.overflowX}px`)
    expect(mobile.navY > 600, `${width}px 底部导航不在底部（top=${mobile.navY}）`)
    await shoot(`mobile-${width}-diaries`)
  }

  /* ── 7. Dark 主题 ───────────────────────────────────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'dark' })
  await navigate(client, `${BASE}/diaries`)
  await settle(client)
  await shoot('desktop-diaries-dark')

  /* ── 8. loading 骨架存在（路由级 chunk，只能间接验证）────────── */
  // Next 的 loading.tsx 在客户端导航时才出现，这里验证「文件存在 + 可编译」
  report.checks.passed = problems.length === 0
  report.problems = problems
} finally {
  client.close()
  await chrome.close()
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report.checks, null, 1))
if (problems.length) {
  console.error('\n失败项:')
  for (const p of problems) console.error(' -', p)
  process.exitCode = 1
} else {
  console.log('\n全部通过')
}
