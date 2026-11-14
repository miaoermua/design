/**
 * Folio 唯一的实时连接实现（socket.io-client 4.x / Engine.IO 4）
 *
 * 设计约束：
 * - 全站只有一个 Socket.IO 实例：`acquireRealtimeClient()` 用 globalThis 单例 +
 *   引用计数，StrictMode / HMR / 重复挂载都复用同一个实例。
 * - 监听器只在 `transport.bind()` 里注册一次，`destroy()` 里按原函数逐个解绑；
 *   重连期间不重复注册业务监听器。
 * - 重连完全交给 Socket.IO Manager，不自己 `setTimeout`，也不靠不断新建 Socket
 *   实例来实现重连。
 * - Engine.IO v4 的心跳由服务端发 ping，客户端不再实现应用层心跳。
 * - 底层协议细节（path / namespace / query / transport）只存在于本文件的默认
 *   transport 工厂里，业务组件只见 `RealtimeClient` 与类型化的 `RealtimeEvent`。
 *
 * 服务端能力不满足时进入终态 `error` 并停止重试；没有旧协议 fallback、没有自动
 * 探测、没有双协议适配。
 */

import { io, type Socket } from 'socket.io-client'
import type { Locale } from '@/lib/i18n/config'
import {
  REALTIME_ENGINE_PATH,
  REALTIME_MESSAGE_EVENT,
  REALTIME_NAMESPACE_PATH,
  RealtimeClientMessageTypes,
  articleRoom,
  dispatchMessage,
  eventKey,
  type RealtimeEvent,
  type RealtimeRoomMessage,
} from './protocol'

/**
 * 状态语义（与 UI 状态胶囊一致）：
 * - idle       未启动 / 已停止
 * - connecting 首次握手
 * - online     已连上 `/web` namespace
 * - reconnecting Socket.IO Manager 正在自动重连
 * - offline    主动暂停 / 浏览器离线 / 重连次数耗尽
 * - error      服务端能力不满足（namespace / 协议不支持），已停止重试，不降级
 */
export type RealtimeStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline' | 'error'

export type RealtimeOfflineReason = 'network' | 'exhausted' | 'paused' | 'stopped'

/** 区分「服务端不支持」「握手失败」「传输/网络错误」「超时」，不混成一条 */
export type RealtimeErrorKind =
  'unsupported-server' | 'handshake' | 'transport' | 'timeout' | 'unknown'

export interface RealtimeError {
  kind: RealtimeErrorKind
  /** 保留上游原始信息，便于诊断 */
  message: string
}

export interface RealtimeState {
  status: RealtimeStatus
  /** 连续重连次数；连接成功后归零 */
  attempts: number
  reason: RealtimeOfflineReason | null
  error: RealtimeError | null
}

export interface RealtimeTransportHandlers {
  onConnect(): void
  onDisconnect(reason: string): void
  onMessage(raw: unknown): void
  onConnectError(error: Error): void
  onReconnectAttempt(attempt: number): void
  onReconnect(attempt: number): void
  onReconnectError(error: Error): void
  onReconnectFailed(): void
}

/** 只暴露状态机需要的能力；Socket.IO 类型不会泄漏给业务层 */
export interface RealtimeTransport {
  connect(): void
  disconnect(): void
  emitMessage(payload: RealtimeRoomMessage): void
  /** query 在会话期内不可变，改语言必须新建会话 */
  setLang(lang: string): void
  bind(handlers: RealtimeTransportHandlers): void
  unbind(): void
  destroy(): void
}

export interface RealtimeTransportConfig {
  origin: string
  lang: Locale
}

export type RealtimeTransportFactory = (config: RealtimeTransportConfig) => RealtimeTransport

export interface RealtimeClientOptions extends RealtimeTransportConfig {
  onEvent: (event: RealtimeEvent) => void
  onState?: (state: RealtimeState) => void
  /** 测试注入；生产用下面的默认 Socket.IO 工厂 */
  createTransport?: RealtimeTransportFactory
  /** 去重窗口大小，默认 64 */
  dedupeWindow?: number
}

export interface RealtimeClient {
  start(): void
  stop(): void
  pause(): void
  resume(): void
  joinArticle(articleId: string): () => void
  getState(): RealtimeState
  setLang(lang: Locale): void
}

const INITIAL_STATE: RealtimeState = {
  status: 'idle',
  attempts: 0,
  reason: null,
  error: null,
}

/**
 * 把 Socket.IO 的 `connect_error` 分成可诊断的类别。
 *
 * `unsupported-server` 表示服务端不具备本客户端要求的协议能力：namespace 不存在、
 * 或对端是旧一代 Socket.IO 服务端。这类错误不会自愈，必须明确报出来。
 */
