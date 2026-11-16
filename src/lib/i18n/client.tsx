'use client'

/**
 * 客户端语言上下文
 *
 * 为什么需要它：界面文案分散在几十个客户端组件里（评论、相册、代码块、订阅面板……），
 * 逐层传 `locale` 会让每个中间组件都被迫多一个与自己无关的 prop。
 * 一个只有 20 行的 context 让组件各自取语言，而**服务端组件仍然直接用
 * `t(locale, key)`**——RSC 里不能用 hook，两条路径各自清晰。
 *
 * 不是国际化框架：不处理路由、不处理复数、不处理加载，只有「当前是哪种语言」。
 * 没有 Provider 时回退到默认语言，因此单独渲染某个组件的测试不需要额外包裹。
 */

import { createContext, useContext, type ReactNode } from 'react'
import { DEFAULT_LOCALE, type Locale } from './config'

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}
