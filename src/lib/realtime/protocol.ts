/**
 * Mix Space 实时网关协议（只读主题用到的子集）
 *
 * 事实来源：core 17 的 `apps/core/src/processors/gateway/ws/`。
 * 1. 传输是**原生 WebSocket**，不是 socket.io：core 17 的依赖里已没有 socket.io。
 * 2. 地址是 `{origin}/ws/web`（NestJS `@WebSocketGateway({ path })`）。
 * 3. 报文是 JSON 信封 `{ v, event, payload?, id? }`，`v` 当前恒为 1。
 * 4. 连接时可带 `lang` / `socket_session_id` 查询参数；`lang` 决定 `post.update`
 *    下发哪一种语言的正文。
 * 5. 文章事件只发给**加入了对应房间**的连接：`article-<postId>`。
 *    `post.delete` / `post.unpublish` 的 payload 只有 id 字符串；
 *    `post.update` / `post.republish` / `post.create` 的 payload 是完整文章。
 *
 * 这里只声明 Folio 会处理的事件，其余事件（评论、日记、在线人数等）一律忽略，
 * 避免把「协议里存在」当成「本主题支持」。
 */

export const REALTIME_PATH = '/ws/web'

/** 信封版本；与 core 的 `ENVELOPE_VERSION` 对齐，不匹配即丢弃该帧 */
export const REALTIME_PROTOCOL_VERSION = 1

export const RealtimeEvents = {
  /** 连接建立时服务端下发的问候帧 */
  connected: 'gateway.connect',
  postUpdate: 'post.update',
  postDelete: 'post.delete',
  postUnpublish: 'post.unpublish',
  postRepublish: 'post.republish',
  /** 服务端对入站请求的确认帧 */
  ack: 'ack',
} as const

export const RealtimeInboundEvents = {
  roomJoin: 'room.join',
  roomLeave: 'room.leave',
  ping: 'ping',
} as const

export interface RealtimeEnvelope<T = unknown> {
  v: number
  event: string
  payload?: T
  /** 请求/确认帧的关联 id；服务端只对带 id 的 `ping` 回包 */
  id?: string
}

/** 文章房间名：core 侧固定前缀 `article-`，且只接受这个前缀的房间 */
export function articleRoom(articleId: string): string {
  return `article-${articleId}`
}

/**
 * 解析一帧原始文本。
 *
 * 任何不合规的输入都返回 `null` 而不是抛错：一条脏帧不应该打断整条连接，
 * 更不应该让页面上出现未捕获异常。
 */
export function parseEnvelope(raw: unknown): RealtimeEnvelope | null {
  if (typeof raw !== 'string' || raw.length === 0) return null

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof value !== 'object' || value === null) return null
  const candidate = value as Record<string, unknown>

  if (typeof candidate.event !== 'string' || candidate.event.length === 0) {
    return null
  }
  if (candidate.v !== REALTIME_PROTOCOL_VERSION) return null

  const envelope: RealtimeEnvelope = { v: candidate.v, event: candidate.event }
  if ('payload' in candidate) envelope.payload = candidate.payload
  if (typeof candidate.id === 'string' && candidate.id.length > 0) {
    envelope.id = candidate.id
  }
  return envelope
}

export function buildEnvelope(
  event: string,
  payload?: unknown,
  id?: string,
): RealtimeEnvelope {
  const envelope: RealtimeEnvelope = { v: REALTIME_PROTOCOL_VERSION, event }
  if (payload !== undefined) envelope.payload = payload
  if (id !== undefined) envelope.id = id
  return envelope
}

/**
 * 从事件 payload 里取文章 id。
 *
 * - `post.update` / `post.republish` 的 payload 是文章对象；
 * - `post.delete` / `post.unpublish` 的 payload 是 id 字符串本身。
 *
 * payload 来自网络，一律当不可信输入处理：拿不到合法 id 就返回 null。
 */
export function readPostIdFromPayload(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return isSafeId(payload) ? payload : null
  }
  if (typeof payload === 'object' && payload !== null) {
    const id = (payload as Record<string, unknown>).id
    if (typeof id === 'string' && isSafeId(id)) return id
    if (typeof id === 'number' && Number.isFinite(id)) return String(id)
  }
  return null
}

/**
 * 读取事件 payload 里的文章修改时间。
 *
 * core 的公开载荷里字段是 `modifiedAt`；旧版本可能叫 `updatedAt`。
 * 只接受能解析成时间的字符串，解析不了就当没有。
 */
export function readModifiedAt(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const record = payload as Record<string, unknown>
  for (const key of ['modifiedAt', 'updatedAt'] as const) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value))) {
      return value
    }
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return value.toISOString()
    }
  }
  return null
}

const SAFE_SLUG = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/

/** slug / 分类 slug 只接受保守字符集，避免把事件里的任意字符串拼进 URL */
export function isSafeSlug(value: unknown): value is string {
  return typeof value === 'string' && SAFE_SLUG.test(value)
}

/** 文章 id 同样按保守规则校验（数字 id 与 UUID 都能通过） */
export function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value)
}