export function classifyConnectionError(error: unknown): RealtimeError {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error ?? '')
  const text = message.toLowerCase()

  let kind: RealtimeErrorKind
  if (
    /invalid namespace|namespace .*not found|v2\.x with a v3\.x client|not compatible/.test(text)
  ) {
    kind = 'unsupported-server'
  } else if (/timeout|timed out/.test(text)) {
    kind = 'timeout'
  } else if (
    /websocket error|transport error|xhr poll error|fetch failed|network|econnrefused|enotfound/.test(
      text,
    )
  ) {
    kind = 'transport'
  } else if (text.length === 0) {
    kind = 'unknown'
  } else {
    kind = 'handshake'
  }

  return { kind, message: message || 'Socket.IO 未提供错误信息' }
}

/** 默认 transport：Core v12 的 Socket.IO 4.x /web namespace */
function createSocketIoTransport({ origin, lang }: RealtimeTransportConfig): RealtimeTransport {
  const socket: Socket = io(`${origin}${REALTIME_NAMESPACE_PATH}`, {
    // `/socket.io/` 是 Engine.IO path；`/web` 由 URL 的 pathname 指定为 namespace
    path: REALTIME_ENGINE_PATH,
    query: { lang },
    transports: ['websocket'],
    autoConnect: false,
    reconnection: true,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 30_000,
    randomizationFactor: 0.5,
    // 独占一个 Manager，避免和其他代码共享连接导致生命周期不可控
    forceNew: true,
  })

  let bound: RealtimeTransportHandlers | null = null

  function unbind(): void {
    if (!bound) return
    const handlers = bound
    bound = null
    socket.off('connect', handlers.onConnect)
    socket.off('disconnect', handlers.onDisconnect)
    socket.off('connect_error', handlers.onConnectError)
    socket.off(REALTIME_MESSAGE_EVENT, handlers.onMessage)
    socket.io.off('reconnect_attempt', handlers.onReconnectAttempt)
    socket.io.off('reconnect', handlers.onReconnect)
    socket.io.off('reconnect_error', handlers.onReconnectError)
    socket.io.off('reconnect_failed', handlers.onReconnectFailed)
  }

  return {
    connect: () => {
      socket.connect()
    },
    disconnect: () => {
      socket.disconnect()
    },
    emitMessage: (payload) => {
      socket.emit(REALTIME_MESSAGE_EVENT, payload)
    },
    setLang: (next) => {
      socket.io.opts.query = { ...socket.io.opts.query, lang: next }
    },
    bind: (handlers) => {
      // 重复 bind 不会重复注册监听器
      if (bound) return
      bound = handlers
      socket.on('connect', handlers.onConnect)
      socket.on('disconnect', handlers.onDisconnect)
      socket.on('connect_error', handlers.onConnectError)
      socket.on(REALTIME_MESSAGE_EVENT, handlers.onMessage)
      socket.io.on('reconnect_attempt', handlers.onReconnectAttempt)
      socket.io.on('reconnect', handlers.onReconnect)
      socket.io.on('reconnect_error', handlers.onReconnectError)
      socket.io.on('reconnect_failed', handlers.onReconnectFailed)
    },
    unbind,
    destroy: () => {
      unbind()
      socket.disconnect()
    },
  }
}

