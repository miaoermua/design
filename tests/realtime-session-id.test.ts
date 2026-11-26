// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRealtimeSessionId, resetRealtimeSessionFallback } from '@/lib/realtime/session-id'

const KEY = 'folio:realtime-session'
const SAFE = /^[A-Za-z0-9_-]{8,64}$/

beforeEach(() => {
  window.localStorage.clear()
  resetRealtimeSessionFallback()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('实时会话 id', () => {
  it('首次生成后写入 localStorage，后续调用保持同一个值', () => {
    const first = getRealtimeSessionId()
    expect(first).toBeTruthy()
    expect(first).toMatch(SAFE)
    expect(window.localStorage.getItem(KEY)).toBe(first)
    expect(getRealtimeSessionId()).toBe(first)
  })

  it('已经存过的值直接复用（跨标签页、跨刷新都是同一个会话）', () => {
    window.localStorage.setItem(KEY, 'session-abcdefgh')
    expect(getRealtimeSessionId()).toBe('session-abcdefgh')
  })

  it('存储里是脏值时覆盖成新的合法 id，不会把脏值带到握手 query 里', () => {
    window.localStorage.setItem(KEY, '../../etc/passwd')
    const id = getRealtimeSessionId()
    expect(id).toMatch(SAFE)
    expect(window.localStorage.getItem(KEY)).toBe(id)
  })

  it('存储不可用（隐私模式）时退回页面内稳定 id，不让连接崩掉', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })

    const first = getRealtimeSessionId()
    expect(first).toMatch(SAFE)
    // 同一页面内必须稳定：每次重连换 id 会让 core 认为来了新访客
    expect(getRealtimeSessionId()).toBe(first)
  })
})
