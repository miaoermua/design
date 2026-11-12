import { describe, expect, it } from 'vitest'
import {
  createRealtimeClient,
  type RealtimeSocket,
  type RealtimeState,
  type RealtimeTimers,
} from '@/lib/realtime/client'
import type { RealtimeEnvelope } from '@/lib/realtime/protocol'

class FakeSocket implements RealtimeSocket {
  readyState = 0
  sent: string[] = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.readyState = 3
    this.onclose?.()
  }

  open(): void {
    this.readyState = 1
    this.onopen?.()
  }

  deliver(envelope: RealtimeEnvelope | string): void {
    this.onmessage?.({ data: typeof envelope === 'string' ? envelope : JSON.stringify(envelope) })
  }
}

function createHarness(options: { maxAttempts?: number } = {}) {
  const sockets: FakeSocket[] = []
  const states: RealtimeState[] = []
  const events: RealtimeEnvelope[] = []

  let clock = 0
  let seq = 0
  const timeouts = new Map<number, () => void>()
  const intervals = new Map<number, () => void>()

  const timers: RealtimeTimers = {
    setTimeout: (handler) => {
      const id = ++seq
      timeouts.set(id, handler)
      return id
    },
    clearTimeout: (handle) => {
      timeouts.delete(handle as number)
    },
    setInterval: (handler) => {
      const id = ++seq
      intervals.set(id, handler)
      return id
    },
    clearInterval: (handle) => {
      intervals.delete(handle as number)
    },
  }

  const client = createRealtimeClient({
    url: 'wss://example.com/ws/web',
    createSocket: (url) => {
      const socket = new FakeSocket(url)
      sockets.push(socket)
      return socket
    },
    timers,
    random: () => 0.5,
    now: () => clock,
    onEvent: (envelope) => events.push(envelope),
    onState: (state) => states.push(state),
    baseDelayMs: 1_000,
    maxDelayMs: 8_000,
    heartbeatIntervalMs: 25_000,
    heartbeatTimeoutMs: 60_000,
    maxAttempts: options.maxAttempts ?? 0,
  })

  return {
    client,
    sockets,
    states,
    events,
    last: () => sockets[sockets.length - 1]!,
    advance: (ms: number) => {
      clock += ms
    },
    runTimeouts: () => {
      for (const [id, handler] of [...timeouts]) {
        timeouts.delete(id)
        handler()
      }
    },
    runIntervals: () => {
      for (const handler of intervals.values()) handler()
    },
    pendingTimeouts: () => timeouts.size,
    pendingIntervals: () => intervals.size,
  }
}

