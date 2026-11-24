import { Container } from '@/components/ui/container'
import { t } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'

/**
 * 服务端渲染的加载骨架：不使用全局 spinner，保持版面稳定。
 *
 * 只挂在**不会 404** 的路由上（tags/search/about/friends，
 * 以及 articles/diaries/explore/projects/says/categories 这些列表页）。
 * 纯重定向路由（`/notes`、`/archives`）一律不挂：有 Suspense 边界时
 * 重定向会降级成 200 + `<meta refresh>`，拿不到真正的 3xx。
 *
 * **详情页刻意不挂**。根级或详情段的 `loading.tsx` 会让响应立刻开始流式输出，
 * 于是 `notFound()` 只能在状态码 200 之后才渲染出来，硬 404 变成软 404 ——
 * 对爬虫与订阅者都是错误信号。宁可详情页多等一会儿白屏，也不要错误的 200。
 *
 * `variant` 只描述**骨架的形状**，不引入第二套视觉：
 *   - `rows`（默认）      标题 + 若干条「元信息 / 标题 / 摘要」行，服务列表页
 *   - `timeline`          同样内容，但左侧留出 3.75rem 时间列，服务日记列表
 *     的形状与真实列表一致，避免骨架→内容的宽度跳变
 */
interface PageLoadingProps {
  variant?: 'rows' | 'timeline'
  rows?: number
}

export async function PageLoading({ variant = 'rows', rows = 4 }: PageLoadingProps) {
  const locale = await getLocale()
  const timeline = variant === 'timeline'

  return (
    <Container>
      <div className="animate-pulse pt-16 pb-8" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t(locale, 'state.loading')}</span>
        <div className="h-3 w-16 bg-[var(--surface-sunk)]" />
        <div className="mt-5 h-9 w-2/3 bg-[var(--surface-sunk)]" />
        <div className="mt-3 h-3 w-1/2 bg-[var(--surface-sunk)]" />
        <div className="mt-12 space-y-6 border-t border-dashed border-[var(--edge)] pt-8">
          {Array.from({ length: rows }, (_, index) => (
            <div
              key={index}
              className={timeline ? 'grid gap-2 sm:grid-cols-[3.75rem_1fr] sm:gap-5' : undefined}
            >
              {timeline ? <div className="h-2.5 w-14 bg-[var(--surface-sunk)]" /> : null}
              <div className="space-y-3">
                <div className="h-2.5 w-20 bg-[var(--surface-sunk)]" />
                <div className="h-5 w-3/4 bg-[var(--surface-sunk)]" />
                <div className="h-3 w-full max-w-[36rem] bg-[var(--surface-sunk)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}
