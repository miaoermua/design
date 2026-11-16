/**
 * 日记列表页度量：改造前后用同一份脚本，保证可比
 *
 * 只读：不发任何写请求，不改数据。
 * 用法：node scripts/visual/diary-list-metrics.mjs <标签>
 *   FOLIO_BASE 覆盖地址（默认 http://127.0.0.1:3000）
 *   FOLIO_SHOTS 覆盖截图目录（默认系统临时目录）
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { launchChrome, navigate, openPage, preparePage, screenshot, settle } from './cdp.mjs'

const BASE = process.env.FOLIO_BASE ?? 'http://127.0.0.1:3000'
const TAG = process.argv[2] ?? 'run'
const OUT = process.env.FOLIO_SHOTS ?? join(tmpdir(), 'folio-diary-list')
const VIEWPORTS = [
  { w: 1440, h: 900, name: 'desktop-1440' },
  { w: 1280, h: 800, name: 'desktop-1280' },
  { w: 390, h: 844, name: 'mobile-390' },
  { w: 375, h: 812, name: 'mobile-375' },
]

mkdirSync(OUT, { recursive: true })

/** 量一页的结构指标 */
const PROBE = `(() => {
  const doc = document.documentElement
  const entries = [...document.querySelectorAll('article')]
  const imgs = [...document.querySelectorAll('main img')]
  const prose = document.querySelectorAll('.prose')
  return {
    pageHeight: doc.scrollHeight,
    viewports: +(doc.scrollHeight / window.innerHeight).toFixed(1),
    domNodes: doc.querySelectorAll('*').length,
    htmlBytes: doc.outerHTML.length,
    entries: entries.length,
    entryHeights: entries.map((el) => Math.round(el.getBoundingClientRect().height)),
    maxEntryHeight: Math.max(0, ...entries.map((el) => Math.round(el.getBoundingClientRect().height))),
    imgCount: imgs.length,
    proseCount: prose.length,
    lazyImgs: imgs.filter((i) => i.loading === 'lazy').length,
    noDimImgs: imgs.filter((i) => !i.getAttribute('width')).length,
    paginationTop: Math.round(
      document.querySelector('a[rel="next"], nav[aria-label] a:last-child')
        ?.getBoundingClientRect().top ?? -1,
    ),
  }
})()`

const chrome = await launchChrome({ port: 9381 })
const client = await openPage(chrome.port)
const report = { tag: TAG, base: BASE, at: new Date().toISOString(), rows: [] }

try {
  for (const vp of VIEWPORTS) {
    for (const theme of ['light', 'dark']) {
      await preparePage(client, { width: vp.w, height: vp.h, theme })
      await navigate(client, `${BASE}/diaries`)
      await settle(client)
      const m = await client.evaluate(PROBE)
      report.rows.push({ ...vp, theme, ...m })
      const png = await screenshot(client)
      writeFileSync(join(OUT, `${TAG}-${vp.name}-${theme}.png`), png)
    }
  }

  // SSR HTML 体积（不经浏览器，直接取服务端输出）
  const html = await client.evaluate(
    `fetch('/diaries').then((r) => r.text()).then((t) => t.length)`,
  )
  report.ssrHtmlBytes = html

  // 摘要文本抽样：确认真实日记的摘要里没有残留 Markdown 记号
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/diaries`)
  await settle(client)
  report.samples = await client.evaluate(`(() => {
    return [...document.querySelectorAll('article')].slice(0, 10).map((el) => {
      const p = el.querySelector('p.line-clamp-3, p.line-clamp-4, [data-diary-excerpt]')
      const text = (p?.textContent ?? '').trim()
      return {
        title: (el.querySelector('h3')?.textContent ?? '').trim().slice(0, 24),
        excerpt: text.slice(0, 90),
        chars: text.length,
        hasMarkup: /!\\[|\\]\\(|^#{1,6}\\s|^:::|\`\`\`/m.test(text),
        imgCount: el.querySelectorAll('img').length,
      }
    })
  })()`)
} finally {
  writeFileSync(join(OUT, `metrics-${TAG}.json`), JSON.stringify(report, null, 2))
  client.close()
  await chrome.close()
}

const head = report.rows.filter((r) => r.theme === 'light')
console.log(
  JSON.stringify(
    {
      tag: TAG,
      out: OUT,
      ssrHtmlBytes: report.ssrHtmlBytes,
      light: head.map((r) => ({
        viewport: r.name,
        pageHeight: r.pageHeight,
        viewports: r.viewports,
        domNodes: r.domNodes,
        imgs: r.imgCount,
        maxEntry: r.maxEntryHeight,
        prose: r.proseCount,
      })),
      samples: report.samples,
    },
    null,
    2,
  ),
)
