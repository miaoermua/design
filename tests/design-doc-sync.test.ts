import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  KNOWN_DEAD_ALIASES,
  ROOT,
  DOC,
  TOKENS,
  aliasDefinitions,
  codeSpans,
  contrast,
  cssDefinitions,
  cssVarReferences,
  docSections,
  palette,
  plain,
  sectionGroup,
  stripCssComments,
  tableRows,
  themeValues,
  tokenNamesIn,
  walk,
} from './helpers/design-tokens'

const doc = readFileSync(DOC, 'utf8')
const sec = docSections(doc)
const light = palette('light')
const dark = palette('dark')
const aliases = aliasDefinitions()
const theme = themeValues()
const tokensDefined = cssDefinitions(stripCssComments(readFileSync(TOKENS, 'utf8')))

/** 组件层源码（不含 tokens.css）：判断某个 Token 是否真的被用起来 */
const consumerText = walk(join(ROOT, 'src'))
  .filter((file) => /\.(css|ts|tsx)$/.test(file) && !file.endsWith('tokens.css'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n')

function isConsumed(name: string): boolean {
  if (new RegExp(`var\\(\\s*${name}\\s*[,)]`).test(consumerText)) return true
  // @theme 的 Token 由 Tailwind 生成同名工具类（--color-accent-line → text-accent-line）
  const utility = name.replace(/^--(color|font|text|radius|ease|duration|container|spacing)-/, '')
  return new RegExp(`["'\\s]${utility}(?![-a-z0-9])`).test(consumerText)
}

/** 展开文档里的 Token 简写：`--radius-xs/sm/md`、`--spacing-gutter` / `-lg` */
function expandTokens(cell: string): string[] {
  const names: string[] = []
  let base: string | null = null

  for (const fragment of plain(cell).split('/')) {
    const full = fragment.match(/--[a-z0-9-]+/)?.[0]
    if (full?.startsWith('--')) {
      base = full
      names.push(base)
      continue
    }
    const bare = fragment.trim().match(/^-?([a-z0-9]+)$/)?.[1]
    if (!base || !bare) continue
    // `-lg` 接在全名后面，`sm/md/pill` 替换最后一段
    names.push(
      fragment.trim().startsWith('-')
        ? `${base}-${bare}`
        : `${base.replace(/-[^-]*$/, '-')}${bare}`,
    )
  }
  return names
}

/** 只有单值标量/函数才比对数值；clamp()、`1.25rem / 2rem`、`见 §3.1` 一律只查存在性 */
function isExactValue(value: string): boolean {
  return /^(#[0-9a-f]{3,8}|[\d.]+(?:rem|px|em|ms|s)?|0|cubic-bezier\([\d.,\s]+\))$/i.test(value)
}

/** 文档用排版减号 U+2212，CSS 用 ASCII 连字符；比对负值前先归一 */
function normalize(value: string): string {
  return plain(value)
    .replace(/−/g, '-')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s+/g, ' ')
}

/** 文档把「建议 / 预留 / 未实施」标了出来，这些内容不能作为已实现的事实来断言 */
function isProposal(text: string): boolean {
  return /(建议|尚未|未实施|预留|待确认|需要设计决策)/.test(text)
}

/** @theme 里的字号角色：`--text-x`，排除别名层的同名色变量（`--text-primary` 等） */
function themeTextRoles(): string[] {
  return [...theme.keys()]
    .filter((key) => /^--text-[a-z0-9]+$/.test(key))
    .filter((key) => !aliases.has(key))
    .sort()
}

describe('文档 §13：文件清单路径真实存在', () => {
  const listed = [
    ...new Set(
      (sec['13'] ?? '')
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => /^(src|tests|docs)\//.test(line))
        .map((line) => line.split(/\s+/)[0]),
    ),
  ]

  it('清单不为空', () => {
    expect(listed.length).toBeGreaterThanOrEqual(10)
  })

  for (const path of listed) {
    it(`${path} 存在`, () => {
      expect(existsSync(join(ROOT, path)), `§13 列出的路径不存在: ${path}`).toBe(true)
    })
  }

  it('清单里不混入截图或不存在的历史报告', () => {
    // 正文可以说明「这些路径不存在」，但清单（上面校验过的 listed）不能列出它们
    expect(listed.some((path) => /shots|PHASE-\d/.test(path))).toBe(false)
  })
})

describe('文档 §3：色彩', () => {
  const lightRows = tableRows(sec['3.1'] ?? '')
  const roleToToken = new Map(
    lightRows.map((row) => [row[0], plain(row[1]).match(/--[a-z0-9-]+/)?.[0] as string]),
  )

  it('§3.1 行数与源码调色板条目数一致', () => {
    expect(lightRows.length).toBe(light.size)
  })

  it('§3.1 每行的 Token 存在且 HEX 与源码一致', () => {
    const problems: string[] = []

    for (const [, token, value] of lightRows) {
      const name = plain(token).match(/--[a-z0-9-]+/)?.[0]
      if (!name) {
        problems.push(`某行解析不出 Token 名：${token}`)
        continue
      }
      if (!light.has(name)) problems.push(`${name} 不在 @theme 调色板里`)
      else if (normalize(value) !== light.get(name)) {
        problems.push(`${name} 的值不一致：文档「${plain(value)}」/ 源码「${light.get(name)}」`)
      }
    }

    expect(problems, problems.join('\n')).toEqual([])
  })

  it('源码调色板里没有未写进 §3.1 的颜色', () => {
    const documented = new Set(lightRows.map((row) => plain(row[1]).match(/--[a-z0-9-]+/)?.[0]))
    const missing = [...light.keys()].filter((name) => !documented.has(name))
    expect(missing, `以下颜色 Token 未写进 §3.1:\n${missing.join('\n')}`).toEqual([])
  })

  it('§3.2 是暗色的节选：列出的值必须与源码一致，但不要求覆盖全部', () => {
    const problems: string[] = []

    for (const [role, value] of tableRows(sec['3.2'] ?? '')) {
      const hex = plain(value).match(/#[0-9a-f]{6}/i)?.[0]
      if (!hex) continue // 阴影基色等非 HEX 行只做说明
      const name = roleToToken.get(role)
      if (!name) {
        problems.push(`角色「${role}」在 §3.1 里没有对应 Token`)
      } else if (dark.get(name) !== hex) {
        problems.push(`${name} 的暗色值不一致：文档 ${hex} / 源码 ${dark.get(name)}`)
      }
    }

    expect(problems, problems.join('\n')).toEqual([])
  })

  it('暗色覆盖的 Token 都是亮色里已有的同名变量', () => {
    const extra = [...dark.keys()].filter((name) => !light.has(name))
    expect(extra, `暗色出现了亮色没有的颜色 Token:\n${extra.join('\n')}`).toEqual([])
  })
})

describe('文档 §4：语义别名', () => {
  const rows = tableRows(sec['4'] ?? '')

  it('别名存在、代理链与源码一致、标了「有」的确实有消费者', () => {
    const problems: string[] = []

    for (const [token, proxy, , status] of rows) {
      const names = expandTokens(token)
      if (names.length === 0) {
        problems.push(`解析不出 Token 名：${token}`)
        continue
      }

      for (const name of names) {
        // §4 也收录了组件直接消费的 @theme 变量（--shadow-raise / --shadow-pop）
        if (!aliases.has(name) && !theme.has(name)) problems.push(`${name} 在源码里不存在`)
      }

      const documented = [...new Set(tokenNamesIn(plain(proxy)))].sort()
      if (documented.length && aliases.has(names[0])) {
        const source = [...new Set([...cssVarReferences(aliases.get(names[0]) ?? '')])].sort()
        if (documented.join(' ') !== source.join(' ')) {
          problems.push(`${names[0]} 的代理链不一致：文档 ${documented} / 源码 ${source}`)
        }
      }

      if (names.length === 1 && aliases.has(names[0]) && isExactValue(plain(proxy))) {
        if (normalize(proxy) !== normalize(aliases.get(names[0]) ?? '')) {
          problems.push(
            `${names[0]} 的值不一致：文档「${plain(proxy)}」/ 源码「${aliases.get(names[0])}」`,
          )
        }
      }

      // 「无消费者 / 仅 tokens 内部」由 design-tokens.test.ts 的白名单守护，这里不重复断言
      if (/^有/.test(status) && !isProposal(`${proxy} ${status}`)) {
        for (const name of names) {
          if (!isConsumed(name)) problems.push(`${name} 标为「有消费者」，源码里找不到引用`)
        }
      }
    }

    expect(problems, problems.join('\n')).toEqual([])
  })

  it('标为无消费者的别名与测试白名单完全一致', () => {
    const documented = rows
      .filter((row) => plain(row[3]).includes('无消费者'))
      .flatMap((row) => expandTokens(row[0]))
      .sort()

    expect(documented, '§4 的「无消费者」标注与 KNOWN_DEAD_ALIASES 不同步').toEqual(
      [...KNOWN_DEAD_ALIASES].sort(),
    )
  })

  it('§4 覆盖了别名层里所有 surface / text / edge / accent 变量', () => {
    const documented = new Set(rows.flatMap((row) => expandTokens(row[0])))
    const missing = [...aliases.keys()]
      .filter((name) => /^--(surface|text|edge|accent|reading-surface|code-surface)/.test(name))
      .filter((name) => !documented.has(name))

    expect(missing, `以下别名未写进 §4:\n${missing.join('\n')}`).toEqual([])
  })
})

describe('文档 §5：排版', () => {
  const rows = tableRows(sec['5'] ?? '').filter((row) => /--text-[a-z0-9]+/.test(row[1] ?? ''))
  const documented = rows
    .map((row) => plain(row[1]).match(/--text-[a-z0-9]+/)?.[0])
    .filter((name): name is string => Boolean(name))

  it('每行的 Token、行高、字距、精确值与源码一致', () => {
    const problems: string[] = []

    for (const [, token, value] of rows) {
      const name = plain(token).match(/--text-[a-z0-9]+/)?.[0] as string
      const source = theme.get(name)
      const cell = plain(value)
      if (!source) {
        problems.push(`${name} 在 @theme 里不存在`)
        continue
      }

      const lh = cell.match(/lh\s*([\d.]+)/)
      const lineCompanion = theme.get(`${name}--line-height`)
      if (lh && normalize(lh[1]) !== normalize(lineCompanion ?? '')) {
        problems.push(`${name} 行高不一致：文档 ${lh[1]} / 源码 ${lineCompanion}`)
      }

      const ls = cell.match(/ls\s*([−-]?[\d.]+em)/)
      const trackCompanion = theme.get(`${name}--letter-spacing`)
      if (ls && normalize(ls[1]) !== normalize(trackCompanion ?? '')) {
        problems.push(`${name} 字距不一致：文档 ${ls[1]} / 源码 ${trackCompanion}`)
      }
      if (!ls && /无字距/.test(cell) && trackCompanion) {
        problems.push(`${name} 文档写「无字距覆盖」，源码却有 ${name}--letter-spacing`)
      }

      const scalar = cell.match(/^([\d.]+rem)(?![\d])/)?.[1]
      if (scalar && !source.includes('clamp') && normalize(source) !== scalar) {
        problems.push(`${name} 值不一致：文档 ${scalar} / 源码 ${source}`)
      }
    }

    expect(problems, problems.join('\n')).toEqual([])
  })

  it('源码里的每个字号角色都写进了 §5', () => {
    const roles = themeTextRoles().filter((key) => !documented.includes(key))

    expect(roles, `以下字号角色未写进 §5:\n${roles.join('\n')}`).toEqual([])
  })

  it('只有文档标了 ls 的角色才定义 --letter-spacing', () => {
    const withLs = rows
      .filter((row) => /ls\s*[−-]?[\d.]+em/.test(plain(row[2] ?? '')))
      .map((row) => plain(row[1]).match(/--text-[a-z0-9]+/)?.[0] as string)
      .sort()
    const inSource = [...theme.keys()]
      .filter((key) => key.endsWith('--letter-spacing'))
      .map((key) => key.replace(/--letter-spacing$/, ''))
      .sort()

    expect(inSource, '--letter-spacing 定义与 §5 的 ls 标注不同步').toEqual(withLs)
  })

  it('字体栈表：首选即源码第一项，回退名逐个存在，不做整串比对', () => {
    const fontRows = tableRows(sec['5.2'] ?? '').filter((row) => /^--font-/.test(plain(row[0])))
    expect(fontRows.length).toBe(3)

    const problems: string[] = []
    for (const [tokenCell, first, cjk, latin, keyword] of fontRows) {
      const name = plain(tokenCell).match(/--font-[a-z]+/)?.[0] as string
      const entries = (theme.get(name) ?? '')
        .split(',')
        .map((entry) => normalize(entry).replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)

      const wantFirst = codeSpans(first)[0]
      if (wantFirst && entries[0] !== wantFirst) {
        problems.push(`${name} 首选不一致：文档「${wantFirst}」/ 源码「${entries[0]}」`)
      }

      const fallbacks = [...codeSpans(cjk), ...codeSpans(latin)]
      expect(fallbacks.length, `${name} 的回退列没解析出字体名`).toBeGreaterThan(0)
      for (const face of fallbacks) {
        if (!entries.includes(face)) problems.push(`${name} 源码回退链里没有「${face}」`)
      }

      const last = codeSpans(keyword)[0]
      if (last && entries.at(-1) !== last) {
        problems.push(`${name} 关键字不一致：文档「${last}」/ 源码「${entries.at(-1)}」`)
      }
    }

    expect(problems, problems.join('\n')).toEqual([])
  })

  it('§5.1 的字号角色映射只引用真实存在的 Token，不新增平行字号', () => {
    const mapping = tableRows(sec['5.1'] ?? '')
    const names = [...new Set(mapping.flatMap((row) => tokenNamesIn(row[0] ?? '')))]
    const textRoles = names.filter((name) => name.startsWith('--text-'))
    expect(textRoles.length).toBeGreaterThanOrEqual(10)

    const missing = textRoles.filter((name) => !theme.has(name))
    expect(missing, `§5.1 引用了不存在的字号角色:\n${missing.join('\n')}`).toEqual([])

    // 映射表覆盖 @theme 里全部字号角色，反过来也不允许出现源码里没有的字号
    const roles = themeTextRoles()
    expect([...textRoles].sort(), '§5.1 的字号角色集合与源码不一致').toEqual(roles)
  })
})

describe('文档 §6：版心 / 间距 / 圆角 / 阴影 / 动效', () => {
  const rows = tableRows(sec['6'] ?? '').filter((row) => /--/.test(row[1] ?? ''))

  it('每个 Token 存在；精确值与源码一致', () => {
    const problems: string[] = []

    for (const [, token, value] of rows) {
      const names = expandTokens(token)
      if (names.length === 0) {
        problems.push(`解析不出 Token 名：${token}`)
        continue
      }

      for (const name of names) {
        if (!theme.has(name) && !aliases.has(name)) problems.push(`${name} 在源码里不存在`)
      }

      const cell = normalize(value)
      if (names.length === 1 && isExactValue(value) && !/\d+\s*\/\s*\d+/.test(value)) {
        const source = theme.get(names[0]) ?? aliases.get(names[0])
        if (source && normalize(source) !== cell) {
          problems.push(`${names[0]} 值不一致：文档「${cell}」/ 源码「${normalize(source)}」`)
        }
      }
    }

    expect(problems, problems.join('\n')).toEqual([])
  })

  it('§6 覆盖 @theme 的版心 / 间距 / 圆角 / 边框 / 阴影 / 动效变量', () => {
    const documented = new Set(rows.flatMap((row) => expandTokens(row[1])))
    const missing = [...theme.keys()]
      .filter((key) => /^--(container|spacing|radius|border|shadow|ease|duration)-/.test(key))
      .filter((key) => !aliases.has(key)) // --shadow-color 属别名层，登记在 §4
      .filter((key) => !documented.has(key))

    expect(missing, `以下 Token 未写进 §6:\n${missing.join('\n')}`).toEqual([])
  })

  it('断点口径：Tailwind 默认三档，仓库里没有自定义覆盖', () => {
    expect(stripCssComments(readFileSync(TOKENS, 'utf8'))).not.toMatch(/--breakpoint-/)
    expect(existsSync(join(ROOT, 'tailwind.config.ts'))).toBe(false)
    expect(existsSync(join(ROOT, 'tailwind.config.js'))).toBe(false)
    expect(sectionGroup(sec, '6')).toContain('断点')
  })
})

describe('文档 §11 / §12 / §14', () => {
  const rows = tableRows(sec['11'] ?? '').filter((row) => /--color-/.test(row[0] ?? ''))

  function thresholdFor(cell: string, side: '亮' | '暗'): string | null {
    const scoped = cell.match(new RegExp(`${side}\\s*≥?\\s*([\\d.]+)`))
    if (scoped) return scoped[1]
    return cell.match(/≥\s*([\d.]+)/)?.[1] ?? null
  }

  it('标了「已断言」的对比度组合，实际比值不低于文档写的阈值', () => {
    const problems: string[] = []

    for (const [fg, bg, threshold, lightCell, darkCell] of rows) {
      const fgName = plain(fg).match(/--color-[a-z-]+/)?.[0]
      const bgName = plain(bg).match(/--color-[a-z-]+/)?.[0]
      if (!fgName || !bgName) continue

      for (const [cell, status, map] of [
        ['亮', lightCell, light],
        ['暗', darkCell, dark],
      ] as const) {
        if (!/已断言/.test(plain(status))) continue
        const limit = Number(thresholdFor(threshold, cell))
        if (!map.has(fgName) || !map.has(bgName)) {
          problems.push(`${cell}色找不到 ${fgName} 或 ${bgName}`)
          continue
        }
        const value = contrast(map.get(fgName) as string, map.get(bgName) as string)
        if (!(value >= limit)) {
          problems.push(`${cell}色 ${fgName}/${bgName} 实测 ${value.toFixed(2)} < 阈值 ${limit}`)
        }
      }
    }

    expect(problems, problems.join('\n')).toEqual([])
  })

  it('§11 明确列出哪些颜色没有被断言', () => {
    expect(sec['11']).toMatch(/未被任何断言覆盖/)
    expect(sec['11']).toMatch(/color-mix\(\)/)
  })

  it('§12 的扩展流程要求本文与 tokens.css 同批更新', () => {
    expect(sec['12']).toContain('tokens.css')
    expect(sec['12']).toMatch(/第 3\/4\/5\/6 节/)
  })

  it('§14 引用的 Token 真实存在；标为建议 / 预留 / 未实施的行不作断言', () => {
    const section = sectionGroup(sec, '14')
    const problems: string[] = []

    for (const line of section.split('\n')) {
      if (isProposal(line)) continue
      for (const name of tokenNamesIn(line)) {
        if (!tokensDefined.has(name) && !aliases.has(name)) problems.push(`${name}（§14）`)
      }
    }

    expect(problems, `§14 引用了不存在的 Token:\n${problems.join('\n')}`).toEqual([])
  })

  it('「建议 / 预留」措辞确实会被排除在事实断言之外', () => {
    expect(isProposal('- 建议的自动化守护（**C**）：断言 …')).toBe(true)
    expect(isProposal('| `--surface-lift` | 预留：最高层 | 本轮只记录 |')).toBe(true)
    expect(isProposal('| `--surface` | `--color-paper` | 页面底 | 有 |')).toBe(false)
  })

  it('§14 状态图例存在，且 A/B/C 三档都被用到', () => {
    const section = sectionGroup(sec, '14')
    expect(section).toMatch(/\*\*A\*\* =/)
    for (const marker of ['**A**', '**B**', '**C**']) {
      expect(section.split(marker).length - 1, `§14 里没有出现 ${marker}`).toBeGreaterThan(1)
    }
  })
})
