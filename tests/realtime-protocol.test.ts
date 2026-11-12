import { describe, expect, it } from 'vitest'
import {
  articleRoom,
  buildEnvelope,
  isSafeId,
  isSafeSlug,
  parseEnvelope,
  REALTIME_PROTOCOL_VERSION,
  readModifiedAt,
  readPostIdFromPayload,
} from '@/lib/realtime/protocol'

describe('parseEnvelope', () => {
  it('解析合法的信封', () => {
    const parsed = parseEnvelope(
      JSON.stringify({ v: 1, event: 'post.update', payload: { id: '1' }, id: 'req-1' }),
    )
    expect(parsed).toEqual({ v: 1, event: 'post.update', payload: { id: '1' }, id: 'req-1' })
  })

  it('脏帧一律返回 null，不抛错', () => {
    expect(parseEnvelope('')).toBeNull()
    expect(parseEnvelope('not json')).toBeNull()
    expect(parseEnvelope('null')).toBeNull()
    expect(parseEnvelope('[]')).toBeNull()
    expect(parseEnvelope(JSON.stringify({ v: 1 }))).toBeNull()
    expect(parseEnvelope(JSON.stringify({ v: 1, event: '' }))).toBeNull()
    expect(parseEnvelope(123)).toBeNull()
  })

  it('协议版本不匹配时丢弃', () => {
    expect(parseEnvelope(JSON.stringify({ v: 2, event: 'post.update' }))).toBeNull()
  })

  it('只保留非空的字符串 id', () => {
    expect(parseEnvelope(JSON.stringify({ v: 1, event: 'ack', id: '' }))).toEqual({
      v: 1,
      event: 'ack',
    })
    expect(parseEnvelope(JSON.stringify({ v: 1, event: 'ack', id: 7 }))).toEqual({
      v: 1,
      event: 'ack',
    })
  })

  it('没有 payload 时不伪造空对象', () => {
    expect(parseEnvelope(JSON.stringify({ v: 1, event: 'ping' }))).not.toHaveProperty('payload')
  })
})

describe('buildEnvelope', () => {
  it('带上当前协议版本', () => {
    expect(buildEnvelope('room.join', { room: 'article-1' })).toEqual({
      v: REALTIME_PROTOCOL_VERSION,
      event: 'room.join',
      payload: { room: 'article-1' },
    })
  })

  it('undefined 字段不输出', () => {
    expect(buildEnvelope('ping')).toEqual({ v: 1, event: 'ping' })
  })
})

describe('articleRoom', () => {
  it('房间名带 core 要求的 article- 前缀', () => {
    expect(articleRoom('abc')).toBe('article-abc')
  })
})

describe('readPostIdFromPayload', () => {
  it('post.delete 的 payload 是 id 字符串', () => {
    expect(readPostIdFromPayload('post-1')).toBe('post-1')
  })

  it('post.update 的 payload 是文章对象', () => {
    expect(readPostIdFromPayload({ id: 'post-2' })).toBe('post-2')
  })

  it('数字 id 转成字符串', () => {
    expect(readPostIdFromPayload({ id: 42 })).toBe('42')
  })

  it('不合法输入返回 null', () => {
    expect(readPostIdFromPayload(null)).toBeNull()
    expect(readPostIdFromPayload('')).toBeNull()
    expect(readPostIdFromPayload('带 空格')).toBeNull()
    expect(readPostIdFromPayload({})).toBeNull()
    expect(readPostIdFromPayload({ id: { nested: true } })).toBeNull()
  })
})

describe('readModifiedAt', () => {
  it('读取 modifiedAt', () => {
    expect(readModifiedAt({ modifiedAt: '2024-05-01T00:00:00.000Z' })).toBe(
      '2024-05-01T00:00:00.000Z',
    )
  })

  it('兼容 updatedAt', () => {
    expect(readModifiedAt({ updatedAt: '2024-05-02T00:00:00.000Z' })).toBe(
      '2024-05-02T00:00:00.000Z',
    )
  })

  it('解析不了的时间当作没有', () => {
    expect(readModifiedAt({ modifiedAt: 'yesterday' })).toBeNull()
    expect(readModifiedAt({ modifiedAt: '' })).toBeNull()
    expect(readModifiedAt(null)).toBeNull()
  })
})

describe('字符集校验', () => {
  it('slug 只接受保守字符集', () => {
    expect(isSafeSlug('hello-world_2')).toBe(true)
    expect(isSafeSlug('-leading')).toBe(false)
    expect(isSafeSlug('with space')).toBe(false)
    expect(isSafeSlug('../etc/passwd')).toBe(false)
    expect(isSafeSlug(undefined)).toBe(false)
  })

  it('id 接受数字与 UUID', () => {
    expect(isSafeId('123')).toBe(true)
    expect(isSafeId('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true)
    expect(isSafeId('a/b')).toBe(false)
    expect(isSafeId('')).toBe(false)
  })
})
