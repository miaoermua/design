/**
 * Phase 4D 截图矩阵采集
 *
 *   页面：首页 / 文章详情 / Markdown 全组件样张
 *   视口：390×844、768×1024、1024×768、1280×800
 *   主题：light / dark
 *   额外交付：1280 宽下的组件特写（按标题定位后截图）
 *
 * 前置：`MX_MOCK=1 PORT=3021 pnpm start` 已经在跑（生产构建）。
 * 用法：`node scripts/visual/capture.mjs`
 *
 * 输出：
 *   docs/audits/assets/phase-4d/screenshots/*.png
 *   docs/audits/assets/phase-4d/manifest.json
 *
 * 说明：截图一律来自真实 Chrome（系统安装版），没有使用任何占位图或模拟渲染。
 */

import { execFileSync } from 'node:child_process'
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

const PAGES = [
  { key: 'home', route: '/', label: '首页' },
  { key: 'article', route: '/articles/essay/paper-and-whitespace', label: '文章详情' },
  { key: 'markdown', route: '/visual-tests/markdown', label: 'Markdown 全组件样张' },
]

const VIEWPORTS = [
  { width: 390, height: 844, label: '390' },
  { width: 768, height: 1024, label: '768' },
  { width: 1024, height: 768, label: '1024' },
  { width: 1280, height: 800, label: '1280' },
]

const THEMES = ['light', 'dark']

/**
 * 组件特写：按二级标题定位，截标题之后的一屏。
 *
 * 每个条目对应样张里的一节，覆盖范围以「样张的十六节」为准，
 * 不要求一屏装下整节——装不下的部分留在主矩阵里。
 */
const COMPONENTS = [
  { key: 'typography', heading: '一、标题层级' },
  { key: 'inline-marks', heading: '二、正文与行内标记' },
  { key: 'blockquote', heading: '三、引用块' },
  { key: 'code', heading: '四、代码' },
  { key: 'math', heading: '五、数学公式' },
  { key: 'callouts', heading: '六、Callout 六型' },
  { key: 'alerts-banner', heading: '七、GitHub Alerts 五型' },
  { key: 'details', heading: '九、Details 折叠' },
  { key: 'gallery', heading: '十、Gallery 与 Carousel' },
  { key: 'mermaid', heading: '十二、Mermaid', ready: '.mermaid-block svg' },
  { key: 'table-footnotes', heading: '十三、表格' },
  { key: 'mentions', heading: '十五、社交提及' },
]

function isoNow() {
  return new Date().toISOString()
}

function gitInfo() {
  try {
    return {
      head: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
      branch: execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      dirty:
        execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
          .split('\n')
          .filter(Boolean).length + ' entries',
    }
  } catch {
    return { head: 'unknown', branch: 'unknown', dirty: 'unknown' }
  }
}

/** 取一组能证明「当前主题真的生效」的计算样式 */
const PROBE_EXPRESSION = `(() => {
  const pick = (selector) => {
    const el = document.querySelector(selector)
    if (!el) return null
    const style = getComputedStyle(el)
    let family = style.fontFamily
    return {
      selector,
      fontFamily: family,
      firstFamily: family.split(',')[0].replace(/["']/g, '').trim(),
      weight: style.fontWeight,
      fontSize: style.fontSize,
      color: style.color,
    }
  }
  return {
    fontStatus: document.fonts.status,
    fontFaceCount: document.fonts.size,
    htmlTheme: document.documentElement.dataset.theme ?? 'light',
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    bodyColor: getComputedStyle(document.body).color,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    samples: [
      pick('h1'),
      pick('.prose h2'),
      pick('.prose p'),
      pick('.prose code'),
      pick('.md-callout__title'),
      pick('.meta'),
    ].filter(Boolean),
    notoLoaded: {
      sans: document.fonts.check('16px "Noto Sans SC"'),
      serif: document.fonts.check('16px "Noto Serif SC"'),
    },
  }
})()`

