// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ArticleSummary as ArticleSummaryModel } from '@/lib/api'

/**
 * AI 摘要卡 / AI 精读窗口（读取层 + 组件层）
 *
 * 纯解析逻辑由 `insights-document.test.ts` 覆盖，这里验证交互契约：
 *   1. 开关关掉时**连请求都不发**；接口没内容时读成 null，不留空壳；
 *   2. 摘要默认展开、可折叠，且折叠不销毁正文（展开后仍能读全）；
 *   3. 「AI 精读」是独立按钮：开窗不收起摘要、重复打开不重复请求；
 *   4. 窗口的键盘契约：Esc / 关闭按钮 / 遮罩 / 焦点进入与归还；
 *   5. 引用锚点跳转，以及目标不存在时的安全降级；
 *   6. 换文章（新 props）后不残留上一篇的语言与正文。
 */

const state = vi.hoisted(() => ({
  aiSummary: true,
  aiInsights: true,
  summary: null as unknown,
  insights: null as unknown,
  summaryCalls: 0,
  insightsCalls: 0,
}))

vi.mock('@/core/registry/features', () => ({
  isFeatureEnabled: (key: string) =>
    key === 'aiSummary' ? state.aiSummary : key === 'aiInsights' ? state.aiInsights : true,
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    getArticleSummary: async () => {
      state.summaryCalls += 1
      return state.summary
    },
    getArticleInsights: async () => {
      state.insightsCalls += 1
      return state.insights
    },
  }
})

const { AISummaryCard } = await import('@/features/ai-summary')
const { readArticleSummary } = await import('@/features/ai-summary/read')
const { readArticleInsights } = await import('@/features/ai-insights/read')

const SUMMARY: ArticleSummaryModel = {
  text: '这篇文章讲的是如何在静态站点里安全地接入第三方评论。',
  lang: 'zh-CN',
  isFallback: false,
}

const INSIGHTS = {
  leadHtml: '<p>先给结论：评论应该走 BFF。</p>',
  restHtml:
    '<h2 id="insight-rest-为什么">为什么</h2><p>因为浏览器不该直连 Core。</p>' +
    '<p>作者认为<sup class="insight-ref"><a class="insight-ref__link" href="#背景" title="回到原文">§1</a></sup>。</p>',
  meta: { readingMinutes: 2, difficulty: 'easy' as const, genre: 'architecture' },
  refs: { total: 8, resolved: 8 },
  lang: 'zh-CN',
  isFallback: false,
  isTranslation: false,
}

const originalFetch = globalThis.fetch
let fetchCalls = 0

beforeEach(() => {
  state.aiSummary = true
  state.aiInsights = true
  state.summary = null
  state.insights = null
  state.summaryCalls = 0
  state.insightsCalls = 0
  fetchCalls = 0

  // 精读窗口只消费服务端送来的 HTML，客户端不该再发请求
  globalThis.fetch = vi.fn(async () => {
    fetchCalls += 1
    throw new Error('组件不应发起请求')
  }) as unknown as typeof fetch

  // jsdom 没实现这两个 API：补最小实现，别让被测代码为了测试环境改形状
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }))
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('AISummaryCard 摘要卡', () => {
  it('默认展开，标题区可折叠；折叠后正文仍在 DOM 里，展开即可读全', () => {
    const { container } = render(<AISummaryCard summary={SUMMARY} insights={null} />)

    expect(screen.getByLabelText('AI 摘要')).toBeTruthy()
    expect(screen.getByText('AI 摘要')).toBeTruthy()
    expect(screen.getByText(SUMMARY.text)).toBeTruthy()

    const toggle = screen.getByRole('button', { expanded: true })
    const section = container.querySelector('.ai-summary')
    expect(section?.getAttribute('data-open')).toBe('true')

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(section?.getAttribute('data-open')).toBe('false')
    // 不截断、不卸载：正文还在，展开后不需要重新请求或重新生成
    expect(screen.getByText(SUMMARY.text)).toBeTruthy()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
  })

  it('回退到别的语种时如实标注，不让读者以为是界面语言写的', () => {
    render(<AISummaryCard summary={{ ...SUMMARY, lang: 'ja', isFallback: true }} insights={null} />)
    expect(screen.getByText(/^原文/)).toBeTruthy()
    expect(screen.getByText(SUMMARY.text)).toBeTruthy()
  })

  it('没有精读数据时不渲染「AI 精读」入口', () => {
    render(<AISummaryCard summary={SUMMARY} insights={null} />)
    expect(screen.queryByRole('button', { name: /AI 精读/ })).toBeNull()
  })
})

