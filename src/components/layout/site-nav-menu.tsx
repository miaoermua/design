'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode, RefObject } from 'react'
import { HOME_NAV, isNavItemActive, type NavEntry } from '@/core/navigation'
import type { Locale } from '@/lib/i18n/config'
import type { MessageKey } from '@/lib/i18n/dictionary'
import { CoverImage } from '@/components/ui/cover-image'
import { NavSettings } from './nav-settings'

interface SiteNavMenuProps {
  /** 由触发器通过 aria-controls 指向；也是测试定位面板的锚点 */
  id: string
  /** 正在播放收起动画（此时仍在 DOM 里，关闭态已对辅助技术生效） */
  closing: boolean
  /**
   * 导航树，与顶栏是同一份。
   *
   * 这里不再收「主导航 / 更多 / 分组」三份数据：菜单只是把同一棵树按
   * `section` 分成两段渲染，父级入口的子项就挂在它自己的 `branch` 上。
   */
  nav: NavEntry[]
  locale: Locale
  messages: Record<MessageKey, string>
  siteName: string
  avatarUrl: string | null
  /** 点击任意导航项后收起菜单（不还原焦点：焦点已经跟着页面走了） */
  onNavigate: () => void
  panelRef: RefObject<HTMLDivElement | null>
  /**
   * 文章目录的预留位（本次不实现）。
   *
   * 位置定在「站点身份」与主导航之间：移动端展开后第一屏就能看到目录，
   * 与设置区（固定在面板底部）互不挤压。
   * 调用方当前不传值 → 这里不留任何空容器、不显示空标题。
   * 下一阶段只需从文章详情页把已经存在的 `TocItem[]` 传进来渲染，
   * 不需要改这个组件的结构，也不需要新增状态。
   */
  tocSlot?: ReactNode
}

/**
 * 完整菜单面板（桌面端与移动端共用一套内容）
 *
 * 结构固定为四段：站点身份 → 主导航 → 更多 → Settings。
 * 桌面端与移动端的差别只在**定位与展开方向**（由 CSS 按断点决定），
 * 内容、顺序、文案、选中态完全同一份，不存在第二套菜单。
 *
 * 它是导航的展开形态，不是第二套导航：每一行都来自 `nav` 里的同一个
 * `NavEntry`，目录型入口的父子关系就写在数据里（`entry.branch`），
 * 不另存一份分组清单，也不手工映射分组标题。
 *
 * 它不是模态对话框：不劫持焦点、不加 `aria-modal`、不锁背景滚动。
 * 菜单只是导航的展开形态——用户随时可以点页面其它地方继续阅读。
 */
export function SiteNavMenu({
  id,
  closing,
  nav,
  locale,
  messages,
  siteName,
  avatarUrl,
  onNavigate,
  panelRef,
  tocSlot,
}: SiteNavMenuProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentQuery = searchParams.toString()
  const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname

  // 同一棵树的两个投影：分区只是呈现，不是第二份配置
  const mainNav = nav.filter((entry) => (entry.section ?? 'main') === 'main')
  const moreNav = nav.filter((entry) => entry.section === 'more')

  return (
    <div
      ref={panelRef}
      id={id}
      className="nav-panel"
      data-motion={closing ? 'leave' : 'enter'}
      // 关闭动画期间对辅助技术已经不可见，避免重复播报同一份链接
      aria-hidden={closing ? 'true' : undefined}
    >
      <div className="nav-panel__scroll">
        {/* A. 站点身份：头像 + 站名，整块是回首页的链接 */}
        <Link href={HOME_NAV.href} onClick={onNavigate} className="nav-identity">
          <span className="nav-identity__avatar">
            {avatarUrl ? (
              <CoverImage src={avatarUrl} alt="" width={40} height={40} className="size-full" />
            ) : (
              <span aria-hidden="true">{siteName.trim().charAt(0) || '·'}</span>
            )}
          </span>
          <span className="nav-identity__text">
            <span className="nav-identity__name">{siteName}</span>
            <span className="nav-identity__hint">{messages[HOME_NAV.label]}</span>
          </span>
        </Link>

        {/* 文章目录的预留位：当前为空，不占高度 */}
        {tocSlot}

        {/* B. 主导航 */}
        <nav aria-label={messages['nav.main']} className="nav-section">
          <ul className="nav-list">
            {mainNav.map((entry) => (
              <NavEntryRow
                key={entry.href}
                entry={entry}
                pathname={pathname}
                currentUrl={currentUrl}
                messages={messages}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </nav>

        {/* C. 更多：同一条树上标了 `section: 'more'` 的入口 */}
        {moreNav.length > 0 ? (
          <section aria-label={messages['nav.more']} className="nav-section nav-section--more">
            <p className="nav-section__title">{messages['nav.more']}</p>
            <ul className="nav-list">
              {moreNav.map((entry) => (
                <NavEntryRow
                  key={entry.href}
                  entry={entry}
                  pathname={pathname}
                  currentUrl={currentUrl}
                  messages={messages}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {/* D. Settings：固定在面板底部，滚动只发生在上面那一段 */}
      <div className="nav-panel__settings">
        <NavSettings locale={locale} messages={messages} />
      </div>
    </div>
  )
}

/**
 * 一行导航。
 *
 * 普通入口就是一条链接；目录型入口用原生 `<details>`：触屏没有 hover，
 * 折叠列表是唯一能让「分类几十条」不把菜单撑爆的形态，且键盘与无 JS 都可用。
 * 折叠头本身不是链接（点它是展开），进入该入口自身列表页的链接是
 * 折叠区的第一项——它的 href 取自 `entry`，不在数据里再存一份。
 */
function NavEntryRow({
  entry,
  pathname,
  currentUrl,
  messages,
  onNavigate,
}: {
  entry: NavEntry
  pathname: string
  currentUrl: string
  messages: Record<MessageKey, string>
  onNavigate: () => void
}) {
  const active = isNavItemActive(entry, pathname)
  const branch = entry.branch

  if (!branch) {
    return (
      <li>
        <Link
          href={entry.href}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          data-active={active ? 'true' : undefined}
          className="nav-row"
        >
          {messages[entry.label]}
        </Link>
      </li>
    )
  }

  // 已经在这个入口的详情页里时默认展开，省一次点击
  const hasActiveChild = branch.items.some(
    (item) => item.href === currentUrl || item.href === pathname,
  )
  const onListPage = pathname === entry.href

  return (
    <li>
      <details className="nav-group" open={active || hasActiveChild || undefined}>
        <summary className="nav-group__summary" data-active={active ? 'true' : undefined}>
          <span>{messages[entry.label]}</span>
          <ChevronIcon />
        </summary>

        <ul className="nav-group__list">
          <li>
            <Link
              href={entry.href}
              onClick={onNavigate}
              aria-current={onListPage ? 'page' : undefined}
              data-active={onListPage ? 'true' : undefined}
              className="nav-row nav-row--child"
            >
              {messages[branch.entryLabel]}
            </Link>
          </li>

          {branch.status === 'ok' ? (
            branch.items.map((item) => {
              const itemActive = item.href === currentUrl
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={itemActive ? 'page' : undefined}
                    data-active={itemActive ? 'true' : undefined}
                    title={item.label}
                    className="nav-row nav-row--child"
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })
          ) : (
            <li className="nav-group__empty">
              {messages[branch.status === 'error' ? branch.errorLabel : branch.emptyLabel]}
            </li>
          )}
        </ul>
      </details>
    </li>
  )
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="nav-group__chevron"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
