'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { isNavItemActive, type NavItem } from '@/core/navigation'
import { cn } from '@/lib/utils/cn'

interface NavLinksProps {
  items: NavItem[]
  variant?: 'inline' | 'stacked'
}

export function NavLinks({ items, variant = 'inline' }: NavLinksProps) {
  const pathname = usePathname()

  return (
    <ul
      className={cn(
        variant === 'inline' ? 'flex items-center gap-7' : 'flex flex-col p-2',
      )}
    >
      {items.map((item) => {
        const active = isNavItemActive(item, pathname)
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'transition-colors duration-[var(--duration-fast)]',
                variant === 'inline'
                  ? 'relative block py-1 text-small'
                  : 'block rounded-[var(--radius-sm)] px-3 py-2.5 text-small',
                active
                  ? 'text-[var(--text-heading)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
                active && variant === 'stacked' && 'bg-[var(--accent-wash)]',
              )}
            >
              {item.label}
              {active && variant === 'inline' ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-1 h-px rounded-[var(--radius-pill)] bg-[var(--accent)]"
                />
              ) : null}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** 移动端菜单：仅此一处客户端状态，随路由变化自动收起 */
export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-mobile-nav"
        onClick={() => setOpen((value) => !value)}
        className="meta meta-interactive rounded-[var(--radius-sm)] border border-[var(--edge)] px-2.5 py-1 transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent-line)] hover:bg-[var(--accent-wash)]"
      >
        {open ? '收起' : '目录'}
      </button>
      {open ? (
        <div
          id="site-mobile-nav"
          className="glass-panel absolute inset-x-[var(--spacing-gutter)] top-full mt-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--edge)] shadow-[var(--shadow-pop)]"
        >
          <NavLinks items={items} variant="stacked" />
        </div>
      ) : null}
    </div>
  )
}
