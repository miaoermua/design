/**
 * 实时连接的稳定会话 id
 *
 * 为什么需要：core 的 `getCurrentClientCount()` 对**同一 sessionId 的多个连接**
 * 做 `uniqBy` 后才算「全站在线人数」。客户端不带这个值，core 会退回 `socket.id`，
 * 于是同一个人的两个标签页被算成两个人，切换语言重建会话的瞬间还会短暂多 1。
 *
 * core v12.10.0 的支持方式是实测确认的（`events.gateway.ts#handleConnection`）：
 *
 *   const webSessionId =
 *     socket.handshake.headers['x-socket-session-id'] ||
 *     socket.handshake.query.socket_session_id ||
 *     socket.id
 *
 * 主题走握手 query。**不能传空串**：空串会让所有未登录访客一起被 uniqBy 合并成 1，
 * 所以拿不到存储时宁可不传（退回 core 的 socket.id 兜底）。
 *
 * 作用域是「这一个浏览器」：localStorage 的读写失败（隐私模式、禁用站点数据）
 * 就退回本页面的随机 id，等价于升级前的行为——只影响计数精度，不影响连接。
 */

const STORAGE_KEY = 'folio:realtime-session'

/** core 侧只把它当字符串用；仍然限制字符集，避免写入奇怪的路径/头内容 */
const SAFE_ID = /^[A-Za-z0-9_-]{8,64}$/

/** 存储不可用时的一次性 id：同一页面内保持稳定即可 */
let fallbackId: string | null = null

function createId(): string {
  try {
    const uuid = globalThis.crypto?.randomUUID?.()
    if (uuid) return uuid
  } catch {
    // 非安全上下文（http）没有 randomUUID，走下面的替代实现
  }
  const random = Math.random().toString(36).slice(2, 12)
  return `${Date.now().toString(36)}-${random}`
}

/**
 * 取当前浏览器的会话 id；服务端 / 无法持久化时返回 null（调用方应省略该参数）。
 */
export function getRealtimeSessionId(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && SAFE_ID.test(stored)) return stored

    const created = createId()
    window.localStorage.setItem(STORAGE_KEY, created)
    return created
  } catch {
    fallbackId ??= createId()
    return fallbackId
  }
}

/** 测试用：清掉模块级兜底，避免用例之间互相影响 */
export function resetRealtimeSessionFallback(): void {
  fallbackId = null
}
