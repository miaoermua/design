import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  EXTERNAL_PREFIXES,
  KNOWN_DEAD_ALIASES,
  KNOWN_UNUSED_MOTION_TOKENS,
  ROOT,
  SRC,
  TOKENS,
  contrast,
  cssDefinitions,
  cssVarReferences,
  palette,
  stripCssComments,
  stripNonColorLiterals,
  tokensSection,
  walk,
} from './helpers/design-tokens'

const files = walk(SRC)
const cssFiles = files.filter((file) => file.endsWith('.css'))
const tsFiles = files.filter((file) => file.endsWith('.ts') || file.endsWith('.tsx'))
/** tokens.css 之外的样式层：硬编码色值、dark: 变体这类规则只约束这里 */
const styleFiles = cssFiles.filter((file) => !file.endsWith('tokens.css'))

const defined = new Set<string>()
const used = new Map<string, string>()
/** Token → 消费它的文件（相对路径），CSS 与 TS/TSX 都算 */
const varSites = new Map<string, string[]>()

function record(name: string, file: string) {
  const rel = relative(ROOT, file)
  const sites = varSites.get(name) ?? []
  if (!sites.includes(rel)) sites.push(rel)
  varSites.set(name, sites)
}

for (const file of cssFiles) {
  const text = readFileSync(file, 'utf8')
  for (const name of cssDefinitions(text)) defined.add(name)
  for (const name of cssVarReferences(text)) {
    if (!used.has(name)) used.set(name, relative(ROOT, file))
    record(name, file)
  }
}
for (const file of tsFiles) {
  for (const name of cssVarReferences(readFileSync(file, 'utf8'))) record(name, file)
}

/** 在 tokens.css 之外（含 TS/TSX）有 var() 消费者 */
function consumedOutsideTokens(name: string): boolean {
  return (varSites.get(name) ?? []).some((site) => site !== relative(ROOT, TOKENS))
}
/** 被 tokens.css 里另一条声明引用：仍处在主题定义链上，不算死 Token */
function usedByOtherToken(name: string): boolean {
  return (varSites.get(name) ?? []).includes(relative(ROOT, TOKENS))
}

