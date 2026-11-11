import type { SiteIdentity } from '@/lib/api'
import { getPrimaryNav } from '@/core/navigation'
import { isFeatureEnabled } from '@/core/registry/features'
import { dictionary } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { siteTitle } from '@/lib/site'
import { SiteHeaderClient } from './site-header-client'

/**
 * 站点头部（服务端壳）
 *
 * 职责只有三件：读导航清单、读当前语言、把字典整份交给客户端。
 * 所有交互（滚动隐藏、搜索面板、主题、语言、移动菜单）都在
 * SiteHeaderClient 里，'use client' 的边界压在顶栏这一棵子树内，
 * 页面其余部分仍然是 Server Components。
 *
 * 导航项本身不携带文案，只携带字典键——语言切换后文案跟着变，
 * 而 href 与高亮逻辑不变。
 */
export async function SiteHeader({ identity }: { identity: SiteIdentity | null }) {
  const locale = await getLocale()
  const messages = dictionary(locale)

  return (
    <SiteHeaderClient
      items={getPrimaryNav()}
      title={siteTitle(identity)}
      locale={locale}
      messages={messages}
      searchEnabled={isFeatureEnabled('search')}
    />
  )
}