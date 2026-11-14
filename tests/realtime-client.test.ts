import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acquireRealtimeClient,
  classifyConnectionError,
  createRealtimeClient,
  type RealtimeClient,
  type RealtimeClientOptions,
  type RealtimeState,
  type RealtimeTransport,
  type RealtimeTransportConfig,
  type RealtimeTransportHandlers,
} from '@/lib/realtime/client'
import type { RealtimeEvent, RealtimeRoomMessage } from '@/lib/realtime/protocol'

const ORIGIN = 'https://api.example.com'

class FakeTransport implements RealtimeTransport {
  readonly config: RealtimeTransportConfig
  lang: string
  connectCalls = 0
  disconnectCalls = 0
  bindCalls = 0
  unbindCalls = 0
  destroyed = false
  sent: RealtimeRoomMessage[] = []
  handlers: RealtimeTransportHandlers | null = null

  constructor(config: RealtimeTransportConfig) {
    this.config = config
    this.lang = config.lang
  }

  connect(): void {
    this.connectCalls += 1
  }
  disconnect(): void {
    this.disconnectCalls += 1
  }
  emitMessage(payload: RealtimeRoomMessage): void {
    this.sent.push(payload)
  }
  setLang(lang: string): void {
    this.lang = lang
  }
  bind(handlers: RealtimeTransportHandlers): void {
    if (this.handlers) return
    this.handlers = handlers
    this.bindCalls += 1
  }
  unbind(): void {
    this.handlers = null
    this.unbindCalls += 1
  }
  destroy(): void {
    this.unbind()
    this.disconnect()
    this.destroyed = true
  }

  fireConnect(): void {
    this.handlers?.onConnect()
  }
  fireDisconnect(reason = 'transport close'): void {
    this.handlers?.onDisconnect(reason)
  }
  fireMessage(raw: unknown): void {
    this.handlers?.onMessage(raw)
  }
  fireConnectError(error: Error): void {
    this.handlers?.onConnectError(error)
  }
  fireReconnectAttempt(attempt: number): void {
    this.handlers?.onReconnectAttempt(attempt)
  }
  fireReconnect(): void {
    this.handlers?.onReconnect(1)
  }
  fireReconnectFailed(): void {
    this.handlers?.onReconnectFailed()
  }
}

interface Harness {
  client: RealtimeClient
  transports: FakeTransport[]
  events: RealtimeEvent[]
  states: RealtimeState[]
  last: () => FakeTransport
}

function createHarness(overrides: Partial<RealtimeClientOptions> = {}): Harness {
  const transports: FakeTransport[] = []
  const events: RealtimeEvent[] = []
  const states: RealtimeState[] = []

  const client = createRealtimeClient({
    origin: ORIGIN,
    lang: 'zh',
    createTransport: (config) => {
      const transport = new FakeTransport(config)
      transports.push(transport)
      return transport
    },
    onEvent: (event) => events.push(event),
    onState: (state) => states.push({ ...state }),
    ...overrides,
  })

  return { client, transports, events, states, last: () => transports[transports.length - 1]! }
}

function makeOptions(): RealtimeClientOptions {
  return {
    origin: ORIGIN,
    lang: 'zh',
    onEvent: () => {},
    createTransport: (config) => new FakeTransport(config),
  }
}

afterEach(() => {
  delete (globalThis as typeof globalThis & { __folioRealtimeClient?: unknown })
    .__folioRealtimeClient
  vi.restoreAllMocks()
})

