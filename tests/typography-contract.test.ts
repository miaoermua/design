import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ROOT, SRC, TOKENS, stripCssComments, walk } from './helpers/design-tokens'

/**
 * Typography 契约守卫
 *
 * 这里守的是「排版只能从 Token 取值」这条线，不是审美判断。三条规则：
 *
 *   1. 字号只能来自 `--text-*` 角色；任何 `text-[3rem]` 这种字面量必须登记理由。
 *   2. 导语（`text-lead`）必须吃 Token 行高，不允许各自写 `leading-[1.7]`。
 *   3. 衬线 + 600 的组合只能出现在标题族选择器里（§14.1 的 C 项）。
 *
 * 白名单是**债务登记**：新增一项要写理由，删掉实现后对应条目也会因「失效」而报错。
 * 判定口径与 `design-color-system.test.ts` 一致：静态可识别的范围才断言，
 * 由条件表达式拼出的类名不在覆盖范围内（盲区如实记录，不假装全覆盖）。
 */

const files = walk(SRC)
const tsxFiles = files.filter((file) => file.endsWith('.tsx'))
const cssFiles = files.filter((file) => file.endsWith('.css'))

const rel = (file: string) => relative(ROOT, file).split('\\').join('/')

/** 解析 CSS 规则块：`{选择器, 块内容, 行号}`，跳过注释与 at-rule 头 */
interface CssRule {
  selector: string
  body: string
  line: number
}

function cssRules(text: string): CssRule[] {
  const clean = stripCssComments(text)
  const rules: CssRule[] = []
  const pattern = /([^{}]+)\{([^{}]*)\}/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(clean)) !== null) {
    const selector = (match[1] ?? '').trim()
    const body = match[2] ?? ''
    if (!selector || selector.startsWith('@')) continue
    const line = clean.slice(0, match.index).split('\n').length
    rules.push({ selector, body, line })
  }
  return rules
}

/* ── 1. 硬编码字号 ──────────────────────────────────────────────── */

/**
 * 允许保留的字面量字号。每一条都要能回答「为什么它不是 Token」。
 *
 * 判定的分界线：**这个尺寸是否表达一个新的字号角色**。
 * 若只是把某个 Token 的数值抄了一遍，就该用 Token；若它是「同一角色的
 * 局部尺寸变体」（日号、印章、单行输入），则留在组件里并登记。
 */
const ALLOWED_LITERAL_SIZES: Array<{ file: string; value: string; reason: string }> = [
  {
    file: 'src/features/explore/components/archive-section.tsx',
    value: 'text-[1.75rem]',
    reason:
      '归档年份（28px）：比 --text-h2(22px) 大一档、比 --text-title 小一档，单行 + leading-none',
  },
  {
    file: 'src/components/ui/page-header.tsx',
    value: 'text-[1.0625rem]',
    reason: '页头描述 17px/1.8：与 --text-body 同尺寸但行高更紧（说明文不是阅读正文）',
  },
  {
    file: 'src/components/ui/empty-state.tsx',
    value: 'text-[1.0625rem]',
    reason: '空态说明 17px 衬线：单行标题式说明，不吃正文的 1.82 行高',
  },
  {
    file: 'src/app/search/page.tsx',
    value: 'text-[1.125rem]',
    reason: '搜索框输入 18px/1.6：单行输入需要紧行高，与 --text-lead 的 1.8 冲突',
  },
  {
    file: 'src/app/search/page.tsx',
    value: 'text-[0.9375rem]',
    reason: '搜索框 placeholder 15px：比 --text-small 更小一档，避免占位文字与输入值同重',
  },
]

describe('Typography：字号只能来自 Token', () => {
  const LITERAL = /text-\[(\d*\.?\d+)(rem|px)\]/g

  it('每个字面量字号都登记在允许清单里', () => {
    const offenders: string[] = []
    const seen = new Set<string>()

    for (const file of tsxFiles) {
      const text = readFileSync(file, 'utf8')
      const hits = [...text.matchAll(LITERAL)]
      if (hits.length === 0) continue

      for (const hit of hits) {
        const token = hit[0]
        const key = `${rel(file)}::${token}`
        seen.add(key)
        const allowed = ALLOWED_LITERAL_SIZES.some(
          (entry) => entry.file === rel(file) && entry.value === token,
        )
        if (!allowed) offenders.push(`${rel(file)} → ${token}`)
      }
    }

    expect(
      offenders,
      '以下字面量字号不在允许清单里：\n' +
        offenders.join('\n') +
        '\n请改用 --text-* 角色，或在 ALLOWED_LITERAL_SIZES 里登记理由。',
    ).toEqual([])
  })

  it('允许清单没有失效项（实现改了就要同步删条目）', () => {
    const stale: string[] = []
    for (const entry of ALLOWED_LITERAL_SIZES) {
      const file = `${ROOT}/${entry.file.replace(/\//g, '\\')}`
      let text: string
      try {
        text = readFileSync(file, 'utf8')
      } catch {
        text = readFileSync(`${ROOT}/${entry.file}`, 'utf8')
      }
      if (!text.includes(entry.value)) stale.push(`${entry.file} → ${entry.value}`)
    }
    expect(stale, '以下白名单条目在源码里已不存在：\n' + stale.join('\n')).toEqual([])
  })

  it('角色的伴生行高/字距在 tokens.css 里齐全', () => {
    // `text-*` 工具类由 @theme 生成；缺了伴生行高就会退回继承值，层级立刻塌掉
    const tokens = readFileSync(TOKENS, 'utf8')
    const roles = [
      'display',
      'pageheading',
      'headline',
      'title',
      'rowtitle',
      'h2',
      'h3',
      'body',
      'lead',
      'small',
      'caption',
      'meta',
      'code',
    ]
    const missing = roles.filter((role) => !tokens.includes(`--text-${role}--line-height:`))
    expect(missing, `缺少行高的角色：${missing.join(', ')}`).toEqual([])
  })
})

