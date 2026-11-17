import { readFileSync } from 'node:fs'
import { ROOT, SRC, TOKENS, relativeToRoot, stripCssComments, walk } from './design-tokens'

/**
 * 小字号（< 12px）守卫的判定内核
 *
 * ## 为什么不能只扫 `font-size` 后面那个数字
 *
 * 字号有五种来源，只有前两种能靠文本匹配抓到：
 *
 *   1. 字面量 px          `font-size: 10px`
 *   2. 字面量 rem         `font-size: 0.7rem`            → ×16
 *   3. 语义 Token         `font-size: var(--text-caption)`
 *   4. 相对父级 em        `font-size: 0.9em`              → 取决于**祖先最终字号**
 *   5. 继承（无声明）      不出现 font-size，跟随父级
 *
 * 第 4 类是本模块的核心：`.prose code { 0.875em }` 这一条规则，
 * 在正文段落里算 14.875px（合格），在脚注区里算 11.375px（低于 12）。
 * 同一段 CSS 文本，两个结论 —— 所以 em 必须结合祖先上下文求值。
 *
 * 而祖先关系**不可能**从选择器字符串可靠推出：`.footnotes` 是
 * `.prose .footnote-backref__hint` 的 DOM 祖先，但它既不在后者选择器里，
 * 也不在同一条规则链上。所以每条 em 规则都必须在 `EM_ANCESTORS` 里
 * **显式登记**它求值时依据的祖先 —— 登记错会被「实际渲染值」比对抓出来，
 * 漏登记直接判失败（宁可要求补充说明，也不默认放行）。
 *
 * ## 与运行时扫描的分工（重要，别把两者混为一谈）
 *
 * `scripts/visual/typography.mjs` 那类 DOM 扫描**抓不到**：
 *   - 伪元素（`::before` / `::marker` 不是元素）
 *   - 条件渲染的节点（未渲染 = 扫不到）
 * 实测教训：`.prose .md-mention::before`(11.9px)、`.home-more__count`(11.4px)
 * 就是这样从上一轮审计里漏掉的。所以静态解析（本文件）是主判据，
 * 浏览器实测只是交叉验证，不能反过来当成「没扫到就是没有」。
 */

/** 根字号：`1rem = 16px`（项目未改写 html 的 font-size） */
export const ROOT_FONT_PX = 16

/** 低于这个值即视为「小字号」，需要白名单 */
export const MIN_INFORMATIONAL_PX = 12

/* ── CSS 规则解析 ───────────────────────────────────────────────── */

export interface CssRule {
  selector: string
  body: string
  /** 相对仓库根 */
  file: string
  line: number
  conditional: boolean
  atContext: string
}

/**
 * 解析 CSS 文件里的全部样式规则。
 *
 * 用括号深度遍历而不是正则：`@media` 里还有规则，正则会把 at-rule 前缀
 * 当选择器。注释先抹成等长空白，保证报出来的行号不漂。
 */
export function parseCssRules(file: string): CssRule[] {
  const text = stripCssComments(readFileSync(file, 'utf8'))
  const rel = relativeToRoot(file)
  const rules: CssRule[] = []
  const atStack: string[] = []

  let buffer = ''
  let segmentStart = 0

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]

    if (ch === '{') {
      const prelude = buffer.trim()
      if (prelude.startsWith('@')) {
        atStack.push(prelude.replace(/\s+/g, ' '))
        buffer = ''
        segmentStart = i + 1
        continue
      }

      // 普通规则块：扫到配对的 }
      let inner = ''
      let depth = 1
      let j = i + 1
      for (; j < text.length; j += 1) {
        if (text[j] === '{') depth += 1
        else if (text[j] === '}') {
          depth -= 1
          if (depth === 0) break
        }
        inner += text[j]
      }

      rules.push({
        selector: prelude.replace(/\s+/g, ' ').trim(),
        body: inner,
        file: rel,
        line: text.slice(0, segmentStart).split('\n').length,
        conditional: atStack.length > 0,
        atContext: atStack.join(' / '),
      })

      i = j
      buffer = ''
      segmentStart = j + 1
      continue
    }

    if (ch === '}') {
      if (atStack.length > 0) atStack.pop()
      buffer = ''
      segmentStart = i + 1
      continue
    }

    buffer += ch
  }

  return rules
}

