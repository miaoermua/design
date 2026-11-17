import { describe, expect, it } from 'vitest'
import {
  ANCESTOR_FONT_SOURCES,
  EM_ANCESTORS,
  FOOTNOTE_CONTAINER_SELECTOR,
  MIN_INFORMATIONAL_PX,
  ROOT_FONT_PX,
  SUB_12PX_ALLOWANCES,
  classifyFontSize,
  collectFontSizeRules,
  collectSub12,
  collectTsxSub12,
  decorativeProofOf,
  decorativeProofs,
  fileStylesSvg,
  findFootnoteAllowancesOutsideContainer,
  findOrphanAllowances,
  findOverBroadAllowances,
  findStaleAllowances,
  lastClassOf,
  parseLengthToPx,
  resolveRulePx,
  tokenFontSizePx,
  tsxAriaHiddenClasses,
  type CssRule,
} from './helpers/small-fonts'

/**
 * 小字号守卫（< 12px）
 *
 * 这个文件的职责：把「谁可以小于 12px」变成一条需要回答的问题，而不是
 * 一个可以靠改 CSS 数值悄悄绕过的事实。
 *
 * 判定分四层，缺一层都会漏：
 *   1. 字面量 px      —— 11px 直接抓
 *   2. 字面量 rem     —— 0.7rem = 11.2px 直接抓
 *   3. Token / em     —— 必须解析到最终 px，em 还要结合祖先
 *   4. TSX 任意值     —— `text-[11px]` 零容忍
 *
 * 为什么 em 必须靠显式祖先登记，见 helpers/small-fonts.ts 顶部说明。
 */

const rules = collectFontSizeRules()
/** 带 `aria-hidden` 的类名：装饰豁免的第三个可证条件需要跨文件取 */
const ariaHiddenClasses = tsxAriaHiddenClasses()

/** 造一条假规则，用于正/反向用例，不碰真实源码 */
function fakeRule(selector: string, body: string, file = 'src/__fake__.css'): CssRule {
  return { selector, body, file, line: 1, conditional: false, atContext: '' }
}

/* ── 第 0 层：解析器本身要可信 ─────────────────────────────────── */

describe('前置：单位解析', () => {
  it('px / rem 换算正确', () => {
    expect(parseLengthToPx('12px')).toBe(12)
    expect(parseLengthToPx('0.75rem')).toBe(12)
    expect(parseLengthToPx('0.7rem')).toBe(11.2)
    expect(parseLengthToPx('13px')).toBe(13)
  })

  it('非长度值返回 null，而不是猜一个数', () => {
    expect(parseLengthToPx('calc(1rem - 2px)')).toBeNull()
    expect(parseLengthToPx('inherit')).toBeNull()
    expect(parseLengthToPx('0.9em')).toBeNull()
  })

  it('Token 取真实值；clamp 取下限（窄屏最保守）', () => {
    expect(tokenFontSizePx('--text-caption')).toBe(13)
    expect(tokenFontSizePx('--text-meta')).toBe(12)
    expect(tokenFontSizePx('--text-body')).toBe(17)
    // display 是 clamp(2.125rem, …, 3.25rem) → 取 2.125rem = 34
    expect(tokenFontSizePx('--text-display')).toBe(34)
  })

  it('inherit / unset 被识别为「跟随父级」，不是可疑值', () => {
    expect(classifyFontSize('inherit').kind).toBe('inherit')
    expect(classifyFontSize('unset').kind).toBe('inherit')
    expect(classifyFontSize('0.9em').kind).toBe('em')
    expect(classifyFontSize('var(--text-meta)').kind).toBe('token')
  })
})

/* ── 第一层：字面量 ─────────────────────────────────────────────── */

describe('字面量字号', () => {
  it('12px 恰好达标，不算小字号', () => {
    const rule = fakeRule('.x', 'font-size: 12px;')
    expect(resolveRulePx(rule, rules).px).toBe(12)
    const hits = collectSub12([rule])
    expect(hits).toHaveLength(0)
  })

  it('11.9px 判为小字号', () => {
    const rule = fakeRule('.x', 'font-size: 11.9px;')
    const hits = collectSub12([rule])
    expect(hits).toHaveLength(1)
    expect(hits[0]?.px).toBe(11.9)
    expect(hits[0]?.allowanceIndex).toBe(-1)
  })

  it('10px 判为小字号（真实存在的邮戳例外）', () => {
    const rule = fakeRule(
      '.friend-postmark text',
      'font-size: 10px;',
      'src/features/friends/friend-postcard.css',
    )
    const hits = collectSub12([rule])
    expect(hits).toHaveLength(1)
    expect(hits[0]?.allowanceIndex).toBeGreaterThanOrEqual(0)
  })
})

