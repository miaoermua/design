import Link from 'next/link'
import type { SiteIdentity } from '@/lib/api'
import { getPrimaryNav } from '@/core/navigation'
import { siteTitle } from '@/lib/site'
import { MobileNav, NavLinks } from './nav-links'
import { ThemeToggle } from './theme-toggle'

/**
 * 站点头部
 *
 * 唯一使用冰面玻璃的固定元素：滚动时正文从下方穿过，但不会被盖住。
 * 玻璃参数与退化策略在 material.css，这里只负责结构与间距。
 * 模块关闭时对应导航项由 getPrimaryNav 自动过滤，这里不做额外判断。
 */
export function SiteHeader({ identity }: { identity: SiteIdentity | null }) {
  const items = getPrimaryNav()
  const title = siteTitle(identity)

  return (
    <header className="glass-bar sticky top-0 z-30 border-b border-[var(--edge-frost)]">
      <div className="mx-auto flex h-16 max-w-[var(--container-wide)] items-center justify-between gap-4 px-[var(--spacing-gutter)] sm:h-[4.5rem] sm:px-[var(--spacing-gutter-lg)]">
        <Link
          href="/"
          className="font-serif text-[1.1875rem] tracking-[0.005em] text-[var(--text-heading)] transition-colors duration-[var(--duration-fast)] hover:text-[var(--accent-strong)]"
        >
          {title}
        </Link>

        <div className="flex items-center gap-5">
          <nav aria-label="主导航" className="hidden sm:block">
            <NavLinks items={items} />
          </nav>

          <ThemeToggle />

          <div className="sm:hidden">
            <MobileNav items={items} />
          </div>
        </div>
      </div>
    </header>
  )
}
