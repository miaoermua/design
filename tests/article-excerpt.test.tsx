// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { Article } from '@/lib/api'
import { buildArticleExcerpt } from '@/lib/content/excerpt'
import { ArticleRow } from '@/features/articles'

/**
 * 博文列表「一行正文概览」回归测试
 *
 * 数据来源是列表 `GET /posts?truncate=310` 的 `text`，与官方 `summary`
 * 是两份独立数据。这里验证 Markdown 清理、空值、单行样式与 compact 变体；
 * 请求参数一致性在 tests/article-list-truncate.test.ts 里验证。
 */

afterEach(cleanup)

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'p1',
    title: '纸张、留白与呼吸',
    slug: 'paper',
    summary: null,
    text: null,
    category: { id: 'c1', name: '随笔', slug: 'essay' },
    tags: [],
    cover: null,
    createdAt: '2026-11-02T09:10:00.000Z',
    modifiedAt: null,
    readCount: null,
    likeCount: null,
    commentCount: null,
    isPinned: false,
    ...overrides,
  }
}

/** 默认模拟文章列表页（开启概览）；第三个参数 false 模拟首页等未开启的调用点 */
function renderRow(article: Article, compact = false, withExcerpt = true) {
  return render(
    <ArticleRow
      article={article}
      timeZone="Asia/Shanghai"
      compact={compact}
      withExcerpt={withExcerpt}
    />,
  )
}

describe('buildArticleExcerpt：Markdown / HTML → 单行纯文本', () => {
  const FULL_MARKDOWN = `# 标题一

这是一段 **加粗** 与 [链接文字](https://example.com)，还有 \`code\`。

\`\`\`ts
const secret = 1
\`\`\`

- 列表一
- 列表二

![图片说明](x.png)

<!-- 隐藏注释 <b>不应出现</b> -->

> 引用一行

| A | B |
|---|---|
| 1 | 2 |

正文结尾。`

  it('标题/链接/列表/引用/行内代码保留文字，代码块/图片/注释/表格/标记不出现', () => {
    const out = buildArticleExcerpt(FULL_MARKDOWN)
    expect(out).toContain('标题一')
    expect(out).toContain('这是一段 加粗 与 链接文字')
    expect(out).toContain('code')
    expect(out).toContain('列表一')
    expect(out).toContain('列表二')
    expect(out).toContain('引用一行')
    expect(out).toContain('正文结尾。')

    expect(out).not.toContain('# 标题')
    expect(out).not.toContain('**')
    expect(out).not.toContain('](')
    expect(out).not.toContain('```')
    expect(out).not.toContain('const secret')
    expect(out).not.toContain('图片说明')
    expect(out).not.toContain('隐藏注释')
    expect(out).not.toContain('不应出现')
    expect(out).not.toContain('| A |')
    expect(out).not.toContain('- 列表')
    expect(out).not.toContain('<b>')
  })

  it('中英文混排、标点与连续换行正常处理，不产生大段空白', () => {
    const mixed =
      '中文开头，English words，标点：、。！？（）「」；连续换行\n\n\n\n再一段 A-B_C 与 #标签 保留'
    const out = buildArticleExcerpt(mixed)
    expect(out).toContain('中文开头，English words，标点：、。！？（）「」；连续换行')
    expect(out).toContain('再一段 A-B_C 与 #标签 保留')
    expect(out).not.toContain('\n')
    expect(out).not.toMatch(/\s{2,}/)
  })

  it('正文为空 / 只有标记 / 只有代码块 / 只有图片 / 只有注释时不产出概览', () => {
    expect(buildArticleExcerpt(null)).toBe('')
    expect(buildArticleExcerpt(undefined)).toBe('')
    expect(buildArticleExcerpt('   \n\n  ')).toBe('')
    expect(buildArticleExcerpt('```js\n只有代码\n```')).toBe('')
    expect(buildArticleExcerpt('![只有图片](a.png)')).toBe('')
    expect(buildArticleExcerpt('<!-- 只有注释 -->')).toBe('')
    expect(buildArticleExcerpt('#\n-\n>')).toBe('')
  })

  it('truncate 硬切留下的半截标签 / 半截链接不会原样显示', () => {
    const broken = `<p align="center">
<img src="https://x/y.png">
</p>

<!--
<p align="center">
<img src="hidden.png">
</p>
-->

[安装应用](htt`
    const out = buildArticleExcerpt(broken)
    expect(out).toContain('安装应用')
    expect(out).not.toContain('<p')
    expect(out).not.toContain('img src')
    expect(out).not.toContain('<!--')
    expect(out).not.toContain('](')
    expect(out).not.toContain('hidden.png')
  })

  it('真实线上正文片段（HTML banner + 注释 + 链接）清理正确', () => {
    const realHead = `<p align="center">
<img src="https://static.miaoer.net/images/CatWrt_bannerlogo.jpg">
</p>

<!--
<b>隐藏文字</b>
-->

客制化 OpenWrt 智能网关

[安装应用](https://www.miaoer.net/posts/blog/guide)

欢迎多多留言鼓励`
    const out = buildArticleExcerpt(realHead)
    expect(out).toContain('客制化 OpenWrt 智能网关')
    expect(out).toContain('安装应用')
    expect(out).toContain('欢迎多多留言鼓励')
    expect(out).not.toContain('隐藏文字')
    expect(out).not.toContain('bannerlogo')
    expect(out).not.toContain('https://')
  })

  it('不在 JS 里按字符截断：长文本原样保留，长度交给 CSS', () => {
    const long = '正文文字'.repeat(200)
    expect(buildArticleExcerpt(long)).toBe(long)
  })
})

