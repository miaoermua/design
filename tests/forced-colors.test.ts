/**
 * 系统高对比度（forced-colors）契约（T13）
 *
 * 这类样式没法靠"看一眼截图"验收：它只在系统开启高对比度时才生效，
 * 平时完全不可见。所以用静态契约守住三件事：
 *   1. 文件存在且被引入，所有规则都在 `@media (forced-colors: active)` 内；
 *   2. 关键元素都被显式处理（导航、面板、纸面、代码块、焦点环、装饰层）；
 *   3. 每个选择器都有真实 DOM 生产者 —— 死选择器在强制色下不报错，只是不生效，
 *      比在常规样式里更容易被漏掉。
 *
 * 边界：**不断言真实观感**。要验证必须真的在 Windows 高对比度主题下打开页面，
 * 本文件不声称覆盖那部分（见报告 NOT TESTED）。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SRC, normalizeEol, stripCssComments, walk } from './helpers/design-tokens'

const FILE = join(SRC, 'design-system/styles/forced-colors.css')
const GLOBALS = join(SRC, 'app/globals.css')

const raw = stripCssComments(normalizeEol(readFileSync(FILE, 'utf8')))
const globals = normalizeEol(readFileSync(GLOBALS, 'utf8'))

/** 取某个 at-rule 块的正文（大括号配对，不靠缩进） */
function blockOf(css: string, at: string): string {
  const start = css.indexOf(at)
  if (start < 0) return ''
  const open = css.indexOf('{', start)
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

const forced = blockOf(raw, '@media (forced-colors: active)')

describe('高对比度：结构与引入', () => {
  it('被 globals.css 引入', () => {
    expect(globals).toContain('styles/forced-colors.css')
  })

  it('所有规则都包在对应的媒体查询里', () => {
    expect(forced.length).toBeGreaterThan(0)
    // 去掉两个媒体查询块之后，不该剩下任何规则
    const rest = raw.replace(raw.slice(raw.indexOf('@media (forced-colors: active)')), '').trim()
    expect(rest).toBe('')
  })

  it('两个媒体查询都用了正确的关键字', () => {
    expect(raw).toContain('@media (forced-colors: active)')
    expect(raw).toContain('@media (prefers-contrast: more)')
  })
})

describe('高对比度：必须处理的元素', () => {
  it('玻璃与浮层还原成实色 + 系统边框', () => {
    for (const selector of ['.glass-nav', '.nav-glass', '.nav-panel', '.glass-panel']) {
      expect(forced, `${selector} 未处理`).toContain(selector)
    }
    expect(forced).toContain('background-color: Canvas')
    expect(forced).toContain('CanvasText')
  })

  it('光斑与材质装饰层在强制色下撤掉', () => {
    expect(forced).toMatch(/\.nav-spotlight\s*\{[^}]*display:\s*none/)
    expect(forced).toMatch(/\.paper-grain[\s\S]*?display:\s*none/)
  })

  it('靠底色表达的块补上边框：代码块、便利贴、Callout、表格', () => {
    for (const selector of ['.prose pre', '.tag-note__body', '.md-callout', '.md-banner']) {
      expect(forced, `${selector} 未处理`).toContain(selector)
    }
    expect(forced).toMatch(/\.prose th,[\s\S]*?border:\s*1px solid CanvasText/)
  })

  it('焦点环用系统 Highlight，不用 accent（会被抹掉）', () => {
    const focus = /:focus-visible\s*\{([\s\S]*?)\}/.exec(forced)?.[1] ?? ''
    expect(focus).toContain('Highlight')
    expect(focus).not.toContain('--accent')
  })

  it('当前页 / 当前目录项不只靠颜色区分', () => {
    expect(forced).toMatch(/aria-current='page'/)
    expect(forced).toMatch(/aria-current='location'/)
  })
})

describe('高对比度：选择器纪律', () => {
  it('每个类名都能在源码里找到生产者', () => {
    const source = walk(SRC)
      .filter((file) => /\.(tsx|ts)$/.test(file))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n')

    const classes = new Set<string>()
    for (const match of forced.matchAll(/\.([a-z][a-z0-9_-]*)/g)) classes.add(match[1])

    const orphans = [...classes].filter((name) => !source.includes(name))
    expect(orphans, `以下类名没有 DOM 生产者:\n${orphans.join('\n')}`).toEqual([])
  })

  it('不用十六进制/rgb 字面量：高对比度只允许系统色关键字', () => {
    expect(forced).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(forced).not.toMatch(/\brgba?\(/)
    expect(forced).not.toMatch(/\bhsla?\(/)
  })
})
