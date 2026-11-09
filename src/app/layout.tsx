import type { Metadata } from 'next'
import './globals.css'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { describeError } from '@/lib/api'
import { loadSiteContext, siteBaseUrl, siteDescription, siteTitle } from '@/lib/site'

/**
 * 主题的每个页面都依赖后端实时内容，因此不做构建期静态预渲染：
 *   - 构建不需要数据库/后端可用；
 *   - fetch 层仍按 revalidate/tags 做数据缓存与按需失效。
 */
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const { identity } = await loadSiteContext()
  const title = siteTitle(identity)
  const description = siteDescription(identity)
  const base = siteBaseUrl(identity)
  const icon = identity?.icon ?? undefined

  return {
    ...(base ? { metadataBase: base } : {}),
    title: { default: title, template: `%s · ${title}` },
    description,
    keywords: identity?.keywords.length ? identity.keywords : undefined,
    applicationName: title,
    icons: icon ? { icon } : undefined,
    openGraph: {
      type: 'website',
      title,
      description,
      siteName: title,
      locale: 'zh_CN',
    },
    twitter: { card: 'summary' },
    alternates: { types: { 'application/rss+xml': '/feed.xml' } },
    robots: { index: true, follow: true },
  }
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { identity, error } = await loadSiteContext()

  return (
    <html lang="zh-CN">
      <body>
        <a
          href="#main"
          className="fixed top-3 left-4 z-50 -translate-y-24 rounded-[var(--radius-sm)] border border-[var(--edge)] bg-[var(--surface-raised)] px-3 py-2 text-small transition-transform duration-[var(--duration-fast)] focus:translate-y-0"
        >
          跳到正文
        </a>

        <div className="paper-grain" aria-hidden="true" />
        <div className="paper-ambient" aria-hidden="true" />

        <div className="site-shell flex min-h-dvh flex-col">
          <SiteHeader identity={identity} />

          {identity ? null : (
            <div
              role="status"
              className="border-b border-[var(--edge)] bg-[var(--surface-sunk)]"
            >
              <div className="mx-auto max-w-[var(--container-wide)] px-5 py-2.5 sm:px-8">
                <p className="font-mono text-meta break-all text-[var(--text-secondary)]">
                  未连接到 Mix Space 后端：{describeError(error)}（设置 MX_SERVER_URL，或
                  MX_MOCK=1 离线预览）
                </p>
              </div>
            </div>
          )}

          <main id="main" className="flex-1">
            {children}
          </main>

          <SiteFooter identity={identity} />
        </div>
      </body>
    </html>
  )
}
