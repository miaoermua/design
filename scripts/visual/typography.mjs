/**
 * Typography 实测：字号层级、阅读宽度、每行字数、标题换行、混排断行
 *
 * 为什么必须实测：`--measure-post: 44rem` 只能说明容器多宽，说明不了
 * 「一行放多少汉字」「标题在 390px 折成几行」「URL 会不会撑破」。
 * 这些只能量真实渲染结果。
 *
 * 覆盖 5 档视口（1440 / 1024 / 768 / 390 / 375），输出：
 *   - 正文实际字号、行高、字距、字体族（验证 Token 真的生效）
 *   - 正文内容区宽度、按正文字号换算的每行汉字数
 *   - 标题行数、是否溢出
 *   - 长 URL / 长英文词是否横向溢出
 *
 * 用法：node scripts/visual/typography.mjs
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchChrome, navigate, openPage, preparePage, screenshot, settle } from './cdp.mjs'

const OUT = join(process.env.TEMP ?? '.', 'folio-typography')
mkdirSync(OUT, { recursive: true })
const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3000'

const VIEWPORTS = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'laptop-1024', width: 1024, height: 768 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'phone-390', width: 390, height: 844 },
  { name: 'phone-375', width: 375, height: 667 },
]

const problems = []
const notes = {}

const chrome = await launchChrome({ port: 9481 })
const client = await openPage(chrome.port)

/** 量一个元素的实际排版参数 */
const measure = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)})
  if (!el) return null
  const s = getComputedStyle(el)
  const r = el.getBoundingClientRect()
  return {
    fontFamily: s.fontFamily.split(',')[0].replace(/["']/g, ''),
    fontSize: parseFloat(s.fontSize),
    lineHeight: s.lineHeight === 'normal' ? null : parseFloat(s.lineHeight),
    letterSpacing: s.letterSpacing === 'normal' ? 0 : parseFloat(s.letterSpacing),
    fontWeight: s.fontWeight,
    width: +r.width.toFixed(1),
    height: +r.height.toFixed(1),
    // 行数用 Range 量**文本自身**的片段数，不用 height / line-height。
    // 后者会被 ::before 装饰（h2 有一道虚线分节）撑大，量出 2 行而实际只有 1 行。
    lines: (() => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const ys = new Set([...range.getClientRects()].map((x) => Math.round(x.y)))
      return ys.size
    })(),
  }
})()`

try {
  notes.browser = await client.evaluate('navigator.userAgent')

  for (const vp of VIEWPORTS) {
    await preparePage(client, { width: vp.width, height: vp.height, theme: 'light' })

    // ── 文章页：正文排版 ──────────────────────────────────────
    await navigate(client, `${BASE}/visual-tests/markdown`)
    await settle(client)

    const prose = await client.evaluate(measure('.prose'))
    const h2 = await client.evaluate(measure('.prose h2'))
    const title = await client.evaluate(measure('h1'))

    // 每行汉字数：正文宽度 ÷ 字号（汉字是 1em 方块，这是理论上限，
    // 实际会因标点与西文变宽而略少 —— 作为阅读宽度的可比指标足够）
    const charsPerLine = prose ? +(prose.width / prose.fontSize).toFixed(1) : null

    // 横向溢出（长 URL / 长英文词 / 代码块）
    //
    // 关键：**不能把「代码块内部横向滚动」算成越界**。`pre` 故意
    // `overflow-x: auto`，它的子元素超出视口是设计行为。判据是
    // 「页面级横向滚动」+「不在可滚动祖先内的越界元素」。
    const overflow = await client.evaluate(`(() => {
      const doc = document.documentElement
      const inScroller = (el) => {
        let p = el.parentElement
        while (p && p !== document.body) {
          const s = getComputedStyle(p)
          if ((s.overflowX === 'auto' || s.overflowX === 'scroll') && p.scrollWidth > p.clientWidth + 1) return true
          p = p.parentElement
        }
        return false
      }
      const offenders = []
      let scrolled = 0
      for (const el of document.querySelectorAll('.prose *')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0) continue
        if (r.right <= doc.clientWidth + 1) continue
        if (inScroller(el)) { scrolled += 1; continue }
        offenders.push({ tag: el.tagName.toLowerCase(), cls: el.className?.toString?.().slice(0, 40), right: Math.round(r.right) })
      }
      return {
        pageOverflowX: Math.max(0, doc.scrollWidth - doc.clientWidth),
        offenders: offenders.slice(0, 6),
        offenderCount: offenders.length,
        insideScrollerCount: scrolled,
      }
    })()`)

    notes[vp.name] = {
      viewport: `${vp.width}x${vp.height}`,
      prose,
      h2,
      title,
      charsPerLine,
      overflow,
    }

    if (overflow.pageOverflowX > 0) {
      problems.push(`${vp.name}: 页面横向溢出 ${overflow.pageOverflowX}px`)
    }
    if (overflow.offenderCount > 0) {
      problems.push(
        `${vp.name}: ${overflow.offenderCount} 个正文元素超出视口（例：${JSON.stringify(overflow.offenders[0])}）`,
      )
    }
    // 阅读宽度：中文每行字数有物理上限，桌面与手机不能用同一区间。
    //
    //   桌面（≥1024）：30–46 字/行。中文比拉丁字面宽，Bringhurst 的 45–75
    //                  字符区间换算到中文后偏窄，30–46 是常见实践。
    //   手机（<768）  ：15–28 字/行。390px 减去两侧留白只剩 349px，
    //                  17px 字号下就是 20 字 —— 这不是缺陷，是屏宽决定的上限。
    //
    // 用错阈值会把正常排版报成问题，所以这里按视口分档。
    const narrow = vp.width < 768
    const [minChars, maxChars] = narrow ? [15, 28] : [30, 46]
    if (charsPerLine !== null && (charsPerLine < minChars || charsPerLine > maxChars)) {
      problems.push(
        `${vp.name}: 每行 ${charsPerLine} 汉字，超出 ${narrow ? '手机' : '桌面'}区间 ${minChars}–${maxChars}`,
      )
    }
    // 正文不小于 16px（移动端可读下限）
    if (prose && prose.fontSize < 16) {
      problems.push(`${vp.name}: 正文字号 ${prose.fontSize}px < 16px`)
    }
    // 正文行高 1.7–1.9 是中文舒适区
    if (prose && prose.lineHeight) {
      const ratio = prose.lineHeight / prose.fontSize
      if (ratio < 1.6 || ratio > 2.0) {
        problems.push(`${vp.name}: 正文行高比 ${ratio.toFixed(2)} 超出 1.6–2.0`)
      }
    }

    writeFileSync(join(OUT, `${vp.name}-article.png`), await screenshot(client))

    // ── 首页：导语（本轮统一了衬线） ──────────────────────────
    await navigate(client, `${BASE}/`)
    await settle(client)
    notes[vp.name].heroLead = await client.evaluate(measure('.hero-intro, [class*="text-lead"]'))

    // ── 日记页：日号（40px 档） ───────────────────────────────
    await navigate(client, `${BASE}/diaries`)
    await settle(client)
    notes[vp.name].diaryDay = await client.evaluate(
      `(() => {
        const el = [...document.querySelectorAll('*')].find(e => {
          const s = getComputedStyle(e)
          return parseFloat(s.fontSize) === 40 && e.textContent?.trim().length <= 2
        })
        if (!el) return null
        const s = getComputedStyle(el)
        return { fontSize: parseFloat(s.fontSize), fontWeight: s.fontWeight, tabular: s.fontVariantNumeric }
      })()`,
    )
  }

  // ── 混排专项：中文 / 英文 / 日文 / 长 URL 在 390px 的断行 ──
  await preparePage(client, { width: 390, height: 844, theme: 'light' })
  await navigate(client, `${BASE}/visual-tests/markdown`)
  await settle(client)

  notes.mixed = await client.evaluate(`(() => {
    const out = { cjk: 0, latinWord: 0, longUrl: 0, cjkLatin: 0 }
    for (const el of document.querySelectorAll('.prose p, .prose li, .prose td')) {
      const t = el.textContent || ''
      const w = el.getBoundingClientRect().width
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 20
      const h = el.getBoundingClientRect().height
      // 字体族（用于确认 CJK 走的是自托管无衬线）
      out.fontFamily = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '')
      if (/[\\u4e00-\\u9fff]{4,}/.test(t)) out.cjk = Math.max(out.cjk, Math.round(h / lh))
      if (/https?:\\/\\/\\S{20,}/.test(t)) out.longUrl += 1
      if (/[A-Za-z]{15,}/.test(t)) out.latinWord += 1
      if (/[\\u4e00-\\u9fff][A-Za-z]|[A-Za-z][\\u4e00-\\u9fff]/.test(t)) out.cjkLatin += 1
    }
    return out
  })()`)

  writeFileSync(join(OUT, 'phone-390-mixed.png'), await screenshot(client))
} finally {
  await chrome.close()
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify({ notes, problems }, null, 2))
console.log(JSON.stringify(notes, null, 2))

if (problems.length > 0) {
  console.log('\n❌ 发现排版问题：')
  for (const p of problems) console.log('  - ' + p)
  process.exitCode = 1
} else {
  console.log(`\n✅ 排版检查通过（截图与 report.json 在 ${OUT}）`)
}
