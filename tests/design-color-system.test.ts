import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ROOT,
  SRC,
  TOKENS,
  aliasDefinitions,
  composite,
  contrast,
  cssDefinitions,
  cssVarReferences,
  mixOklab,
  mixSrgb,
  palette,
  stripCssComments,
  tokensSection,
  walk,
} from './helpers/design-tokens'

/*
 * Folio 颜色系统契约测试
 *
 * 覆盖范围（写清楚，避免被当成"全站对比度都测了"）：
 *   - 静态可解析的 **Token 值** 与 **CSS 颜色配方**：亮/暗两套、标准表面、
 *     Reading / Code / Accent Wash、五种便利贴（含 hover）、Callout / Banner
 *     四种状态、导航玻璃在五种滚动背景上的合成、玻璃控件。
 *   - color-mix(in oklab) 按 CSS Color 5 的 OKLab 插值计算（不是 sRGB 近似）；
 *     半透明层按 sRGB alpha 合成，并只对**代表性的不透明背后底色**取极值。
 *
 * 明确不覆盖（NOT TESTED，不伪造完整）：
 *   - 背后是图片 / 渐变 / 用户自定义 CSS 时的半透明玻璃对比度；
 *   - 浏览器实际渲染的亚像素抗锯齿、字体渲染、系统高对比模式；
 *   - TSX 里由条件表达式拼出的类名（静态扫描只看同一行字符串，故另有
 *     「tertiary 装饰专用」「accent 不作文字色」两条 Token 级禁令兜底）；
 *   - Mermaid / Shiki / KaTeX 等第三方运行时注入的样式。
 */

const styleFiles = walk(SRC).filter(
  (file) => /\.(css|ts|tsx)$/.test(file) && !file.endsWith('tokens.css'),
)
const cssFiles = styleFiles.filter((file) => file.endsWith('.css'))
const tokensText = stripCssComments(readFileSync(TOKENS, 'utf8'))
const rootBlock = tokensSection('root')
const darkBlock = tokensSection('dark')
const aliases = aliasDefinitions()

const THEMES = ['light', 'dark'] as const
type Theme = (typeof THEMES)[number]

function color(theme: Theme, name: string): string {
  const value = palette(theme).get(name)
  if (!value) throw new Error(`${theme} 调色板里没有 ${name}`)
  return value
}

const STATE_NAMES = ['danger', 'warning', 'success', 'info'] as const
const NOTE_NAMES = ['sage', 'blue', 'clay', 'ochre', 'cream'] as const

interface Bundle {
  inks: {
    primary: string
    secondary: string
    tertiary: string
    heading: string
    accent: string
    accentStrong: string
  }
  surfaces: Record<string, string>
  texts: string[]
  notes: Record<string, string>
  noteHovers: Record<string, string>
  callout: Record<string, string>
  banner: Record<string, string>
  nav: string[]
  glass: string[]
  states: Record<string, string>
}

function bundle(theme: Theme): Bundle {
  const c = (name: string) => color(theme, name)
  const paper = c('--color-paper')
  const raised = c('--color-paper-raised')
  const lift = c('--color-paper-lift')
  const sunk = c('--color-paper-sunk')
  const deep = c('--color-paper-deep')
  const frost = c('--color-frost')
  const wash = c('--color-accent-wash')
  const primary = c('--color-ink')

  // 阅读纸面：tokens.css 的 --reading-surface 用 oklab 94/6 混合
  const reading = mixOklab(raised, paper, 0.94)

  const states = Object.fromEntries(
    STATE_NAMES.map((name) => [name, c(`--color-${name}`)]),
  ) as Record<string, string>
  const notes = Object.fromEntries(
    NOTE_NAMES.map((name) => [name, c(`--color-note-${name}`)]),
  ) as Record<string, string>

  // 便利贴 hover：tag-note.css 用 color-mix(in srgb, note 92%, text-primary)
  const noteHovers = Object.fromEntries(
    NOTE_NAMES.map((name) => [name, mixSrgb(notes[name], primary, 0.92)]),
  ) as Record<string, string>

  // Callout 8% / Banner 6% 底纹，配方写在 containers.css
  const callout = Object.fromEntries(
    STATE_NAMES.map((name) => [name, mixOklab(states[name], raised, 0.08)]),
  ) as Record<string, string>
  const banner = Object.fromEntries(
    STATE_NAMES.map((name) => [name, mixOklab(states[name], raised, 0.06)]),
  ) as Record<string, string>

  // --nav-backdrop = paper-raised @ 82%(亮)/88%(暗)，背后是可滚动的页面内容
  const behinds = [paper, raised, lift, sunk, deep]
  const navAlpha = theme === 'light' ? 0.82 : 0.88
  const nav = behinds.map((behind) => composite(raised, navAlpha, behind))
  // .glass-control = material-glass-tint(=frost) @ 0.88/0.82
  const controlAlpha = theme === 'light' ? 0.88 : 0.82
  const glass = behinds.map((behind) => composite(frost, controlAlpha, behind))

  return {
    inks: {
      primary,
      secondary: c('--color-ink-muted'),
      tertiary: c('--color-ink-faint'),
      heading: c('--color-heading'),
      accent: c('--color-accent'),
      accentStrong: c('--color-accent-strong'),
    },
    surfaces: { paper, raised, lift, sunk, deep, reading, code: sunk, wash, frost },
    // secondary / accent-strong 被允许落在的表面。deep / frost / 便利贴不在其中。
    texts: [paper, raised, lift, sunk, reading, wash],
    notes,
    noteHovers,
    callout,
    banner,
    nav,
    glass,
    states,
  }
}

