import { describe, expect, it, vi } from 'vitest'
import {
  createLiveArticleController,
  isNewerThan,
  toArticleSignal,
  type RefreshOutcome,
  type RefreshRequest,
} from '@/features/articles/live/controller'
import { dispatchMessage, type RealtimeEvent } from '@/lib/realtime/protocol'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const flush = () => new Promise((done) => setTimeout(done, 0))

const IDENTITY = {
  id: 'post-1',
  category: 'tech',
  slug: 'hello',
  modifiedAt: '2024-02-01T00:00:00.000Z',
}

function setup(overrides: { refresh?: (request: RefreshRequest) => Promise<RefreshOutcome> } = {}) {
  const refresh = vi.fn(
    overrides.refresh ??
      (async (_request: RefreshRequest): Promise<RefreshOutcome> => {
        return { status: 'updated' }
      }),
  )
  const onUpdated = vi.fn()
  const onMoved = vi.fn()
  const onGone = vi.fn()
  const onError = vi.fn()

  const controller = createLiveArticleController({
    identity: { ...IDENTITY },
    refresh,
    onUpdated,
    onMoved,
    onGone,
    onError,
  })

  return { controller, refresh, onUpdated, onMoved, onGone, onError }
}

describe('isNewerThan', () => {
  it('只为更新的时间返回 true', () => {
    expect(isNewerThan('2024-02-02T00:00:00.000Z', '2024-02-01T00:00:00.000Z')).toBe(true)
    expect(isNewerThan('2024-02-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z')).toBe(false)
    expect(isNewerThan('2024-01-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z')).toBe(false)
  })

  it('解析不了的时间当作「不更新」', () => {
    expect(isNewerThan('yesterday', '2024-02-01T00:00:00.000Z')).toBe(false)
    expect(isNewerThan(null, '2024-02-01T00:00:00.000Z')).toBe(false)
  })

  it('没有基准时间时接受任何合法时间', () => {
    expect(isNewerThan('2024-02-01T00:00:00.000Z', null)).toBe(true)
  })
})

describe('toArticleSignal', () => {
  it('POST_UPDATE 分发出的 article-update 保留 id、时间与位置线索', () => {
    const event = dispatchMessage({
      type: 'POST_UPDATE',
      data: {
        id: 'post-1',
        modifiedAt: '2024-03-01T00:00:00.000Z',
        slug: 'new-slug',
        category: { slug: 'life' },
      },
    })!
    expect(toArticleSignal(event)).toEqual({
      kind: 'update',
      id: 'post-1',
      modifiedAt: '2024-03-01T00:00:00.000Z',
      next: { category: 'life', slug: 'new-slug' },
    })
  })

  it('POST_DELETE 分发出的 article-removed 映射为 removed', () => {
    const event = dispatchMessage({ type: 'POST_DELETE', data: 'p3' })!
    expect(toArticleSignal(event)).toEqual({ kind: 'removed', id: 'p3' })
  })

  it('其他类型化事件一律忽略', () => {
    expect(toArticleSignal({ kind: 'gateway-connect', greeting: null })).toBeNull()
    expect(toArticleSignal({ kind: 'visitor-online', online: 3, timestamp: null })).toBeNull()
    expect(
      toArticleSignal({ kind: 'read-count-update', articleType: 'post', id: 'p1', count: 9 }),
    ).toBeNull()
    expect(toArticleSignal({ kind: 'article-removed', id: 'other' })).toEqual({
      kind: 'removed',
      id: 'other',
    })
  })

  it('未经协议层校验的脏帧不会进入 controller', () => {
    expect(dispatchMessage({ type: 'POST_UPDATE', data: {} })).toBeNull()
    expect(dispatchMessage({ type: 'POST_DELETE', data: '../etc' })).toBeNull()
    expect(dispatchMessage({ v: 1, event: 'post.update' })).toBeNull()
  })

  it('位置线索里的非法 slug 在分发阶段就被丢弃', () => {
    const event: RealtimeEvent = {
      kind: 'article-update',
      id: 'p1',
      modifiedAt: null,
      next: null,
    }
    expect(
      dispatchMessage({
        type: 'POST_UPDATE',
        data: { id: 'p1', slug: '../escape', category: { slug: 'tech' } },
      }),
    ).toEqual(event)
    expect(toArticleSignal(event)).toMatchObject({ kind: 'update', id: 'p1', next: null })
  })
})

