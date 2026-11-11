/**
 * Phase 4D 字体加载实测（只测量，不优化）
 *
 * 回答三个问题，且只用网络事件与浏览器 API 回答，不用「202 个文件共 10 MB」倒推：
 *   1. 一个真实页面到底请求了几个 WOFF2 分片、传输多少字节；
 *   2. 冷启动与热缓存差多少；
 *   3. 首页与文章详情差多少。
 *
 * 明确不采集 LCP / CLS / INP / FCP：本阶段没有跑 Lighthouse，
 * 也不打算用推断值填充这些指标。
 *
 * 用法：`node scripts/visual/fonts.mjs`
 * 输出：docs/audits/assets/phase-4d/fonts.json
 */

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { applyTheme, launchChrome, navigate, openPage, preparePage, sleep } from './cdp.mjs'

const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3021'
const OUT_DIR = 'docs/audits/assets/phase-4d'

const PAGES = [
  { key: 'home', route: '/', label: '首页' },
  { key: 'article', route: '/articles/essay/paper-and-whitespace', label: '文章详情' },
  { key: 'markdown', route: '/visual-tests/markdown', label: 'Markdown 全组件样张' },
]

/** 在新文档里尽早记录 document.fonts.ready 的时间点 */
const FONTS_READY_HOOK = `
  window.__fontTiming = { startedAt: performance.now(), readyAt: null }
  document.fonts.ready.then(() => {
    window.__fontTiming.readyAt = performance.now()
  })
`

function collect(client) {
  const fonts = new Map()
  const others = new Map()

  client.on('Network.responseReceived', (params) => {
    const { requestId, response, type } = params
    const entry = {
      url: response.url,
      type,
      status: response.status,
      mimeType: response.mimeType,
      fromDiskCache: Boolean(response.fromDiskCache),
      fromMemoryCache: Boolean(response.fromMemoryCache),
      fromServiceWorker: Boolean(response.fromServiceWorker),
      encodedDataLength: 0,
    }
    if (/\.woff2(\?|$)/.test(response.url)) fonts.set(requestId, entry)
    else others.set(requestId, entry)
  })

  client.on('Network.loadingFinished', (params) => {
    const entry = fonts.get(params.requestId) ?? others.get(params.requestId)
    if (entry) entry.encodedDataLength = params.encodedDataLength
  })

  return {
    reset() {
      fonts.clear()
      others.clear()
    },
    snapshot() {
      const fontList = [...fonts.values()]
      // 切片文件名里带字体家族与分片序号，例如 noto-sans-sc-032.xxxx.woff2
      const slices = fontList
        .map((item) => item.url.split('/').pop())
        .filter((name) => name.startsWith('noto-'))
        .sort()
      return {
        fontRequests: fontList.length,
        fontBytes: fontList.reduce((sum, item) => sum + item.encodedDataLength, 0),
        fontBytesCached: fontList
          .filter((item) => item.fromDiskCache || item.fromMemoryCache)
          .reduce((sum, item) => sum + item.encodedDataLength, 0),
        cachedRequests: fontList.filter((item) => item.fromDiskCache || item.fromMemoryCache)
          .length,
        woff2Slices: slices,
        families: [...new Set(slices.map((name) => name.replace(/-\d+\..*$/, '')))].sort(),
        // 只有 pages 里引用的 CSS 里出现的 @font-face 才会被请求，
        // 这里顺带看总资源量，判断页面整体是否被字体拖住
        allRequests: others.size + fontList.length,
        allBytes:
          [...others.values()].reduce((sum, item) => sum + item.encodedDataLength, 0) +
          fontList.reduce((sum, item) => sum + item.encodedDataLength, 0),
      }
    },
  }
}