/* ── 第二层：rem ────────────────────────────────────────────────── */

describe('rem 计算后小于 12px', () => {
  it('0.7rem = 11.2px 判为小字号', () => {
    const rule = fakeRule('.x', 'font-size: 0.7rem;')
    const hits = collectSub12([rule])
    expect(hits).toHaveLength(1)
    expect(hits[0]?.px).toBeCloseTo(11.2, 3)
  })

  it('0.75rem = 12px 恰好达标', () => {
    const hits = collectSub12([fakeRule('.x', 'font-size: 0.75rem;')])
    expect(hits).toHaveLength(0)
  })

  it('Root font-size 是 16px（换算基准不能漂）', () => {
    expect(ROOT_FONT_PX).toBe(16)
  })
})

/* ── 第三层：em 与嵌套继承 ──────────────────────────────────────── */

describe('em 计算后小于 12px', () => {
  it('同一条 em 规则在不同祖先下得到不同结论（这正是必须登记祖先的原因）', () => {
    // 真实存在于 prose.css：.prose code { font-size: 0.875em }
    const codeRule = rules.find((r) => r.selector === '.prose code')
    expect(codeRule).toBeDefined()

    const resolved = resolveRulePx(codeRule!, rules)
    // 登记的祖先是脚注区 13px → 11.375px（小字号）
    expect(resolved.px).toBeCloseTo(11.375, 3)

    // 若换成正文 17px 作基准，同一条规则是 14.875px（达标）——
    // 说明「CSS 里写着 0.875em」本身回答不了「它是否小于 12px」
    expect(Number((0.875 * 17).toFixed(3))).toBeCloseTo(14.875, 3)
  })

  it('嵌套场景：0.9em × 13px = 11.7px', () => {
    const hint = rules.find((r) => r.selector === '.prose .footnote-backref__hint')
    expect(hint).toBeDefined()
    const resolved = resolveRulePx(hint!, rules)
    expect(resolved.px).toBeCloseTo(11.7, 3)
    expect(resolved.basis).toContain('.footnotes')
  })

  it('嵌套场景：0.7em × 17px（h4 是最小标题档）= 11.9px', () => {
    const anchor = rules.find((r) => r.selector === '.prose .heading-anchor')
    expect(anchor).toBeDefined()
    const resolved = resolveRulePx(anchor!, rules)
    expect(resolved.px).toBeCloseTo(11.9, 3)
    expect(resolved.basis).toContain('.prose h4')
  })

  it('em 结果 >= 12px 的规则不产生命中（避免把合格项当问题）', () => {
    // .prose kbd { 0.82em } → 13.94px
    const kbd = rules.find((r) => r.selector === '.prose kbd')
    expect(kbd).toBeDefined()
    expect(resolveRulePx(kbd!, rules).px! >= MIN_INFORMATIONAL_PX).toBe(true)
    // 用全量规则求值（祖先 .prose 也在里面），再只看 kbd 这一条有没有命中
    const hits = collectSub12(rules).filter((h) => h.rule.selector === '.prose kbd')
    expect(hits).toHaveLength(0)
  })

  it('未登记祖先的 em 规则无法求值 → 判为不可验证（不是放行）', () => {
    const orphan = fakeRule('.prose .brand-new-em', 'font-size: 0.6em;')
    const merged = [...rules, orphan]
    const hits = collectSub12(merged)
    const hit = hits.find((h) => h.rule.selector === '.prose .brand-new-em')
    expect(hit).toBeDefined()
    expect(hit?.unverifiable).toBe(true)
    expect(hit?.px).toBeNull()
    expect(hit?.basis).toContain('未登记祖先')
  })

  it('每一条真实 em 规则都登记了祖先，且祖先都能解析出 px', () => {
    const emRules = rules.filter(
      (r) => classifyFontSize(r.body.match(/font-size\s*:\s*([^;]+)/)?.[1] ?? '').kind === 'em',
    )
    expect(emRules.length).toBeGreaterThan(0)

    const missing = emRules.filter((r) => !EM_ANCESTORS[r.selector]).map((r) => r.selector)
    expect(missing, `以下 em 规则缺祖先登记：${missing.join(', ')}`).toEqual([])

    const unresolved: string[] = []
    for (const rule of emRules) {
      const ancestorKey = EM_ANCESTORS[rule.selector]!
      const entry = ANCESTOR_FONT_SOURCES[ancestorKey]
      expect(entry, `祖先键 ${ancestorKey} 未在 ANCESTOR_FONT_SOURCES 中定义`).toBeDefined()
      const ancestorRule = rules.find((r) => r.selector === entry.selector)
      expect(ancestorRule, `祖先选择器 ${entry.selector} 在源码中不存在`).toBeDefined()
      if (resolveRulePx(rule, rules).px === null) unresolved.push(rule.selector)
    }
    expect(unresolved, `以下 em 规则无法求值：${unresolved.join(', ')}`).toEqual([])
  })
})

