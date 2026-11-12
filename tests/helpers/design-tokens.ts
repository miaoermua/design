import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * 设计契约测试的共享工具
 *
 * 只放「被两个以上测试用到」的解析能力：文件遍历、CSS 注释剥离、Token 定义/引用提取、
 * 调色板读取、WCAG 对比度。不在这里放断言逻辑 —— 规则留在各自的测试文件里，
 * 这样某条规则失败时能直接看到是哪条契约被破坏。
 */

export const ROOT = process.cwd()
export const SRC = join(ROOT, 'src')
export const TOKENS = join(SRC, 'design-system/tokens/tokens.css')
export const DOC = join(ROOT, 'docs/DESIGN-SYSTEM.md')

/** 由运行时代码提供、不在本项目 CSS 里定义的变量前缀 */
export const EXTERNAL_PREFIXES = ['--tw-', '--shiki', '--katex', '--mermaid', '--hljs']

/**
 * 语义别名层里当前「没有消费者」的 Token。
 *
 * 这是一份**白名单式的债务登记**，不是认可：
 *   - 新出现的死别名会让测试失败，逼你在同一批里补文档或补消费；
 *   - 一旦某个 Token 被真正使用，它必须从这份名单里消失。
 *
 * 判定口径见 `isDeadAlias`：别名层不生成 Tailwind 工具类，唯一消费方式是 var()。
 * 只被 tokens.css 内部其它 Token 引用的（如 --focus-ring-color、--shadow-color）
 * 属于定义链，**不算死 Token**；调色板层可能通过工具类被消费，静态扫描无法可靠判定，
 * 因此不在这份名单里断言。
 */
export const KNOWN_DEAD_ALIASES = ['--surface-lift', '--surface-glass'] as const

/** 由 @theme 生成、当前源码里既无 var() 也无同名工具类的动效 Token */
export const KNOWN_UNUSED_MOTION_TOKENS = [
  '--duration-slow',
  '--ease-in-out-soft',
] as const

export function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

export function relativeToRoot(file: string, root: string = ROOT): string {
  return relative(root, file)
}

/**
 * 去掉 CSS 注释。
 *
 * 注释里的 Token 名不算消费者 —— `tokens.css:118` 的说明文字提到 `--shadow-color`，
 * 把它当引用会让死 Token 检查看不见真实情况。
 */
export function stripCssComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * 去掉 url(...) 与带引号的字符串。
 *
 * 材质层的 data URI（`tokens.css:178`）里有 `%23` 之类的转义与长串十六进制字符，
 * 片段引用 `url(#id)` 也以 `#` 开头 —— 它们都不是颜色字面量。
 */
export function stripNonColorLiterals(text: string): string {
  return text.replace(/url\((?:[^()]|\([^()]*\))*\)/gi, '').replace(/"(?:[^"\\]|\\.)*"/g, '""')
}

/**
 * 收集 CSS 里的 Token **定义**。
 *
 * 只承认「行首（可缩进）紧跟 `--x:`」的声明位置。不锚定行首会把选择器误判成定义：
 * `.md-mention--tw::before` 里的 `--tw:`、`.prose--compact {` 里的 `--compact:`
 * 都会伪装成 Token 名。
 */
export function cssDefinitions(cssText: string): Set<string> {
  const names = new Set<string>()
  for (const match of stripCssComments(cssText).matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)) {
    names.add(match[1])
  }
  return names
}

/** 收集 var() 引用。`var(--x` 的写法没有歧义，不需要锚定。 */
export function cssVarReferences(text: string): Set<string> {
  const names = new Set<string>()
  for (const match of text.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) names.add(match[1])
  return names
}

/** 取 tokens.css 里某个选择器块的文本（用于区分亮色 @theme 与暗色覆盖） */
export function tokensSection(section: 'light' | 'dark' | 'root'): string {
  const text = readFileSync(TOKENS, 'utf8')

  if (section === 'dark') {
    const start = text.indexOf("[data-theme='dark']")
    if (start === -1) throw new Error("tokens.css 里找不到 [data-theme='dark'] 块")
    return text.slice(start)
  }

  const darkStart = text.indexOf("[data-theme='dark']")
  const rootStart = text.indexOf(':root')
  if (section === 'root') {
    if (rootStart === -1) throw new Error('tokens.css 里找不到 :root 块')
    return text.slice(rootStart, darkStart === -1 ? undefined : darkStart)
  }
  return text.slice(0, darkStart === -1 ? text.length : darkStart)
}

