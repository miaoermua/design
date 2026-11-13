'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { isNavItemActive, type NavGroup, type NavItem } from '@/core/navigation'
import type { Locale } from '@/lib/i18n/config'
import type { MessageKey } from '@/lib/i18n/dictionary'
import { cn } from '@/lib/utils/cn'
import { LanguageButton } from './language-button'
import { NavSelector } from './nav-selector'
import { SearchPanel } from './search-panel'
import { ThemeToggle } from './theme-toggle'
import { ToolbarButton, ToolbarGroup } from './toolbar-button'
import { useHeaderScroll } from './use-header-scroll'

interface SiteHeaderClientProps {
  /** 目录型入口：Blog 分类 / Note 专栏 / Pages */
  groups: NavGroup[]
  /** 普通链接入口：探索 / 友链 */
  links: NavItem[]
  locale: Locale
  messages: Record<MessageKey, string>
  /** 是否有搜索模块；关闭时不渲染搜索按钮 */
  searchEnabled: boolean
}

/**
 * 悬浮顶栏
 *
 * 形态：整行顶栏 → 收在版心内的圆角浮条。
 * 它不再是页面的「顶边」，而是一块浮在纸面上的薄片：
 *   - 外侧留出边距，滚动时正文从浮条两侧与下方穿过；
 *   - 圆角 + 细边 + 投影建立独立层级，不靠整行实色块压迫版面；
 *   - 玻璃参数沿用现有材质层，没有新增材质（见 material.css）。
 *
 * 滚动行为在 useHeaderScroll：向下累计 96px 隐藏、向上累计 40px 显示，
 * 页首恒显。搜索面板打开或输入聚焦时锁定为显示——顶栏不能从操作中途滑走。
 *
 * 布局约束：工具组是独立组件，不写死在导航里。未来换位置或换组合，
 * 改的是这个文件里的一处挂载点。
 */