/** 规则里的 `font-size` 原始值；没有则 null */
export function fontSizeOf(rule: CssRule): string | null {
  const m = /(?:^|;)\s*font-size\s*:\s*([^;]+)/.exec(rule.body)
  return m ? (m[1] ?? '').trim() : null
}

/* ── 长度与 Token 求值 ──────────────────────────────────────────── */

/** `0.8125rem` → 13；`13px` → 13；其它（clamp/calc/em）→ null */
export function parseLengthToPx(value: string): number | null {
  const v = value.trim()
  const rem = /^(-?\d*\.?\d+)rem$/.exec(v)
  if (rem) return Number(rem[1]) * ROOT_FONT_PX
  const px = /^(-?\d*\.?\d+)px$/.exec(v)
  if (px) return Number(px[1])
  return null
}

/**
 * `--text-caption` → 13。
 *
 * clamp() 取**第一段**（下限）：窄屏就是下限，用最保守的值判断是否可能
 * 跌破 12px，避免在桌面测着合格、到手机才发现太小。
 */
export function tokenFontSizePx(token: string): number | null {
  const text = readFileSync(TOKENS, 'utf8')
  const name = token.startsWith('--') ? token : `--${token}`
  // 允许值里有函数（clamp(...)），所以要一直取到行末分号
  const m = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(text)
  if (!m) return null
  const value = (m[1] ?? '').trim()
  if (value.startsWith('clamp(')) {
    const inner = value.slice(value.indexOf('(') + 1, value.lastIndexOf(')'))
    return parseLengthToPx(inner.split(',')[0]?.trim() ?? '')
  }
  return parseLengthToPx(value)
}

export type SizeKind = 'px' | 'rem' | 'em' | 'token' | 'inherit' | 'unknown'

export interface SizeSource {
  kind: SizeKind
  raw: string
  factor?: number
  token?: string
}

export function classifyFontSize(raw: string): SizeSource {
  const v = raw.trim()
  // `inherit` / `unset` 不改变字号，等价于「跟随父级」——它不是可疑值
  if (/^(inherit|unset|revert)$/i.test(v)) return { kind: 'inherit', raw: v }
  const token = /var\(\s*(--[a-z0-9-]+)\s*\)/i.exec(v)
  if (token) return { kind: 'token', raw: v, token: token[1] }
  const em = /^(-?\d*\.?\d+)em$/.exec(v)
  if (em) return { kind: 'em', raw: v, factor: Number(em[1]) }
  if (/^-?\d*\.?\d+rem$/.test(v)) return { kind: 'rem', raw: v }
  if (/^-?\d*\.?\d+px$/.test(v)) return { kind: 'px', raw: v }
  return { kind: 'unknown', raw: v }
}

/* ── 祖先字号登记 ───────────────────────────────────────────────── */

/**
 * em 求值时可依据的祖先，以及它自己的字号来自哪条规则。
 *
 * 只登记**能解析出确定 px** 的祖先；`--text-display` 这类 clamp 档位不在此列，
 * 因为它们的实际值随视口变，拿来当 em 基准会让结论也随视口漂移。
 */