function assertMin(problems: string[], label: string, fg: string, bg: string, min: number) {
  const value = contrast(fg, bg)
  if (value < min) problems.push(`${label}: ${fg} / ${bg} = ${value.toFixed(2)} < ${min}`)
}

/* ──────────────────────────────────────────────────────────────────────────── */

describe('颜色对比度矩阵（OKLab 混色，亮暗两套）', () => {
  for (const theme of THEMES) {
    it(`${theme}：四支文字色在所有允许的表面上 ≥ 4.5:1`, () => {
      const b = bundle(theme)
      const problems: string[] = []
      for (const [surfaceName, bg] of Object.entries(b.surfaces)) {
        if (!b.texts.includes(bg)) continue
        for (const [inkName, fg] of Object.entries(b.inks)) {
          if (inkName === 'tertiary' || inkName === 'accent') continue
          assertMin(problems, `${theme}/${surfaceName}/${inkName}`, fg, bg, 4.5)
        }
      }
      expect(problems, problems.join('\n')).toEqual([])
    })

    it(`${theme}：装饰色在允许的表面上 ≥ 3:1（非文本下限）`, () => {
      const b = bundle(theme)
      const problems: string[] = []
      const allowed =
        theme === 'light'
          ? ['paper', 'raised', 'lift', 'reading', 'wash']
          : ['paper', 'raised', 'lift', 'sunk', 'deep', 'wash', 'frost']
      for (const name of allowed) {
        assertMin(problems, `${theme}/${name}/tertiary`, b.inks.tertiary, b.surfaces[name], 3)
      }
      for (const name of ['paper', 'raised', 'lift', 'sunk', 'wash', 'frost']) {
        assertMin(problems, `${theme}/${name}/accent`, b.inks.accent, b.surfaces[name], 3)
      }
      expect(problems, problems.join('\n')).toEqual([])
    })

    it(`${theme}：便利贴纸面（含 hover）只用 primary / heading`, () => {
      const b = bundle(theme)
      const problems: string[] = []
      for (const name of NOTE_NAMES) {
        for (const [state, bg] of [
          ['rest', b.notes[name]],
          ['hover', b.noteHovers[name]],
        ] as const) {
          assertMin(problems, `${theme}/note-${name}/${state}/primary`, b.inks.primary, bg, 4.5)
          assertMin(problems, `${theme}/note-${name}/${state}/heading`, b.inks.heading, bg, 4.5)
        }
      }
      expect(problems, problems.join('\n')).toEqual([])
    })

    it(`${theme}：Callout 标题与 Banner 正文（四种状态）`, () => {
      const b = bundle(theme)
      const problems: string[] = []
      for (const name of STATE_NAMES) {
        assertMin(
          problems,
          `${theme}/callout-${name}/title`,
          b.states[name],
          b.callout[name],
          4.5,
        )
        assertMin(
          problems,
          `${theme}/banner-${name}/secondary`,
          b.inks.secondary,
          b.banner[name],
          4.5,
        )
        assertMin(problems, `${theme}/state-${name}/on-paper`, b.states[name], b.surfaces.paper, 3)
      }
      expect(problems, problems.join('\n')).toEqual([])
    })

    it(`${theme}：导航玻璃（五种背后底色）文字 ≥ 4.5:1`, () => {
      const b = bundle(theme)
      const problems: string[] = []
      const strong = color(theme, theme === 'light' ? '--color-heading' : '--color-ink-soft')
      for (const [index, bg] of b.nav.entries()) {
        assertMin(problems, `${theme}/nav[${index}]/ink`, b.inks.secondary, bg, 4.5)
        assertMin(problems, `${theme}/nav[${index}]/strong`, strong, bg, 4.5)
        assertMin(problems, `${theme}/nav[${index}]/focus`, b.inks.accentStrong, bg, 3)
      }
      // 玻璃控件只有图标（非文本），按 3:1 检查 ink-muted
      for (const [index, bg] of b.glass.entries()) {
        assertMin(problems, `${theme}/glass[${index}]/icon`, b.inks.secondary, bg, 3)
      }
      expect(problems, problems.join('\n')).toEqual([])
    })
  }

  it('OKLab 实现自检：端点恒等、与 sRGB 近似确实不同、固定配方有 oracle', () => {
    const a = '#4a6a7c'
    const b = '#f8f6ef'
    expect(mixOklab(a, b, 1)).toBe(a)
    expect(mixOklab(a, b, 0)).toBe(b)
    expect(mixOklab(a, b, 0.08)).not.toBe(mixSrgb(a, b, 0.08))
    // 浏览器 CSS color-mix(in oklab, #4a6a7c 8%, #f8f6ef) 的 8bit 结果
    expect(mixOklab(a, b, 0.08)).toBe('#e9eae5')
  })

  it('测试里写死的配方与 CSS 源码保持一致（防止配方漂移后矩阵空转）', () => {
    expect(rootBlock).toContain(
      'color-mix(in oklab, var(--color-paper-raised) 94%, var(--color-paper))',
    )
    const containers = readFileSync(`${SRC}/design-system/styles/containers.css`, 'utf8')
    expect(containers).toContain(
      'color-mix(in oklab, var(--notice-tone) 8%, var(--surface-raised))',
    )
    expect(containers).toContain(
      'color-mix(in oklab, var(--notice-tone) 6%, var(--surface-raised))',
    )
    const tagNote = readFileSync(`${SRC}/features/taxonomy/tag-note.css`, 'utf8')
    expect(tagNote).toContain('color-mix(in srgb, var(--note-bg) 92%, var(--text-primary))')
    expect(rootBlock).toContain('color-mix(in srgb, var(--color-paper-raised) 82%, transparent)')
    expect(darkBlock).toContain('color-mix(in srgb, var(--color-paper-raised) 88%, transparent)')
  })
})

