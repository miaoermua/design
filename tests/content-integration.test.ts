import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SRC } from './helpers/design-tokens'

/**
 * 三类详情的接入差异（源码契约）
 *
 * Core v12 对 Page 不提供 AI 摘要 / 精读（实测 400 + `{"code":1002}`），
 * 因此三类页面的接入并不对称。这类差异最容易在后续重构里被「顺手统一」掉，
 * 变成对 Page 的空请求或空白模块，所以用源码断言把它钉住。
 *
 * 断言只看结构性事实：引入了什么、是否条件渲染、评论是否在正文容器之外。
 * 具体渲染结果由 `ai-reading.test.tsx` / `comments-ui.test.tsx` 覆盖。
 */

const ARTICLE_PAGE = join(SRC, 'app/articles/[category]/[slug]/page.tsx')
const DIARY_PAGE = join(SRC, 'app/diaries/[id]/page.tsx')
const CONTENT_PAGE = join(SRC, 'app/pages/[slug]/page.tsx')

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('Blog / Note：摘要 + 精读 + 评论', () => {
  for (const [label, path, id] of [
    ['文章', ARTICLE_PAGE, 'article.id'],
    ['日记', DIARY_PAGE, 'diary.id'],
  ] as const) {
    it(`${label}页接入三块能力`, () => {
      const code = source(path)

      expect(code).toContain("from '@/features/ai-summary'")
      expect(code).toContain("from '@/features/ai-insights'")
      expect(code).toContain("from '@/features/comments'")
      expect(code).toContain(`<CommentsSection refId={${id}}`)
    })
  }

  it('摘要卡是「有才渲染」，取不到就什么都不留（精读入口随之消失）', () => {
    for (const path of [ARTICLE_PAGE, DIARY_PAGE]) {
      const code = source(path)
      expect(code).toMatch(/summary \? \(/)
      expect(code).toContain('<AISummaryCard')
      // 精读不再单独成块渲染在正文之后
      expect(code).not.toContain('ArticleInsightsBlock')
    }
  })

  it('摘要卡在正文之前、不进目录；精读由卡片的窗口承载', () => {
    const code = source(ARTICLE_PAGE)
    const summary = code.indexOf('<AISummaryCard')
    const toc = code.indexOf('<ReadingInline')

    expect(summary).toBeGreaterThan(-1)
    expect(summary).toBeLessThan(toc)
    expect(code.indexOf('insights={insights}')).toBeGreaterThan(summary)
  })

  it('摘要卡按内容 id 挂 key：换文章不会带着上一篇的展开状态与内容', () => {
    for (const [path, id] of [
      [ARTICLE_PAGE, 'article.id'],
      [DIARY_PAGE, 'diary.id'],
    ] as const) {
      expect(source(path)).toContain(`<AISummaryCard key={${id}}`)
    }
  })

  it('评论挂在正文容器之外，不参与阅读进度', () => {
    const code = source(ARTICLE_PAGE)
    const articleEnd = code.indexOf('</article>')
    const comments = code.indexOf('<CommentsSection')

    expect(articleEnd).toBeGreaterThan(-1)
    expect(comments).toBeGreaterThan(articleEnd)
  })

  it('评论不混进文章操作栏', () => {
    const code = source(ARTICLE_PAGE)
    const rail = code.slice(
      code.indexOf('<ActionRail'),
      code.indexOf('/>', code.indexOf('<ActionRail')),
    )

    expect(rail).not.toContain('Comment')
  })
})

describe('Page：只有评论', () => {
  it('不引入 AI 特性，也不请求摘要 / 精读', () => {
    const code = source(CONTENT_PAGE)

    expect(code).not.toContain('ai-summary')
    expect(code).not.toContain('ai-insights')
    expect(code).not.toContain('readArticleSummary')
    expect(code).not.toContain('readArticleInsights')
  })

  it('评论复用同一入口，传的是页面 id', () => {
    const code = source(CONTENT_PAGE)

    expect(code).toContain("from '@/features/comments'")
    expect(code).toContain('<CommentsSection refId={page.id}')
  })
})
