/**
 * Mix Space Core v12 实时协议（Socket.IO 4.x / Engine.IO 4）
 *
 * 事实来源：core v12.10.0 `apps/core/src/processors/gateway/web/`。
 * - `events.gateway.ts`：`@WebSocketGateway({ namespace: 'web' })`，服务端与客户端
 *   统一用 `message` 事件；`broadcast()` 发送 `gatewayMessageFormat(event, data)`，
 *   即 `{ type, data, code }`（`base.gateway.ts`）。
 * - `handleConnection()`：读握手 query `lang`，加入 `lang:<lang>` 房间；随后单播
 *   一条 `VISITOR_ONLINE`，数据来自 `sendOnlineNumber()` = `{ online, timestamp }`。
 * - `handleMessageEvent()`：客户端 → 服务端的 `message` 是
 *   `{ type: 'join'|'leave'|'updateSid'|'updateLang', payload }`。
 * - `activity.util.ts`：文章房间名固定为 `article-<id>`。
 * - `visitor-event-dispatch.service.ts`：`POST_UPDATE` 只发给对应文章房间，
 *   数据是完整文章；`POST_DELETE` 发的是 id 字符串。
 * - `ack.controller.ts`：`ARTICLE_READ_COUNT_UPDATE` 数据是 `{ count, id, type }`，
 *   `type` 取值来自 `ArticleTypeEnum`（post / note / page）。
 *
 * Folio 只实现这一套协议：没有原生 WebSocket 备用实现、没有端点探测、没有降级分支。
 * 路径、namespace、业务事件三者互不混淆：
 *   `/socket.io/` = Engine.IO path，`/web` = namespace，`lang` = 握手 query。
 */

/** Engine.IO path（socket.io-client 的 `path` 选项），不是业务地址 */
export const REALTIME_ENGINE_PATH = '/socket.io/'

/** Socket.IO namespace，拼在 API origin 后面 */
export const REALTIME_NAMESPACE_PATH = '/web'

/** 服务端与客户端统一的 Socket.IO 事件名 */
export const REALTIME_MESSAGE_EVENT = 'message'

/** Folio 处理的 BusinessEvents 子集（core 12 `business-event.constant.ts`） */
export const RealtimeEventTypes = {
  gatewayConnect: 'GATEWAY_CONNECT',
  postUpdate: 'POST_UPDATE',
  postDelete: 'POST_DELETE',
  visitorOnline: 'VISITOR_ONLINE',
  visitorOffline: 'VISITOR_OFFLINE',
  articleReadCountUpdate: 'ARTICLE_READ_COUNT_UPDATE',
} as const

export type RealtimeEventType = (typeof RealtimeEventTypes)[keyof typeof RealtimeEventTypes]

/** 客户端 → 服务端的 `message` 类型（core `SupportedMessageEvent` 子集） */
export const RealtimeClientMessageTypes = {
  join: 'join',
  leave: 'leave',
} as const

export type RealtimeArticleType = 'post' | 'note' | 'page'

/** `message` 事件的原始载荷：`gatewayMessageFormat()` 的形状 */
export interface RealtimeMessage<T = unknown> {
  type: string
  data: T
  code?: number
}

/** 加入 / 退出文章房间；core 只认 `roomName` 字段 */
export interface RealtimeRoomMessage {
  type: 'join' | 'leave'
  payload: { roomName: string }
}

export interface ArticleLocation {
  category: string
  slug: string
}

/**
 * 分发后的类型化业务事件。
 *
 * 业务组件只消费这个联合类型，不接触 Socket.IO 帧、`message` 事件名或 `data` 的原始
 * 形状；`data` 的校验全部在 `dispatchMessage()` 里完成，非法载荷不会产生事件。
 */
export type RealtimeEvent =
  | { kind: 'gateway-connect'; greeting: string | null }
  | {
      kind: 'article-update'
      id: string
      modifiedAt: string | null
      next: ArticleLocation | null
    }
  | { kind: 'article-removed'; id: string }
  | { kind: 'visitor-online'; online: number; timestamp: string | null }
  | { kind: 'visitor-offline'; online: number; timestamp: string | null }
  | {
      kind: 'read-count-update'
      articleType: RealtimeArticleType
      id: string
      count: number
    }

/** 文章房间名：core `buildArticleRoomName()` 的前缀 `article-` */
export function articleRoom(articleId: string): string {
  return `article-${articleId}`
}

/** 阅读数按「文章类型 + 文章 id」关联，避免不同类型同 id 串数 */
export function readCountKey(articleType: RealtimeArticleType, id: string): string {
  return `${articleType}:${id}`
}

/**
 * 解析一条 `message` 载荷。
 *
 * 任何不合规的输入都返回 `null` 而不是抛错：一条脏帧不应该打断连接，
 * 也不应该在页面上产生未捕获异常。
 */
export function parseMessage(raw: unknown): RealtimeMessage | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const candidate = raw as Record<string, unknown>
  if (typeof candidate.type !== 'string' || candidate.type.length === 0) return null

  const message: RealtimeMessage = { type: candidate.type, data: candidate.data }
  if (typeof candidate.code === 'number' && Number.isFinite(candidate.code)) {
    message.code = candidate.code
  }
  return message
}

/**
 * 按 `payload.type` 分发，并逐类做结构校验。
 *
 * 未知类型与校验失败的已知类型都返回 `null` —— 不转发给 UI、不抛错、不影响其他事件。
 */