/* ──────────────────────────────────────────────────────────────────────────── */

interface Occurrence {
  file: string
  line: number
  text: string
  /** CSS 里该声明所属的选择器；TSX 没有选择器，为空 */
  selector: string
}

/** 从声明行往上找最近的 `{`，把 `{` 之前、上一条 `}` 之后的文本当选择器 */
function selectorFor(lines: string[], index: number): string {
  for (let i = index; i >= 0; i--) {
    if (lines[i].includes('}')) return ''
    const open = lines[i].indexOf('{')
    if (open === -1) continue
    let selector = lines[i].slice(0, open).trim()
    for (let j = i - 1; j >= 0; j--) {
      if (lines[j].includes('}') || lines[j].includes('{')) break
      if (lines[j].trim()) selector = `${lines[j].trim()} ${selector}`
    }
    return selector.replace(/\s+/g, ' ').trim()
  }
  return ''
}

/** 只统计真正参与样式的引用：CSS 剥注释，TSX 用整行字符串判定 */
function occurrences(pattern: RegExp): Occurrence[] {
  const out: Occurrence[] = []
  for (const file of styleFiles) {
    const isCss = file.endsWith('.css')
    const text = isCss ? stripCssComments(readFileSync(file, 'utf8')) : readFileSync(file, 'utf8')
    const lines = text.split('\n')
    for (const [index, line] of lines.entries()) {
      if (pattern.test(line)) {
        out.push({
          file: relative(ROOT, file),
          line: index + 1,
          text: line.trim(),
          selector: isCss ? selectorFor(lines, index) : '',
        })
      }
    }
  }
  return out
}

