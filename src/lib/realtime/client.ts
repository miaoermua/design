/**
 * 实时连接状态机
 *
 * 设计约束（与 core 的网关行为一致）：
 * - 一个页面只允许一条连接：`start()` 幂等，重复调用不会新建连接。
 * - 断开后按指数退避重连，且带抖动；不设上限的「立即重连」会打满后端的握手。
 * - 断线期间的房间订阅先记在本地，重连成功后自动重新加入。
 * - 心跳用应用层 `ping`（带 id，服务端才会回 `ack`），超时无帧即判定连接已死。
 * - 浏览器 API（WebSocket / 定时器 / document）全部通过构造参数注入，
 *   这样状态机可以在 Node 里跑测试，也不会在 SSR 阶段碰到 `window`。
 */

import {
  articleRoom as toArticleRoom,
  buildEnvelope,
  parseEnvelope,
  RealtimeEvents,
  RealtimeInboundEvents,
  readModifiedAt,
  readPostIdFromPayload,
  type RealtimeEnvelope,
} from './protocol'

export type RealtimeStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline'

export type RealtimeOfflineReason = 'network' | 'exhausted' | 'paused' | 'stopped'

export interface RealtimeState {
  status: RealtimeStatus
  /** 连续失败次数，连接成功后归零 */
  attempts: number
  /** 距离下一次重试的毫秒数；非等待状态为 null */
  retryInMs: number | null
  reason: RealtimeOfflineReason | null
}

/** 只依赖 WebSocket 里用到的成员，便于用假实现替换 */
export interface RealtimeSocket {
  readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: (() => void) | null
  onmessage: ((event: { data: unknown }) => void) | null
  onclose: (() => void) | null
  onerror: (() => void) | null
}

export type RealtimeSocketFactory = (url: string) => RealtimeSocket

export interface RealtimeTimers {
  setTimeout: (handler: () => void, timeout: number) => unknown
  clearTimeout: (handle: unknown) => void
  setInterval: (handler: () => void, timeout: number) => unknown
  clearInterval: (handle: unknown) => void
}

export interface RealtimeClientOptions {
  url: string
  onEvent: (envelope: RealtimeEnvelope) => void
  onState?: (state: RealtimeState) => void
  createSocket?: RealtimeSocketFactory
  timers?: RealtimeTimers
  random?: () => number
  now?: () => number
  /** 首次重试延迟，默认 1000ms */
  baseDelayMs?: number
  /** 重试延迟上限，默认 30s */
  maxDelayMs?: number
  /** 心跳间隔，默认 25s（core 自身 30s 一次协议层 ping） */
  heartbeatIntervalMs?: number
  /** 多久收不到任何帧就认为连接已死，默认 60s */
  heartbeatTimeoutMs?: number
  /** 最多尝试重连次数；0 表示不限（默认） */
  maxAttempts?: number
  /** 去重窗口大小，默认 64 */
  dedupeWindow?: number
}

const OPEN = 1

export interface RealtimeClient {
  start(): void
  stop(): void
  pause(): void
  resume(): void
  joinArticle(articleId: string): () => void
  getState(): RealtimeState
  setLang(lang: string): void
}