export function createRealtimeClient(options: RealtimeClientOptions): RealtimeClient {
  const { onEvent, onState, dedupeWindow = 64 } = options
  const factory = options.createTransport ?? createSocketIoTransport
  const transport = factory({ origin: options.origin, lang: options.lang })

  let lang: Locale = options.lang
  let started = false
  let paused = false
  let disposed = false
  let connected = false
  let capabilityFailed = false

  const rooms = new Set<string>()
  const seen = new Set<string>()
  const seenOrder: string[] = []

  let state: RealtimeState = INITIAL_STATE

  function setState(patch: Partial<RealtimeState>): void {
    const next: RealtimeState = { ...state, ...patch }
    const changed =
      next.status !== state.status ||
      next.attempts !== state.attempts ||
      next.reason !== state.reason ||
      next.error?.kind !== state.error?.kind ||
      next.error?.message !== state.error?.message
    state = next
    if (changed) onState?.(state)
  }

  function isDuplicate(event: RealtimeEvent): boolean {
    const key = eventKey(event)
    if (seen.has(key)) return true
    seen.add(key)
    seenOrder.push(key)
    while (seenOrder.length > dedupeWindow) {
      const evicted = seenOrder.shift()
      if (evicted !== undefined) seen.delete(evicted)
    }
    return false
  }

  function rejoinRooms(): void {
    for (const room of rooms) {
      transport.emitMessage({
        type: RealtimeClientMessageTypes.join,
        payload: { roomName: room },
      })
    }
  }

  function handleConnectionError(error: Error): void {
    if (disposed || !started) return
    const classified = classifyConnectionError(error)

    if (classified.kind === 'unsupported-server') {
      capabilityFailed = true
      connected = false
      setState({ status: 'error', reason: null, error: classified })
      // 明确停止：服务端能力不满足，不重试、不降级、不切换协议
      transport.disconnect()
      return
    }

    setState({ status: 'reconnecting', reason: 'network', error: classified })
  }

  const handlers: RealtimeTransportHandlers = {
    onConnect: () => {
      if (disposed || !started || paused) return
      connected = true
      setState({ status: 'online', attempts: 0, reason: null, error: null })
      rejoinRooms()
    },

    onDisconnect: (reason) => {
      connected = false
      // `disconnect()` 由客户端发起（pause / 改语言 / 停止重试）时不需要再切状态
      if (reason === 'io client disconnect') return
      if (disposed || !started || paused || capabilityFailed) return
      setState({ status: 'reconnecting', reason: 'network' })
    },

    onMessage: (raw) => {
      if (disposed || !started || paused) return
      const event = dispatchMessage(raw)
      if (!event) return
      if (isDuplicate(event)) return
      onEvent(event)
    },

    onConnectError: handleConnectionError,

    onReconnectAttempt: (attempt) => {
      if (disposed || !started || paused || capabilityFailed) return
      setState({ status: 'reconnecting', attempts: attempt, reason: 'network' })
    },

    onReconnect: () => {
      if (disposed || !started || paused) return
      connected = true
      setState({ status: 'online', attempts: 0, reason: null, error: null })
      rejoinRooms()
    },

    onReconnectError: handleConnectionError,

    onReconnectFailed: () => {
      if (disposed || !started) return
      connected = false
      setState({ status: 'offline', reason: 'exhausted' })
    },
  }

  return {
    start() {
      if (disposed || started) return
      started = true
      paused = false
      connected = false
      transport.bind(handlers)
      setState({ status: 'connecting', attempts: 0, reason: null, error: null })
      transport.connect()
    },

    stop() {
      if (disposed) return
      disposed = true
      started = false
      paused = false
      connected = false
      rooms.clear()
      seen.clear()
      seenOrder.length = 0
      transport.destroy()
      setState({ status: 'idle', attempts: 0, reason: 'stopped', error: null })
    },

    pause() {
      // 服务端能力不满足是终态，网络事件不应该把它改写成「主动暂停」
      if (disposed || !started || paused || capabilityFailed) return
      paused = true
      connected = false
      transport.disconnect()
      setState({ status: 'offline', reason: 'paused', error: null })
    },

    resume() {
      if (disposed || !started || !paused || capabilityFailed) return
      paused = false
      setState({ status: 'connecting', attempts: 0, reason: null, error: null })
      transport.connect()
    },

    joinArticle(articleId) {
      if (disposed) return () => {}
      const room = articleRoom(articleId)
      rooms.add(room)
      if (connected) {
        transport.emitMessage({
          type: RealtimeClientMessageTypes.join,
          payload: { roomName: room },
        })
      }
      return () => {
        if (disposed) return
        rooms.delete(room)
        if (connected) {
          transport.emitMessage({
            type: RealtimeClientMessageTypes.leave,
            payload: { roomName: room },
          })
        }
      }
    },

    getState() {
      return state
    },

    setLang(next) {
      if (disposed || !next || next === lang) return
      lang = next
      capabilityFailed = false
      transport.setLang(next)
      // 官方约定：query 在会话期内不可变，改语言必须断开并重建会话。
      // 仍是同一个 Socket 实例，不会重复注册监听器。
      if (!started || paused) return
      transport.disconnect()
      transport.connect()
      setState({ status: 'connecting', attempts: 0, reason: null, error: null })
    },
  }
}

interface HeldClient {
  key: string
  client: RealtimeClient
  refs: number
}

const globalStore = globalThis as typeof globalThis & {
  __folioRealtimeClient?: HeldClient
}

/**
 * 获取全站唯一的连接宿主。相同 `origin + lang` 复用同一实例，引用计数归零才 stop。
 * `release()` 返回 true 表示这是最后一个引用、连接已停止（宿主可据此清理会话）。
 */
export function acquireRealtimeClient(options: RealtimeClientOptions): {
  client: RealtimeClient
  release: () => boolean
} {
  const key = `${options.origin}|${options.lang}`
  const held = globalStore.__folioRealtimeClient

  if (held && held.key === key) {
    held.refs += 1
    return { client: held.client, release: () => releaseRef(held) }
  }

  // 目标变了（例如切换语言 / 后端地址）：先彻底停掉旧实例，不并行留两条连接
  if (held) held.client.stop()

  const client = createRealtimeClient(options)
  const entry: HeldClient = { key, client, refs: 1 }
  globalStore.__folioRealtimeClient = entry
  return { client, release: () => releaseRef(entry) }
}

function releaseRef(entry: HeldClient): boolean {
  entry.refs -= 1
  if (entry.refs > 0) return false
  if (globalStore.__folioRealtimeClient === entry) {
    entry.client.stop()
    globalStore.__folioRealtimeClient = undefined
  }
  return true
}
