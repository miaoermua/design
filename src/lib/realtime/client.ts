/**
 * Folio 唯一的实时连接实现（socket.io-client 4.x / Engine.IO 4）
 *
 * 设计约束：
 * - 每个浏览器运行环境只有一个 Socket.IO 实例：`acquireRealtimeClient()` 用
 *   globalThis 上的共享宿主 + 引用计数，StrictMode / HMR / 重复挂载都复用同一个实例。
 *   globalThis 只等于「一个 JS 运行环境」：不同标签页各有自己的实例，服务端进程里
 *   也各自独立，所以它既不是跨标签页单例，也不是服务端全局单例。
 * - 监听器只在 `transport.bind()` 里注册一次，`destroy()` 里按原函数逐个解绑；
 *   重连期间不重复注册业务监听器。
 * - 重连完全交给 Socket.IO Manager，不自己 `setTimeout`，也不靠不断新建 Socket
 *   实例来实现重连。
 * - 房间订阅只在 namespace 的 `connect` 事件里补发一次。Manager 的 `reconnect`
 *   在它之前触发，只用于诊断（清重试计数），不重复 join。
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

/**
 * 进入 offline 的原因：
 * - network       网络/传输层断开，Manager 正在自动重连
 * - exhausted     重连次数耗尽
 * - paused        主动暂停（含浏览器离线）
 * - stopped       已销毁
 * - server-closed 服务端关掉了 namespace 会话（或底层被强制关闭）。按 Socket.IO
 *                 官方行为，客户端不会进入常规重连流程，需要显式 `resume()` 才会重建
 */
export type RealtimeOfflineReason =
  | 'network'
  | 'exhausted'
  | 'paused'
  | 'stopped'
  | 'server-closed'

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
  /**
   * 改握手用的 `lang` query。
   *
   * query 在 Socket.IO 会话期内不可变，所以这里只改 Manager 的 query 选项，
   * 由调用方随后 `disconnect()` + `connect()` **重建 namespace 会话**（同一对
   * Socket / Manager 实例、同一批监听器）；不新建 Socket 实例，也不重注册监听器。
   */
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
 * 一定还会走 Manager 自动重连的断开原因（Engine.IO 关连接 → `Manager#onclose`
 * → 未 skipReconnect → reconnect）。只有这些原因可以显示「正在重试」。
 *
 * `io server disconnect` 与 `forced close` 不在此列：前者客户端已从 Manager 解绑，
 * 后者 Manager 自己把 skipReconnect 置成了 true，两者都不会自动重连。
 */
const AUTO_RECONNECT_REASONS = new Set([
  'ping timeout',
  'transport close',
  'transport error',
  'parse error',
])

/**
 * 可以确认「对端不具备本客户端要求的协议能力」的信号。
 *
 * 只收两类有出处的文案，其余一律不猜：
 * - `Invalid namespace`：socket.io 服务端在 namespace 不存在时回的 CONNECT_ERROR
 *   固定文案。Core 12 的网关是 `@WebSocketGateway({ namespace: 'web' })`，namespace
 *   不存在就走这条路径，因此保留终态处理（连上过 `/web` 不等于任何环境都存在它）。
 * - `in v2.x with a v3.x client`：socket.io-client 在 `Socket#onpacket` 里对
 *   v2 服务端返回不带 sid 的 CONNECT 包的固定报错。
 *
 * 这里刻意不收 `not compatible` 这类宽泛片段：普通网络/浏览器报错里也会出现。
 */
const UNSUPPORTED_SERVER_SIGNATURES = ['invalid namespace', 'in v2.x with a v3.x client']

/**
 * 普通传输层 / 网络错误：都还有自愈可能，不能当成服务端不兼容。
 * `TransportError` 的结构化 `type` 已在前面单独判断，这里覆盖没有该字段的路径
 * （浏览器抛出的 fetch/WebSocket 错误、Engine.IO 的 close 文案）。
 */
const TRANSPORT_ERROR_PATTERN =
  /websocket error|websocket .*failed|transport error|transport close|xhr poll error|network ?error|failed to fetch|fetch failed|connection (?:refused|reset|closed|failed)|econnrefused|econnreset|enotfound|eai_again/

const TIMEOUT_PATTERN = /\btimeout\b|timed out/

/** Engine.IO 的 `TransportError` 带结构化 `type`（`"TransportError"`），优先于文本判断 */
function readErrorType(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  const type = (error as { type?: unknown }).type
  return typeof type === 'string' && type.length > 0 ? type : null
}

/**
 * 服务端 CONNECT_ERROR 会把业务信息放在 `data` 上（middleware 抛出的错误），
 * `message` 为空时用它兜底，避免丢掉唯一可诊断的字符串。
 */
function readErrorData(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null
  const data = (error as { data?: unknown }).data
  return typeof data === 'string' && data.length > 0 ? data : null
}