export const ANCESTOR_FONT_SOURCES: Record<string, { selector: string; reason: string }> = {
  '.prose': {
    selector: '.prose',
    reason: '正文容器 --text-body = 17px',
  },
  '.prose blockquote': {
    selector: '.prose blockquote',
    reason: '引用块自身 1.04em × 17px = 17.68px；块内段落以它为基准',
  },
  '.prose h4': {
    selector: '.prose h4',
    reason: '四级标题走 --text-body = 17px；它是标题里最小的一档，也是 heading-anchor 的最小上下文',
  },
  '.footnotes': {
    selector: '.prose .footnotes',
    reason: '脚注容器 --text-caption = 13px，脚注内相对字号以它为基准',
  },
  '.home-more__entry': {
    selector: '.home-more__entry',
    reason: '首页「更多」入口 --text-meta = 12px，其内部附注以它为基准',
  },
}

/** 规则 → 它 em 求值时依据的祖先（保守取「能得到最小字号」的那个） */
export const EM_ANCESTORS: Record<string, keyof typeof ANCESTOR_FONT_SOURCES> = {
  '.home-more__count': '.home-more__entry',
  '.prose .footnote-ref': '.prose',
  '.prose .footnote-backref__hint': '.footnotes',
  '.prose .md-mention::before': '.prose',
  '.prose kbd': '.prose',
  '.prose ol > li::marker': '.prose',
  '.prose blockquote': '.prose',
  '.prose blockquote p': '.prose blockquote',
  '.prose code': '.footnotes',
  '.prose .katex': '.prose',
  '.prose .heading-anchor': '.prose h4',
  '.prose--compact :is(pre, table, blockquote)': '.prose',
  '.prose .insight-ref': '.prose',
}

/**
 * `footnote-inner` 这一类豁免的合法性前提：**祖先必须是脚注容器**。
 *
 * 这条不是形式主义。`footnote-inner` 的存在理由只有一句：「脚注区整体
 * 已经是 13px 次级说明，内部再小一档属层级延续」。若某条规则的真实祖先
 * 不是 `.footnotes`，这句话对它就不成立 —— 那它要么改字号，要么换分类
 * （例如带 `aria-hidden` 的计数属于 `decorative`）。
 */
export const FOOTNOTE_CONTAINER_SELECTOR = '.footnotes'

/* ── 求值 ───────────────────────────────────────────────────────── */

export interface ResolvedSize {
  px: number | null
  kind: SizeKind
  /** 求值依据（祖先/Token 名），用于报错 */
  basis: string
}

export function resolveRulePx(rule: CssRule, rules: CssRule[]): ResolvedSize {
  const raw = fontSizeOf(rule)
  if (!raw) return { px: null, kind: 'unknown', basis: '无 font-size' }
  const source = classifyFontSize(raw)

  if (source.kind === 'px' || source.kind === 'rem') {
    return { px: parseLengthToPx(raw), kind: source.kind, basis: 'literal' }
  }

  if (source.kind === 'token' && source.token) {
    return { px: tokenFontSizePx(source.token), kind: 'token', basis: source.token }
  }

  if (source.kind === 'inherit') {
    return { px: null, kind: 'inherit', basis: 'inherit（跟随父级，不单独构成小字号来源）' }
  }

  if (source.kind === 'em' && source.factor !== undefined) {
    const ancestorKey = EM_ANCESTORS[rule.selector]
    if (!ancestorKey) {
      return { px: null, kind: 'em', basis: `未登记祖先（${rule.selector}）` }
    }
    const entry = ANCESTOR_FONT_SOURCES[ancestorKey]
    const candidates = rules.filter((r) => r.selector === entry.selector)
    // 同文件优先：同名选择器可能被不同样式表重定义
    const ordered = [...candidates.filter((r) => r.file === rule.file), ...candidates]
    for (const candidate of ordered) {
      const ancestor = resolveRulePx(candidate, rules)
      if (ancestor.px !== null) {
        return {
          px: Number((source.factor * ancestor.px).toFixed(3)),
          kind: 'em',
          basis: `${source.factor}em × ${ancestorKey}(${ancestor.px}px)`,
        }
      }
    }
    return { px: null, kind: 'em', basis: `祖先 ${ancestorKey} 字号无法解析` }
  }

  return { px: null, kind: source.kind, basis: `不可解析：${raw}` }
}