/**
 * 解析某一段 CSS 里的 `--color-*` HEX 定义（亮色取 @theme 段，暗色取 [data-theme] 段）。
 * 只识别 6 位 HEX —— 这也是 `color-mix()` 一类合成色不在对比度检查能力范围内的原因。
 */
export function palette(section: 'light' | 'dark'): Map<string, string> {
  const map = new Map<string, string>()
  for (const match of tokensSection(section).matchAll(
    /(--color-[a-z0-9-]+):\s*(#[0-9a-f]{6})\b/gi,
  )) {
    map.set(match[1], match[2])
  }
  return map
}

/** 解析 `:root` 里的别名定义：`--surface: var(--color-paper)` → 键值对 */
export function aliasDefinitions(): Map<string, string> {
  const map = new Map<string, string>()
  for (const match of tokensSection('root').matchAll(/^\s*(--[a-z0-9-]+)\s*:\s*([\s\S]+?);/gim)) {
    map.set(match[1], match[2].replace(/\s+/g, ' ').trim())
  }
  return map
}

/** 解析 `@theme` / `:root` 里的 Token 值（字号、间距、圆角、阴影、动效等） */
export function themeValues(): Map<string, string> {
  const map = new Map<string, string>()
  const block = tokensSection('light')
  const pattern =
    /^\s*(--(?:text|spacing|radius|border|container|shadow|ease|duration|font)-[a-z0-9-]+)\s*:\s*([\s\S]+?);/gim
  for (const match of block.matchAll(pattern)) {
    map.set(match[1], match[2].replace(/\s+/g, ' ').trim())
  }
  return map
}

export function luminance(hex: string): number {
  const channels = [1, 3, 5].map(
    (offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255,
  )
  const [r, g, b] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(foreground: string, background: string): number {
  const a = luminance(foreground)
  const b = luminance(background)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 按标题切分设计文档，返回 { 编号: 正文 }。
 * `## 3.` 与 `### 3.1` 都会成为键，父章节的正文在下一个任意标题处结束 —— 这样
 * 「§3.1 的表」和「整节 §14」两种粒度都能取到，不必让测试去猜标题层级。
 */
export function docSections(docText: string): Record<string, string> {
  const sections: Record<string, string> = {}
  const pattern = /^#{2,3}[ \t]+(\d+(?:\.\d+)?)[.\s]/gm
  const marks: { num: string; start: number }[] = []
  for (const match of docText.matchAll(pattern)) {
    marks.push({ num: match[1], start: (match.index as number) + match[0].length })
  }
  marks.forEach((mark, index) => {
    const end = index + 1 < marks.length ? marks[index + 1].start : docText.length
    sections[mark.num] = docText.slice(mark.start, end)
  })
  return sections
}

/** 把某个章节连同它的子章节拼在一起（如 §14 的全部小节） */
export function sectionGroup(sections: Record<string, string>, num: string): string {
  return Object.entries(sections)
    .filter(([key]) => key === num || key.startsWith(`${num}.`))
    .map(([, body]) => body)
    .join('\n')
}

/** 把一段 Markdown 表格解析成行（跳过表头与分隔行） */
export function tableRows(section: string): string[][] {
  const rows: string[][] = []
  for (const line of section.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    if (/^\|[\s|:-]+\|$/.test(trimmed)) continue
    const cells = trimmed
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
    rows.push(cells)
  }
  // 第一行是表头
  return rows.slice(1)
}

/**
 * 从文本里取出所有 code span 形式的 CSS 变量名。
 * 贪婪匹配后再要求整段是变量写法，避免把 `--text-*` 截断成 `--text`。
 */
export function tokenNamesIn(text: string): string[] {
  const names: string[] = []
  for (const match of text.matchAll(/`(--[a-z0-9-*]+)`/gi)) {
    const name = match[1]
    if (name.endsWith('-') || name.includes('*')) continue // 截断或通配写法，不是具体 Token
    if (!names.includes(name)) names.push(name)
  }
  return names
}

/** 取出文本里所有 code span 的内容（字体名、路径这类带空格与括号的值只能这样取） */
export function codeSpans(text: string): string[] {
  return [...text.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim())
}

/** 去掉 Markdown 的行内代码与加粗标记，方便比对 Token 名与数值 */
export function plain(cell: string | undefined): string {
  return (cell ?? '').replace(/`/g, '').replace(/\*\*/g, '').trim()
}
