'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  localeLabel,
  localeName,
  parseLocaleCookie,
  type Locale,
} from '@/lib/i18n/config'
import { ToolbarButton } from './toolbar-button'

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
 * 语言切换的唯一写入点。
 *
 * 菜单 Settings 与右下角按钮都消费这个 hook：cookie 名、有效期、
 * `router.refresh()` 的调用时机只在这里实现一次。
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

interface LanguageButtonProps {
  current: Locale
  label: string
}

/**
 * 语言切换（中文 → English → 中文）
 *
 * 只有两种界面语言，所以这个按钮就是二态开关；精确选择在菜单 Settings 里。
 *
 * 已知边界（写在这里以免被当成 bug）：站点标题、简介、导航名等
 * **站点级身份**不参与后端翻译——`/aggregate` 在 `?lang=en` 下仍返回原文，
 * 后端也没有 UI 文案接口。界面层的按钮与区块标题由本地字典负责。
 */
export function LanguageButton({ current, label }: LanguageButtonProps) {
  const { value, pending, setLocale } = useLocaleSwitcher(current)

  const next: Locale = LOCALES[(LOCALES.indexOf(value) + 1) % LOCALES.length] ?? DEFAULT_LOCALE

  return (
    <ToolbarButton
      label={`${label} · ${localeName(next)}`}
      onClick={() => setLocale(next)}
      aria-busy={pending}
      // 两种语言是有限的，用短标识直接呈现当前语言，比一个通用「语言」图标信息量高
      className={pending ? 'opacity-60' : undefined}
    >
      <span aria-hidden="true" className="text-meta font-mono tracking-tight">
        {localeLabel(value)}
      </span>
    </ToolbarButton>
  )
}