describe('AI 精读窗口', () => {
  function openReading() {
    const view = render(<AISummaryCard summary={SUMMARY} insights={INSIGHTS} />)
    const trigger = screen.getByRole('button', { name: /AI 精读/ })
    fireEvent.click(trigger)
    return { ...view, trigger }
  }

  it('点入口打开模态窗口：标题栏、人话元信息、正文都在', () => {
    openReading()

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(within(dialog).getByText('AI 精读')).toBeTruthy()
    expect(within(dialog).getByText('先给结论：评论应该走 BFF。')).toBeTruthy()
    expect(within(dialog).getByText('为什么')).toBeTruthy()

    const facts = within(dialog).getByText(/约 2 分钟/)
    expect(facts.textContent).toContain('轻松')
    // genre 是 Core 的开放 key，不直接抛给读者
    expect(facts.textContent).not.toContain('architecture')

    // 打开只动窗口，不收起摘要
    expect(screen.getByRole('button', { expanded: true })).toBeTruthy()
  })

  it('打开与关闭都不发请求，重复打开也不重复请求', () => {
    const { trigger } = openReading()
    fireEvent.keyDown(document, { key: 'Escape' })

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeTruthy()

    expect(fetchCalls).toBe(0)
    expect(state.insightsCalls).toBe(0)
  })

  it('Esc 关闭，焦点回到触发按钮；关闭按钮与遮罩同样能关', () => {
    const { trigger } = openReading()

    const panel = screen.getByRole('dialog')
    expect(document.activeElement).toBe(panel)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: '关闭 AI 精读' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(trigger)
    const backdrop = document.querySelector('.folio-dialog__backdrop')
    expect(backdrop).not.toBeNull()
    fireEvent.mouseDown(backdrop as Element)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Tab 在窗口内循环：最后一个可聚焦元素之后回到关闭按钮', () => {
    openReading()

    const close = screen.getByRole('button', { name: '关闭 AI 精读' })
    const refLink = screen.getByTitle('回到原文')

    refLink.focus()
    fireEvent.keyDown(refLink, { key: 'Tab' })
    expect(document.activeElement).toBe(close)

    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(refLink)
  })

  it('点引用锚点：关窗并滚到正文对应章节', async () => {
    const target = document.createElement('h2')
    target.id = '背景'
    document.body.appendChild(target)

    openReading()
    fireEvent.click(screen.getByTitle('回到原文'))

    expect(screen.queryByRole('dialog')).toBeNull()
    // 跳转排在关窗之后的一帧：等滚动锁解除再滚，才不会被背景锁挡住
    await new Promise((resolve) => setTimeout(resolve, 32))
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()

    target.remove()
  })

  it('目标章节不存在时不制造失败的跳转：窗口留在原处', () => {
    openReading()
    fireEvent.click(screen.getByTitle('回到原文'))

    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled()
  })

  it('引用命中不全时如实标出差额，全命中时不写这句话', () => {
    const { rerender } = render(<AISummaryCard summary={SUMMARY} insights={INSIGHTS} />)
    fireEvent.click(screen.getByRole('button', { name: /AI 精读/ }))
    // 窗口挂在 portal 里，不在 RTL 的 container 下
    expect(document.body.textContent).toContain('8 处原文引用')
    expect(document.body.textContent).not.toContain('无法在原文定位')

    fireEvent.keyDown(document, { key: 'Escape' })
    rerender(
      <AISummaryCard
        summary={SUMMARY}
        insights={{ ...INSIGHTS, refs: { total: 8, resolved: 5 } }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /AI 精读/ }))
    expect(document.body.textContent).toContain('其中 3 处无法在原文定位')
  })

  it('回退语种与译本分别标注', () => {
    const { rerender } = render(
      <AISummaryCard summary={SUMMARY} insights={{ ...INSIGHTS, lang: 'ja', isFallback: true }} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /AI 精读/ }))
    expect(document.body.textContent).toContain('原文')

    fireEvent.keyDown(document, { key: 'Escape' })
    rerender(<AISummaryCard summary={SUMMARY} insights={{ ...INSIGHTS, isTranslation: true }} />)
    fireEvent.click(screen.getByRole('button', { name: /AI 精读/ }))
    expect(document.body.textContent).toContain('译本')
  })

  it('换文章后不残留上一篇的正文（语言切换同理）', () => {
    const { rerender } = render(<AISummaryCard summary={SUMMARY} insights={INSIGHTS} />)
    fireEvent.click(screen.getByRole('button', { name: /AI 精读/ }))
    expect(screen.getByText('先给结论：评论应该走 BFF。')).toBeTruthy()

    const next = {
      ...INSIGHTS,
      leadHtml: '<p>This one is in English.</p>',
      restHtml: '<p>And it says nothing about the previous article.</p>',
      lang: 'en',
      isFallback: true,
    }

    // 页面用 key={文章 id} 强制重挂载：这里模拟同一位置换 props 的结果
    rerender(<AISummaryCard key="next" summary={{ ...SUMMARY, lang: 'en' }} insights={next} />)

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText('先给结论：评论应该走 BFF。')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /AI 精读/ }))
    expect(screen.getByText('This one is in English.')).toBeTruthy()
  })

  it('精读里的图表容器原样交给 Prose，不被二次解析', () => {
    const mermaid = {
      ...INSIGHTS,
      restHtml: '<div class="mermaid-block">graph TD; A--&gt;B</div>',
    }
    render(<AISummaryCard summary={SUMMARY} insights={mermaid} />)
    fireEvent.click(screen.getByRole('button', { name: /AI 精读/ }))

    expect(document.querySelector('.ai-insights__body .mermaid-block')).not.toBeNull()
  })
})

