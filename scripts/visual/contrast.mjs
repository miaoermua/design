/**
 * Phase 4D 正文与容器对比度抽查
 *
 * 只做测量，不改任何颜色。基准取 WCAG 2.2 AA（SC 1.4.3 的阈值与 2.1 相同）：
 *   - 正文（< 18.66px 常规 / < 24px 粗体）≥ 4.5:1
 *   - 大字（≥ 24px，或 ≥ 18.66px 且 700 以上）≥ 3:1
 *
 * 用法：`node scripts/visual/contrast.mjs`
 * 输出：docs/audits/assets/phase-4d/contrast.json
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { applyTheme, launchChrome, navigate, openPage, preparePage, sleep } from './cdp.mjs'

const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3021'
const OUT_DIR = 'docs/audits/assets/phase-4d'

/** 所有要抽查的元素，selector 会自动取第 n 个匹配 */
const TARGETS = [
  { key: 'body-text', selector: '.prose p', label: '正文段落' },
  { key: 'h2', selector: '.prose h2', label: '正文 h2' },
  { key: 'h3', selector: '.prose h3', label: '正文 h3' },
  { key: 'h4-clamped', selector: '.prose h4', label: '正文 h4（H5/H6 也落在这里）' },
  { key: 'blockquote', selector: '.prose blockquote p', label: '引用块正文' },
  { key: 'inline-code', selector: '.prose code', label: '行内代码' },
  { key: 'link', selector: '.prose p a', label: '正文链接' },
  { key: 'mention', selector: '.md-mention', label: '社交提及' },
  // 注意：`.meta` 在站点里出现在两处——文章头部的小字，和 <640px 才出现的导航「目录」按钮。
  // 后者在 1280 视口是 display:none，必须用作用域把测量锁定在文章头部。
  { key: 'meta', selector: '#visual-tests-markdown .meta', label: '元信息小字' },
  {
    key: 'callout-info-title',
    selector: '.md-callout--info .md-callout__title',
    label: 'Callout info 标题',
  },
  {
    key: 'callout-note-title',
    selector: '.md-callout--note .md-callout__title',
    label: 'Callout note 标题',
  },
  {
    key: 'callout-success-title',
    selector: '.md-callout--success .md-callout__title',
    label: 'Callout success 标题',
  },
  {
    key: 'callout-warning-title',
    selector: '.md-callout--warning .md-callout__title',
    label: 'Callout warning 标题',
  },
  {
    key: 'callout-error-title',
    selector: '.md-callout--error .md-callout__title',
    label: 'Callout error 标题',
  },
  {
    key: 'callout-danger-title',
    selector: '.md-callout--danger .md-callout__title',
    label: 'Callout danger 标题',
  },
  {
    key: 'callout-tip-title',
    selector: '.md-callout--tip .md-callout__title',
    label: 'Callout tip 标题',
  },
  {
    key: 'callout-important-title',
    selector: '.md-callout--important .md-callout__title',
    label: 'Callout important 标题',
  },
  {
    key: 'callout-caution-title',
    selector: '.md-callout--caution .md-callout__title',
    label: 'Callout caution 标题',
  },
  {
    key: 'callout-info-body',
    selector: '.md-callout--info .md-callout__body p',
    label: 'Callout info 正文',
  },
  { key: 'banner-info-body', selector: '.md-banner--info p', label: 'Banner info 正文' },
  { key: 'banner-warning-body', selector: '.md-banner--warning p', label: 'Banner warning 正文' },
  { key: 'table-th', selector: '.prose th', label: '表格表头' },
  { key: 'table-td', selector: '.prose td', label: '表格正文' },
  { key: 'details-summary', selector: '.md-details summary', label: 'Details 概要' },
  { key: 'footnote', selector: '.footnotes p', label: '脚注正文' },
]

/** 只在移动断点出现的导航元素（玻璃栏，半透明底），单独一轮测量 */
const NAV_TARGETS = [
  { key: 'nav-brand', selector: '.glass-bar a', label: '导航站名' },
  { key: 'nav-toggle', selector: '.glass-bar button.meta', label: '导航「目录」按钮' },
]