export function SiteHeaderClient({
  groups,
  links,
  locale,
  messages,
  searchEnabled,
}: SiteHeaderClientProps) {
  const pathname = usePathname()
  const homeGroup = groups.find((group) => group.href === '/')
  const [searchOpen, setSearchOpen] = useState(false)

  // 搜索面板打开时锁定顶栏（不允许隐藏）
  const { hidden, detached } = useHeaderScroll(searchOpen)

  const closeSearch = useCallback(() => setSearchOpen(false), [])

  // ⌘K / Ctrl+K 打开搜索，Esc 关闭；不拦截输入框里的普通输入
  useEffect(() => {
    if (!searchEnabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      const isK = event.key.toLowerCase() === 'k'
      if (isK && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setSearchOpen((open) => !open)
        return
      }
      // Escape 只在面板由本组件打开时处理；面板内部也有自己的处理
      if (event.key === 'Escape') setSearchOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchEnabled])

  /**
   * 隐藏状态用内联 transform 而不是 Tailwind 任意值类。
   *
   * 原因：`-translate-y-[calc(100%+0.75rem)]` 在 Tailwind v4 的任意值里
   * 需要把 `+` 写成空格，容易失效且构建时不报错——实测该类没有被生成，
   * 导致 state 正确但 transform 仍是 none。这里直接写 transform，
   * 位移量用 CSS 变量拼出来，语义清楚也不依赖工具类解析。
   */
  const HIDDEN_TRANSFORM = 'translate3d(0, calc(-100% - 0.75rem), 0)'

  return (
    <>
      <header
        style={{ transform: hidden ? HIDDEN_TRANSFORM : 'translate3d(0, 0, 0)' }}
        className={cn('site-header-bar fixed inset-x-0 top-0 z-40 pt-3 sm:pt-4')}
      >
        <div className="mx-auto w-full max-w-[var(--container-wide)] px-[var(--spacing-gutter)] sm:px-[var(--spacing-gutter-lg)]">
          <div
            className={cn(
              'glass-bar mx-auto flex h-14 w-full max-w-full items-center gap-3 rounded-[var(--radius-pill)] px-2 sm:h-[3.75rem] sm:px-3 md:w-fit',
              // 脱离页首后才显示投影：在顶部时它与纸面是一体的
              detached ? 'shadow-[var(--shadow-pop)]' : undefined,
            )}
          >
            {/* 目录型入口收进选择器，避免把 Pages / 分类 / 专栏条目铺满顶栏。 */}
            <nav aria-label="主导航" className="hidden min-w-0 md:block">
              <ul className="flex items-center gap-1">
                {groups.map((group) => (
                  <li key={group.key}>
                    <NavSelector group={group} messages={messages} />
                  </li>
                ))}

                {links.map((item) => {
                  const active = isNavItemActive(item, pathname)
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'text-small rounded-full px-3 py-1.5 transition-colors duration-[var(--duration-fast)]',
                          active
                            ? 'bg-[var(--accent-wash)] text-[var(--text-heading)]'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
                        )}
                      >
                        {messages[item.label]}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className="ml-auto flex flex-1 items-center justify-between md:hidden">
              {homeGroup ? (
                <NavSelector group={homeGroup} messages={messages} />
              ) : (
                <Link
                  href="/"
                  aria-current={pathname === '/' ? 'page' : undefined}
                  className="text-small rounded-full px-3 py-1.5 text-[var(--text-secondary)]"
                >
                  {messages['nav.home']}
                </Link>
              )}
              <MobileMenu
                groups={groups.filter((group) => group.href !== '/')}
                links={links}
                messages={messages}
              />
            </div>
          </div>
        </div>
      </header>

      {/* 固定顶栏不占文档流：占位块保证正文不被浮条盖住 */}
      <div aria-hidden="true" className="h-[calc(3.5rem+0.75rem)] sm:h-[calc(3.75rem+1rem)]" />

      <div className="fixed right-4 bottom-28 z-50 sm:right-6 sm:bottom-32">
        {/* 无 JS 时的搜索出口：搜索面板不可用时仍保留普通链接。 */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<a href="/search" class="text-meta px-2 py-1.5 text-[var(--text-secondary)] underline decoration-[var(--edge-strong)] underline-offset-4">${messages['action.search']}</a>`,
          }}
        />
        <ToolbarGroup>
          {searchEnabled ? (
            <ToolbarButton
              label={messages['action.search']}
              onClick={() => setSearchOpen(true)}
              active={searchOpen}
            >
              <SearchIcon />
            </ToolbarButton>
          ) : null}

          <ThemeToggle label={messages['action.mode']} />

          <LanguageButton current={locale} label={messages['action.language']} />

          <ToolbarButton
            label={messages['action.backToTop']}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <ArrowUpIcon />
          </ToolbarButton>
        </ToolbarGroup>
      </div>

      {searchEnabled ? (
        <SearchPanel
          open={searchOpen}
          onClose={closeSearch}
          labels={{
            title: messages['action.search'],
            placeholder: messages['search.placeholder'],
            empty: messages['search.empty'],
            emptyHint: messages['search.emptyHint'],
            loading: messages['search.loading'],
            failed: messages['search.failed'],
            hint: messages['search.hint'],
            openFull: messages['search.openFull'],
          }}
        />
      ) : null}
    </>
  )
}

/**
 * 移动端菜单：仅此一处客户端状态，随路由变化自动收起。
 *
 * 目录型入口在菜单里直接展开成小列表——触屏没有「悬停」可用，
 * 再套一层折叠只会让用户多点两次。列表超出可视高度时在面板内滚动。
 */
function MobileMenu({
  groups,
  links,
  messages,
  className,
}: {
  groups: NavGroup[]
  links: NavItem[]
  messages: Record<MessageKey, string>
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  return (
    <div className={cn('relative', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-mobile-nav"
        aria-label={messages['action.menu']}
        onClick={() => setOpen((value) => !value)}
        className="flex size-10 items-center justify-center rounded-full border border-[var(--edge)] bg-[var(--surface-raised)] text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--surface-sunk)] hover:text-[var(--text-heading)]"
      >
        {open ? <CloseIcon /> : <MenuIcon />}
      </button>

      {open ? (
        <div
          id="site-mobile-nav"
          className="glass-panel absolute top-[calc(100%+0.5rem)] right-0 max-h-[min(45vh,20rem)] w-[min(17rem,calc(100vw-2rem))] overflow-y-auto"
        >
          <ul className="flex flex-col p-1.5">
            {groups.map((group) => (
              <li key={group.key}>
                {group.href === '/' ? null : (
                  <p className="text-meta px-3 pt-2 pb-1 text-[var(--text-tertiary)]">
                    {messages[group.label]}
                  </p>
                )}
                <Link
                  href={group.href}
                  aria-current={pathname === group.href ? 'page' : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'text-small block rounded-[var(--radius-sm)] px-3 py-2 transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-wash)]',
                    pathname === group.href
                      ? 'bg-[var(--accent-wash)] text-[var(--text-heading)]'
                      : 'text-[var(--text-heading)]',
                  )}
                >
                  {messages[group.allLabel]}
                </Link>
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="text-meta block truncate rounded-[var(--radius-sm)] py-1.5 pr-3 pl-6 text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-wash)] hover:text-[var(--text-heading)]"
                  >
                    {item.label}
                  </Link>
                ))}
                {group.status !== 'ok' ? (
                  <p className="text-meta px-3 py-1.5 text-[var(--text-tertiary)]">
                    {messages[group.status === 'error' ? group.errorLabel : group.emptyLabel]}
                  </p>
                ) : null}
              </li>
            ))}

            {links.map((item) => {
              const active = isNavItemActive(item, pathname)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'text-small mt-1 block rounded-[var(--radius-sm)] px-3 py-2.5 transition-colors duration-[var(--duration-fast)]',
                      active
                        ? 'bg-[var(--accent-wash)] text-[var(--text-heading)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
                    )}
                  >
                    {messages[item.label]}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[1.05rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

function ArrowUpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[1.05rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[1.15rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[1.15rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