describe('live article controller', () => {
  it('只处理当前文章的事件', async () => {
    const { controller, refresh } = setup()
    controller.handleSignal({ kind: 'update', id: 'other', modifiedAt: null, next: null })
    await flush()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('同一版本的重复事件不触发请求', async () => {
    const { controller, refresh } = setup()
    controller.handleSignal({
      kind: 'update',
      id: 'post-1',
      modifiedAt: IDENTITY.modifiedAt,
      next: null,
    })
    controller.handleSignal({
      kind: 'update',
      id: 'post-1',
      modifiedAt: '2024-01-01T00:00:00.000Z',
      next: null,
    })
    await flush()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('更新成功后回调 onUpdated', async () => {
    const { controller, onUpdated } = setup()
    controller.handleSignal({
      kind: 'update',
      id: 'post-1',
      modifiedAt: '2024-03-01T00:00:00.000Z',
      next: null,
    })
    await flush()
    expect(onUpdated).toHaveBeenCalledTimes(1)
  })

  it('单飞：请求进行中再来事件只补跑一次', async () => {
    const first = deferred<RefreshOutcome>()
    const second = deferred<RefreshOutcome>()
    const refresh = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { controller, onUpdated } = setup({ refresh })

    controller.handleSignal({
      kind: 'update',
      id: 'post-1',
      modifiedAt: '2024-03-01T00:00:00.000Z',
      next: null,
    })
    controller.handleSignal({
      kind: 'update',
      id: 'post-1',
      modifiedAt: '2024-03-02T00:00:00.000Z',
      next: null,
    })
    controller.handleSignal({
      kind: 'update',
      id: 'post-1',
      modifiedAt: '2024-03-03T00:00:00.000Z',
      next: null,
    })

    expect(refresh).toHaveBeenCalledTimes(1)

    first.resolve({ status: 'updated' })
    await flush()
    expect(onUpdated).toHaveBeenCalledTimes(1)
    expect(refresh).toHaveBeenCalledTimes(2)

    second.resolve({ status: 'unchanged' })
    await flush()
    expect(onUpdated).toHaveBeenCalledTimes(1)
  })

  it('两个请求严格串行：前一次结果先应用，后一次不会与之交叉', async () => {
    const first = deferred<RefreshOutcome>()
    const second = deferred<RefreshOutcome>()
    const refresh = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { controller, onUpdated, onGone } = setup({ refresh })

    controller.handleSignal({
      kind: 'update',
      id: 'post-1',
      modifiedAt: '2024-03-01T00:00:00.000Z',
      next: null,
    })
    controller.handleSignal({
      kind: 'update',
      id: 'post-1',
      modifiedAt: '2024-03-02T00:00:00.000Z',
      next: null,
    })

    first.resolve({ status: 'updated' })
    await flush()
    expect(onUpdated).toHaveBeenCalledTimes(1)
    expect(onGone).not.toHaveBeenCalled()

    second.resolve({ status: 'gone' })
    await flush()
    expect(onGone).toHaveBeenCalledTimes(1)
  })

  it('移动到新地址时回调 onMoved', async () => {
    const { controller, onMoved, refresh } = setup({
      refresh: async () => ({ status: 'moved', path: '/articles/life/new-slug' }),
    })
    controller.handleSignal({
      kind: 'update',
      id: 'post-1',
      modifiedAt: '2024-03-01T00:00:00.000Z',
      next: { category: 'life', slug: 'new-slug' },
    })
    await flush()
    expect(refresh.mock.calls[0]?.[0].next).toEqual({ category: 'life', slug: 'new-slug' })
    expect(onMoved).toHaveBeenCalledWith('/articles/life/new-slug')
  })

  it('文章不可访问时回调 onGone 并停止后续请求', async () => {
    const { controller, onGone, refresh } = setup({
      refresh: async () => ({ status: 'gone' }),
    })
    controller.handleSignal({ kind: 'removed', id: 'post-1' })
    await flush()
    expect(onGone).toHaveBeenCalledTimes(1)
    expect(controller.isGone()).toBe(true)

    controller.check()
    await flush()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('删除事件不看 modifiedAt，直接核对', async () => {
    const { controller, refresh } = setup()
    controller.handleSignal({ kind: 'removed', id: 'post-1' })
    await flush()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('请求失败回调 onError，不抛出', async () => {
    const { controller, onError } = setup({
      refresh: async () => {
        throw new Error('boom')
      },
    })
    controller.handleSignal({ kind: 'removed', id: 'post-1' })
    await flush()
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('dispose 后不再回调，也不再发请求', async () => {
    const pending = deferred<RefreshOutcome>()
    const { controller, refresh, onUpdated } = setup({ refresh: () => pending.promise })

    controller.handleSignal({ kind: 'removed', id: 'post-1' })
    controller.dispose()
    pending.resolve({ status: 'updated' })
    await flush()

    expect(onUpdated).not.toHaveBeenCalled()
    controller.check()
    await flush()
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('check 即使没有收到事件也能核对一次（降级轮询）', async () => {
    const { controller, refresh } = setup()
    controller.check()
    await flush()
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