/* ── 白名单 ─────────────────────────────────────────────────────── */

export type AllowanceKind = 'structural' | 'decorative' | 'footnote-inner'

export interface Sub12Allowance {
  kind: AllowanceKind
  selector: string
  file?: string
  /** 装饰类必须给出可机检的证明 */
  decorativeProof?: 'svg' | 'opacity-0' | 'aria-hidden'
  /** 为什么可以小于 12px —— 不许留空 */
  reason: string
}

/**
 * 正式豁免清单（每一条都经过人工判定，不是「为了变绿」）。
 *
 * 三条纪律：
 *   1. 必须指向**真实存在**的规则，失效即失败；
 *   2. 装饰类必须带 `decorativeProof`，且该条件要在规则里能被证实；
 *   3. 未列入清单的 <12px 规则一律失败 —— 新增必须先回答「为什么」。
 */
export const SUB_12PX_ALLOWANCES: readonly Sub12Allowance[] = [
  /*
   * `.prose .md-mention::before`（平台徽标 GH/TW/TG）曾经也在候选里：
   * 0.7em × 17px = 11.9px。它挂在 `::before` 上，而生成内容加不了 ARIA，
   * 所以「装饰类可证」三个条件（svg / opacity:0 / aria-hidden）一个都不成立 ——
   * 它不是装饰，是承载信息的小字。正确处理是把字号提到 12px 以上
   * （现为 0.71em = 12.07px），而不是塞进豁免清单。
   */
  /*
   * 另外这里**只登记本项目源码里的规则**。
   * KaTeX 的 `.vlist-s`（零宽占位，1px）来自 node_modules 的第三方样式表，
   * 不归我们维护，也不该占一个豁免位 —— 把它列进来等于把别人的问题
   * 伪装成「已审核的本项目例外」。
   */
  /*
   * `.home-more__notify-state` 已从清单删除（2026-11-17）：它只存在于
   * `globals.css`，TSX 里**零消费者** —— 订阅面板迁成 `SubscribeModal` 后，
   * 旧 popover 的样式被遗留在样式表里。给一条不会渲染的规则发豁免是虚假覆盖，
   * 正确处理是删掉该死规则（同批已删）。这类「CSS 还在、DOM 没了」的假豁免
   * 由 `findOrphanAllowances` 守住。
   */
  {
    kind: 'decorative',
    selector: '.friend-postmark text',
    file: 'src/features/friends/friend-postcard.css',
    decorativeProof: 'svg',
    reason: '邮戳弧形字，字号是 SVG 用户单位、随邮戳尺寸等比缩放，属图案而非信息',
  },
  {
    kind: 'decorative',
    selector: '.prose .heading-anchor',
    file: 'src/design-system/styles/prose.css',
    decorativeProof: 'opacity-0',
    reason: '标题锚点「#」，默认 opacity:0 只在 hover/聚焦出现，不承载标题语义',
  },
  {
    kind: 'decorative',
    selector: '.home-more__count',
    file: 'src/app/globals.css',
    decorativeProof: 'aria-hidden',
    reason:
      '点赞计数 0.95em×12px=11.4px：JSX 标了 aria-hidden，读屏不读它，属装饰性计数；' +
      '视觉上要低于入口标题一档，提到 12px 会与标题同重',
  },
  {
    kind: 'footnote-inner',
    selector: '.prose .footnote-backref__hint',
    file: 'src/design-system/styles/footnotes.css',
    reason: '脚注回跳提示「第 N 处」：脚注区整体已是 13px 次级说明，内部再小一档属层级延续',
  },
  {
    kind: 'footnote-inner',
    selector: '.prose code',
    file: 'src/design-system/styles/prose.css',
    reason: '行内代码 0.875em：正文里是 14.875px，只有落进 13px 脚注区才降到 11.375px',
  },
]

