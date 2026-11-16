'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { LOCALE_COOKIE, parseLocaleCookie, type Locale } from '@/lib/i18n/config'

/**
 * cookie 里当前的手动选择；`null` = 用户还没选过（现在是自动识别的结果）。
 *
 * 这是「手动选择」的唯一凭证：自动识别不写 cookie，所以有 cookie 就是选过。
 */
function readCookieLocale(): Locale | null {
  try {
    for (const part of document.cookie.split(';')) {
      const [name, ...rest] = part.trim().split('=')
      if (name === LOCALE_COOKIE) return parseLocaleCookie(rest.join('='))
    }
  } catch {
    // 隐私模式等读不到 cookie 的情况：当作没选过，这一次点击照常落盘
  }
  return null
}

/**
 * 语言切换的唯一写入点（Footer 的语言选择器消费它）。
 *
 * cookie 名、有效期、`router.refresh()` 的调用时机只在这里实现一次。
 *
 * 走的是 Mix Space 官方的**内容翻译**能力：把语言写进 cookie，
 * 服务端取数时带上 `?lang=en`，后端返回已翻译的标题与正文。
 * 主题自己不做任何机器翻译，也不调用未公开的 AI 接口。
 *
 * **只有这里写 cookie**：`getLocale()` 的浏览器语言协商结果不落盘，
 * 所以没手动选过的访客下次换了浏览器语言仍会重新协商。
 * 一旦选了，就按一年有效期固定下来。
 *
 * 为什么用 cookie + router.refresh() 而不是切换 URL：
 *   - 内容路由由 Mix Space 决定，加 `/[locale]` 前缀会让所有既有链接失效；
 *   - refresh() 重新请求当前路由的 RSC 负载，服务端读到新 cookie 后
 *     内容与界面文案同时更新，URL 不变、滚动位置保留。
 */
export function useLocaleSwitcher(current: Locale) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState<Locale>(current)

  const setLocale = useCallback(
    (next: Locale) => {
      // 早退的判据是 **cookie**，不是 `value`：自动识别也会让 value 等于 next，
      // 而那次点击是用户第一次明确表态，必须落盘——否则访客点「中文」后
      // 换个浏览器语言，识别结果就把他刚做的选择静默覆盖了。
      // 只有「cookie 已经是同一语言」才是真正的重复操作，不必再写一遍。
      if (next === value && readCookieLocale() === next) return
      // 写 cookie：一年有效期，Path=/ 让所有路由都能读到
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
      setValue(next)
      startTransition(() => {
        router.refresh()
      })
    },
    [router, startTransition, value],
  )

  return { value, pending, setLocale }
}
