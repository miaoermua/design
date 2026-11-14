import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 列表请求一致性回归测试
 *
 * Core v12.10.0 的 `GET /posts?truncate=N` 会把每篇 `text` 按字符截断到 N，
 * 并把 lexical `content` 置 null。Folio 把 `truncate` 统一注入仓库层，
 * 因此普通列表、分页、分类、标签扫描、feed、sitemap、详情页相邻文章
 * 都走同一条请求，不会出现某个入口拉回整篇正文。
 * 这里不测真实网络：用 mock 的 requestV2 检查实际拼出的请求参数。
 */

const requestMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/client/http', () => ({
  requestV2: requestMock,
}))

import { toArticle, toArticleDetail } from '@/lib/api/adapters/article'
import type { V2PostRow } from '@/lib/api/contracts/v2/post'
import { getMockResponse } from '@/lib/api/mock/handlers'
import { ARTICLE_LIST_TRUNCATE, getArticle, listArticles } from '@/lib/api/repositories/posts'
import { listArticlesByTag } from '@/lib/api/repositories/taxonomy'

type RequestCall = [string, { query?: Record<string, unknown> }]

const EMPTY_PAGE = {
  data: [],
  pagination: {
    current_page: 1,
    total_page: 1,
    total: 0,
    size: 10,
    has_next_page: false,
    has_prev_page: false,
  },
}

function calls(): RequestCall[] {
  return requestMock.mock.calls as unknown as RequestCall[]
}

beforeEach(() => {
  requestMock.mockReset()
  requestMock.mockResolvedValue(EMPTY_PAGE)
})

describe('listArticles：truncate 参数', () => {
  it('常量与 Shiro 一致（310 字符）', () => {
    expect(ARTICLE_LIST_TRUNCATE).toBe(310)
  })

  it('普通列表 / 分页 / 分类 / 年份 / 排序 / lang 共用同一个 truncate', async () => {
    await listArticles()
    await listArticles({ page: 2, size: 10 })
    await listArticles({ page: 3, size: 10, categoryIds: ['c1', 'c2'] })
    await listArticles({ year: 2026, sortBy: 'createdAt', sortOrder: -1, lang: 'en' })

    const all = calls()
    expect(all).toHaveLength(4)
    for (const [path, options] of all) {
      expect(path).toBe('/posts')
      expect(options.query?.truncate).toBe(310)
    }
    // 其余查询参数没有被挤掉
    expect(all[1]?.[1].query).toMatchObject({ page: 2, size: 10 })
    expect(all[2]?.[1].query).toMatchObject({ page: 3, categoryIds: 'c1,c2' })
    expect(all[3]?.[1].query).toMatchObject({ year: 2026, lang: 'en', sortOrder: -1 })
  })

  it('标签扫描（多页翻页 / 加载更多语义）也走同一条请求', async () => {
    await listArticlesByTag('Openwrt', { page: 1, size: 10 })
    const all = calls()
    expect(all.length).toBeGreaterThan(0)
    for (const [path, options] of all) {
      expect(path).toBe('/posts')
      expect(options.query?.truncate).toBe(310)
    }
  })

  it('列表只发一次 /posts，不产生逐文章详情请求；详情接口本身不传 truncate', async () => {
    await listArticles({ page: 1, size: 20 })
    const listPaths = calls().map(([path]) => path)
    expect(listPaths).toEqual(['/posts'])
    expect(listPaths.some((path) => path.includes('/posts/'))).toBe(false)

    requestMock.mockResolvedValue({
      id: 'p1',
      title: '详情',
      slug: 'paper',
      text: '# 完整正文\n\n详情内容',
      created_at: '2026-11-02T09:10:00.000Z',
    })
    await getArticle('essay', 'paper')
    const last = calls().at(-1)
    expect(last?.[0]).toBe('/posts/essay/paper')
    expect(last?.[1].query?.truncate).toBeUndefined()
  })
})

describe('数据链路：text 与 summary 各归各位', () => {
  const row: V2PostRow = {
    id: 'p1',
    title: '标题',
    slug: 'slug',
    created_at: '2026-11-02T09:10:00.000Z',
    summary: null,
    text: '## 正文\n\n列表截断正文',
    content_format: 'markdown',
  }

  it('toArticle 映射列表 text，summary 保持 null 不被正文填充', () => {
    const article = toArticle(row)
    expect(article.text).toBe('## 正文\n\n列表截断正文')
    expect(article.summary).toBeNull()
  })

  it('详情正文仍由 content 承担，不重复保存完整原文', () => {
    const detail = toArticleDetail(row)
    expect(detail.text).toBeNull()
    expect(detail.content).toBe(row.text)
  })
})

describe('mock 模式与真实后端行为一致', () => {
  it('带 truncate 时按字符截断 text 并丢弃 content', () => {
    const params = new URLSearchParams({
      page: '1',
      size: '10',
      truncate: String(ARTICLE_LIST_TRUNCATE),
    })
    const res = getMockResponse('/posts', params)
    expect(res?.status).toBe(200)
    const body = res?.body as { data: V2PostRow[] }
    expect(body.data.length).toBeGreaterThan(0)
    for (const item of body.data) {
      expect((item.text ?? '').length).toBeLessThanOrEqual(310)
      expect(item.content).toBeNull()
    }

    const full = getMockResponse('/posts', new URLSearchParams({ page: '1', size: '10' }))
    const fullBody = full?.body as { data: V2PostRow[] }
    const fullLength = (fullBody.data[0]?.text ?? '').length
    const truncatedLength = (body.data[0]?.text ?? '').length
    expect(fullLength).toBeGreaterThan(truncatedLength)
  })
})