describe('realtime client 连接管理', () => {
  it('start 幂等：重复调用只连接一次、只绑定一次监听器', () => {
    const h = createHarness()
    h.client.start()
    h.client.start()
    expect(h.transports).toHaveLength(1)
    expect(h.last().connectCalls).toBe(1)
    expect(h.last().bindCalls).toBe(1)
  })

  it('start 之前不创建连接', () => {
    const h = createHarness()
    expect(h.last().connectCalls).toBe(0)
    expect(h.client.getState().status).toBe('idle')
  })

  it('工厂拿到的是 API origin 与当前语言，而不是旧 ws 地址', () => {
    const h = createHarness()
    expect(h.last().config).toEqual({ origin: ORIGIN, lang: 'zh' })
  })

  it('连接成功后状态为 online 且 attempts 归零', () => {
    const h = createHarness()
    h.client.start()
    expect(h.client.getState()).toMatchObject({ status: 'connecting', attempts: 0 })
    h.last().fireConnect()
    expect(h.client.getState()).toMatchObject({ status: 'online', attempts: 0, error: null })
  })

  it('加入房间：连接前记住，连上后用 message/join 补发', () => {
    const h = createHarness()
    const release = h.client.joinArticle('post-1')
    expect(h.last().sent).toHaveLength(0)

    h.client.start()
    h.last().fireConnect()
    expect(h.last().sent[0]).toEqual({ type: 'join', payload: { roomName: 'article-post-1' } })

    release()
    expect(h.last().sent[1]).toEqual({ type: 'leave', payload: { roomName: 'article-post-1' } })
  })

  it('连接后加入房间立即发送', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()
    h.client.joinArticle('post-2')
    expect(h.last().sent[0]).toEqual({ type: 'join', payload: { roomName: 'article-post-2' } })
  })

  it('重连成功后重新加入房间，且不会重复注册监听器', () => {
    const h = createHarness()
    h.client.start()
    h.client.joinArticle('post-1')
    h.last().fireConnect()
    h.last().fireDisconnect()
    h.last().fireReconnect()

    expect(h.last().bindCalls).toBe(1)
    expect(h.last().sent.filter((m) => m.type === 'join')).toHaveLength(2)
    expect(h.client.getState()).toMatchObject({ status: 'online', attempts: 0 })
  })

  it('断线 → reconnecting；客户端主动 disconnect 不改变状态', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()
    h.last().fireDisconnect('io client disconnect')
    expect(h.client.getState().status).toBe('online')

    h.last().fireDisconnect('transport close')
    expect(h.client.getState()).toMatchObject({ status: 'reconnecting', reason: 'network' })
  })

  it('reconnect_attempt 递增次数，reconnect 成功后归零', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireReconnectAttempt(1)
    h.last().fireReconnectAttempt(3)
    expect(h.client.getState()).toMatchObject({ status: 'reconnecting', attempts: 3 })
    h.last().fireReconnect()
    expect(h.client.getState()).toMatchObject({ status: 'online', attempts: 0 })
  })

  it('重连次数耗尽进入 offline/exhausted', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireReconnectFailed()
    expect(h.client.getState()).toMatchObject({ status: 'offline', reason: 'exhausted' })
  })

  it('pause 不重连，resume 用同一个实例重新连接', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()

    h.client.pause()
    expect(h.client.getState()).toMatchObject({ status: 'offline', reason: 'paused' })
    const before = h.states.length
    h.last().fireDisconnect('transport close')
    expect(h.states).toHaveLength(before)

    h.client.resume()
    expect(h.transports).toHaveLength(1)
    expect(h.last().connectCalls).toBe(2)
    expect(h.client.getState().status).toBe('connecting')
  })

  it('stop 之后销毁并解绑，销毁后迟到的事件不再产生状态更新', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()
    h.client.stop()

    expect(h.client.getState()).toMatchObject({ status: 'idle', reason: 'stopped' })
    expect(h.last().destroyed).toBe(true)
    const before = h.states.length
    h.last().fireMessage({ type: 'VISITOR_ONLINE', data: { online: 1 } })
    h.last().fireConnectError(new Error('late'))
    expect(h.states).toHaveLength(before)
    expect(() => h.client.start()).not.toThrow()
    expect(h.last().connectCalls).toBe(1)
  })

  it('setLang 更新握手 query 并新建会话，不新建实例也不重复绑定', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()

    h.client.setLang('en')
    expect(h.last().lang).toBe('en')
    expect(h.transports).toHaveLength(1)
    expect(h.last().bindCalls).toBe(1)
    expect(h.last().disconnectCalls).toBe(1)
    expect(h.last().connectCalls).toBe(2)
    expect(h.client.getState().status).toBe('connecting')

    h.client.setLang('en')
    expect(h.last().connectCalls).toBe(2)
  })
})

