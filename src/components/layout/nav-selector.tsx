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
 * 顶栏的目录型入口（首页 Pages / Blog 分类 / Note 专栏）。
 *
 * 入口标签本身就是菜单触发器：不再挂一个可见的「更多」圆点按钮，
 * 菜单与标签是同一个交互面。标签仍是真实链接——
 *   - 鼠标：悬停预览，点击直接导航；
 *   - 键盘：ArrowDown 打开并聚焦首项，方向键 / Home / End 移动；
 *   - 触屏没有 hover：第一次点按展开菜单，再点一次才导航。
 * 离开后通过短暂延迟与根节点包含判断保留安全三角过渡区。
 * 不用 ARIA menu：面板内容是普通链接，不需要 roving tabindex 契约。
 */
export function NavSelector({ group, messages }: NavSelectorProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const pinned = useRef(false)
  const closeTimerRef = useRef<number | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLAnchorElement>(null)
  /** 记录本次点击来自哪种指针：触屏需要「先开菜单、再导航」两段式 */
  const lastPointerType = useRef<string | null>(null)
  const panelId = useId()

  const active = isGroupActive(group, pathname)
  const isHomeMenu = group.href === '/'

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
  const selectedHomeItem = isHomeMenu ? group.items.find((item) => isItemActive(item.href)) : null
  const triggerLabel = selectedHomeItem?.label ?? messages[group.label]
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
        aria-current={
          isHomeMenu ? (pathname === '/' ? 'page' : undefined) : active ? 'page' : undefined
        }
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType
        }}
        onClick={(event) => {
          const pointerType = lastPointerType.current
          lastPointerType.current = null

          // 触屏没有 hover：第一次点按展开菜单，再点一次才导航（与原生
          // hover 菜单在触屏上的行为一致）。鼠标与键盘保持直达链接。
          if (pointerType && pointerType !== 'mouse') {
            if (open) {
              close(false)
              return
            }
            event.preventDefault()
            clearCloseTimer()
            pinned.current = true
            setOpen(true)
            return
          }

          close(false)
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
            window.requestAnimationFrame(focusFirstItem)
          }
          if (event.key === 'Escape' && open) {
            event.preventDefault()
            close(true)
          }
        }}
        className={cn(
          'nav-label flex items-center rounded-full px-3 py-1.5 transition-colors duration-[var(--duration-fast)]',
          active
            ? 'bg-[var(--accent-wash)] text-[var(--text-heading)]'
            : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
        )}
      >
        {triggerLabel}
      </a>

      {open ? (
        <div className="absolute top-full left-0 z-50 w-[min(18rem,calc(100vw-2rem))] pt-2">
          <div
            id={panelId}
            onKeyDown={handlePanelKeyDown}
            className="motion-panel-in glass-panel overflow-hidden"
          >
            <ul className="max-h-[min(70dvh,32rem)] overflow-y-auto p-1.5">
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
                        'nav-panel-link block truncate rounded-[var(--radius-sm)] px-3 py-2 transition-colors duration-[var(--duration-fast)]',
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