async function measure(client, collector, page, label) {
  collector.reset()
  await navigate(client, `${BASE}${page.route}`)
  await applyTheme(client, 'light')

  // 等字体真正就绪（页面里已挂 hook），最多 8s
  const timing = await client.evaluate(`(async () => {
    const deadline = Date.now() + 8000
    while (Date.now() < deadline && !(window.__fontTiming && window.__fontTiming.readyAt)) {
      await new Promise((r) => setTimeout(r, 60))
    }
    const t = window.__fontTiming ?? {}
    return {
      readyAt: t.readyAt ?? null,
      startedAt: t.startedAt ?? null,
      status: document.fonts.status,
      faceCount: document.fonts.size,
      notoSansLoaded: document.fonts.check('16px "Noto Sans SC"'),
      notoSerifLoaded: document.fonts.check('16px "Noto Serif SC"'),
      h1Family: getComputedStyle(document.querySelector('h1')).fontFamily,
      bodyFamily: getComputedStyle(document.body).fontFamily,
    }
  })()`)

  await sleep(500)
  const snapshot = collector.snapshot()
  console.log(
    `  ${label.padEnd(22)} 请求 ${String(snapshot.fontRequests).padStart(3)}  传输 ${(snapshot.fontBytes / 1024).toFixed(1).padStart(7)} KB  fonts.ready ${
      timing.readyAt === null ? 'n/a' : `${timing.readyAt.toFixed(0)} ms`
    }`,
  )
  return {
    ...snapshot,
    fontsReadyAtMs: timing.readyAt === null ? null : Math.round(timing.readyAt),
    fontsStatus: timing.status,
    fontFaceCount: timing.faceCount,
    notoSansLoaded: timing.notoSansLoaded,
    notoSerifLoaded: timing.notoSerifLoaded,
    h1Family: timing.h1Family,
    bodyFamily: timing.bodyFamily,
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const profile = mkdtempSync(join(tmpdir(), 'folio-fonts-'))
  const result = {
    stage: 'Phase 4D-0 字体加载实测',
    generatedAt: new Date().toISOString(),
    pages: {},
  }

  // ── 冷缓存：全新 profile + 清空缓存 + 禁用内存/磁盘缓存 ──────────
  let chrome = await launchChrome({ port: 9338, profile })
  let client = await openPage(chrome.port)
  client.browserVersion = chrome.version
  await client.send('Page.enable')
  await client.send('Runtime.enable')
  await client.send('Network.enable')
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: FONTS_READY_HOOK })
  await preparePage(client, { width: 1280, height: 800, theme: 'light' })
  await client.send('Network.clearBrowserCache')
  await client.send('Network.setCacheDisabled', { cacheDisabled: true })

  const collector = collect(client)
  console.log('\n── 冷缓存（cache disabled，统计真实传输字节） ──')
  for (const page of PAGES) {
    result.pages[page.key] ??= {}
    result.pages[page.key].label = page.label
    result.pages[page.key].route = page.route
    result.pages[page.key].cold = await measure(client, collector, page, page.label)
  }
  client.close()
  await chrome.close()

  // ── 热缓存：同一个 profile，缓存放开，二次访问 ──────────────────
  chrome = await launchChrome({ port: 9339, profile })
  client = await openPage(chrome.port)
  client.browserVersion = chrome.version
  await client.send('Page.enable')
  await client.send('Runtime.enable')
  await client.send('Network.enable')
  await client.send('Page.addScriptToEvaluateOnNewDocument', { source: FONTS_READY_HOOK })
  await preparePage(client, { width: 1280, height: 800, theme: 'light' })
  await client.send('Network.setCacheDisabled', { cacheDisabled: false })

  const warmCollector = collect(client)
  console.log('\n── 热缓存（同一 profile 第二次访问） ──')
  for (const page of PAGES) {
    result.pages[page.key].warm = await measure(client, warmCollector, page, page.label)
  }

  result.environment = {
    browser: chrome.version.browser,
    baseUrl: BASE,
    cacheDisabledForCold: true,
    note: 'fontBytes 来自 Network.loadingFinished.encodedDataLength，即真实传输字节；缓存命中时为 0。',
  }
  result.summary = {
    coldTotalFontBytes: Object.values(result.pages).reduce((sum, p) => sum + p.cold.fontBytes, 0),
    coldMaxRequests: Math.max(...Object.values(result.pages).map((p) => p.cold.fontRequests)),
    warmMaxRequests: Math.max(...Object.values(result.pages).map((p) => p.warm.fontRequests)),
    slicesUnion: [
      ...new Set(Object.values(result.pages).flatMap((p) => p.cold.woff2Slices)),
    ].sort(),
  }
  result.summary.slicesUnionCount = result.summary.slicesUnion.length

  writeFileSync(join(OUT_DIR, 'fonts.json'), `${JSON.stringify(result, null, 2)}\n`)
  console.log(
    `\n共命中 ${result.summary.slicesUnionCount} 个不同切片；结果写入 ${OUT_DIR}/fonts.json`,
  )

  client.close()
  await chrome.close()
  rmSync(profile, { recursive: true, force: true })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
