import { cookies } from 'next/headers'

/**
 * 受密码保护日记的「已解锁凭据」
 *
 * ## 为什么需要它
 *
 * 上游 core 的密码接口是 `GET /notes/:id?password=`（`NotePasswordQueryDto`）——
 * **密码只能通过查询参数传给后端**，这是既有契约，本轮不改、也不假设它支持
 * POST 或请求头。于是「浏览器不要拿着明文密码」与「后端只认查询参数」之间
 * 需要一个中间层：浏览器用 POST 交密码，服务端换成一个作用域受限的凭据。
 *
 * ## 凭据是什么
 *
 * 就是密码本身，放在 **httpOnly cookie** 里：
 *   - 浏览器 JS 读不到（`httpOnly`），XSS 偷不走；
 *   - 不进地址栏、不进历史记录、不进 `Referer`、不进访问日志；
 *   - 服务端每次渲染时取出，再以查询参数发给上游（服务端到服务端，不外泄）。
 *
 * 没有做成签名 token，因为那需要引入密钥与签名基建，而收益有限：
 * 凭据的价值等于密码本身，签名只能防篡改、防不了「拿到就能用」。真正起作用的
 * 是 httpOnly + 短有效期 + 按 nid 隔离。
 *
 * ## 为什么不按路径收窄
 *
 * cookie 的 `path` 若能设成 `/notes/13` 会更紧，但旧路由 `/diaries/:雪花id`
 * 也需要读到同一份凭据（它要 308 到 `/notes/13`，且不该让读者再输一次）。
 * 路径收窄会让两条路由各存一份，反而更容易出现「解锁了却看不到」。
 * 因此 path 用 `/`，靠 **cookie 名按 nid 区分** 来隔离：`folio-note-pw-13`
 * 只对第 13 篇有效，换一篇必然重新验证。
 */

/** cookie 名的固定前缀；后面拼 nid */
const COOKIE_PREFIX = 'folio-note-pw-'

/**
 * 旧路由那一路的前缀；后面拼雪花 id。
 *
 * 为什么需要两个键：cookie 按 nid 隔离，但旧路由只拿到雪花 id，解不出 nid
 * （解出来需要正文，而正文要密码——循环）。所以解锁成功时同时写两个键，
 * 让 `/notes/:nid` 与 `/diaries/:雪花id` 都能读到同一份凭据。
 * 两个键指向同一篇日记、同一份密码，不存在谁能看到谁看不到的差异。
 */
const LEGACY_COOKIE_PREFIX = 'folio-note-pw-id-'

/** 有效期：1 小时。够读完一篇，又不至于长期留在磁盘上 */
const MAX_AGE_SECONDS = 60 * 60

/** 密码长度上限：只为挡住畸形超长输入，不作为安全边界 */
export const MAX_PASSWORD_LENGTH = 200

/** 第 nid 篇日记对应的 cookie 名 */
export function passwordCookieName(nid: number | string): string {
  return `${COOKIE_PREFIX}${nid}`
}

/** 同一篇日记在旧路由下的 cookie 名（键是雪花 id） */
export function legacyPasswordCookieName(id: number | string): string {
  return `${LEGACY_COOKIE_PREFIX}${id}`
}

/**
 * Base64url 编码后的密码。
 *
 * cookie 值只允许可见 ASCII，且不能含 `;` `,` 空格引号；密码可能是任意 UTF-8，
 * 直接塞进去会被浏览器截断或转义坏掉。base64url 同时避开 `+` `/` `=` 这些在
 * cookie / URL 里需要额外转义的字符。
 */
export function encodePassword(password: string): string {
  return Buffer.from(password, 'utf8').toString('base64url')
}

export function decodePassword(value: string | undefined): string | null {
  if (!value) return null
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8')
    // 空串等于没给密码；长度超限说明 cookie 被伪造或损坏
    if (!decoded || decoded.length > MAX_PASSWORD_LENGTH) return null
    return decoded
  } catch {
    return null
  }
}

/**
 * 读取当前请求里第 nid 篇的已解锁凭据。
 *
 * 取不到（没解锁、已过期、密码被换掉）就返回 null，调用方照常走密码门。
 * 构建期等没有请求上下文的场合也返回 null，不抛错。
 */
export async function readNotePassword(nid: number | string): Promise<string | null> {
  try {
    const store = await cookies()
    return decodePassword(store.get(passwordCookieName(nid))?.value)
  } catch {
    return null
  }
}

/** 旧路由按雪花 id 读同一份凭据 */
export async function readLegacyNotePassword(id: number | string): Promise<string | null> {
  try {
    const store = await cookies()
    return decodePassword(store.get(legacyPasswordCookieName(id))?.value)
  } catch {
    return null
  }
}

/** 写 cookie 时用的一组属性，路由处理器与测试共用同一份定义 */
export function notePasswordCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // 本地 http 调试时不加 secure，否则浏览器直接丢弃
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}