describe('realtime client 连接管理', () => {
  it('start 幂等：重复调用只有一条连接', () => {
    const h = createHarness()
    h.client.start()
    h.client.start()
    expect(h.sockets).toHaveLength(1)
  })

  it('只注入 socket factory，start 之前不会碰浏览器 WebSocket', () => {
    const h = createHarness()
    expect(h.sockets).toHaveLength(0)
    h.client.start()
    expect(h.sockets).toHaveLength(1)
  })

  it('握手地址带 lang 参数', () => {
    const h = createHarness()
    h.client.setLang('en')
    h.client.start()
    expect(h.last().url).toBe('wss://example.com/ws/web?lang=en')
  })

  it('连接成功后状态为 online 且 attempts 归零', () => {
    const h = createHarness()
    h.client.start()
    expect(h.client.getState().status).toBe('connecting')
    h.last().open()
    expect(h.client.getState()).toMatchObject({ status: 'online', attempts: 0, retryInMs: null })
  })

  it('加入房间：连接前记住，连接后补发', () => {
    const h = createHarness()
    const release = h.client.joinArticle('post-1')
    expect(h.sockets).toHaveLength(0)

    h.client.start()
    h.last().open()
    expect(JSON.parse(h.last().sent[0]!)).toEqual({
      v: 1,
      event: 'room.join',
      payload: { room: 'article-post-1' },
    })

    release()
    expect(JSON.parse(h.last().sent[1]!)).toEqual({
      v: 1,
      event: 'room.leave',
      payload: { room: 'article-post-1' },
    })
  })

  it('连接后加入房间立即发送', () => {
    const h = createHarness()
    h.client.start()
    h.last().open()
    h.client.joinArticle('post-2')
    expect(JSON.parse(h.last().sent[0]!).payload).toEqual({ room: 'article-post-2' })
  })

  it('断开后按 equal jitter 退避重连，并在重连后重新加入房间', () => {
    const h = createHarness()
    h.client.start()
    h.client.joinArticle('post-1')
    h.last().open()

    h.last().close()

    const state = h.client.getState()
    expect(state.status).toBe('reconnecting')
    expect(state.attempts).toBe(1)
    // cap = 1000，equal jitter 且 random 固定 0.5 → 750ms
    expect(state.retryInMs).toBe(750)

    h.runTimeouts()
    expect(h.sockets).toHaveLength(2)
    h.last().open()
    expect(JSON.parse(h.last().sent[0]!).payload).toEqual({ room: 'article-post-1' })
    expect(h.client.getState().attempts).toBe(0)
  })

  it('重连延迟有上限', () => {
    const h = createHarness()
    h.client.start()

    for (let index = 0; index < 6; index += 1) {
      h.last().close()
      h.advance(h.client.getState().retryInMs ?? 0)
      h.runTimeouts()
    }

    h.last().close()
    // cap 被封顶在 8s，抖动后最大不超过 8s
    expect(h.client.getState().retryInMs).toBeLessThanOrEqual(8_000)
  })

  it('stop 之后不再重连，状态回到 idle', () => {
    const h = createHarness()
    h.client.start()
    h.last().open()
    h.client.stop()
    expect(h.client.getState()).toMatchObject({ status: 'idle', reason: 'stopped' })
    expect(h.pendingTimeouts()).toBe(0)
    expect(h.pendingIntervals()).toBe(0)
    expect(h.sockets).toHaveLength(1)
  })

  it('pause 不重连，resume 重新连上', () => {
    const h = createHarness()
    h.client.start()
    h.last().open()

    h.client.pause()
    expect(h.client.getState()).toMatchObject({ status: 'offline', reason: 'paused' })
    expect(h.pendingTimeouts()).toBe(0)

    h.client.resume()
    expect(h.sockets).toHaveLength(2)
    expect(h.client.getState().status).toBe('connecting')
  })

  it('达到最大尝试次数后停止并标记 exhausted', () => {
    const h = createHarness({ maxAttempts: 1 })
    h.client.start()
    h.last().close()
    expect(h.client.getState().status).toBe('reconnecting')

    h.runTimeouts()
    h.last().close()
    expect(h.client.getState()).toMatchObject({ status: 'offline', reason: 'exhausted' })
  })
})

describe('realtime client 事件与心跳', () => {
  it('同一帧只投递一次', () => {
    const h = createHarness()
    h.client.start()
    h.last().open()

    const frame = { v: 1, event: 'post.update', payload: { id: 'p1' }, id: 'evt-1' }
    h.last().deliver(frame)
    h.last().deliver(frame)

    expect(h.events).toHaveLength(1)
  })

  it('没有 id 的帧按 event + 文章 id + modifiedAt 去重', () => {
    const h = createHarness()
    h.client.start()
    h.last().open()

    const frame = {
      v: 1,
      event: 'post.update',
      payload: { id: 'p1', modifiedAt: '2024-01-01T00:00:00.000Z' },
    }
    h.last().deliver(frame)
    h.last().deliver(frame)

    expect(h.events).toHaveLength(1)
  })

  it('脏帧不会打断连接', () => {
    const h = createHarness()
    h.client.start()
    h.last().open()

    h.last().deliver('{oops')
    expect(h.client.getState().status).toBe('online')
    expect(h.events).toHaveLength(0)
  })

  it('发应用层 ping，收到任何帧都算活着', () => {
    const h = createHarness()
    h.client.start()
    h.last().open()

    h.advance(20_000)
    h.last().deliver({ v: 1, event: 'gateway.connect' })
    h.runIntervals()

    const ping = JSON.parse(h.last().sent[h.last().sent.length - 1]!)
    expect(ping.event).toBe('ping')
    expect(typeof ping.id).toBe('string')
  })

  it('长时间没有任何帧即判定连接已死并重连', () => {
    const h = createHarness()
    h.client.start()
    h.last().open()

    h.advance(61_000)
    h.runIntervals()

    expect(h.last().closed).toBe(true)
    expect(h.client.getState().status).toBe('reconnecting')
  })
})