describe('ArticleRow：正文概览与 summary 的关系', () => {
  it('summary 为 null 但 text 有内容 → 正文概览正常显示', () => {
    const { container } = renderRow(makeArticle({ summary: null, text: '这是列表返回的正文内容。' }))
    const textP = container.querySelector('[data-excerpt="text"]')
    expect(textP).not.toBeNull()
    expect(textP?.textContent).toBe('这是列表返回的正文内容。')
    expect(container.querySelector('[data-excerpt="summary"]')).toBeNull()
  })

  it('summary 与 text 都有内容 → 两行各显示各自数据，不互相冒充', () => {
    const { container } = renderRow(
      makeArticle({
        summary: '作者手写的独立摘要',
        text: '## 小标题\n\n正文段落与 [链接](https://x) 内容。',
      }),
    )
    const summaryP = container.querySelector('[data-excerpt="summary"]')
    const textP = container.querySelector('[data-excerpt="text"]')
    expect(summaryP?.textContent).toBe('作者手写的独立摘要')
    expect(textP?.textContent).toBe('小标题 正文段落与 链接 内容。')
    expect(textP?.textContent).not.toContain('作者手写的独立摘要')
    expect(summaryP?.textContent).not.toContain('正文段落')
    expect(container.querySelectorAll('[data-excerpt]')).toHaveLength(2)
  })

  it('summary 与正文概览恰好同文 → 只渲染一次，不重复显示', () => {
    const { container } = renderRow(makeArticle({ summary: '同一句话', text: '同一句话' }))
    expect(container.querySelector('[data-excerpt="summary"]')?.textContent).toBe('同一句话')
    expect(container.querySelector('[data-excerpt="text"]')).toBeNull()
  })

  it('text 为空 / null / 清理后没有有效文字 → 不渲染空概览', () => {
    const cases = [null, '', '   ', '```js\ncode\n```', '![img](x.png)', '<!-- 注释 -->']
    for (const text of cases) {
      const { container, unmount } = renderRow(makeArticle({ text }))
      expect(container.querySelector('[data-excerpt="text"]'), `text=${JSON.stringify(text)}`).toBeNull()
      unmount()
    }
  })

  it('Markdown 语法不进入 DOM 概览', () => {
    const { container } = renderRow(
      makeArticle({ text: '# 标题\n\n**粗体** [链接](https://x) ![图](y.png)\n\n```js\nsecret\n```' }),
    )
    const text = container.querySelector('[data-excerpt="text"]')?.textContent ?? ''
    expect(text).toContain('标题')
    expect(text).toContain('粗体')
    expect(text).toContain('链接')
    expect(text).not.toContain('**')
    expect(text).not.toContain('https://')
    expect(text).not.toContain('secret')
    expect(text).not.toContain('```')
  })

  it('超长正文保持完整文本，视觉长度交给 line-clamp-1', () => {
    const long = '长正文内容'.repeat(200)
    const { container } = renderRow(makeArticle({ text: long }))
    const p = container.querySelector('[data-excerpt="text"]') as HTMLElement | null
    expect(p).not.toBeNull()
    expect(p?.textContent).toBe(long)
    expect(p?.className).toContain('line-clamp-1')
    expect(p?.className).toContain('max-w-[var(--measure-copy)]')
    expect(p?.className).toContain('text-small')
    expect(p?.className).toContain('text-[var(--text-secondary)]')
    expect(p?.className).not.toContain('truncate') // 是 line-clamp，不是 JS/单行 overflow 截断
  })

  it('compact 变体不受影响：无概览、无摘要，标题与日期仍在', () => {
    const { container } = renderRow(makeArticle({ summary: '有摘要', text: '有正文' }), true)
    expect(container.querySelector('[data-excerpt]')).toBeNull()
    expect(container.querySelector('h3')?.textContent).toBe('纸张、留白与呼吸')
    expect(container.querySelector('time')).not.toBeNull()
    expect(container.querySelector('article')?.className).toContain('py-5')
  })

  it('桌面不再有独立日期栏：日期并入元信息行，标题与摘要用整行宽度', () => {
    const { container } = renderRow(makeArticle({ text: '正文概览一行' }))
    const article = container.querySelector('article') as HTMLElement
    // 列表行不再分栏：没有日期列，也没有两列 grid
    expect(article.className).not.toContain('sm:grid-cols')
    // 列表行间距是 py-6（compact 变体是 py-5，见上一条断言）；断言写成 py-8 是
    // 测试诞生时就写错的值——引入该测试的提交里源码已经是 py-6
    expect(article.className).toContain('py-6')
    // 日期只在元信息行里出现一次，不再有第二个日期节点
    expect(container.querySelectorAll('time')).toHaveLength(1)
    expect(article.querySelector('[data-excerpt="text"]')?.className).toContain('mt-2.5')
    expect(article.querySelector('[data-excerpt="text"]')?.className).toContain(
      'text-[var(--text-secondary)]',
    )
  })

  it('元信息行按「日期 · 分类 · 标签 · 阅读数」排列，间隔点只打在三处', () => {
    const { container } = renderRow(
      makeArticle({ text: '正文概览一行', tags: ['纸张', '排版'], readCount: 1280 }),
    )
    const meta = container.querySelector('.article-row-meta') as HTMLElement
    expect(meta).not.toBeNull()

    const kids = [...meta.children]
    expect(kids.map((el) => el.tagName)).toEqual(['TIME', 'A', 'A', 'A', 'SPAN'])
    expect(kids[0]?.textContent?.trim()).toBe('2026.11.02')
    expect(kids[0]?.className).not.toContain('meta-sep') // 行首不加点
    expect(kids[1]?.className).toContain('meta-sep') // 分类
    expect(kids[1]?.className).toContain('text-[var(--accent-strong)]')
    expect(kids[2]?.className).toContain('meta-sep') // 标签整组的第一个
    expect(kids[3]?.className).not.toContain('meta-sep') // 组内其余标签不再打点
    expect(kids[4]?.className).toContain('meta-sep') // 阅读数
  })

  it('标题链接扩展为整条文章行，分类与标签链接仍是独立入口', () => {
    const { container } = renderRow(makeArticle({ tags: ['纸张', '排版'] }))
    const row = container.querySelector('article.article-row')
    const titleLink = row?.querySelector('.article-row__title-link')
    const metadataLinks = [...(row?.querySelectorAll('.article-row-meta a') ?? [])]

    expect(titleLink?.textContent).toBe('纸张、留白与呼吸')
    expect(metadataLinks).toHaveLength(3)
    expect(metadataLinks.every((link) => !titleLink?.contains(link))).toBe(true)
    expect(metadataLinks.map((link) => link.textContent)).toEqual(['随笔', '#纸张', '#排版'])
  })

  it('未开启 withExcerpt（首页等调用点）→ 不渲染正文概览，标题与日期栏仍在', () => {
    const { container } = renderRow(
      makeArticle({ summary: null, text: '这是列表返回的正文内容。' }),
      false,
      false,
    )
    expect(container.querySelector('[data-excerpt="text"]')).toBeNull()
    expect(container.querySelector('h3')?.textContent).toBe('纸张、留白与呼吸')
    expect(container.querySelector('time')).not.toBeNull()
    // 列表行间距是 py-6（compact 变体是 py-5，见上一条断言）；断言写成 py-8 是
    // 测试诞生时就写错的值——引入该测试的提交里源码已经是 py-6
    expect(container.querySelector('article')?.className).toContain('py-6')
  })

  it('未开启 withExcerpt 时官方 summary 仍按原语义显示，不受开关影响', () => {
    const { container } = renderRow(
      makeArticle({ summary: '作者手填的独立摘要', text: '正文内容' }),
      false,
      false,
    )
    expect(container.querySelector('[data-excerpt="summary"]')?.textContent).toBe(
      '作者手填的独立摘要',
    )
    expect(container.querySelector('[data-excerpt="text"]')).toBeNull()
    expect(container.querySelectorAll('[data-excerpt]')).toHaveLength(1)
  })
})