const styleCss = styleFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
const tsText = tsFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
const aliasNames = [...cssDefinitions(tokensSection('root'))]

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
    const darkBlock = tokensSection('dark')

    expect(darkBlock).toContain('--color-paper:')
    expect(darkBlock).toContain('--color-accent:')
    expect(darkBlock).toContain('--material-glass-tint:')

    for (const file of tsFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source, `${relative(ROOT, file)} 不应出现 dark: 变体`).not.toMatch(/\bdark:[a-z[]/)
    }
  })

  it('样式层 CSS 也不出现 dark: 变体', () => {
    for (const file of styleFiles) {
      const text = stripCssComments(readFileSync(file, 'utf8'))
      expect(text, `${relative(ROOT, file)} 不应出现 dark: 变体`).not.toMatch(/\bdark:[a-z[]/)
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

  it('TS/TSX 里 var() 引用的变量同样有定义', () => {
    const missing: string[] = []

    for (const [name, sites] of varSites) {
      if (EXTERNAL_PREFIXES.some((prefix) => name.startsWith(prefix))) continue
      if (defined.has(name)) continue
      for (const site of sites) if (!site.endsWith('.css')) missing.push(`${name}（${site}）`)
    }

    expect(missing, '以下变量没有定义:\n' + [...new Set(missing)].join('\n')).toEqual([])
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

describe('Design Token：样式层不硬编码颜色', () => {
  it('CSS 消费层不出现 HEX / rgb() / hsl() 字面量', () => {
    const offenders: string[] = []

    for (const file of styleFiles) {
      // 注释里的示例色值、url() 中的 data URI 与 #fragment 都不是颜色声明
      const text = stripNonColorLiterals(stripCssComments(readFileSync(file, 'utf8')))
      for (const match of text.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi)) {
        offenders.push(`${relative(ROOT, file)} → ${match[0]}`)
      }
      for (const match of text.matchAll(/\b(?:rgb|rgba|hsl|hsla)\s*\(([^)]*)\)/gi)) {
        if (!match[1].includes('var(')) offenders.push(`${relative(ROOT, file)} → ${match[0]}`)
      }
    }

    expect(offenders, '样式层颜色必须来自 Token:\n' + offenders.join('\n')).toEqual([])
  })
})

describe('Design Token：死 Token 登记', () => {
  it('别名层里没有未登记的死 Token', () => {
    // 别名层不生成 Tailwind 工具类，var() 是它唯一的消费途径
    const dead = aliasNames
      .filter((name) => !consumedOutsideTokens(name) && !usedByOtherToken(name))
      .sort()

    expect(
      dead,
      `新增了无人消费的别名，请补上消费者或删除；确需保留则登记原因:\n${dead.join('\n')}`,
    ).toEqual([...KNOWN_DEAD_ALIASES].sort())
  })

  it('登记为死的别名一旦被使用，必须移出名单', () => {
    const alive = KNOWN_DEAD_ALIASES.filter((name) => consumedOutsideTokens(name))

    expect(alive, `以下 Token 已有消费者，请移出 KNOWN_DEAD_ALIASES:\n${alive.join('\n')}`).toEqual(
      [],
    )
  })

  it('仅被 tokens.css 内部引用的 Token 仍在定义链上', () => {
    const text = stripCssComments(readFileSync(TOKENS, 'utf8'))

    for (const name of ['--focus-ring-color', '--shadow-color']) {
      expect(
        new RegExp(`var\\(\\s*${name}\\)`).test(text),
        `${name} 已脱落出主题定义链，请确认是否该删除`,
      ).toBe(true)
    }
  })

  it('动效 Token 的消费状态与登记一致', () => {
    for (const name of KNOWN_UNUSED_MOTION_TOKENS) {
      expect(consumedOutsideTokens(name), `${name} 已被使用，请移出登记名单`).toBe(false)
    }
    // 反向哨兵：扫描器一旦失效，这些确实在用的 Token 会先报错
    for (const name of [
      '--duration-fast',
      '--duration-base',
      '--duration-slow',
      '--ease-out-soft',
    ]) {
      expect(consumedOutsideTokens(name), `${name} 理应仍有消费者`).toBe(true)
    }
  })
})

describe('Design Token：字号角色有消费者', () => {
  for (const role of [
    'display',
    'title',
    'h2',
    'h3',
    'body',
    'lead',
    'small',
    'caption',
    'meta',
    'code',
  ]) {
    it(`--text-${role} 经 var() 或同名工具类被消费`, () => {
      const viaVar = styleCss.includes(`var(--text-${role})`)
      const viaUtility = new RegExp(`["'\\s]text-${role}(?![-a-z0-9])`).test(tsText)

      expect(viaVar || viaUtility, `--text-${role} 既无 var() 也无 text-${role} 工具类`).toBe(true)
    })
  }
})

describe('Design Token：解析器可靠性', () => {
  it('选择器不会被误判成 Token 定义', () => {
    // .md-mention--tw::before、.prose--compact 都带 `--xxx:` 的形态
    for (const fake of ['--tw', '--tg', '--compact', '--before']) {
      expect(defined.has(fake), `${fake} 不是 Token，解析器把选择器当成了定义`).toBe(false)
    }
  })

  it('被注释掉的声明不算定义', () => {
    const commented = '/*\n--obsolete-token: #ffffff;\n*/\n.foo { color: var(--color-ink); }'
    expect(cssDefinitions(commented).has('--obsolete-token')).toBe(false)
    // 去掉注释边界后同一行确实会被识别 —— 说明剥离注释这一步在真实起作用
    expect(cssDefinitions(commented.replace(/\/?\*[\/]?/g, '')).has('--obsolete-token')).toBe(true)
  })

  it('data URI 与 #fragment 不算硬编码色值', () => {
    const text = 'background-image: url("data:image/svg+xml,%3Csvg/%3E#f3f0e7");'
    expect(stripNonColorLiterals(text).match(/#[0-9a-f]{6}\b/gi)).toBeNull()
  })

  it('扫描覆盖到全部样式层文件，避免规则空转', () => {
    expect(styleFiles.length, '样式层 CSS 文件数异常，扫描范围可能被裁掉').toBeGreaterThanOrEqual(6)
    expect(aliasNames.length).toBeGreaterThanOrEqual(20)
    expect(defined.size).toBeGreaterThanOrEqual(60)
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