/* ── 收集 ───────────────────────────────────────────────────────── */

export interface Sub12Hit {
  rule: CssRule
  px: number | null
  basis: string
  allowanceIndex: number
  /** 无法求值时为 true —— 不能当作合格 */
  unverifiable: boolean
}

export function collectFontSizeRules(): CssRule[] {
  const files = walk(SRC).filter((f) => f.endsWith('.css'))
  return files.flatMap((f) => parseCssRules(f)).filter((r) => fontSizeOf(r) !== null)
}

/** 所有可能 <12px 的规则（含无法求值的） */
export function collectSub12(rules: CssRule[] = collectFontSizeRules()): Sub12Hit[] {
  const hits: Sub12Hit[] = []
  for (const rule of rules) {
    const resolved = resolveRulePx(rule, rules)
    const allowanceIndex = SUB_12PX_ALLOWANCES.findIndex(
      (a) => a.selector === rule.selector && (!a.file || a.file === rule.file),
    )
    // `inherit` 不构成独立的小字号来源：它的实际大小由父级决定，
    // 而父级自己的字号会各自接受检查，这里重复报只是噪声。
    if (resolved.kind === 'inherit') continue

    if (resolved.px === null) {
      // 算不出来 —— 只有「已登记的 em 规则」才可能是合法情况；
      // 其余（如 calc/clamp 直接写在组件里）一律标为不可验证
      hits.push({
        rule,
        px: null,
        basis: resolved.basis,
        allowanceIndex,
        unverifiable: true,
      })
      continue
    }
    if (resolved.px < MIN_INFORMATIONAL_PX) {
      hits.push({
        rule,
        px: resolved.px,
        basis: resolved.basis,
        allowanceIndex,
        unverifiable: false,
      })
    }
  }
  return hits
}

/* ── TSX 侧 ─────────────────────────────────────────────────────── */

export interface TsxSizeHit {
  file: string
  line: number
  token: string
  px: number
}

/** TSX/TS 里的 `text-[11px]` / `text-[0.7rem]`，返回所有 <12px 的 */
export function collectTsxSub12(): TsxSizeHit[] {
  const files = walk(SRC).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
  const hits: TsxSizeHit[] = []
  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/text-\[(\d*\.?\d+)(px|rem)\]/g)) {
      const value = Number(m[1])
      const px = m[2] === 'rem' ? value * ROOT_FONT_PX : value
      if (px < MIN_INFORMATIONAL_PX) {
        hits.push({
          file: relativeToRoot(file),
          line: text.slice(0, m.index ?? 0).split('\n').length,
          token: m[0],
          px,
        })
      }
    }
  }
  return hits
}

/* ── 白名单健康检查 ─────────────────────────────────────────────── */

export function findStaleAllowances(rules: CssRule[] = collectFontSizeRules()): Sub12Allowance[] {
  return SUB_12PX_ALLOWANCES.filter(
    (a) => !rules.some((r) => r.selector === a.selector && (!a.file || r.file === a.file)),
  )
}

/**
 * 白名单条目「在 CSS 里存在、但在 TSX 里没有生产者」—— 死豁免。
 *
 * 这是比 `findStaleAllowances` 更深一层的问题：规则确实还在样式表里，
 * 所以失效检查抓不到；但没有任何组件渲染这个类名，等于给一个不存在的
 * 元素发了豁免。实测教训：`.home-more__notify-state` 就是这种情况 ——
 * 订阅面板迁成模态弹窗后，旧 popover 的样式留在 globals.css 里没人删，
 * 而它是 11.4px，于是被当成「真实的小字号」登记进了豁免清单。
 *
 * 判定口径：该类名在 `src/**` 的 **`.ts` 与 `.tsx`** 里至少要出现一次。
 *
 * 必须包含 `.ts`：正文里的 `heading-anchor` 与脚注的 `footnote-backref__hint`
 * 不是 JSX，而是 Markdown 渲染器（`src/lib/content/markdown.ts` /
 * `footnotes.ts`）用模板字符串拼出来的 HTML —— 只扫 `.tsx` 会把它们误判成
 * 死豁免。所以「有生产者」= 有 TSX 组件 **或** 有渲染器输出。
 */
