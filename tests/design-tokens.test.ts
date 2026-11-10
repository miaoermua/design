import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')
const TOKENS = join(SRC, 'design-system/tokens/tokens.css')

/** 由运行时代码提供、不在本项目 CSS 里定义的变量前缀 */
const EXTERNAL_PREFIXES = ['--tw-', '--shiki', '--katex', '--mermaid', '--hljs']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

const files = walk(SRC)
const cssFiles = files.filter((file) => file.endsWith('.css'))
const tsFiles = files.filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))

const defined = new Set<string>()
const used = new Map<string, string>()

for (const file of cssFiles) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/(--[a-z0-9-]+)\s*:/gi)) defined.add(match[1])
  for (const match of text.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
    if (!used.has(match[1])) used.set(match[1], relative(ROOT, file))
  }
}

/** 解析某一段 CSS 里的 `--color-*` 定义（亮色取 @theme 段，暗色取 [data-theme] 段） */
function palette(selector: 'light' | 'dark'): Map<string, string> {
  const text = readFileSync(TOKENS, 'utf8')
  const darkStart = text.indexOf("[data-theme='dark']")
  const block = selector === 'dark' ? text.slice(darkStart) : text.slice(0, darkStart)
  const map = new Map<string, string>()
  for (const match of block.matchAll(/(--color-[a-z-]+):\s*(#[0-9a-f]{6})/gi)) {
    map.set(match[1], match[2])
  }
  return map
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
  const [r, g, b] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

describe('Design Token：结构', () => {
  it('tokens.css 保留 8 组 token 族', () => {
    const text = readFileSync(TOKENS, 'utf8')

    for (const family of [
      '--color-paper:',
      '--font-serif:',
      '--text-display:',
      '--spacing-gutter:',
      '--radius-md:',
      '--shadow-raise:',
      '--border-hairline:',
      '--duration-base:',
      '--material-grain-opacity:',
    ]) {
      expect(text, `缺少 ${family}`).toContain(family)
    }
  })

  it('暗色覆盖的是同一批语义变量，而不是组件里的 dark: 变体', () => {
    const text = readFileSync(TOKENS, 'utf8')
    const darkBlock = text.slice(text.indexOf("[data-theme='dark']"))

    expect(darkBlock).toContain('--color-paper:')
    expect(darkBlock).toContain('--color-accent:')
    expect(darkBlock).toContain('--material-glass-tint:')

    for (const file of tsFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${relative(ROOT, file)} 不应出现 dark: 变体`).not.toMatch(/\bdark:[a-z[]/)
    }
  })
})

describe('Design Token：引用完整性', () => {
  it('CSS 里消费的每个变量都有定义（外部库前缀除外）', () => {
    const missing: string[] = []

    for (const [name, file] of used) {
      if (EXTERNAL_PREFIXES.some((prefix) => name.startsWith(prefix))) continue
      if (!defined.has(name)) missing.push(`${name}（${file}）`)
    }

    expect(missing, '以下变量没有定义:\n' + missing.join('\n')).toEqual([])
  })

  it('组件层不硬编码颜色', () => {
    const offenders: string[] = []

    for (const file of tsFiles) {
      if (file.includes('/lib/api/mock/')) continue
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) {
        offenders.push(`${relative(ROOT, file)} → ${match[0]}`)
      }
    }

    expect(offenders, '颜色必须来自 Token:\n' + offenders.join('\n')).toEqual([])
  })
})

describe('Design Token：对比度', () => {
  it('亮色下正文/次级/标题/强调文字达到 WCAG AA', () => {
    const tokens = palette('light')
    const paper = tokens.get('--color-paper') as string
    const raised = tokens.get('--color-paper-raised') as string

    expect(contrast(tokens.get('--color-ink') as string, paper)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(tokens.get('--color-heading') as string, paper)).toBeGreaterThanOrEqual(7)
    expect(contrast(tokens.get('--color-ink-muted') as string, raised)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(tokens.get('--color-accent-strong') as string, raised)).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  it('暗色下正文/次级/主题色达到 WCAG AA', () => {
    const tokens = palette('dark')
    const paper = tokens.get('--color-paper') as string
    const raised = tokens.get('--color-paper-raised') as string

    expect(contrast(tokens.get('--color-ink') as string, paper)).toBeGreaterThanOrEqual(7)
    expect(contrast(tokens.get('--color-heading') as string, paper)).toBeGreaterThanOrEqual(7)
    expect(contrast(tokens.get('--color-ink-muted') as string, raised)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(tokens.get('--color-accent') as string, raised)).toBeGreaterThanOrEqual(4.5)
  })
})
