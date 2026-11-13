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

function MoreIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="currentColor">
      <circle cx="5" cy="12" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="19" cy="12" r="1.4" />
    </svg>
  )
}

function isGroupActive(group: NavGroup, pathname: string): boolean {
  return group.matchPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

/**
 * 顶栏的目录型入口（首页 Pages / Blog 分类 / Note 专栏）。
 *
 * 主入口保留真实链接，旁边的更多按钮负责钉住子菜单；鼠标悬停仍可预览，
 * 离开后通过短暂延迟与根节点包含判断保留安全三角过渡区。
 * 键盘可用 ArrowDown 打开、方向键 / Home / End 移动，Escape 关闭并还焦点。
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

  const togglePinned = () => {
    if (open && pinned.current) {
      close(false)
      return
    }
    pinned.current = true
    setOpen(true)
  }

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
      <div className="flex items-center gap-0.5">
        <a
          ref={triggerRef}
          href={group.href}
          aria-current={isHomeMenu ? (pathname === '/' ? 'page' : undefined) : active ? 'page' : undefined}
          onClick={() => close(false)}
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
            'text-small flex items-center rounded-full px-3 py-1.5 transition-colors duration-[var(--duration-fast)]',
            active
              ? 'bg-[var(--accent-wash)] text-[var(--text-heading)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
          )}
        >
          {triggerLabel}
        </a>
        <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? panelId : undefined}
            aria-label={`${open ? messages['action.close'] : messages['nav.directory']}: ${triggerLabel}`}
            title={`${open ? messages['action.close'] : messages['nav.directory']}: ${triggerLabel}`}
            onClick={togglePinned}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setOpen(true)
                window.requestAnimationFrame(focusFirstItem)
              }
            }}
            className={cn(
              'flex size-7 items-center justify-center rounded-full transition-colors duration-[var(--duration-fast)]',
              open
                ? 'bg-[var(--accent-wash)] text-[var(--accent-strong)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--surface-sunk)] hover:text-[var(--text-heading)]',
            )}
          >
            <MoreIcon />
        </button>
      </div>

      {open ? (
        <div className="absolute top-full left-0 z-50 w-[min(18rem,calc(100vw-2rem))] pt-2">
          <div
            id={panelId}
            onKeyDown={handlePanelKeyDown}
            className="motion-panel-in overflow-hidden rounded-[var(--radius-md)] border border-[var(--edge)] bg-[var(--surface-raised)] shadow-[var(--shadow-pop)]"
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
