/**
 * 内容语言的请求链路
 *
 * 界面文案由 `dictionary.ts` 负责，但文章的标题、正文、摘要，日记的标题与正文，
 * 搜索命中与时间线标题全部来自 Mix Space。它们只能靠查询参数 `?lang=` 让后端
 * 返回对应译文——`renderMarkdown` 只渲染 Markdown，不会翻译任何字。
 *
 * 这组测试钉住两件事：
 *   1. 每个内容入口都把 lang 真正拼进请求，而不是只在页面里算了一下；
 *   2. `lang` 与 `password` / 分页 / 分类筛选正交，谁都不会挤掉谁。
 *
 * 默认语言（简体）**不发** `?lang=`：让后端返回原文，避免把中文正文再「翻译」
 * 一次。所以断言里「不传」与「传 undefined」等价。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const requestMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/client/http', () => ({
  requestV2: requestMock,
}))

import { getArticle, listArticles } from '@/lib/api/repositories/posts'
import {
  getDiary,
  getDiaryByNid,
  getLatestDiary,
  listDiaries,
  listDiariesByTopic,
} from '@/lib/api/repositories/notes'
import { getTimeline } from '@/lib/api/repositories/site'
import { listArticlesByTag } from '@/lib/api/repositories/taxonomy'

type RequestCall = [string, { query?: Record<string, unknown>; revalidate?: number }]

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

/* ── 文章 ───────────────────────────────────────────────────────── */

describe('文章：详情与列表都带 lang', () => {
  it('详情请求把 lang 拼进查询参数，且不带 truncate', async () => {
    requestMock.mockResolvedValue({
      id: 'p1',
      title: 'Translated title',
      slug: 'hello',
      created_at: '2026-11-02T09:10:00.000Z',
    })

    const article = await getArticle('tech', 'hello', { lang: 'en' })
    const [path, options] = calls().at(-1)!

    expect(path).toBe('/posts/tech/hello')
    expect(options.query?.lang).toBe('en')
    expect(options.query?.truncate).toBeUndefined()
    // 后端返回什么标题就展示什么标题：主题不参与翻译
    expect(article.title).toBe('Translated title')
  })

  it('不传 lang 时查询参数里不出现该键（默认语言取原文）', async () => {
    await getArticle('tech', 'hello')
    expect(calls().at(-1)?.[1].query?.lang).toBeUndefined()
  })

  it('列表把 lang 与分页、分类筛选一起传，互不覆盖', async () => {
    await listArticles({ page: 2, size: 10, categoryIds: ['c1', 'c2'], lang: 'en' })
    const [path, options] = calls().at(-1)!

    expect(path).toBe('/posts')
    expect(options.query).toMatchObject({
      page: 2,
      size: 10,
      categoryIds: 'c1,c2',
      lang: 'en',
    })
    expect(options.query?.truncate).toBe(310)
  })

  it('实体的翻译标题会被适配器原样透出到列表', async () => {
    requestMock.mockResolvedValue({
      ...EMPTY_PAGE,
      data: [
        {
          id: 'p1',
          title: 'Translated title',
          slug: 'hello',
          created_at: '2026-11-02T09:10:00.000Z',
        },
      ],
    })

    const result = await listArticles({ lang: 'en' })
    expect(result.items[0]?.title).toBe('Translated title')
  })
})

/* ── 日记 ───────────────────────────────────────────────────────── */

