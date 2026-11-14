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
    h.last().fireConnect()

    expect(h.last().bindCalls).toBe(1)
    expect(h.last().sent.filter((m) => m.type === 'join')).toHaveLength(2)
    expect(h.client.getState()).toMatchObject({ status: 'online', attempts: 0 })
  })

  it('真实重连顺序（Manager reconnect 先于 namespace connect）每个房间只 join 一次', () => {
    const h = createHarness()
    const joinCount = () => h.last().sent.filter((m) => m.type === 'join').length

    h.client.start()
    h.client.joinArticle('post-1')
    h.last().fireConnect()
    expect(joinCount()).toBe(1)

    h.last().fireDisconnect('transport close')
    h.last().fireReconnectAttempt(1)
    // Socket.IO 的实际顺序：Manager 先发 reconnect，namespace 随后才发 connect
    h.last().fireReconnect()
    h.last().fireConnect()

    expect(joinCount()).toBe(2)
    expect(h.client.getState()).toMatchObject({ status: 'online', attempts: 0 })
  })

  it('多个房间在每次重连成功后各补一次 join', () => {
    const h = createHarness()
    const joinsOf = (room: string) =>
      h.last().sent.filter((m) => m.type === 'join' && m.payload.roomName === room).length

    h.client.start()
    h.client.joinArticle('post-1')
    h.client.joinArticle('post-2')
    h.last().fireConnect()

    h.last().fireDisconnect('ping timeout')
    h.last().fireReconnect()
    h.last().fireConnect()

    expect(joinsOf('article-post-1')).toBe(2)
    expect(joinsOf('article-post-2')).toBe(2)
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

  it('reconnect_attempt 递增次数；Manager reconnect 只清计数，online 由 namespace connect 收口', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireReconnectAttempt(1)
    h.last().fireReconnectAttempt(3)
    expect(h.client.getState()).toMatchObject({ status: 'reconnecting', attempts: 3 })
    h.last().fireReconnect()
    // 传输层已恢复，但 /web 会话还没建立：不提前宣布 online
    expect(h.client.getState()).toMatchObject({ status: 'reconnecting', attempts: 0 })
    h.last().fireConnect()
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

  it('销毁后的 joinArticle 是空操作，不再写连接', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()
    h.client.stop()
    const sent = h.last().sent.length

    const release = h.client.joinArticle('post-1')
    release()
    expect(h.last().sent).toHaveLength(sent)
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

describe('realtime client 断开原因', () => {
  const joining = (h: Harness) => h.last().sent.filter((m) => m.type === 'join').length

  it.each(['ping timeout', 'transport close', 'transport error', 'parse error'])(
    '%s 由 Manager 自动重连，状态为 reconnecting',
    (reason) => {
      const h = createHarness()
      h.client.start()
      h.last().fireConnect()
      h.last().fireDisconnect(reason)
      expect(h.client.getState()).toMatchObject({ status: 'reconnecting', reason: 'network' })
    },
  )

  it('io server disconnect：不谎称正在重试，只有显式 resume 才重建会话', () => {
    const h = createHarness()
    h.client.start()
    h.client.joinArticle('post-1')
    h.last().fireConnect()
    expect(joining(h)).toBe(1)

    h.last().fireDisconnect('io server disconnect')
    expect(h.client.getState()).toMatchObject({ status: 'offline', reason: 'server-closed' })
    // 没有进入重连流程，就不该补发 join
    expect(joining(h)).toBe(1)

    // 服务端主动断开后 Manager 不会自动重连，恢复只能靠显式 resume
    h.client.resume()
    expect(h.last().connectCalls).toBe(2)
    expect(h.client.getState().status).toBe('connecting')

    // 重复 resume 不会多连一次
    h.client.resume()
    expect(h.last().connectCalls).toBe(2)

    h.last().fireConnect()
    expect(joining(h)).toBe(2)
  })

  it('forced close 与未知原因按「会话已关闭」处理，不显示不会发生的重试', () => {
    for (const reason of ['forced close', 'some unknown reason']) {
      const h = createHarness()
      h.client.start()
      h.last().fireConnect()
      h.last().fireDisconnect(reason)
      expect(h.client.getState()).toMatchObject({ status: 'offline', reason: 'server-closed' })
    }
  })

  it('server-closed 之后仍可 pause / resume，且不会被当成网络重连', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()
    h.last().fireDisconnect('io server disconnect')

    h.client.pause()
    expect(h.client.getState()).toMatchObject({ status: 'offline', reason: 'paused' })
    h.client.resume()
    expect(h.last().connectCalls).toBe(2)
    expect(h.client.getState().status).toBe('connecting')
  })

  it('客户端主动断开不改变状态，也不触发重连状态', () => {
    const h = createHarness()
    h.client.start()
    h.last().fireConnect()
    const before = h.states.length
    h.last().fireDisconnect('io client disconnect')
    expect(h.states).toHaveLength(before)
    expect(h.client.getState().status).toBe('online')
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

  it('优先用 Engine.IO 的结构化 type，而不是只靠文本', () => {
    const transportError = Object.assign(new Error('websocket error'), { type: 'TransportError' })
    expect(classifyConnectionError(transportError).kind).toBe('transport')
    // 结构化信息与文本冲突时以结构为准：不会被当成服务端不兼容
    const misleading = Object.assign(new Error('something odd'), { type: 'TransportError' })
    expect(classifyConnectionError(misleading).kind).toBe('transport')
  })

  it('普通网络错误不会被误判成服务端不兼容', () => {
    const samples = [
      'Failed to fetch',
      'NetworkError when attempting to fetch resource.',
      "WebSocket connection to 'wss://api.example.com/socket.io/' failed",
      'connect ECONNREFUSED 127.0.0.1:3000',
      'getaddrinfo ENOTFOUND api.example.com',
    ]
    for (const message of samples) {
      expect(classifyConnectionError(new Error(message)).kind).toBe('transport')
    }
  })

  it('只有已核实的文案才升级成 unsupported-server', () => {
    // 宽泛的 "not compatible" 不足以判定服务端不具备能力
    expect(classifyConnectionError(new Error('this browser is not compatible')).kind).toBe(
      'handshake',
    )
    expect(classifyConnectionError(new Error('namespace is not found in config')).kind).toBe(
      'handshake',
    )
  })

  it('服务端把信息放在 data 上时仍能分类并保留原文', () => {
    const error = Object.assign(new Error(''), { data: 'Invalid namespace' })
    expect(classifyConnectionError(error)).toMatchObject({
      kind: 'unsupported-server',
      message: 'Invalid namespace',
    })
  })

  it('无法归因的错误保持 handshake / unknown，不猜测', () => {
    expect(classifyConnectionError(new Error('unauthorized')).kind).toBe('handshake')
    expect(classifyConnectionError(undefined).kind).toBe('unknown')
    expect(classifyConnectionError(42).kind).toBe('handshake')
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

    // 旧实例已被替换并停止：它的 release() 不能报告「已停掉当前共享连接」，
    // 否则宿主会误把新会话的 room 订阅摘掉
    expect(a.release()).toBe(false)
    expect(b.release()).toBe(true)
    expect(transports[1]!.destroyed).toBe(true)
  })
})
