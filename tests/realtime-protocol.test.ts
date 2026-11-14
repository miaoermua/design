import { describe, expect, it } from 'vitest'
import {
  REALTIME_ENGINE_PATH,
  REALTIME_MESSAGE_EVENT,
  REALTIME_NAMESPACE_PATH,
  RealtimeEventTypes,
  articleRoom,
  dispatchMessage,
  eventKey,
  isSafeId,
  isSafeSlug,
  parseMessage,
  readArticleLocation,
  readCountKey,
  readModifiedAt,
  readPostIdFromPayload,
} from '@/lib/realtime/protocol'

const message = (type: string, data: unknown) => ({ type, data, code: undefined })

describe('协议常量', () => {
  it('Engine.IO path / namespace / 事件名三者互不混淆', () => {
    expect(REALTIME_ENGINE_PATH).toBe('/socket.io/')
    expect(REALTIME_NAMESPACE_PATH).toBe('/web')
    expect(REALTIME_MESSAGE_EVENT).toBe('message')
  })

  it('事件名是 Core v12 的 BusinessEvents，不是 v17 的 post.*', () => {
    expect(RealtimeEventTypes.postUpdate).toBe('POST_UPDATE')
    expect(RealtimeEventTypes.postDelete).toBe('POST_DELETE')
    expect(RealtimeEventTypes.visitorOnline).toBe('VISITOR_ONLINE')
    expect(RealtimeEventTypes.articleReadCountUpdate).toBe('ARTICLE_READ_COUNT_UPDATE')
  })
})

describe('parseMessage', () => {
  it('解析合法的 { type, data, code }', () => {
    expect(parseMessage({ type: 'POST_UPDATE', data: { id: '1' }, code: 0 })).toEqual({
      type: 'POST_UPDATE',
      data: { id: '1' },
      code: 0,
    })
  })

  it('脏帧一律返回 null，不抛错', () => {
    expect(parseMessage('')).toBeNull()
    expect(parseMessage('not json')).toBeNull()
    expect(parseMessage(null)).toBeNull()
    expect(parseMessage(123)).toBeNull()
    expect(parseMessage([])).toBeNull()
    expect(parseMessage({})).toBeNull()
    expect(parseMessage({ type: '' })).toBeNull()
    expect(parseMessage({ type: 7 })).toBeNull()
  })

  it('只保留有限数值的 code，没有 data 也不伪造', () => {
    expect(parseMessage({ type: 'X', code: Number.NaN })).toEqual({ type: 'X', data: undefined })
    expect(parseMessage({ type: 'X', code: '500' })).toEqual({ type: 'X', data: undefined })
    expect(parseMessage({ type: 'X' })).not.toHaveProperty('code')
  })
})

