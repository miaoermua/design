import Link from 'next/link'
import type { SiteIdentity } from '@/lib/api'
import { getPrimaryNav } from '@/core/navigation'
import { siteTitle } from '@/lib/site'
import { MobileNav, NavLinks } from './nav-links'

/**
 * 站点头部
 *
 * 唯一使用毛玻璃的固定元素：滚动时正文从下方穿过，但不会盖住导航。
 * 模块关闭时对应导航项由 getPrimaryNav 自动过滤，这里不做额外判断。
 */
export function SiteHeader({ identity }: { identity: SiteIdentity | null }) {
  const items = getPrimaryNav()
  const title = siteTitle(identity)

  return (
    <header className="glass-bar sticky top-0 z-30 border-b border-[var(--edge)]">
      <div className="mx-auto flex h-16 max-w-[var(--container-wide)] items-center gap-4 px-5 sm:px-8">
        <Link
          href="/"
          className="font-serif text-[1.125rem] tracking-[0.01em] text-[var(--text-primary)]"
        >
          {title}
        </Link>

        <nav aria-label="主导航" className="ml-auto hidden sm:block">
          <NavLinks items={items} />
        </nav>

        <div className="ml-auto sm:hidden">
          <MobileNav items={items} />
        </div>
      </div>
    </header>
  )
}
