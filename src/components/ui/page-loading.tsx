import { Container } from '@/components/ui/container'

/**
 * 服务端渲染的加载骨架：不使用全局 spinner，保持版面稳定。
 *
 * 只挂在**不会 404** 的路由上（archives/tags/search/about/friends）。
 * 根级 loading.tsx 会让整个响应立刻开始流式输出，详情页的 notFound()
 * 就只能在 200 之后才渲染出来，变成软 404。
 */
export function PageLoading() {
  return (
    <Container>
      <div className="animate-pulse pt-16 pb-8" aria-busy="true" aria-live="polite">
        <span className="sr-only">正在加载</span>
        <div className="h-3 w-16 bg-[var(--surface-sunk)]" />
        <div className="mt-5 h-9 w-2/3 bg-[var(--surface-sunk)]" />
        <div className="mt-3 h-3 w-1/2 bg-[var(--surface-sunk)]" />
        <div className="mt-12 space-y-6 border-t border-dashed border-[var(--edge)] pt-8">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="space-y-3">
              <div className="h-2.5 w-20 bg-[var(--surface-sunk)]" />
              <div className="h-5 w-3/4 bg-[var(--surface-sunk)]" />
              <div className="h-3 w-full max-w-[36rem] bg-[var(--surface-sunk)]" />
            </div>
          ))}
        </div>
      </div>
    </Container>
  )
}