/* ── 2. 导语必须吃 Token 行高 ───────────────────────────────────── */

/**
 * `text-lead` 用在「大号标签 / 单行输入」时写自己的紧行高是合理的，
 * 用在「导语段落」时必须吃 Token 的 1.8 —— 否则同一个语义在三个页面
 * 有三种行高（历史上首页 1.7、文章 1.8/1.75、Token 1.8 没人用）。
 */
const LEAD_LEADING_EXCEPTIONS: Array<{ file: string; reason: string }> = [
  {
    file: 'src/app/explore/page.tsx',
    reason: '年份星标：text-lead 用在这里是大号标签而不是导语，单行需要 1.4',
  },
  {
    file: 'src/app/tags/page.tsx',
    reason: '标签计数：同上，单行标签用 1.4',
  },
]

describe('Typography：导语行高统一', () => {
  it('导语段落不带 leading-[...] 覆盖', () => {
    const offenders: string[] = []
    // 匹配「同一 className 里同时出现 text-lead 与 leading-[数值]」
    const pattern = /className="([^"]*\btext-lead\b[^"]*)"/g

    for (const file of tsxFiles) {
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(pattern)) {
        const classes = match[1] ?? ''
        if (!/leading-\[[^\]]+\]/.test(classes)) continue
        if (LEAD_LEADING_EXCEPTIONS.some((entry) => entry.file === rel(file))) continue
        offenders.push(`${rel(file)} → ${classes.trim().slice(0, 80)}`)
      }
    }

    expect(
      offenders,
      '以下导语自己覆盖了行高，应交给 --text-lead--line-height：\n' + offenders.join('\n'),
    ).toEqual([])
  })

  it('导语统一用衬线（书籍 / 编辑式方向）', () => {
    // 文章的导语一直是衬线；首页曾是无衬线，同一角色两种字体族。
    const offenders: string[] = []
    const pattern = /className="([^"]*\btext-lead\b[^"]*)"/g

    for (const file of tsxFiles) {
      // 标签类用法不要求衬线（它们已经显式写了 font-serif，这里只查导语页）
      if (LEAD_LEADING_EXCEPTIONS.some((entry) => entry.file === rel(file))) continue
      const text = readFileSync(file, 'utf8')
      for (const match of text.matchAll(pattern)) {
        const classes = match[1] ?? ''
        if (!/\bfont-serif\b/.test(classes)) {
          offenders.push(`${rel(file)} → ${classes.trim().slice(0, 80)}`)
        }
      }
    }

    expect(offenders, '以下导语缺少 font-serif：\n' + offenders.join('\n')).toEqual([])
  })
})

/* ── 3. 衬线 + 600 只在标题族 ───────────────────────────────────── */

describe('Typography：字重纪律', () => {
  it('显式衬线 + 600 的组合只出现在标题族选择器', () => {
    const offenders: string[] = []
    // 只认「同一条规则里同时写了衬线栈与 600」这种静态可判定的情形。
    // 靠继承拿到衬线的选择器（例如 .comment__author）不在覆盖范围内 ——
    // 静态扫描无法可靠还原继承链，这是已知盲区，不用它假装全覆盖。
    for (const file of cssFiles) {
      if (file.endsWith('tokens.css')) continue
      const rules = cssRules(readFileSync(file, 'utf8'))
      for (const rule of rules) {
        const hasSerif = /font-family:\s*var\(--font-serif\)/.test(rule.body)
        const has600 = /font-weight:\s*600/.test(rule.body)
        if (!hasSerif || !has600) continue
        // 标题族：选择器里出现 h1–h6 或 title/heading 语义
        const isHeading =
          /(^|[\s,(])(h[1-6])\b/.test(rule.selector) || /(title|heading)/i.test(rule.selector)
        if (!isHeading) offenders.push(`${rel(file)}:${rule.line} → ${rule.selector}`)
      }
    }

    expect(offenders, '衬线 + 600 出现在非标题选择器：\n' + offenders.join('\n')).toEqual([])
  })

  it('正文字重是 400，不显式声明', () => {
    // 400 是继承默认值；写出来只会在换字体时多一个需要同步的点
    const offenders: string[] = []
    for (const file of cssFiles) {
      const rules = cssRules(readFileSync(file, 'utf8'))
      for (const rule of rules) {
        if (/font-weight:\s*400/.test(rule.body)) {
          offenders.push(`${rel(file)}:${rule.line} → ${rule.selector}`)
        }
      }
    }
    expect(offenders, '不必要的 font-weight: 400：\n' + offenders.join('\n')).toEqual([])
  })
})
