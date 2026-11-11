import type { Metadata } from 'next'
// KaTeX 已在服务端产出公式 HTML，这里只需要官方排版样式（字体、间距、分数线）。
// 必须排在 globals.css 之前，让 prose.css 的局部覆盖仍然生效。
import 'katex/dist/katex.min.css'
import './globals.css'
// 自托管中文 Web Font：本文件只声明 @font-face，字体栈（--font-sans/--font-serif）定义在 tokens.css 的 @theme 里。
// 保留在 globals.css 之后，与其他样式层保持一致的加载顺序。
import '@/design-system/styles/fonts.css'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { ImageViewer } from '@/components/markdown/image-preview'
import { describeError } from '@/lib/api'
import { getLocale } from '@/lib/i18n/server'
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
  // 与界面/内容语言保持一致：屏幕阅读器按 lang 选择发音，切换语言后必须同步
  const locale = await getLocale()

  return (
    <html lang={locale === 'en' ? 'en' : 'zh-CN'} suppressHydrationWarning>
      <body>
        {/* 防闪：首帧之前决定 data-theme，避免先画浅色再翻黑 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('folio-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.dataset.theme='dark'}}catch(e){}})()",
          }}
        />
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

        {/* 全局唯一的图片预览宿主：正文里的普通图片 / 相册 / 轮播共用 */}
        <ImageViewer />
      </body>
    </html>
  )
}