export function dispatchMessage(raw: unknown): RealtimeEvent | null {
  const message = parseMessage(raw)
  if (!message) return null
  try {
    return dispatchParsed(message)
  } catch {
    // 单条畸形帧（含异常 getter / Proxy）不能让整个分发器崩溃
    return null
  }
}

function dispatchParsed(message: RealtimeMessage): RealtimeEvent | null {
  switch (message.type) {
    case RealtimeEventTypes.gatewayConnect:
      return {
        kind: 'gateway-connect',
        greeting: typeof message.data === 'string' ? message.data : null,
      }

    case RealtimeEventTypes.postUpdate: {
      const id = readPostIdFromPayload(message.data)
      if (!id) return null
      return {
        kind: 'article-update',
        id,
        modifiedAt: readModifiedAt(message.data),
        next: readArticleLocation(message.data),
      }
    }

    case RealtimeEventTypes.postDelete: {
      if (typeof message.data !== 'string' || !isSafeId(message.data)) return null
      return { kind: 'article-removed', id: message.data }
    }

    case RealtimeEventTypes.visitorOnline: {
      const visitor = readVisitorCount(message.data)
      return visitor ? { kind: 'visitor-online', ...visitor } : null
    }

    case RealtimeEventTypes.visitorOffline: {
      const visitor = readVisitorCount(message.data)
      return visitor ? { kind: 'visitor-offline', ...visitor } : null
    }

    case RealtimeEventTypes.articleReadCountUpdate: {
      const update = readReadCountUpdate(message.data)
      return update
        ? {
            kind: 'read-count-update',
            articleType: update.articleType,
            id: update.id,
            count: update.count,
          }
        : null
    }

    default:
      return null
  }
}

/** 去重键：重连后服务端可能重发同一条事件 */
export function eventKey(event: RealtimeEvent): string {
  switch (event.kind) {
    case 'gateway-connect':
      return `gateway-connect:${event.greeting ?? ''}`
    case 'article-update':
      return `article-update:${event.id}:${event.modifiedAt ?? ''}:${
        event.next ? `${event.next.category}/${event.next.slug}` : ''
      }`
    case 'article-removed':
      return `article-removed:${event.id}`
    case 'visitor-online':
      return `visitor-online:${event.online}:${event.timestamp ?? ''}`
    case 'visitor-offline':
      return `visitor-offline:${event.online}:${event.timestamp ?? ''}`
    case 'read-count-update':
      return `read-count-update:${event.articleType}:${event.id}:${event.count}`
  }
}

function readVisitorCount(data: unknown): { online: number; timestamp: string | null } | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  const online = record.online
  if (
    typeof online !== 'number' ||
    !Number.isFinite(online) ||
    !Number.isInteger(online) ||
    online < 0
  ) {
    return null
  }
  const timestamp =
    typeof record.timestamp === 'string' && Number.isFinite(Date.parse(record.timestamp))
      ? record.timestamp
      : null
  return { online, timestamp }
}

function readReadCountUpdate(
  data: unknown,
): { articleType: RealtimeArticleType; id: string; count: number } | null {
  if (typeof data !== 'object' || data === null) return null
  const record = data as Record<string, unknown>
  const { count, id, type } = record
  if (
    typeof count !== 'number' ||
    !Number.isFinite(count) ||
    !Number.isInteger(count) ||
    count < 0
  ) {
    return null
  }
  if (typeof id !== 'string' || !isSafeId(id)) return null
  if (type !== 'post' && type !== 'note' && type !== 'page') return null
  return { articleType: type, id, count }
}

/**
 * 从事件 data 里取文章 id。
 *
 * `POST_UPDATE` 的 data 是完整文章对象；`POST_DELETE` 单独处理（id 字符串）。
 * data 来自网络，一律当不可信输入。
 */
export function readPostIdFromPayload(payload: unknown): string | null {
  if (typeof payload === 'string') return isSafeId(payload) ? payload : null
  if (typeof payload === 'object' && payload !== null) {
    const id = (payload as Record<string, unknown>).id
    if (typeof id === 'string' && isSafeId(id)) return id
    if (typeof id === 'number' && Number.isFinite(id)) return String(id)
  }
  return null
}

/** 文章修改时间：core 公开载荷用 `modifiedAt`，兼容旧字段 `updatedAt` */
export function readModifiedAt(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const record = payload as Record<string, unknown>
  for (const key of ['modifiedAt', 'updatedAt'] as const) {
    const value = record[key]
    if (typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value))) {
      return value
    }
    if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString()
  }
  return null
}

/** 事件里的新地址只作为「去哪回查」的线索，slug 与分类都按保守字符集校验 */
export function readArticleLocation(payload: unknown): ArticleLocation | null {
  if (typeof payload !== 'object' || payload === null) return null
  const record = payload as Record<string, unknown>
  const categoryRecord =
    typeof record.category === 'object' && record.category !== null
      ? (record.category as Record<string, unknown>)
      : null
  const category =
    (categoryRecord?.slug as unknown) ??
    (typeof record.categorySlug === 'string' ? record.categorySlug : undefined) ??
    (typeof record.category === 'string' ? record.category : undefined)

  if (!isSafeSlug(record.slug) || !isSafeSlug(category)) return null
  return { category, slug: record.slug }
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