export function findOrphanAllowances(rules: CssRule[] = collectFontSizeRules()): Sub12Allowance[] {
  const sourceText = walk(SRC)
    .filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')

  return SUB_12PX_ALLOWANCES.filter((a) => {
    // 规则本身不存在的情况归 findStaleAllowances 管，这里不重复报
    if (!rules.some((r) => r.selector === a.selector && (!a.file || r.file === a.file)))
      return false
    const cls = lastClassOf(a.selector)
    if (!cls) return false
    // SVG 元素选择器（`text` / `textPath`）没有类名，用标签名找
    if (/^(text|textPath)$/.test(cls)) return !new RegExp(`<${cls}\\b`).test(sourceText)
    return !sourceText.includes(cls)
  })
}

/**
 * `footnote-inner` 豁免里「真实祖先不是脚注容器」的条目。
 *
 * 当前实现无法从选择器字符串反推 DOM 祖先（`.prose code` 的真实父级可能是在
 * 正文段落，也可能是脚注 li —— 取决于它在页面里的位置）。所以用**登记的
 * em 祖先**来判定：登记值必须是 `.footnotes`（或其选择器含 `.footnotes`），
 * 否则这条豁免就套错了理由。
 */
export function findFootnoteAllowancesOutsideContainer(): Sub12Allowance[] {
  return SUB_12PX_ALLOWANCES.filter((a) => {
    if (a.kind !== 'footnote-inner') return false
    const ancestorKey = EM_ANCESTORS[a.selector]
    if (!ancestorKey) return true
    const entry = ANCESTOR_FONT_SOURCES[ancestorKey]
    if (!entry) return true
    return !entry.selector.includes(FOOTNOTE_CONTAINER_SELECTOR)
  })
}

/**
 * 白名单是否过宽：同一选择器命中多条规则（含不同断点/不同文件）。
 *
 * 只在 >1 条时报，因为那意味着豁免实际覆盖了开发者没想过的位置。
 */
export function findOverBroadAllowances(
  rules: CssRule[] = collectFontSizeRules(),
): Array<{ allowance: Sub12Allowance; count: number; where: string[] }> {
  const out: Array<{ allowance: Sub12Allowance; count: number; where: string[] }> = []
  for (const a of SUB_12PX_ALLOWANCES) {
    const matched = rules.filter((r) => r.selector === a.selector)
    if (matched.length <= 1) continue
    out.push({
      allowance: a,
      count: matched.length,
      where: matched.map((r) => `${r.file}:${r.line}${r.conditional ? ` [${r.atContext}]` : ''}`),
    })
  }
  return out
}

/**
 * 从 TSX 收集「被 `aria-hidden` 标记的元素的类名」。
 *
 * 为什么需要这道跨文件检查：`aria-hidden` 是 **DOM 属性**，不是 CSS 属性。
 * `.home-more__count` 的样式表里永远看不到它，但它的 JSX 是
 * `<span className="home-more__count" aria-hidden="true">`。
 * 只看 CSS 会把这类元素误判成「承载信息的小字」，进而逼人把它提到 12px ——
 * 而它对读屏本来就是隐藏的，属于装饰。判断依据必须在 TSX 侧取。
 */
