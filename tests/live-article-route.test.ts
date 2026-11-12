import { beforeEach, describe, expect, it, vi } from 'vitest'

const getArticle = vi.fn()
const revalidateTag = vi.fn()
const isNotFound = vi.fn()

vi.mock('@/lib/api', () => ({
  getArticle: (...args: unknown[]) => getArticle(...args),
  isNotFound: (error: unknown) => isNotFound(error),
}))

vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => revalidateTag(...args),
}))

vi.mock('@/lib/i18n/server', () => ({
  getLocale: async () => 'zh',
}))

const ARTICLE = {
  id: 'post-1',
  slug: 'hello',
  category: { slug: 'tech' },
  modifiedAt: '2024-03-01T00:00:00.000Z',
}

const NOT_FOUND = Object.assign(new Error('not found'), { name: 'NotFoundError' })

async function post(body: unknown) {
  const { POST } = await import('@/app/api/articles/live/route')
  const response = await POST(
    new Request('http://localhost/api/articles/live', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
  return { status: response.status, body: await response.json() }
}

const BASE = {
  id: 'post-1',
  category: 'tech',
  slug: 'hello',
  knownModifiedAt: '2024-02-01T00:00:00.000Z',
  next: null,
}

beforeEach(() => {
  getArticle.mockReset()
  revalidateTag.mockReset()
  isNotFound.mockReset()
  isNotFound.mockImplementation((error: unknown) => error === NOT_FOUND)
})

describe('POST /api/articles/live', () => {
  it('非法输入直接 400，不问后端', async () => {
    expect((await post({ id: 'post-1' })).status).toBe(400)
    expect((await post({ ...BASE, category: '../etc' })).status).toBe(400)
    expect(getArticle).not.toHaveBeenCalled()
  })

  it('内容确实变新：返回 updated 并失效缓存标签', async () => {
    getArticle.mockResolvedValue(ARTICLE)
    const result = await post(BASE)

    expect(result).toEqual({ status: 200, body: { status: 'updated' } })
    expect(revalidateTag).toHaveBeenCalledWith('posts')
    // 必须绕开 300s 缓存；默认语言不传 lang（与正式渲染管线一致）
    expect(getArticle).toHaveBeenCalledWith('tech', 'hello', { lang: undefined, fresh: true })
  })

  it('修改时间没往前走：unchanged，不做无谓重渲染', async () => {
    getArticle.mockResolvedValue({ ...ARTICLE, modifiedAt: '2024-02-01T00:00:00.000Z' })
    const result = await post(BASE)

    expect(result.body).toEqual({ status: 'unchanged' })
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('页面没有基准时间时宁可多刷一次', async () => {
    getArticle.mockResolvedValue(ARTICLE)
    const result = await post({ ...BASE, knownModifiedAt: null })
    expect(result.body).toEqual({ status: 'updated' })
  })

  it('地址换了但 id 一致：返回 moved 与新路径', async () => {
    getArticle.mockResolvedValueOnce({ ...ARTICLE, slug: 'new-slug', category: { slug: 'life' } })
    const result = await post({ ...BASE, next: { category: 'life', slug: 'new-slug' } })

    expect(result.body).toEqual({ status: 'moved', path: '/articles/life/new-slug' })
    expect(getArticle).toHaveBeenCalledTimes(1)
    expect(revalidateTag).toHaveBeenCalledWith('posts')
  })

  it('新地址上是另一篇文章：不跳转，继续核对原地址', async () => {
    getArticle
      .mockResolvedValueOnce({ ...ARTICLE, id: 'other' })
      .mockResolvedValueOnce({ ...ARTICLE, modifiedAt: '2024-04-01T00:00:00.000Z' })

    const result = await post({ ...BASE, next: { category: 'life', slug: 'new-slug' } })
    expect(result.body).toEqual({ status: 'updated' })
    expect(getArticle).toHaveBeenCalledTimes(2)
  })

  it('原地址 404：gone，并清掉旧缓存', async () => {
    getArticle.mockRejectedValue(NOT_FOUND)
    const result = await post(BASE)

    expect(result.body).toEqual({ status: 'gone' })
    expect(revalidateTag).toHaveBeenCalledWith('posts')
  })

  it('地址被另一篇文章占用：gone，不展示旧内容', async () => {
    getArticle.mockResolvedValue({ ...ARTICLE, id: 'other' })
    const result = await post(BASE)

    expect(result.body).toEqual({ status: 'gone' })
  })

  it('上游故障返回 error，不把错误细节带给浏览器', async () => {
    getArticle.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:3000'))
    const result = await post(BASE)

    expect(result).toEqual({ status: 502, body: { status: 'error' } })
    expect(JSON.stringify(result.body)).not.toContain('ECONNREFUSED')
  })

  it('404 与 5xx 区别对待：404 不算服务器故障', async () => {
    getArticle.mockRejectedValue(NOT_FOUND)
    const gone = await post(BASE)
    expect(gone.body.status).toBe('gone')

    getArticle.mockRejectedValue(new Error('timeout'))
    const failed = await post(BASE)
    expect(failed.body.status).toBe('error')
  })
})
