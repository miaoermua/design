/**
 * 服务端读取当前语言
 *
 * 语言存在 cookie 里（而不是 URL 段）：Folio 的内容路由已经由 Mix Space 决定，
 * 再加一层 `/[locale]` 前缀会让所有既有链接失效。cookie 方案下：
 *   - 服务端首帧就拿到语言，内容与界面语言一致，无闪烁；
 *   - 站内链接形状不变，切换语言不改变 URL；
 *   - 代价是语言不进 URL，同一链接对不同访客语言不同（对个人站点可接受，
 *     但 RSS / 分享链接因此始终是默认语言——这是明确的取舍，不是遗漏）。
 *
 * 优先级：cookie（手动选择）→ `Accept-Language`（浏览器协商）→ `FALLBACK_LOCALE`。
 *
 * **协商结果不写 cookie**：写进去等于把一次猜测改成了永久偏好。
 * 因此 cookie 的存在与否，正好等价于「用户有没有手动选过」——
 * 不需要额外再存一个「这是默认值还是用户选的」标记位。
 * 只有 `LanguageButton` / 菜单 Settings 里的手动选择才写 cookie。
 */

import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LOCALE,
  detectLocale,
  LOCALE_COOKIE,
  parseLocaleCookie,
  type Locale,
} from './config'

async function readCookieLocale(): Promise<Locale | null> {
  try {
    const store = await cookies()
    return parseLocaleCookie(store.get(LOCALE_COOKIE)?.value)
  } catch {
    // 没有请求上下文（例如构建期静态分析）时当作没有 cookie
    return null
  }
}

async function readNegotiatedLocale(): Promise<Locale | null> {
  try {
    const store = await headers()
    // 同一请求里 header 可能重复出现，`get` 只会拿到第一个；
    // 多值场景（反代合并的 `a, b`）本身就在同一个字符串里，不影响解析。
    // 请求存在但没有 Accept-Language 时，`detectLocale` 会落英文兜底。
    return detectLocale(store.get('accept-language'))
  } catch {
    // 读不到 header store = **根本没有请求上下文**（构建期静态分析、单测直挂组件），
    // 那不是「访客没有语言偏好」，不能拿访客的兜底规则套上去，
    // 否则这些场景会凭空从中文变成英文。返回 null 由调用方用基准语言。
    return null
  }
}

/**
 * 读取当前请求的语言。
 *
 * 放在 React `cache()` 之外是刻意的：cookie 只能在请求作用域读，
 * 而同一次渲染里多个组件各读一次开销可忽略（不产生网络请求）。
 */
export async function getLocale(): Promise<Locale> {
  const stored = await readCookieLocale()
  if (stored) return stored

  // 有请求：detectLocale 已保证落在 zh-CN / en 内（无语言信息 → en）
  // 无请求：退回内容层基准语言，不引入「访客偏好」的假设
  return (await readNegotiatedLocale()) ?? DEFAULT_LOCALE
}
