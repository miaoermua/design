/**
 * 打印样式契约（T5）
 *
 * 打印样式最容易烂的方式不是写错，而是**被后来的人顺手删掉**：它不进任何
 * 屏幕截图，删了也没人看得见，直到有人真的去打印才发现导航盖住正文。
 * 这里钉住三件事：
 *   1. `print.css` 存在且被 `globals.css` 引入；
 *   2. 所有规则都在 `@media print` 里（不能污染屏幕）；
 *   3. 关键隐藏项齐全，且每个选择器都有真实 DOM 生产者（不许写想象出来的类名）。
 *
 * 边界：**不断言打印观感**。分页位置、纸边距、颜色还原都需要真实打印机或
 * PDF 导出来看，本文件不声称覆盖那部分（见报告 NOT TESTED 一节）。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SRC, normalizeEol, stripCssComments, walk } from './helpers/design-tokens'

const PRINT_CSS = join(SRC, 'design-system/styles/print.css')
const GLOBALS_CSS = join(SRC, 'app/globals.css')

const raw = stripCssComments(normalizeEol(readFileSync(PRINT_CSS, 'utf8')))
const globals = normalizeEol(readFileSync(GLOBALS_CSS, 'utf8'))

/** 抽出 @media print 块的内容（按大括号配对，不靠缩进猜） */
function printBlock(css: string): string {
  const at = css.indexOf('@media print')
  if (at < 0) return ''
  const open = css.indexOf('{', at)
  let depth = 0
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1
    else if (css[i] === '}') {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  return ''
}

const block = printBlock(raw)

describe('打印样式：结构与引入', () => {
  it('被 globals.css 引入，且在所有样式层之后', () => {
    expect(globals).toContain("styles/print.css'")
    const printAt = globals.indexOf('styles/print.css')
    for (const layer of ['tokens.css', 'material.css', 'prose.css', 'reading.css']) {
      expect(globals.indexOf(layer), `${layer} 必须在 print.css 之前`).toBeLessThan(printAt)
    }
  })

  it('所有规则都在 @media print 里，屏幕样式零污染', () => {
    expect(block.length).toBeGreaterThan(0)
    // 除去 @media print 块本身，文件里不该剩任何规则
    const outside = raw.replace(raw.slice(raw.indexOf('@media print')), '')
    expect(outside).not.toMatch(/\{[\s\S]*\}/)
    // @media print 之外也不允许出现 screen / all
    expect(raw).not.toMatch(/@media\s+(screen|all)/)
  })
})

describe('打印样式：关键隐藏项', () => {
  const mustHide = [
    '.site-nav',
    '.site-nav-spacer',
    '.toolbar-dock',
    '.reading-aside',
    '.reading-inline',
    '.search-panel',
    '.nav-panel',
    '.nav-flyout',
    '.comments',
    'footer',
    '.paper-grain',
    '.paper-ambient',
  ]

  it('导航、占位、浮标、阅读辅助、弹层、评论、页脚、材质层都要隐藏', () => {
    for (const selector of mustHide) {
      expect(block, `${selector} 未在打印样式中隐藏`).toContain(selector)
    }
  })

  it('隐藏用 display:none：visibility / opacity / height:0 仍会占位出空白页', () => {
    const hideRule = block.slice(0, block.indexOf('display: none'))
    expect(hideRule.length).toBeGreaterThan(0)
    expect(block).toMatch(/display:\s*none\s*!important/)
  })

  it('占位块必须跟着导航一起隐藏，否则每页顶部空一条', () => {
    const navRule = /\.site-nav,[\s\S]*?\}/.exec(block)?.[0] ?? ''
    expect(navRule).toContain('.site-nav-spacer')
  })
})

describe('打印样式：正文与分页', () => {
  it('阅读纸面去底色、去边框、去阴影', () => {
    const sheet = /\.reading-sheet\s*\{([\s\S]*?)\}/.exec(block)?.[1] ?? ''
    expect(sheet).toContain('background: none')
    expect(sheet).toContain('box-shadow: none')
    expect(sheet).toContain('border: 0')
  })

  it('标题不在页底孤行，图/引用/表格不被拆开', () => {
    expect(block).toMatch(/h6\s*\{[\s\S]*?break-after:\s*avoid/)
    expect(block).toMatch(/page-break-inside:\s*avoid/)
  })

  it('长代码块与表格允许跨页：强行不拆会切掉内容', () => {
    expect(block).toMatch(/pre,\s*table\s*\{[\s\S]*?break-inside:\s*auto/)
  })

  it('图片不超出纸宽', () => {
    expect(block).toMatch(/img,[\s\S]*?max-width:\s*100%/)
  })

  it('链接保持正文墨色，不展开 URL', () => {
    expect(block).toMatch(/text-decoration:\s*underline/)
    // 没有 `a[href]::after { content: attr(href) }` 这种把 URL 塞进正文的写法
    expect(block).not.toMatch(/attr\(\s*href\s*\)/)
  })
})

describe('打印样式：选择器纪律', () => {
  it('每个被隐藏的类名都能在源码里找到生产者', () => {
    const source = walk(SRC)
      .filter((file) => /\.(tsx|ts)$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')

    const classes = new Set<string>()
    for (const match of block.matchAll(/\.([a-z][a-z0-9-]*)/g)) classes.add(match[1])

    const orphans = [...classes].filter((name) => !source.includes(name))
    expect(orphans, `以下类名没有 DOM 生产者:\n${orphans.join('\n')}`).toEqual([])
  })
})