describe('Token 架构：调色板不得被组件绕过', () => {
  /**
   * 唯一受控例外：图片预览的**反色浮层**必须直接取 ink/paper —— 它的语义就是
   * 「遮罩用正文墨色、前景用纸色」，套 --text-primary / --surface 反而会把
   * 反色关系写死成正向语义，且暗色下会失效。
   * 功能色（danger/warning/success/info）不在此例外内：它们已全部改走 --state-*。
   */
  const ALLOWED: Record<string, string[]> = {
    'src/design-system/styles/media.css': ['--color-ink', '--color-paper'],
    'src/design-system/styles/reading.css': ['--color-ink'],
  }

  it('组件层 var(--color-*) 只剩受控例外，且例外清单没有失效项', () => {
    const offenders: string[] = []
    const stillUsed = new Set<string>()
    for (const hit of occurrences(/var\(--color-[a-z-]+\)/)) {
      const names = [...new Set(cssVarReferences(hit.text).values())].filter((n) =>
        n.startsWith('--color-'),
      )
      for (const name of names) {
        const allowed = ALLOWED[hit.file] ?? []
        if (!allowed.includes(name)) offenders.push(`${hit.file}:${hit.line} → ${name}`)
        else stillUsed.add(`${hit.file}|${name}`)
      }
    }
    expect(offenders, `组件直接消费了调色板:\n${offenders.join('\n')}`).toEqual([])

    const stale = Object.entries(ALLOWED).flatMap(([file, names]) =>
      names.filter((name) => !stillUsed.has(`${file}|${name}`)).map((name) => `${file}|${name}`),
    )
    expect(stale, `例外清单里有已不存在的引用，请收紧:\n${stale.join('\n')}`).toEqual([])
  })

  it('四个状态语义 Token 已定义、代理正确、且都有组件消费者', () => {
    const consumerText = styleFiles.map((file) => readFileSync(file, 'utf8')).join('\n')
    for (const name of STATE_NAMES) {
      const token = `--state-${name}`
      expect(aliases.get(token), `${token} 未定义`).toBe(`var(--color-${name})`)
      expect(consumerText, `${token} 没有消费者`).toContain(`var(${token})`)
    }
    // 反向：功能色不允许再从调色板被直接取用（例外已关闭）
    const direct = occurrences(/var\(--color-(?:danger|warning|success|info)\)/)
    expect(direct.map((d) => `${d.file}:${d.line}`), '功能色仍绕过语义状态层').toEqual([])
  })

  it('已删除的 Token 不允许复活（定义链与 var() 都没有）', () => {
    const deleted = [
      '--surface-glass',
      '--nav-icon',
      '--nav-ink-muted',
      '--material-glass-alpha-bar',
      '--material-glass-blur-control',
    ]
    const defined = cssDefinitions(tokensText)
    for (const name of deleted) {
      expect(defined.has(name), `${name} 又被定义了`).toBe(false)
      expect(tokensText, `${name} 仍被 tokens.css 引用`).not.toContain(`var(${name})`)
    }
    const refs = occurrences(new RegExp(`var\\(${deleted.join('|')}\\)`))
    expect(refs.map((r) => `${r.file}:${r.line}`), '已删除 Token 仍被组件引用').toEqual([])
  })

  it('.glass-bar 死 CSS 已删除，且没有把它并进导航', () => {
    const material = readFileSync(`${SRC}/design-system/styles/material.css`, 'utf8')
    const code = stripCssComments(material)
    expect(code).not.toContain('.glass-bar')
    expect(code).toContain('.glass-nav')
    expect(code).toContain('.glass-control')
    // 导航玻璃必须继续走 --nav-backdrop，不能改用 frost tint
    expect(code.match(/\.glass-nav\s*\{[^}]*\}/s)?.[0]).toContain('var(--nav-backdrop)')
  })

  it('--material-glass-tint 与 --color-frost 在亮暗两套逐通道同源', () => {
    for (const [theme, block] of [
      ['light', rootBlock],
      ['dark', darkBlock],
    ] as const) {
      const triple = block.match(/--material-glass-tint:\s*([\d\s]+);/)?.[1].trim().split(/\s+/)
      expect(triple, `${theme} 找不到 tint 三元组`).toHaveLength(3)
      const frost = color(theme, '--color-frost').replace('#', '')
      const expected = [0, 2, 4].map((i) => Number.parseInt(frost.slice(i, i + 2), 16))
      expect(triple?.map(Number), `${theme} tint 与 frost 不同源`).toEqual(expected)
    }
  })

  it('--color-paper-deep 因暗色环境光而保留，不得因亮色零消费者删除', () => {
    expect(darkBlock).toContain('var(--color-paper-deep)')
    expect(color('light', '--color-paper-deep')).toBe('#dfd9c9')
  })
})

/* ──────────────────────────────────────────────────────────────────────────── */