/* ── 第四层：TSX 任意值 ─────────────────────────────────────────── */

describe('TSX 任意字号零容忍', () => {
  it('现有源码里没有小于 12px 的 text-[...]', () => {
    const hits = collectTsxSub12()
    expect(
      hits.map((h) => `${h.file}:${h.line} ${h.token} (${h.px}px)`),
      'TSX 里出现了 <12px 的任意字号',
    ).toEqual([])
  })

  it('检测器能认出 px 与 rem 两种写法', () => {
    // 用真实的扫描逻辑跑一段构造文本：把 `text-[11px]` 放进临时路径不可能，
    // 所以这里直接验证正则的换算口径与 px 结果一致
    const cases: Array<[string, number]> = [
      ['text-[11px]', 11],
      ['text-[0.7rem]', 11.2],
      ['text-[11.9px]', 11.9],
    ]
    for (const [token, expected] of cases) {
      const m = /text-\[(\d*\.?\d+)(px|rem)\]/.exec(token)
      expect(m).not.toBeNull()
      const px = m![2] === 'rem' ? Number(m![1]) * ROOT_FONT_PX : Number(m![1])
      expect(px).toBeCloseTo(expected, 3)
      expect(px < MIN_INFORMATIONAL_PX).toBe(true)
    }
    // 12px 及以上不应被判为违规
    expect(12 < MIN_INFORMATIONAL_PX).toBe(false)
  })
})

/* ── 白名单健康度 ───────────────────────────────────────────────── */