describe('realtime client 错误分类', () => {
  it('网络/传输错误保持 reconnecting，并标明 transport', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnectError(new Error('websocket error'))
    expect(h.client.getState()).toMatchObject({
      status: 'reconnecting',
      error: { kind: 'transport' },
    })
  })

  it('服务端不支持 /web namespace 是终态 error，并停止重试', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnectError(new Error('Invalid namespace'))
    expect(h.client.getState()).toMatchObject({
      status: 'error',
      error: { kind: 'unsupported-server', message: 'Invalid namespace' },
    })
    expect(h.last().disconnectCalls).toBe(1)

    // 未暂停时 resume 直接返回；已暂停时也不允许重建会话
    h.client.resume()
    expect(h.last().connectCalls).toBe(1)
    expect(h.client.getState().status).toBe('error')

    h.client.pause()
    h.client.resume()
    expect(h.last().connectCalls).toBe(1)
    expect(h.client.getState().status).not.toBe('connecting')
  })

  it('握手失败、超时、网络错误、服务端不支持可被区分', () => {
    expect(classifyConnectionError(new Error('Invalid namespace')).kind).toBe('unsupported-server')
    expect(
      classifyConnectionError(
        new Error('trying to reach a Socket.IO server in v2.x with a v3.x client'),
      ).kind,
    ).toBe('unsupported-server')
    expect(classifyConnectionError(new Error('connection timeout')).kind).toBe('timeout')
    expect(classifyConnectionError(new Error('xhr poll error')).kind).toBe('transport')
    expect(classifyConnectionError(new Error('some middleware failure')).kind).toBe('handshake')
    expect(classifyConnectionError(new Error('')).kind).toBe('unknown')
    expect(classifyConnectionError(null).kind).toBe('unknown')
  })
})

describe('realtime client 事件分发与去重', () => {
  it('message 帧被分发为类型化业务事件', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()
    h.last().fireMessage({ type: 'POST_UPDATE', data: { id: 'p1' } })
    expect(h.events).toEqual([{ kind: 'article-update', id: 'p1', modifiedAt: null, next: null }])
  })

  it('同一帧只投递一次', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()
    const frame = {
      type: 'VISITOR_ONLINE',
      data: { online: 3, timestamp: '2024-05-01T00:00:00.000Z' },
    }
    h.last().fireMessage(frame)
    h.last().fireMessage(frame)
    expect(h.events).toHaveLength(1)
  })

  it('未知事件与脏帧不打断连接、不投递', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()
    h.last().fireMessage('{oops')
    h.last().fireMessage({ v: 1, event: 'post.update' })
    h.last().fireMessage({ type: 'COMMENT_CREATE', data: {} })
    expect(h.events).toHaveLength(0)
    expect(h.client.getState().status).toBe('online')
  })

  it('重连后重复下发的事件仍被去重', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()
    const frame = { type: 'ARTICLE_READ_COUNT_UPDATE', data: { count: 9, id: 'p1', type: 'post' } }
    h.last().fireMessage(frame)
    h.last().fireDisconnect()
    h.last().fireReconnect()
    h.last().fireMessage(frame)
    expect(h.events).toHaveLength(1)
  })
})

describe('全站单例 acquireRealtimeClient', () => {
  it('相同 origin + lang 复用同一实例，不重复创建 transport', () => {
    const transports: FakeTransport[] = []
    const options = (): RealtimeClientOptions => ({
      ...makeOptions(),
      createTransport: (config) => {
        const transport = new FakeTransport(config)
        transports.push(transport)
        return transport
      },
    })

    const a = acquireRealtimeClient(options())
    const b = acquireRealtimeClient(options())
    expect(a.client).toBe(b.client)
    a.client.start()
    b.client.start()
    expect(transports).toHaveLength(1)
    expect(transports[0]!.connectCalls).toBe(1)

    expect(a.release()).toBe(false)
    expect(transports[0]!.destroyed).toBe(false)
    expect(b.release()).toBe(true)
    expect(transports[0]!.destroyed).toBe(true)
  })

  it('语言变化时先停止旧实例，不同时留两条连接', () => {
    const transports: FakeTransport[] = []
    const options = (lang: 'zh' | 'en'): RealtimeClientOptions => ({
      ...makeOptions(),
      lang,
      createTransport: (config) => {
        const transport = new FakeTransport(config)
        transports.push(transport)
        return transport
      },
    })

    const a = acquireRealtimeClient(options('zh'))
    a.client.start()
    const b = acquireRealtimeClient(options('en'))
    expect(transports).toHaveLength(2)
    expect(transports[0]!.destroyed).toBe(true)
    expect(a.client.getState().status).toBe('idle')
    expect(b.client.getState().status).toBe('idle')
    b.release()
    a.release()
  })
})
