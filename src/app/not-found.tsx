import Link from 'next/link'
import { Container } from '@/components/ui/container'

export default function NotFound() {
  return (
    <Container>
      <div className="py-24 sm:py-32">
        <p className="meta">404</p>
        <h1 className="mt-3 font-serif text-title text-[var(--text-heading)]">
          这一页不在这里
        </h1>
        <p className="mt-3 max-w-[var(--container-prose)] text-small text-[var(--text-secondary)]">
          链接可能已经过期，或者这个模块在当前主题配置里被关闭了。
        </p>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="link-quiet text-small">
            ← 回到首页
          </Link>
          <Link href="/archives" className="link-quiet text-small">
            浏览归档
          </Link>
          <Link href="/search" className="link-quiet text-small">
            搜索文章
          </Link>
        </div>
      </div>
    </Container>
  )
}