describe('readArticleSummary', () => {
  it('接口返回空内容时得到 null —— 调用方据此不渲染整块', async () => {
    state.summary = null
    await expect(readArticleSummary('42', 'zh-CN')).resolves.toBeNull()
    expect(state.summaryCalls).toBe(1)
  })

  it('开关关掉时不发请求', async () => {
    state.aiSummary = false
    await expect(readArticleSummary('42')).resolves.toBeNull()
    expect(state.summaryCalls).toBe(0)
  })

  it('正常命中时透传语种与回退标记', async () => {
    state.summary = SUMMARY
    await expect(readArticleSummary('42', 'zh-CN')).resolves.toEqual(SUMMARY)
  })
})

describe('readArticleInsights', () => {
  const source = ['## 背景', '评论系统一直很难做。', '## 方案', '我们选了 BFF。'].join('\n\n')
  const toc = [
    { id: '背景', text: '背景', depth: 2 as const },
    { id: '方案', text: '方案', depth: 2 as const },
  ]

  const content = [
    '评论应该走 BFF，而不是让浏览器直连 Core。',
    '',
    '## 关键判断',
    '',
    '作者指出「评论系统一直很难做」<ref quote="评论系统一直很难做" section="背景"/>。',
    '',
    '## 开放问题',
    '',
    '- 匿名评论要不要限流？',
    '',
    '<!-- insights-meta: {"reading_time_min":3,"difficulty":"medium","genre":"architecture"} -->',
  ].join('\n')

  it('解析 → 定位锚点 → 分段渲染，标题 id 加前缀避免与正文撞车', async () => {
    state.insights = { content, lang: 'zh-CN', isFallback: false, isTranslation: false }

    const view = await readArticleInsights({ id: '42', source, toc })
    expect(view).not.toBeNull()

    expect(view?.leadHtml).toContain('评论应该走 BFF')
    expect(view?.restHtml).toContain('关键判断')
    expect(view?.restHtml).toContain('开放问题')

    expect(view?.restHtml).toContain('insight-rest-')
    expect(view?.leadHtml).not.toMatch(/id="关键判断"/)

    expect(view?.refs).toEqual({ total: 1, resolved: 1 })
    expect(view?.meta).toEqual({ readingMinutes: 3, difficulty: 'medium', genre: 'architecture' })
    expect(view?.leadHtml).not.toContain('insights-meta')
    expect(view?.restHtml).not.toContain('insights-meta')
  })

  it('quote 在原文找不到时降级成无链接标记，仍然计数但不算命中', async () => {
    state.insights = {
      content: '开头。\n\n## 判断\n\n这句原文没有<ref quote="根本不存在的句子" section="背景"/>。',
      lang: 'zh-CN',
      isFallback: false,
      isTranslation: false,
    }

    const view = await readArticleInsights({ id: '42', source, toc })
    expect(view?.refs).toEqual({ total: 1, resolved: 0 })
    expect(view?.restHtml).toContain('<sup class="insight-ref insight-ref--plain"')
    expect(view?.restHtml).not.toContain('insight-ref__link')
  })

  it('接口没有内容、正文为空、开关关闭，三种情况都得到 null', async () => {
    state.insights = null
    await expect(readArticleInsights({ id: '42', source, toc })).resolves.toBeNull()
    expect(state.insightsCalls).toBe(1)

    state.insights = { content: '   ', lang: 'zh-CN', isFallback: false, isTranslation: false }
    await expect(readArticleInsights({ id: '42', source, toc })).resolves.toBeNull()

    state.aiInsights = false
    state.insightsCalls = 0
    await expect(readArticleInsights({ id: '42', source, toc })).resolves.toBeNull()
    expect(state.insightsCalls).toBe(0)
  })
})
