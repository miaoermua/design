'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { NavGroup } from '@/core/navigation'
import type { MessageKey } from '@/lib/i18n/dictionary'
import { cn } from '@/lib/utils/cn'

interface NavSelectorProps {
  group: NavGroup
  messages: Record<MessageKey, string>
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.matchPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * 顶栏的目录型入口（Blog 分类 / Note 专栏 / Pages）。
 *
 * 交互按「鼠标 + 键盘 + 触屏」三套输入统一设计：
 *   - 鼠标：悬停展开，移出收起；点击可把面板钉住，便于在长列表里慢慢选。
 *   - 触屏：点击展开；点面板外或按 Esc 关闭。
 *   - 键盘：Enter/Space 展开，↑↓/Home/End 在条目间移动，Esc 关闭并把焦点还给按钮。
 *
 * 不用 ARIA menu：menu 角色要求一整套 roving tabindex 与首字母跳转契约，
 * 而这里的内容是普通链接。用「触发器 + aria-expanded + 链接列表」是更诚实的语义。
 *
 * 触发器是 `<a href={group.href}>` 而不是 button：无 JS 时它就是普通链接
 * （/articles、/diaries、/pages 仍然可达），有 JS 时点击才被拦下来展开面板。
 */
export function NavSelector({ group, messages }: NavSelectorProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const pinned = useRef(false)
  const closeTimerRef = useRef<number | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLAnchorElement>(null)
  const panelId = useId()

  const active = isGroupActive(group, pathname)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleMouseClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      if (!pinned.current) setOpen(false)
    }, 180)
  }, [clearCloseTimer])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  const close = useCallback(
    (restoreFocus: boolean) => {
      clearCloseTimer()
      pinned.current = false
      setOpen(false)
      if (restoreFocus) triggerRef.current?.focus()
    },
    [clearCloseTimer],
  )

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close(true)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  const focusFirstItem = () => {
    const items = rootRef.current?.querySelectorAll<HTMLAnchorElement>('[data-nav-item]')
    items?.[0]?.focus()
  }

  const handlePanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      rootRef.current?.querySelectorAll<HTMLAnchorElement>('[data-nav-item]') ?? [],
    )
    if (items.length === 0) return

    const index = items.findIndex((item) => item === document.activeElement)

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(index + 1) % items.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      items[(index - 1 + items.length) % items.length]?.focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      items[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      items[items.length - 1]?.focus()
    }
  }

  // 按「路径 + 查询串」整体比对：只看 pathname 会让 /articles 与
  // /articles?page=2 同时被标成当前页，用户看不出自己在第几页。
  const currentQuery = searchParams.toString()
  const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname
  const isItemActive = (href: string) => href === currentUrl
  // 「全部 X」代表的就是分组根路径：带分页参数时仍然算在它下面
  const allActive = pathname === group.href

  return (
    <div
      ref={rootRef}
      className="relative"
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') {
          clearCloseTimer()
          setOpen(true)
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse' || pinned.current) return
        const nextTarget = event.relatedTarget
        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return
        scheduleMouseClose()
      }}
      onBlur={(event) => {
        // 焦点移出整棵子树（Tab 走开）时收起；面板内的移动不算
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close(false)
      }}
    >
      <a
        ref={triggerRef}
        href={group.href}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={(event) => {
          // 有 JS 时只展开，不导航；无 JS 时这段不会执行，链接照常跳转
          event.preventDefault()
          if (open && pinned.current) {
            close(false)
            return
          }
          pinned.current = true
          setOpen(true)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            // 等面板挂载后再移动焦点
            window.requestAnimationFrame(focusFirstItem)
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            close(true)
          }
        }}
        className={cn(
          'text-small flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors duration-[var(--duration-fast)]',
          active
            ? 'bg-[var(--accent-wash)] text-[var(--text-heading)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
        )}
      >
        {messages[group.label]}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={cn(
            'size-3 text-[var(--text-tertiary)] transition-transform duration-[var(--duration-fast)]',
            open ? 'rotate-180' : undefined,
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </a>

      {open ? (
        <div className="absolute top-full left-0 z-50 w-[min(17rem,calc(100vw-2rem))] pt-2">
          <div
            id={panelId}
            onKeyDown={handlePanelKeyDown}
            className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--edge)] bg-[var(--surface-raised)] shadow-[var(--shadow-pop)]"
          >
            <ul className="max-h-[min(40vh,14rem)] overflow-y-auto p-1.5">
              <li>
                <Link
                  href={group.href}
                  data-nav-item
                  aria-current={allActive ? 'page' : undefined}
                  onClick={() => close(false)}
                  className={cn(
                    'text-small block rounded-[var(--radius-sm)] px-3 py-2 transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-wash)]',
                    allActive
                      ? 'bg-[var(--accent-wash)] text-[var(--text-heading)]'
                      : 'text-[var(--text-heading)]',
                  )}
                >
                  {messages[group.allLabel]}
                </Link>
              </li>

              {group.items.map((item) => {
                const itemActive = isItemActive(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      data-nav-item
                      aria-current={itemActive ? 'page' : undefined}
                      onClick={() => close(false)}
                      title={item.label}
                      className={cn(
                        'text-small block truncate rounded-[var(--radius-sm)] px-3 py-2 transition-colors duration-[var(--duration-fast)]',
                        itemActive
                          ? 'bg-[var(--accent-wash)] text-[var(--text-heading)]'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--accent-wash)] hover:text-[var(--text-heading)]',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>

            {group.status !== 'ok' ? (
              <p className="text-meta border-t border-dashed border-[var(--edge)] px-3 py-2.5 text-[var(--text-tertiary)]">
                {messages[group.status === 'error' ? group.errorLabel : group.emptyLabel]}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