export function tsxAriaHiddenClasses(): Set<string> {
  const out = new Set<string>()
  const files = walk(SRC).filter((f) => f.endsWith('.tsx'))

  // 完整 JSX 开标签：字符串里的 `>` 不算标签结束
  const TAG = /<[A-Za-z][A-Za-z0-9.]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g

  for (const file of files) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(TAG)) {
      const tag = m[0]
      if (!/aria-hidden\s*=\s*["'{]/.test(tag)) continue
      // 显式 false 不算隐藏
      if (/aria-hidden\s*=\s*["']false["']/.test(tag)) continue

      // className="a b"
      for (const c of tag.matchAll(/className\s*=\s*["'`]([^"'`]*)["'`]/g)) {
        for (const cls of (c[1] ?? '').split(/\s+/)) if (cls) out.add(cls)
      }
      // className={cn('a', cond && 'b')} / className={`a ${x}`}
      for (const c of tag.matchAll(/className\s*=\s*\{([^}]*)\}/g)) {
        for (const q of (c[1] ?? '').matchAll(/['"`]([^'"`]*)['"`]/g)) {
          for (const cls of (q[1] ?? '').split(/\s+/)) {
            if (/^[a-z][a-z0-9_-]*$/i.test(cls)) out.add(cls)
          }
        }
      }
    }
  }
  return out
}

/** 选择器里的「最后一个类名」，用来和白名单/TSX 对齐 */
export function lastClassOf(selector: string): string | null {
  const all = [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1])
  return all.length > 0 ? (all[all.length - 1] ?? null) : null
}

/**
 * 装饰豁免的全部可证条件（可能同时成立多条）。
 *
 * 为什么返回集合而不是单值：`.friend-postmark` 的 `<svg>` 既在 SVG 内部
 * （结构证据）又带 `aria-hidden="true"`（语义证据），两条都成立。
 * 若只返回第一条，白名单声明另一条时就会误报「证不出来」——
 * 那是顺序问题，不是事实问题。
 */
export function decorativeProofs(
  rule: CssRule,
  tsxClasses: Set<string> = new Set(),
): Array<'svg' | 'opacity-0' | 'aria-hidden'> {
  const proofs: Array<'svg' | 'opacity-0' | 'aria-hidden'> = []

  if (/opacity\s*:\s*0(?:[;}\s]|$)/.test(rule.body)) proofs.push('opacity-0')

  if (/aria-hidden/.test(rule.selector) || /aria-hidden/.test(rule.body)) {
    proofs.push('aria-hidden')
  } else {
    const cls = lastClassOf(rule.selector)
    if (cls && tsxClasses.has(cls)) proofs.push('aria-hidden')
  }

  // 元素名必须是 text / textPath（前为空格或 >），且该文件真的样式化了 svg ——
  // 否则 `.prose text` 这种写法会被误判成「SVG 文字」而白送一个豁免
  const usesSvgText = /(?:^|[\s,>])(?:text|textPath)(?=[\s,{:]|$)/.test(rule.selector)
  if (usesSvgText && fileStylesSvg(rule.file)) proofs.push('svg')

  return proofs
}

/** 最强的单条证明；null 表示证明不成立。顺序不代表强度，只是取值方便 */
export function decorativeProofOf(
  rule: CssRule,
  tsxClasses: Set<string> = new Set(),
): 'svg' | 'opacity-0' | 'aria-hidden' | null {
  return decorativeProofs(rule, tsxClasses)[0] ?? null
}

/** 该 CSS 文件里是否存在 `svg` 元素选择器（证明它真的在样式化 SVG） */
export function fileStylesSvg(fileRel: string): boolean {
  const cacheKey = fileRel
  const cached = SVG_FILE_CACHE.get(cacheKey)
  if (cached !== undefined) return cached

  let text: string
  try {
    text = stripCssComments(readFileSync(`${ROOT}/${fileRel}`, 'utf8'))
  } catch {
    SVG_FILE_CACHE.set(cacheKey, false)
    return false
  }
  const has = /(?:^|[\s,>+~])svg(?:[\s,{>+~:]|$)/m.test(text)
  SVG_FILE_CACHE.set(cacheKey, has)
  return has
}

const SVG_FILE_CACHE = new Map<string, boolean>()

export const REPO_ROOT = ROOT
export const SRC_ROOT = SRC