export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const {
    url,
    onEvent,
    onState,
    baseDelayMs = 1_000,
    maxDelayMs = 30_000,
    heartbeatIntervalMs = 25_000,
    heartbeatTimeoutMs = 60_000,
    maxAttempts = 0,
    dedupeWindow = 64,
  } = options

  const timers: RealtimeTimers = options.timers ?? {
    setTimeout: (handler, timeout) => globalThis.setTimeout(handler, timeout),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
    setInterval: (handler, timeout) => globalThis.setInterval(handler, timeout),
    clearInterval: (handle) =>
      globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
  }
  const random = options.random ?? Math.random
  const now = options.now ?? Date.now

  const rooms = new Set<string>()
  const seen = new Set<string>()
  const seenOrder: string[] = []

  const createSocket: RealtimeSocketFactory = options.createSocket ?? defaultSocketFactory
  let socket: RealtimeSocket | null = null
  let started = false
  let paused = false
  let retryHandle: unknown = null
  let heartbeatHandle: unknown = null
  let attempts = 0
  let lastFrameAt = 0
  let lang = 'zh'

  let state: RealtimeState = {
    status: 'idle',
    attempts: 0,
    retryInMs: null,
    reason: null,
  }

  function setState(patch: Partial<RealtimeState>): void {
    const next: RealtimeState = { ...state, ...patch }
    const changed =
      next.status !== state.status ||
      next.attempts !== state.attempts ||
      next.retryInMs !== state.retryInMs ||
      next.reason !== state.reason
    state = next
    if (changed) onState?.(state)
  }

  function buildUrl(): string {
    try {
      const parsed = new URL(url)
      parsed.searchParams.set('lang', lang)
      return parsed.toString()
    } catch {
      return url
    }
  }

  function clearRetry(): void {
    if (retryHandle !== null) {
      timers.clearTimeout(retryHandle)
      retryHandle = null
    }
  }

  function stopHeartbeat(): void {
    if (heartbeatHandle !== null) {
      timers.clearInterval(heartbeatHandle)
      heartbeatHandle = null
    }
  }

  function startHeartbeat(): void {
    stopHeartbeat()
    lastFrameAt = now()
    heartbeatHandle = timers.setInterval(() => {
      if (!socket || socket.readyState !== OPEN) return
      if (now() - lastFrameAt >= heartbeatTimeoutMs) {
        // 连接还「开着」但长时间没有任何帧：主动断开，走重连流程
        teardownSocket()
        scheduleReconnect()
        return
      }
      try {
        socket.send(
          JSON.stringify(
            buildEnvelope(RealtimeInboundEvents.ping, {}, `ping-${now()}-${attempts}`),
          ),
        )
      } catch {
        teardownSocket()
        scheduleReconnect()
      }
    }, heartbeatIntervalMs)
  }

  function teardownSocket(): void {
    const current = socket
    socket = null
    stopHeartbeat()
    if (!current) return
    current.onopen = null
    current.onmessage = null
    current.onclose = null
    current.onerror = null
    try {
      current.close(1000, 'client disconnect')
    } catch {
      // close 失败不影响后续重连
    }
  }

  function scheduleReconnect(): void {
    if (!started || paused) return

    if (maxAttempts > 0 && attempts >= maxAttempts) {
      setState({ status: 'offline', attempts, retryInMs: null, reason: 'exhausted' })
      return
    }

    const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** attempts)
    // equal jitter：至少等一半，避免大量标签页在同一毫秒重连
    const delay = Math.round(cap / 2 + random() * (cap / 2))
    attempts += 1
    setState({
      status: 'reconnecting',
      attempts,
      retryInMs: delay,
      reason: 'network',
    })

    clearRetry()
    retryHandle = timers.setTimeout(() => {
      retryHandle = null
      connect()
    }, delay)
  }

  function isDuplicate(envelope: RealtimeEnvelope): boolean {
    const key =
      envelope.id ??
      `${envelope.event}:${readPostIdFromPayload(envelope.payload) ?? ''}:${
        readModifiedAt(envelope.payload) ?? ''
      }`
    if (seen.has(key)) return true
    seen.add(key)
    seenOrder.push(key)
    while (seenOrder.length > dedupeWindow) {
      const evicted = seenOrder.shift()
      if (evicted !== undefined) seen.delete(evicted)
    }
    return false
  }

  function handleFrame(data: unknown): void {
    lastFrameAt = now()
    const envelope = parseEnvelope(typeof data === 'string' ? data : '')
    if (!envelope) return
    if (isDuplicate(envelope)) return
    onEvent(envelope)
  }

  function connect(): void {
    if (!started || paused || socket) return

    setState({ status: attempts > 0 ? 'reconnecting' : 'connecting', retryInMs: null, reason: null })

    let created: RealtimeSocket
    try {
      created = createSocket(buildUrl())
    } catch {
      // 构造失败（例如 url 非法）也走退避，避免死循环
      scheduleReconnect()
      return
    }

    socket = created

    created.onopen = () => {
      if (socket !== created) return
      attempts = 0
      setState({ status: 'online', attempts: 0, retryInMs: null, reason: null })
      startHeartbeat()
      for (const room of rooms) {
        sendFrame(created, buildEnvelope(RealtimeInboundEvents.roomJoin, { room }))
      }
    }

    created.onmessage = (event) => {
      if (socket !== created) return
      handleFrame(event.data)
    }

    created.onclose = () => {
      if (socket !== created) return
      socket = null
      stopHeartbeat()
      if (!started || paused) return
      scheduleReconnect()
    }

    created.onerror = () => {
      // 浏览器在 error 之后通常紧跟 close；这里不重复处理，避免双重重连
    }
  }

  function sendFrame(target: RealtimeSocket, envelope: RealtimeEnvelope): void {
    if (target.readyState !== OPEN) return
    try {
      target.send(JSON.stringify(envelope))
    } catch {
      // 发送失败交给 close / 心跳超时处理
    }
  }

  return {
    start() {
      if (started) return
      started = true
      paused = false
      attempts = 0
      connect()
    },

    stop() {
      started = false
      paused = false
      clearRetry()
      teardownSocket()
      rooms.clear()
      attempts = 0
      setState({ status: 'idle', attempts: 0, retryInMs: null, reason: 'stopped' })
    },

    pause() {
      if (!started) return
      paused = true
      clearRetry()
      teardownSocket()
      setState({ status: 'offline', retryInMs: null, reason: 'paused' })
    },

    resume() {
      if (!started) return
      paused = false
      if (socket) return
      clearRetry()
      attempts = 0
      connect()
    },

    joinArticle(articleId: string) {
      const room = toArticleRoom(articleId)
      rooms.add(room)
      if (socket) sendFrame(socket, buildEnvelope(RealtimeInboundEvents.roomJoin, { room }))
      return () => {
        rooms.delete(room)
        if (socket) sendFrame(socket, buildEnvelope(RealtimeInboundEvents.roomLeave, { room }))
      }
    },

    getState() {
      return state
    },

    setLang(next: string) {
      if (!next || next === lang) return
      lang = next
      // 语言只在握手时生效；改语言直接重连，比半途改状态更可预期
      if (socket) {
        teardownSocket()
        scheduleReconnect()
      }
    },
  }
}

function defaultSocketFactory(url: string): RealtimeSocket {
  const Ctor = (globalThis as { WebSocket?: new (url: string) => WebSocket }).WebSocket
  if (!Ctor) {
    throw new Error('WebSocket 在当前环境不可用')
  }
  return new Ctor(url) as unknown as RealtimeSocket
}

export { RealtimeEvents }
