'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALES,
  localeName,
  type Locale,
} from '@/lib/i18n/config'
import { ToolbarButton } from './toolbar-button'

interface LanguageButtonProps {
  current: Locale
  label: string
}

/**
 * 语言切换
 *
 * 走的是 Mix Space 官方的**内容翻译**能力：把语言写进 cookie，
 * 服务端取数时带上 `?lang=en`，后端返回已翻译的标题与正文。
 * 主题自己不做任何机器翻译，也不调用未公开的 AI 接口。
 *
 * 为什么用 cookie + router.refresh() 而不是切换 URL：
 *   - 内容路由由 Mix Space 决定，加 `/[locale]` 前缀会让所有既有链接失效；
 *   - refresh() 重新请求当前路由的 RSC 负载，服务端读到新 cookie 后
 *     内容与界面文案同时更新，URL 不变、滚动位置保留。
 *
 * 已知边界（写在这里以免被当成 bug）：站点标题、简介、导航名等
 * **站点级身份**不参与后端翻译——`/aggregate` 在 `?lang=en` 下仍返回原文，
 * 后端也没有 UI 文案接口。界面层的按钮与区块标题由本地字典负责。
 */
export function LanguageButton({ current, label }: LanguageButtonProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState<Locale>(current)

  const next: Locale = LOCALES[(LOCALES.indexOf(value) + 1) % LOCALES.length] ?? DEFAULT_LOCALE

  const toggle = () => {
    // 写 cookie：一年有效期，Path=/ 让所有路由都能读到
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    setValue(next)
    startTransition(() => {
      router.refresh()
    })
  }

  return (
    <ToolbarButton
      label={`${label} · ${localeName(next)}`}
      onClick={toggle}
      aria-busy={pending}
      // 语言是二态的，用短码直接呈现当前状态，比一个通用「语言」图标信息量高
      className={pending ? 'opacity-60' : undefined}
    >
      <span aria-hidden="true" className="font-mono text-meta tracking-tight">
        {value === 'en' ? 'EN' : '中'}
      </span>
    </ToolbarButton>
  )
}