const MEASURE = (targets) => `(() => {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const resolve = (value) => {
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
  const ratio = (fg, bg) => {
    const f = luminance(fg)
    const b = luminance(bg)
    return (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05)
  }
  return ${JSON.stringify(targets)}.map((target) => {
    const el = document.querySelector(target.selector)
    if (!el) return { ...target, found: false, reason: 'not in DOM' }
    // 只测真正渲染出来的东西：display:none / 0 尺寸的元素没有「可见对比度」可谈
    if (el.getClientRects().length === 0) {
      return { ...target, found: false, reason: 'not rendered at this viewport' }
    }
    const style = getComputedStyle(el)
    const fg = resolve(style.color)

    // 自下而上收集背景层：元素的祖先可能是半透明（例：玻璃质感导航栏 0.9 的底色），
    // 只取「第一个不透明祖先」会在半透明表面上算错，必须按 alpha 逐层合成。
    const stack = []
    let bgNode = el
    while (bgNode) {
      const raw = getComputedStyle(bgNode).backgroundColor
      const candidate = resolve(raw)
      if (candidate && candidate.a > 0.004) {
        stack.push({ raw, color: candidate })
        if (candidate.a >= 0.999) break
      }
      bgNode = bgNode.parentElement
    }
    if (stack.length === 0 || stack[stack.length - 1].color.a < 0.999) {
      const html = resolve(getComputedStyle(document.documentElement).backgroundColor)
      stack.push({ raw: 'html', color: { ...html, a: 1 } })
    }
    const base = stack[stack.length - 1]
    let bg = { ...base.color, a: 1 }
    const bgSource = stack.length > 1 ? stack[0].raw : base.raw
    // resolve() 读回的是未预乘的 rgb（canvas getImageData 会还原），所以这里显式乘 alpha
    for (let i = stack.length - 2; i >= 0; i -= 1) {
      const layer = stack[i].color
      const rest = 1 - layer.a
      bg = {
        r: layer.r * layer.a + bg.r * rest,
        g: layer.g * layer.a + bg.g * rest,
        b: layer.b * layer.a + bg.b * rest,
        a: 1,
      }
    }

    const size = Number.parseFloat(style.fontSize)
    const weight = Number.parseInt(style.fontWeight, 10) || 400
    const large = size >= 24 || (size >= 18.66 && weight >= 700)
    const ratioValue = Number(ratio(fg, bg).toFixed(2))

    return {
      ...target,
      found: true,
      text: (el.textContent ?? '').trim().slice(0, 32),
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      largeText: large,
      backgroundSource: bgSource,
      background: { r: Math.round(bg.r), g: Math.round(bg.g), b: Math.round(bg.b) },
      contrast: ratioValue,
      threshold: large ? 3 : 4.5,
      pass: ratioValue >= (large ? 3 : 4.5),
    }
  })
})()`

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const chrome = await launchChrome({ port: 9337 })
  const client = await openPage(chrome.port)

  const results = {}
  // 移动端导航只在 <640px 渲染，1280 视口那一轮看不到它，单独补一次 390 的测量。
  // 玻璃质感导航栏是半透明 + backdrop-filter，数值随下方内容变化，这里固定在滚动到顶部时取。
  const mobileNav = {}
  for (const theme of ['light', 'dark']) {
    await preparePage(client, { width: 390, height: 844, theme })
    await navigate(client, `${BASE}/`)
    await applyTheme(client, theme)
    await client.evaluate('window.scrollTo(0, 0)')
    await sleep(320)
    mobileNav[theme] = await client.evaluate(MEASURE(NAV_TARGETS))
    console.log(`\n── 移动导航 ${theme}（390×844，滚动到顶部） ──`)
    for (const item of mobileNav[theme]) {
      console.log(
        item.found
          ? `  ${item.pass ? 'PASS' : 'FAIL'}     ${item.key.padEnd(24)} ${String(item.contrast).padStart(6)}:1  ≥${item.threshold}  ${item.fontSize}/${item.fontWeight}`
          : `  MISSING  ${item.key}  (${item.reason ?? ''})`,
      )
    }
  }

  for (const theme of ['light', 'dark']) {
    await preparePage(client, { width: 1280, height: 800, theme })
    await navigate(client, `${BASE}/visual-tests/markdown`)
    await applyTheme(client, theme)
    // 展开所有 details，保证 details summary 的可见状态被测到
    await client.evaluate(`(() => {
      for (const node of document.querySelectorAll('.md-details')) node.open = true
      return true
    })()`)
    await sleep(320)
    results[theme] = await client.evaluate(MEASURE(TARGETS))
    console.log(`\n── ${theme} ──`)
    for (const item of results[theme]) {
      if (!item.found) {
        console.log(`  MISSING  ${item.key}  (${item.selector})`)
        continue
      }
      console.log(
        `  ${item.pass ? 'PASS' : 'FAIL'}     ${item.key.padEnd(24)} ${String(item.contrast).padStart(6)}:1  ≥${item.threshold}  ${item.fontSize}/${item.fontWeight}`,
      )
    }
  }

  writeFileSync(
    join(OUT_DIR, 'contrast.json'),
    `${JSON.stringify(
      {
        stage: 'Phase 4D-0 对比度抽查',
        generatedAt: new Date().toISOString(),
        route: '/visual-tests/markdown',
        standard: 'WCAG 2.2 AA（正文 4.5:1，大字 3:1）',
        browser: chrome.version.browser,
        note: '背景按 alpha 逐层合成（半透明层叠在不透明基色上），只测真正渲染出来的元素。',
        results,
        mobileNav: {
          route: '/',
          viewport: '390×844',
          scroll: '顶部（scrollY=0）',
          note: '玻璃栏是半透明 + backdrop-filter，数值随下方内容移动而变化，这里记录顶部状态。',
          results: mobileNav,
        },
        summary: {
          ...Object.fromEntries(
            Object.entries(results).map(([theme, list]) => [
              theme,
              {
                total: list.length,
                measured: list.filter((item) => item.found).length,
                failed: list.filter((item) => item.found && !item.pass).map((item) => item.key),
                missing: list.filter((item) => !item.found).map((item) => item.key),
              },
            ]),
          ),
          mobileNav: Object.fromEntries(
            Object.entries(mobileNav).map(([theme, list]) => [
              theme,
              {
                total: list.length,
                measured: list.filter((item) => item.found).length,
                failed: list.filter((item) => item.found && !item.pass).map((item) => item.key),
                missing: list.filter((item) => !item.found).map((item) => item.key),
              },
            ]),
          ),
        },
      },
      null,
      2,
    )}\n`,
  )

  client.close()
  await chrome.close()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