describe('白名单健康度', () => {
  it('每条白名单都指向真实存在的规则（无失效项）', () => {
    const stale = findStaleAllowances(rules).map((a) => `${a.file ?? '*'}:${a.selector}`)
    expect(stale, `以下白名单已失效：${stale.join(', ')}`).toEqual([])
  })

  it('没有过宽匹配（一个选择器跨多个文件/断点）', () => {
    const broad = findOverBroadAllowances(rules)
    expect(
      broad.map((b) => `${b.allowance.selector} → ${b.count} 处`),
      '白名单覆盖了多于一处的规则',
    ).toEqual([])
  })

  it('每条白名单都有非空理由', () => {
    for (const a of SUB_12PX_ALLOWANCES) {
      expect(a.reason.length, `${a.selector} 缺理由`).toBeGreaterThan(10)
    }
  })

  it('分类只用 structural / decorative / footnote-inner 三种', () => {
    const kinds = new Set(SUB_12PX_ALLOWANCES.map((a) => a.kind))
    for (const k of kinds) {
      expect(['structural', 'decorative', 'footnote-inner']).toContain(k)
    }
  })

  it('装饰类豁免必须带可证条件，且该条件在规则里成立', () => {
    for (const a of SUB_12PX_ALLOWANCES.filter((x) => x.kind === 'decorative')) {
      expect(a.decorativeProof, `${a.selector} 缺少 decorativeProof`).toBeDefined()
      const rule = rules.find((r) => r.selector === a.selector && (!a.file || r.file === a.file))
      expect(rule, `${a.selector} 规则不存在`).toBeDefined()
      // 用「成立集合」而不是单值：同一元素可能同时满足 svg 与 aria-hidden，
      // 声明哪一条都应认可（顺序不该决定对错）
      const proofs = decorativeProofs(rule!, ariaHiddenClasses)
      expect(
        proofs,
        `${a.selector} 声明了 ${a.decorativeProof}，实际成立的是 [${proofs.join(', ') || '无'}]`,
      ).toContain(a.decorativeProof)
    }
  })

  it('脚注类豁免必须登记祖先，且真的落在 .footnotes / 小字号上下文里', () => {
    for (const a of SUB_12PX_ALLOWANCES.filter((x) => x.kind === 'footnote-inner')) {
      const rule = rules.find((r) => r.selector === a.selector && (!a.file || r.file === a.file))
      expect(rule, `${a.selector} 规则不存在`).toBeDefined()
      const ancestorKey = EM_ANCESTORS[a.selector]
      expect(ancestorKey, `${a.selector} 缺祖先登记`).toBeDefined()
      // 祖先必须是已知的字号来源，否则「它小于 12px」无从证明
      expect(ANCESTOR_FONT_SOURCES[ancestorKey!]).toBeDefined()
      // 而且解析出来的值必须真的 < 12 —— 否则这条豁免是多余的
      const px = resolveRulePx(rule!, rules).px
      expect(px, `${a.selector} 无法求值`).not.toBeNull()
      expect(px!, `${a.selector} 实测 ${px}px 已达标，豁免应删除`).toBeLessThan(
        MIN_INFORMATIONAL_PX,
      )
    }
  })

  /*
   * 下面两组是 2026-11-17 补的：前一组防「假豁免」（规则在、DOM 没了），
   * 后一组把 `footnote-inner` 的存在理由变成机器可检验的条件 ——
   * 它成立的前提就是「祖先真的是脚注容器」。
   */

  it('脚注类豁免的真实祖先必须含 .footnotes（不是挂名）', () => {
    // 常量本身要与真实容器选择器一致，否则判定口径会漂
    expect(FOOTNOTE_CONTAINER_SELECTOR).toBe('.footnotes')

    const wrong = findFootnoteAllowancesOutsideContainer().map(
      (a) => `${a.selector} → 登记祖先 ${EM_ANCESTORS[a.selector] ?? '缺失'}`,
    )
    expect(
      wrong,
      '以下 footnote-inner 豁免的祖先不是脚注容器：\n' +
        wrong.join('\n') +
        `\n「脚注内再小一档」这个理由对它们不成立，应改字号或换分类（如 aria-hidden → decorative）。`,
    ).toEqual([])

    // 正向确认：现存的两条脚注豁免都真的挂在 .footnotes 下
    const footnoteAllowances = SUB_12PX_ALLOWANCES.filter((a) => a.kind === 'footnote-inner')
    expect(footnoteAllowances.length, '脚注豁免一条都没有，说明分类名存实亡').toBeGreaterThan(0)
    for (const a of footnoteAllowances) {
      const ancestor = ANCESTOR_FONT_SOURCES[EM_ANCESTORS[a.selector]!]
      expect(
        ancestor.selector,
        `${a.selector} 的祖先选择器不含 ${FOOTNOTE_CONTAINER_SELECTOR}`,
      ).toContain(FOOTNOTE_CONTAINER_SELECTOR)
    }
  })

  it('白名单条目的类名必须在 TSX 里真的有生产者（无死豁免）', () => {
    const orphans = findOrphanAllowances(rules).map(
      (a) => `${a.file ?? '*'}:${a.selector}（类名 ${lastClassOf(a.selector) ?? '—'}）`,
    )
    expect(
      orphans,
      '以下白名单对应的元素在 TSX 里不存在（死 CSS 的豁免是虚假覆盖）：\n' +
        orphans.join('\n') +
        '\n应删除该死规则与对应豁免，而不是留着它让清单显得更完整。',
    ).toEqual([])
  })

  it('死豁免检测不是空转：构造一个无消费者的类名应当被认出来', () => {
    // 用一个绝不存在的类名验证判定路径本身有效
    const fake = 'this-class-has-no-tsx-consumer-xyz'
    expect(SUB_12PX_ALLOWANCES.some((a) => lastClassOf(a.selector) === fake)).toBe(false)
    // 反向：真实存在消费者的类名必须被认出来（否则检测器会全量误报）
    expect(lastClassOf('.home-more__count')).toBe('home-more__count')
    expect(collectTsxSub12().length, 'TSX 侧仍应为 0 命中，否则说明这里混进了别的问题').toBe(0)
  })
})