async function collectEnvironment(client) {
  const userAgent = await client.evaluate('navigator.userAgent')
  return {
    browser: client.browserVersion?.browser ?? 'unknown',
    protocolVersion: client.browserVersion?.protocolVersion ?? 'unknown',
    userAgent,
    platform: process.platform,
    platformVersion: execFileSync('sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim(),
    node: process.version,
    headless: true,
    deviceScaleFactor: 1,
    baseUrl: BASE,
    git: gitInfo(),
  }
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true })

  const chrome = await launchChrome({ port: 9333 })
  const client = await openPage(chrome.port)
  client.browserVersion = chrome.version

  const shots = []
  const startedAt = isoNow()

  const capture = async ({ file, page, route, theme, viewport, note }) => {
    const params = { ...viewport, theme }
    await preparePage(client, params)
    await navigate(client, `${BASE}${route}`)
    await applyTheme(client, theme)

    // 样张页要等 Spoiler / 相册增强器挂完标记，避免截到「还没初始化」的中间态
    if (route === '/visual-tests/markdown') {
      try {
        await client.evaluate(`(async () => {
          const deadline = Date.now() + 4000
          while (Date.now() < deadline) {
            const nodes = Array.from(document.querySelectorAll('.md-spoiler'))
            if (nodes.length && nodes.every((n) => n.dataset.spoilerReady === 'true')) return true
            await new Promise((r) => setTimeout(r, 100))
          }
          return false
        })()`)
      } catch {
        /* 记录在 probe 里 */
      }
    }

    const probeSettle = await settle(client)
    const probe = await client.evaluate(PROBE_EXPRESSION)
    const buffer = await screenshot(client)
    writeFileSync(join(SHOT_DIR, file), buffer)

    const entry = {
      file: `screenshots/${file}`,
      page,
      route,
      theme,
      viewport: `${viewport.width}×${viewport.height}`,
      viewportPx: { width: viewport.width, height: viewport.height },
      dpr: 1,
      capturedAt: isoNow(),
      fontsLoaded: probeSettle.fontStatus === 'loaded',
      fontFaceCount: probeSettle.fontFaceCount,
      brokenImages: probeSettle.brokenImages,
      documentHeight: probeSettle.scrollHeight,
      bytes: buffer.length,
      note: note ?? null,
      probe,
    }
    shots.push(entry)
    console.log(
      `✓ ${file}  ${entry.viewport}  ${theme}  faces=${entry.fontFaceCount}  ${Math.round(buffer.length / 1024)}KB`,
    )
    await sleep(120)
  }

  // 主矩阵：4 视口 × 2 主题 × 3 页面
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      for (const page of PAGES) {
        await capture({
          file: `${theme}-${page.key}-${viewport.label}.png`,
          page: page.label,
          route: page.route,
          theme,
          viewport,
        })
      }
    }
  }

  // 组件特写：1280 宽，按标题滚到该节再截一屏
  for (const theme of THEMES) {
    for (const component of COMPONENTS) {
      const viewport = { width: 1280, height: 800 }
      await preparePage(client, { ...viewport, theme })
      await navigate(client, `${BASE}/visual-tests/markdown`)
      await applyTheme(client, theme)

      const found = await client.evaluate(`(() => {
        const heading = Array.from(document.querySelectorAll('.prose h2'))
          .find((node) => node.textContent.includes(${JSON.stringify(component.heading)}))
        if (!heading) return false
        heading.scrollIntoView({ block: 'start', behavior: 'instant' })
        window.scrollBy(0, -72)
        return true
      })()`)

      await sleep(320)
      // 客户端增强的组件（Mermaid）滚进视口后才开始补水，等它真的出结果再截
      if (found && component.ready) {
        await client.evaluate(`(async () => {
          const deadline = Date.now() + 8000
          while (Date.now() < deadline && !document.querySelector(${JSON.stringify(component.ready)})) {
            await new Promise((r) => setTimeout(r, 120))
          }
          return Boolean(document.querySelector(${JSON.stringify(component.ready)}))
        })()`)
      }
      // 滚到该节后，视口内的 lazy 图才开始加载，需要再等一次稳定
      const settleProbe = await settle(client, { extraDelay: 200 })
      if (found) {
        await client.evaluate(`(() => {
          const heading = Array.from(document.querySelectorAll('.prose h2'))
            .find((node) => node.textContent.includes(${JSON.stringify(component.heading)}))
          if (heading) { heading.scrollIntoView({ block: 'start', behavior: 'instant' }); window.scrollBy(0, -72) }
          return true
        })()`)
        await settle(client, { extraDelay: 180 })
      }

      const probe = await client.evaluate(PROBE_EXPRESSION)
      const buffer = await screenshot(client)
      const file = `${theme}-components-${component.key}-1280.png`
      writeFileSync(join(SHOT_DIR, file), buffer)
      shots.push({
        file: `screenshots/${file}`,
        page: 'Markdown 全组件样张',
        route: '/visual-tests/markdown#component',
        theme,
        viewport: '1280×800',
        viewportPx: { width: 1280, height: 800 },
        dpr: 1,
        capturedAt: isoNow(),
        fontsLoaded: probe.fontStatus === 'loaded',
        fontFaceCount: probe.fontFaceCount,
        brokenImages: settleProbe.brokenImages,
        documentHeight: settleProbe.scrollHeight,
        bytes: buffer.length,
        note: found ? `定位到「${component.heading}」` : `未找到标题「${component.heading}」`,
        probe,
      })
      console.log(
        `✓ ${file}  ${found ? component.heading : 'MISSING'}  ${Math.round(buffer.length / 1024)}KB`,
      )
    }
  }

  const environment = await collectEnvironment(client)
  const manifest = {
    stage: 'Phase 4D-0 视觉验收准备',
    generatedAt: isoNow(),
    startedAt,
    environment,
    pages: PAGES,
    viewports: VIEWPORTS.map((v) => `${v.width}×${v.height}`),
    themes: THEMES,
    totalShots: shots.length,
    shots,
  }
  writeFileSync(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(`\n共 ${shots.length} 张，manifest 已写入 ${OUT_DIR}/manifest.json`)

  client.close()
  await chrome.close()
}

main().catch(async (error) => {
  console.error(error)
  process.exitCode = 1
})