describe('dispatchMessage（按 type 分发 + 结构校验）', () => {
  it('GATEWAY_CONNECT 只带问候文本', () => {
    expect(dispatchMessage(message('GATEWAY_CONNECT', 'WebSocket 已连接'))).toEqual({
      kind: 'gateway-connect',
      greeting: 'WebSocket 已连接',
    })
    expect(dispatchMessage(message('GATEWAY_CONNECT', { foo: 1 }))).toEqual({
      kind: 'gateway-connect',
      greeting: null,
    })
  })

  it('POST_UPDATE 校验 id、时间与新地址线索', () => {
    expect(
      dispatchMessage(
        message('POST_UPDATE', {
          id: 'post-1',
          modifiedAt: '2024-03-01T00:00:00.000Z',
          slug: 'new-slug',
          category: { slug: 'life' },
        }),
      ),
    ).toEqual({
      kind: 'article-update',
      id: 'post-1',
      modifiedAt: '2024-03-01T00:00:00.000Z',
      next: { category: 'life', slug: 'new-slug' },
    })
  })

  it('POST_UPDATE 缺少合法 id 时丢弃', () => {
    expect(dispatchMessage(message('POST_UPDATE', {}))).toBeNull()
    expect(dispatchMessage(message('POST_UPDATE', null))).toBeNull()
    expect(dispatchMessage(message('POST_UPDATE', { id: 'a/b' }))).toBeNull()
  })

  it('POST_UPDATE 的非法 slug 不进入 next', () => {
    expect(
      dispatchMessage(
        message('POST_UPDATE', { id: 'p1', slug: '../escape', category: { slug: 'tech' } }),
      ),
    ).toMatchObject({ kind: 'article-update', id: 'p1', next: null })
  })

  it('POST_DELETE 的 data 是 id 字符串', () => {
    expect(dispatchMessage(message('POST_DELETE', 'p3'))).toEqual({
      kind: 'article-removed',
      id: 'p3',
    })
    expect(dispatchMessage(message('POST_DELETE', { id: 'p3' }))).toBeNull()
    expect(dispatchMessage(message('POST_DELETE', '../etc'))).toBeNull()
  })

  it('VISITOR_ONLINE / VISITOR_OFFLINE 校验 online 为有限非负整数', () => {
    const data = { online: 12, timestamp: '2024-05-01T00:00:00.000Z' }
    expect(dispatchMessage(message('VISITOR_ONLINE', data))).toEqual({
      kind: 'visitor-online',
      online: 12,
      timestamp: '2024-05-01T00:00:00.000Z',
    })
    expect(dispatchMessage(message('VISITOR_OFFLINE', data))).toEqual({
      kind: 'visitor-offline',
      online: 12,
      timestamp: '2024-05-01T00:00:00.000Z',
    })
    expect(dispatchMessage(message('VISITOR_ONLINE', { online: '12' }))).toBeNull()
    expect(dispatchMessage(message('VISITOR_ONLINE', { online: -1 }))).toBeNull()
    expect(dispatchMessage(message('VISITOR_ONLINE', { online: 1.5 }))).toBeNull()
    expect(dispatchMessage(message('VISITOR_ONLINE', null))).toBeNull()
  })

  it('在线人数的时间戳不可解析时降级为 null，不丢事件', () => {
    expect(
      dispatchMessage(message('VISITOR_ONLINE', { online: 3, timestamp: 'yesterday' })),
    ).toEqual({ kind: 'visitor-online', online: 3, timestamp: null })
  })

  it('ARTICLE_READ_COUNT_UPDATE 正确关联 id 与文章类型', () => {
    expect(
      dispatchMessage(message('ARTICLE_READ_COUNT_UPDATE', { count: 42, id: 'p1', type: 'post' })),
    ).toEqual({
      kind: 'read-count-update',
      articleType: 'post',
      id: 'p1',
      count: 42,
    })
    expect(
      dispatchMessage(message('ARTICLE_READ_COUNT_UPDATE', { count: 7, id: 'n1', type: 'note' })),
    ).toMatchObject({ articleType: 'note', id: 'n1', count: 7 })
    expect(
      dispatchMessage(message('ARTICLE_READ_COUNT_UPDATE', { count: 9, id: 'g1', type: 'page' })),
    ).toMatchObject({ articleType: 'page', id: 'g1', count: 9 })
  })

  it('阅读数事件的非法 type / id / count 一律丢弃', () => {
    expect(
      dispatchMessage(message('ARTICLE_READ_COUNT_UPDATE', { count: 1, id: 'p1', type: 'other' })),
    ).toBeNull()
    expect(
      dispatchMessage(message('ARTICLE_READ_COUNT_UPDATE', { count: 1, id: 'a/b', type: 'post' })),
    ).toBeNull()
    expect(
      dispatchMessage(message('ARTICLE_READ_COUNT_UPDATE', { count: '1', id: 'p1', type: 'post' })),
    ).toBeNull()
    expect(
      dispatchMessage(message('ARTICLE_READ_COUNT_UPDATE', { count: -5, id: 'p1', type: 'post' })),
    ).toBeNull()
    expect(dispatchMessage(message('ARTICLE_READ_COUNT_UPDATE', null))).toBeNull()
  })

  it('未知 / 旧协议事件安全忽略，不会让分发器崩溃', () => {
    expect(dispatchMessage(message('COMMENT_CREATE', { id: 'p1' }))).toBeNull()
    expect(dispatchMessage(message('post.update', { id: 'p1' }))).toBeNull()
    expect(dispatchMessage(message('ack', { id: 'p1' }))).toBeNull()
    expect(dispatchMessage({ v: 1, event: 'post.update' })).toBeNull()
    expect(() =>
      dispatchMessage({
        type: 'POST_UPDATE',
        data: {
          get id() {
            throw new Error('boom')
          },
        },
      }),
    ).not.toThrow()
  })

  it('去重键区分文章类型与 id', () => {
    const a = dispatchMessage(
      message('ARTICLE_READ_COUNT_UPDATE', { count: 1, id: 'x', type: 'post' }),
    )!
    const b = dispatchMessage(
      message('ARTICLE_READ_COUNT_UPDATE', { count: 1, id: 'x', type: 'note' }),
    )!
    expect(eventKey(a)).not.toBe(eventKey(b))
    expect(eventKey(a)).toBe(`read-count-update:post:x:1`)
    expect(readCountKey('post', 'x')).toBe('post:x')
  })
})

describe('辅助函数', () => {
  it('articleRoom 用 core 的 article- 前缀', () => {
    expect(articleRoom('abc')).toBe('article-abc')
  })

  it('readPostIdFromPayload 接受对象 id 与数字 id', () => {
    expect(readPostIdFromPayload({ id: 'post-2' })).toBe('post-2')
    expect(readPostIdFromPayload({ id: 42 })).toBe('42')
    expect(readPostIdFromPayload('post-1')).toBe('post-1')
    expect(readPostIdFromPayload({})).toBeNull()
    expect(readPostIdFromPayload('带 空格')).toBeNull()
  })

  it('readModifiedAt 兼容 updatedAt，脏值返回 null', () => {
    expect(readModifiedAt({ modifiedAt: '2024-05-01T00:00:00.000Z' })).toBe(
      '2024-05-01T00:00:00.000Z',
    )
    expect(readModifiedAt({ updatedAt: '2024-05-02T00:00:00.000Z' })).toBe(
      '2024-05-02T00:00:00.000Z',
    )
    expect(readModifiedAt({ modifiedAt: 'yesterday' })).toBeNull()
    expect(readModifiedAt(null)).toBeNull()
  })

  it('readArticleLocation 只接受保守 slug', () => {
    expect(readArticleLocation({ slug: 'hello', category: { slug: 'tech' } })).toEqual({
      category: 'tech',
      slug: 'hello',
    })
    expect(readArticleLocation({ slug: '../etc', category: { slug: 'tech' } })).toBeNull()
    expect(readArticleLocation(null)).toBeNull()
  })

  it('字符集校验', () => {
    expect(isSafeSlug('hello-world_2')).toBe(true)
    expect(isSafeSlug('-leading')).toBe(false)
    expect(isSafeSlug('with space')).toBe(false)
    expect(isSafeSlug('../etc/passwd')).toBe(false)
    expect(isSafeId('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true)
    expect(isSafeId('a/b')).toBe(false)
  })
})