describe('文字颜色使用纪律（静态可识别范围）', () => {
  /**
   * --text-tertiary 是**装饰色**，允许清单按「文件 + 稳定识别串」登记，
   * 不按行号（行号会随编辑漂移）。每一项都必须写清为什么不需要 4.5:1。
   */
  const DECORATIVE: { file: string; match: string; reason: string }[] = [
    { file: 'src/app/globals.css', match: '.meta-sep::before', reason: '分隔符「·」，纯装饰' },
    { file: 'src/app/globals.css', match: '.footer-sep', reason: '页脚分隔符，纯装饰' },
    { file: 'src/app/about/page.tsx', match: 'group-hover:translate-x-0.5', reason: '链接尾部箭头图标' },
    { file: 'src/app/search/page.tsx', match: 'size-[1.15rem]', reason: '搜索框放大镜图标' },
    { file: 'src/components/layout/search-panel.tsx', match: 'size-[1.05rem]', reason: '搜索面板放大镜图标' },
    { file: 'src/app/articles/[category]/[slug]/page.tsx', match: 'aria-hidden="true"', reason: '面包屑箭头，aria-hidden' },
    { file: 'src/components/reading/reading-tools.tsx', match: 'toc-chevron', reason: '目录折叠箭头，aria-hidden' },
    { file: 'src/components/reading/subscribe-panel.tsx', match: 'aria-hidden="true"', reason: '箭头图标，aria-hidden' },
    { file: 'src/components/ui/pagination.tsx', match: 'disabledClass', reason: '未激活控件（WCAG 1.4.3 对 inactive component 豁免）' },
    { file: 'src/components/ui/mermaid-hydrator.tsx', match: "'lineColor'", reason: 'Mermaid 图表连线，非文本图形' },
  ]

  it('--text-tertiary 的每一处使用都在装饰白名单里，且白名单无失效项', () => {
    const hits = occurrences(/var\(--text-tertiary\)|'--text-tertiary'/)
    const used = new Set<number>()
    const offenders: string[] = []
    for (const hit of hits) {
      const index = DECORATIVE.findIndex(
        (entry) =>
          entry.file === hit.file &&
          (hit.text.includes(entry.match) || hit.selector.includes(entry.match)),
      )
      if (index === -1) offenders.push(`${hit.file}:${hit.line} → ${hit.text}`)
      else used.add(index)
    }
    expect(offenders, `tertiary 被当作可读文字使用:\n${offenders.join('\n')}`).toEqual([])

    const stale = DECORATIVE.filter((_, i) => !used.has(i)).map((e) => `${e.file} / ${e.match}`)
    expect(stale, `装饰白名单有失效项，请删除:\n${stale.join('\n')}`).toEqual([])
  })

  it('--accent 不再作为文字色（color: / text-[...]）', () => {
    const offenders = occurrences(/(?:^|[\s;{])color:\s*var\(--accent\)|text-\[var\(--accent\)\]/).map(
      (hit) => `${hit.file}:${hit.line} → ${hit.text}`,
    )
    expect(offenders, `accent 被当成文字色（应改用 --accent-strong）:\n${offenders.join('\n')}`).toEqual([])
    // 装饰性用途仍应存在，否则说明扫描器空转
    expect(occurrences(/var\(--accent\)/).length, 'accent 装饰用途不应全部消失').toBeGreaterThan(5)
  })

  it('CSS 里 ≤13px 的文字规则不搭配弱对比颜色', () => {
    const problems: string[] = []
    const smallSize = /font-size:\s*(?:var\(--text-(?:meta|caption|small)\)|0\.(?:75|8125|9375)rem|1[0-3]px)\b/
    const weak = /color:\s*var\(--(?:text-tertiary|accent)\)/
    for (const file of cssFiles) {
      const text = stripCssComments(readFileSync(file, 'utf8'))
      // 逐条 CSS 规则块（非嵌套 @media 内也按大括号切，够用于本项目的扁平规则）
      for (const block of text.matchAll(/\{([^{}]*)\}/g)) {
        const body = block[1]
        if (smallSize.test(body) && weak.test(body)) {
          problems.push(`${relative(ROOT, file)} → ${body.replace(/\s+/g, ' ').trim().slice(0, 160)}`)
        }
      }
    }
    expect(problems, `小字号文字用了弱对比色:\n${problems.join('\n')}`).toEqual([])
  })

  it('便利贴组件不使用 --text-secondary / --text-tertiary', () => {
    const tagNote = stripCssComments(readFileSync(`${SRC}/features/taxonomy/tag-note.css`, 'utf8'))
    expect(tagNote).not.toContain('var(--text-secondary)')
    expect(tagNote).not.toContain('var(--text-tertiary)')
    expect(tagNote).toContain('color: var(--text-heading)')
    expect(tagNote).toContain('color: var(--text-primary)')
  })
})