/**
 * 把 Socket.IO 的 `connect_error` 分成可诊断的类别。
 *
 * `unsupported-server` 表示服务端不具备本客户端要求的协议能力：namespace 不存在、
 * 或对端是旧一代 Socket.IO 服务端。这类错误不会自愈，必须明确报出来。
 *
 * 判断顺序：先用 message（message 为空时用服务端放在 `data` 里的字符串）匹配两类
 * 已核实的能力信号；再看 Engine.IO 的结构化 `type`；最后退回文本启发式。两者都不
 * 确定时落到 `handshake`（有信息但无法归因）或 `unknown`（服务端什么都没给）。
 * 任何情况下都不把普通网络错误升级成「服务端不兼容」，也不因为分类失败去换协议。
 */
export function classifyConnectionError(error: unknown): RealtimeError {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error ?? '')
  const message = raw.length > 0 ? raw : (readErrorData(error) ?? '')
  const text = message.toLowerCase()
  const type = readErrorType(error)

  let kind: RealtimeErrorKind
  if (UNSUPPORTED_SERVER_SIGNATURES.some((signature) => text.includes(signature))) {
    kind = 'unsupported-server'
  } else if (type === 'TransportError') {
    kind = 'transport'
  } else if (TIMEOUT_PATTERN.test(text)) {
    kind = 'timeout'
  } else if (TRANSPORT_ERROR_PATTERN.test(text)) {
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

  /**
   * 断线期间加入的房间也在这里，因此重连后能补订阅；只在 namespace 的 `connect`
   * 事件里调用一次（每次会话一次），不在 Manager 的 `reconnect` 里重复调用。
   */
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
      // `disconnect()` 由客户端发起（pause / 改语言 / stop）时不需要再切状态：
      // 调用方已经把状态改成目标值，这里再改只会覆盖掉它
      if (reason === 'io client disconnect') return
      if (disposed || !started || paused || capabilityFailed) return

      if (AUTO_RECONNECT_REASONS.has(reason)) {
        setState({ status: 'reconnecting', reason: 'network', error: null })
        return
      }

      // 其余原因不会自动重连：
      // - `io server disconnect`：服务端对 namespace 调了 `socket.disconnect()`。
      //   官方实现里 `Socket#destroy()` 先解掉 Manager 订阅，`socket.active` 变
      //   false，Manager 因此不会进入常规重连流程，需要显式 `connect()`。
      // - `forced close` / 未知原因：Manager 已 skipReconnect，或根本无法归因。
      // 宁可报「会话被关闭」，也不显示一个不会发生的「正在重试」。若之后 Manager
      // 确实开始重连，`reconnect_attempt` 会把状态改回 reconnecting。
      setState({ status: 'offline', reason: 'server-closed', error: null })
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
      if (disposed || !started || paused || capabilityFailed) return
      // 保留 Manager 的重连诊断：传输层已经恢复，重试计数可以归零。
      // 但状态与房间订阅不在这里收口 —— 本事件先于 namespace 的 `connect`
      // （`Manager#open` 先 emit `open`，再执行回调里的 `onreconnect()`），
      // 若两个事件都 join，每次重连就会给每个房间发两次 join。
      setState({ attempts: 0 })
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
      if (disposed || !started || capabilityFailed) return
      // 两种可恢复情形：主动暂停；会话被服务端关掉（官方要求手动 connect 才恢复）。
      // 其余状态（connecting / online / reconnecting）交给 Manager，不插一脚。
      if (!paused && state.reason !== 'server-closed') return
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

/**
 * 当前浏览器运行环境里共享的连接宿主（挂在 globalThis 上，HMR 与多次 import 都拿到
 * 同一份）。它的作用域就是**这一个 JS 运行环境**：
 * - 不是跨标签页单例 —— 每个标签页有独立的 globalThis，各自建立自己的连接；
 * - 不是服务端进程级单例 —— SSR 阶段不会走到这里，Node 侧的 globalThis 也不代表
 *   某个用户会话，因此不能把浏览器连接状态放在这里跨请求复用。
 */
const globalStore = globalThis as typeof globalThis & {
  __folioRealtimeClient?: HeldClient
}

/**
 * 获取当前运行环境里唯一的连接宿主。相同 `origin + lang` 复用同一实例，引用计数
 * 归零才 stop。`release()` 返回 true 表示「这次释放真的把共享连接停掉了」，宿主据此
 * 清理会话；实例已被替换时返回 false，避免误清掉新会话。
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
  // 实例已被更新的 acquire 替换并停止：这次释放不涉及当前共享连接，
  // 调用方不能据此清理（否则会把新会话的 room 订阅一起摘掉）
  if (globalStore.__folioRealtimeClient !== entry) return false
  entry.client.stop()
  globalStore.__folioRealtimeClient = undefined
  return true
}