describe('日记：详情带 lang，密码仍是独立参数', () => {
  it('按 nid 取详情时同时带上 lang 与 password', async () => {
    requestMock.mockResolvedValue({
      data: {
        id: 'n1',
        nid: 13,
        title: 'Translated diary',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    })

    const diary = await getDiaryByNid(13, 'open-sesame', { lang: 'en' })
    const [path, options] = calls().at(-1)!

    expect(path).toBe('/notes/nid/13')
    expect(options.query).toMatchObject({ password: 'open-sesame', lang: 'en' })
    expect(diary.title).toBe('Translated diary')
  })

  it('无密码时行为不变：不带 password，仍可带 lang', async () => {
    requestMock.mockResolvedValue({
      data: { id: 'n1', nid: 13, title: 'T', created_at: '2026-01-01T00:00:00.000Z' },
    })

    await getDiaryByNid(13, undefined, { lang: 'en' })
    const [path, options] = calls().at(-1)!

    expect(path).toBe('/notes/nid/13')
    expect(options.query?.password).toBeUndefined()
    expect(options.query?.lang).toBe('en')
  })

  it('受保护日记仍绕开缓存（revalidate 0），与 lang 无关', async () => {
    requestMock.mockResolvedValue({
      data: { id: 'n1', nid: 13, title: 'T', created_at: '2026-01-01T00:00:00.000Z' },
    })

    await getDiaryByNid(13, 'pw', { lang: 'en' })
    expect(calls().at(-1)?.[1].revalidate).toBe(0)

    await getDiaryByNid(13, undefined, { lang: 'en' })
    expect(calls().at(-1)?.[1].revalidate).toBe(120)
  })

  it('旧路由用的 getDiary 也支持 lang，密码继续走查询串', async () => {
    requestMock.mockResolvedValue({
      id: 'n1',
      nid: 13,
      title: 'T',
      created_at: '2026-01-01T00:00:00.000Z',
    })

    await getDiary('n1', 'pw', { lang: 'en' })
    const [path, options] = calls().at(-1)!

    expect(path).toBe('/notes/n1')
    expect(options.query).toMatchObject({ password: 'pw', lang: 'en' })
  })

  it('列表与专栏筛选两条端点都带 lang', async () => {
    await listDiaries({ page: 3, size: 10, lang: 'en' })
    expect(calls().at(-1)?.[0]).toBe('/notes')
    expect(calls().at(-1)?.[1].query).toMatchObject({ page: 3, size: 10, lang: 'en' })

    await listDiariesByTopic('t1', { page: 1, size: 10, lang: 'en' })
    expect(calls().at(-1)?.[0]).toBe('/notes/topics/t1')
    expect(calls().at(-1)?.[1].query).toMatchObject({ page: 1, size: 10, lang: 'en' })
  })
})

/* ── 最新日记扫描 ───────────────────────────────────────────────── */

describe('最新日记扫描：每一页都带 lang', () => {
  it('多页扫描时 lang 逐页传递，结果仍按发布时间挑最新', async () => {
    requestMock
      .mockResolvedValueOnce({
        data: [{ id: 'old', nid: 1, title: 'Old', created_at: '2025-06-01T00:00:00.000Z' }],
        pagination: { ...EMPTY_PAGE.pagination, total_page: 2, has_next_page: true },
      })
      .mockResolvedValueOnce({
        data: [{ id: 'new', nid: 2, title: 'New', created_at: '2026-11-01T00:00:00.000Z' }],
        pagination: {
          ...EMPTY_PAGE.pagination,
          current_page: 2,
          total_page: 2,
          has_next_page: false,
        },
      })

    const result = await getLatestDiary({ lang: 'en' })
    const seen = calls()

    expect(seen).toHaveLength(2)
    for (const [path, options] of seen) {
      expect(path).toBe('/notes')
      expect(options.query?.lang).toBe('en')
    }
    expect(seen.map(([, options]) => options.query?.page)).toEqual([1, 2])
    expect(result.diary?.id).toBe('new')
    expect(result.truncated).toBe(false)
  })

  it('默认语言下仍然逐页不带 lang', async () => {
    await getLatestDiary()
    for (const [, options] of calls()) {
      expect(options.query?.lang).toBeUndefined()
    }
  })
})

/* ── 时间线 / 标签扫描 ───────────────────────────────────────────── */

describe('时间线与标签扫描不是「只回 id」的接口，也要带 lang', () => {
  it('时间线请求带 lang，排序默认值不受影响', async () => {
    requestMock.mockResolvedValue({ data: { posts: [], notes: [] } })
    await getTimeline({ lang: 'en' })

    const [path, options] = calls().at(-1)!
    expect(path).toBe('/aggregate/timeline')
    expect(options.query).toMatchObject({ sort: -1, lang: 'en' })
  })

  it('标签页要翻多页文章列表，每一页都带 lang', async () => {
    requestMock
      .mockResolvedValueOnce({
        data: [
          {
            id: 'p1',
            title: 'Translated',
            slug: 'a',
            tags: ['Openwrt'],
            created_at: '2026-01-01T00:00:00.000Z',
          },
        ],
        pagination: { ...EMPTY_PAGE.pagination, total_page: 2, has_next_page: true },
      })
      .mockResolvedValueOnce({
        data: [],
        pagination: { ...EMPTY_PAGE.pagination, current_page: 2, total_page: 2 },
      })

    const { result } = await listArticlesByTag('Openwrt', { page: 1, size: 10, lang: 'en' })
    const seen = calls()

    expect(seen).toHaveLength(2)
    for (const [path, options] of seen) {
      expect(path).toBe('/posts')
      expect(options.query?.lang).toBe('en')
      expect(options.query?.truncate).toBe(310)
    }
    expect(result.items[0]?.title).toBe('Translated')
  })
})
