/**
 * 服务端读取当前语言
 *
 * 语言存在 cookie 里（而不是 URL 段）：Folio 的内容路由已经由 Mix Space 决定，
 * 再加一层 `/[locale]` 前缀会让所有既有链接失效。cookie 方案下：
 *   - 服务端首帧就拿到语言，内容与界面语言一致，无闪烁；
 *   - 站内链接形状不变，切换语言不改变 URL；
 *   - 代价是语言不进 URL，同一链接对不同访客语言不同（对个人站点可接受，
 *     但 RSS / 分享链接因此始终是默认语言——这是明确的取舍，不是遗漏）。
 */

import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config'

/**
 * 读取当前请求的语言。
 *
 * 放在 React `cache()` 之外是刻意的：cookie 只能在请求作用域读，
 * 而同一次渲染里多个组件各读一次开销可忽略（不产生网络请求）。
 */
export async function getLocale(): Promise<Locale> {
  try {
    const store = await cookies()
    const value = store.get(LOCALE_COOKIE)?.value
    return isLocale(value) ? value : DEFAULT_LOCALE
  } catch {
    // 在没有请求上下文的场景（例如构建期静态分析）回退到默认语言
    return DEFAULT_LOCALE
  }
}