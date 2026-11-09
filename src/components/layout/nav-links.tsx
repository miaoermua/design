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
    <ul className={cn(variant === 'inline' ? 'flex items-center gap-6' : 'flex flex-col gap-1')}>
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
                  : 'block px-3 py-2 text-small',
                active
                  ? 'text-[var(--text-primary)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {item.label}
              {active && variant === 'inline' ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-0.5 h-px bg-[var(--accent)]"
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
        className="meta rounded-[var(--radius-sm)] border border-[var(--edge)] px-2.5 py-1 text-[var(--text-secondary)]"
      >
        {open ? '收起' : '目录'}
      </button>
      {open ? (
        <div
          id="site-mobile-nav"
          className="absolute inset-x-0 top-full border-y border-[var(--edge)] bg-[var(--surface-raised)] py-2 shadow-[var(--shadow-raise)]"
        >
          <NavLinks items={items} variant="stacked" />
        </div>
      ) : null}
    </div>
  )
}