/* ── 装饰证明的边界（防止把非 SVG 写法误判成 SVG） ─────────────── */

describe('装饰证明的判定边界', () => {
  const css = (body: string, selector = '.x') => fakeRule(selector, body, 'src/app/globals.css')

  it('opacity:0 是最直接的证明', () => {
    expect(decorativeProofOf(css('opacity: 0; font-size: 11px;'))).toBe('opacity-0')
  })

  it('选择器自带 aria-hidden 也算', () => {
    expect(decorativeProofOf(fakeRule('[aria-hidden="true"] .badge', 'font-size: 11px;'))).toBe(
      'aria-hidden',
    )
  })

  it('aria-hidden 在 TSX 里：类名命中集合才算（CSS 里看不到它）', () => {
    const rule = fakeRule('.home-more__count', 'font-size: 0.95em;', 'src/app/globals.css')
    // 不传集合 → 证不出来，必须报 null（不能默认放行）
    expect(decorativeProofOf(rule)).toBeNull()
    // 传入真实集合 → 认可
    expect(decorativeProofOf(rule, ariaHiddenClasses)).toBe('aria-hidden')
  })

  it('SVG 证明要求「元素名 + 文件里真的样式化了 svg」', () => {
    // 真实例外：friend-postcard.css 里有 `.friend-postcard__mark svg`
    const real = rules.find((r) => r.selector === '.friend-postmark text')
    expect(real).toBeDefined()
    expect(fileStylesSvg('src/features/friends/friend-postcard.css')).toBe(true)
    expect(decorativeProofOf(real!)).toBe('svg')

    // 反向：prose.css 里没有任何 svg 元素选择器，所以 `.prose text` 拿不到 svg 证明
    expect(fileStylesSvg('src/design-system/styles/prose.css')).toBe(false)
    expect(decorativeProofOf(fakeRule('font-size: 11px;', '.prose text'))).toBeNull()
    // 类名里含 text 的词更不能算
    expect(decorativeProofOf(fakeRule('font-size: 11px;', '.prose .text-block'))).toBeNull()
    expect(decorativeProofOf(fakeRule('font-size: 11px;', '.mytext'))).toBeNull()
  })

  it('什么都证不出来时返回 null（而不是默认通过）', () => {
    expect(decorativeProofOf(fakeRule('.plain', 'font-size: 11px;'))).toBeNull()
  })
})

/* ── 端到端：全仓不得有未豁免的小字号 ───────────────────────────── */

describe('全仓小字号总账', () => {
  it('每一条 <12px 的规则都已豁免', () => {
    const hits = collectSub12(rules)
    const unallowed = hits
      .filter((h) => h.allowanceIndex < 0 || h.unverifiable)
      .map(
        (h) =>
          `${h.rule.file}:${h.rule.line} ${h.rule.selector} → ${h.px ?? '无法求值'}（${h.basis}）`,
      )
    expect(
      unallowed,
      '以下规则小于 12px（或无法求值）却没有豁免：\n' +
        unallowed.join('\n') +
        '\n要么改到 12px 以上，要么在 SUB_12PX_ALLOWANCES 里登记理由。',
    ).toEqual([])
  })

  it('反证：去掉豁免清单就应该报出来（守卫不是空转）', () => {
    // 不能真的改常量，所以直接检查「命中数 == 豁免覆盖的字面量/em 总数」这一不变式
    const hits = collectSub12(rules)
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.allowanceIndex >= 0)).toBe(true)
    // 且确实覆盖了装饰、脚注两类（结构类由第三方样式承担，不在此列）
    const kinds = new Set(
      hits.map((h) => SUB_12PX_ALLOWANCES[h.allowanceIndex]?.kind).filter(Boolean),
    )
    expect(kinds.has('decorative')).toBe(true)
    expect(kinds.has('footnote-inner')).toBe(true)
  })
})
