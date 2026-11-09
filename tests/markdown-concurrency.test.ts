import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 用假的 shiki 替换高亮实现：
 * 一是避免测试里加载完整语法包，二是可以精确统计高亮调用次数——
 * 旧实现把 `walkTokens` 链式追加到共享实例上，第 N 次渲染会触发 N 次高亮。
 */
const probe = vi.hoisted(() => ({ calls: [] as string[] }))

vi.mock('shiki', () => ({
  createHighlighter: async () => ({
    codeToHtml: (code: string) => {
      probe.calls.push(code)
      return `<pre class="shiki"><code>${code}</code></pre>`
    },
  }),
}))

const { renderMarkdown } = await import('@/lib/content/markdown')

function article(index: number): string {
  return [
    `## 标题 ${index}`,
    '',
    `正文 ${index}`,
    '',
    '```ts',
    `const value = ${index}`,
    '```',
  ].join('\n')
}

beforeEach(() => {
  probe.calls.length = 0
})

describe('并发隔离', () => {
  it('两篇不同文章并发渲染时 TOC 不串台', async () => {
    for (let round = 0; round < 20; round++) {
      const [first, second] = await Promise.all([
        renderMarkdown('## 阿尔法\n\n内容 A'),
        renderMarkdown('## 贝塔\n\n内容 B'),
      ])

      expect(first.toc.map((item) => item.text)).toEqual(['阿尔法'])
      expect(second.toc.map((item) => item.text)).toEqual(['贝塔'])
      expect(first.html).toContain('阿尔法')
      expect(first.html).not.toContain('贝塔')
    }
  })

  it('20 篇不同文章并发渲染各自持有标题与高亮', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) => renderMarkdown(article(index))),
    )

    results.forEach((result, index) => {
      expect(result.toc.map((item) => item.text)).toEqual([`标题 ${index}`])
      expect(result.html).toContain(`正文 ${index}`)
      expect(result.html).toContain(`const value = ${index}`)
    })
  })

  it('连续渲染 100 次结果稳定', async () => {
    const first = await renderMarkdown(article(1))
    const baseline = first.html

    for (let index = 0; index < 100; index++) {
      const next = await renderMarkdown(article(1))
      expect(next.toc.map((item) => item.text)).toEqual(['标题 1'])
      expect(next.html).toBe(baseline)
    }
  })

  it('同一篇文章重复渲染不会累积高亮回调', async () => {
    const document = '```ts\nconst a = 1\n```'

    await renderMarkdown(document)
    await renderMarkdown(document)
    await renderMarkdown(document)

    // 每次渲染只应高亮一次；共享实例 + 重复 use() 时这里是 1+2+3 = 6
    expect(probe.calls).toEqual(['const a = 1', 'const a = 1', 'const a = 1'])
  })

  it('多个代码块在一次渲染中各自高亮一次', async () => {
    const { html } = await renderMarkdown('```ts\nconst a = 1\n```\n\n```ts\nconst b = 2\n```')

    expect(probe.calls).toEqual(['const a = 1', 'const b = 2'])
    expect(html).toContain('const a = 1')
    expect(html).toContain('const b = 2')
  })
})
