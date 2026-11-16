'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useCallback, type ReactNode, type RefObject, type SyntheticEvent } from 'react'
import { hasLanding, HOME_NAV, isNavItemActive, type NavEntry } from '@/core/navigation'
import type { MessageKey } from '@/lib/i18n/dictionary'
import { CoverImage } from '@/components/ui/cover-image'

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
 * 结构固定为三段：站点身份 → 一张导航列表。
 * 列表里每一行都来自 `nav` 里的同一个 `NavEntry`；「更多」只是这张列表的
 * 最后一行（`section: 'more'` 的入口收在它自己的折叠里），不是第四个分区。
 * 桌面端与移动端的差别只在**定位与展开方向**（由 CSS 按断点决定），
 * 内容、顺序、文案、选中态完全同一份，不存在第二套菜单。
 *
 * 它是导航的展开形态，不是第二套导航：目录型入口的父子关系就写在数据里
 * （`entry.branch`），不另存一份分组清单，也不手工映射分组标题。
 *
 * 它不是模态对话框：不劫持焦点、不加 `aria-modal`、不锁背景滚动。
 * 菜单只是导航的展开形态——用户随时可以点页面其它地方继续阅读。
 */
export function SiteNavMenu({
  id,
  closing,
  nav,
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

  /**
   * 手风琴：展开一组时收起同一张列表里的其它组。
   *
   * 不用 React state 管「哪一组开着」——`<details>` 的 open 本来就是
   * 浏览器自己的状态，接管它反而要多维护一份副本，还会在无 JS 时失效。
   * 这里只在 `toggle` 事件里把兄弟节点关掉，DOM 仍是唯一事实来源。
   *
   * 收起的理由：一行展开后会把后面的入口推到面板底部之外，列表一长
   * 就要边滚边找；同时只开一组，面板高度稳定，也更容易看出
   * 「展开的是哪一个」。
   */
  const onGroupToggle = useCallback((event: SyntheticEvent<HTMLDetailsElement>) => {
    const current = event.currentTarget
    // 只在「刚展开」时处理；收起是用户自己的动作，不需要连带处理
    if (!current.open) return
    const scope = current.closest('.nav-list')
    if (!scope) return
    for (const other of scope.querySelectorAll<HTMLDetailsElement>('details')) {
      if (other !== current && other.open) other.open = false
    }
  }, [])

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

        {/* B. 主导航 + 更多：同一张列表里的若干行 */}
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
                onGroupToggle={onGroupToggle}
              />
            ))}

            {/*
             * 「更多」是**一行菜单**，不是一个分区：它和其他入口一样是
             * 可折叠的一行（`<details>`），子项收在自己的折叠里。
             * 上一版把它做成带标题的虚线分区，读起来像另一份清单；
             * 现在它就是这张列表里的最后一行，只是没有自己的落地页。
             */}
            {moreNav.length > 0 ? (
              <NavMoreGroup
                entries={moreNav}
                pathname={pathname}
                currentUrl={currentUrl}
                messages={messages}
                onNavigate={onNavigate}
                onGroupToggle={onGroupToggle}
              />
            ) : null}
          </ul>
        </nav>
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
  onGroupToggle,
}: {
  entry: NavEntry
  pathname: string
  currentUrl: string
  messages: Record<MessageKey, string>
  onNavigate: () => void
  onGroupToggle: (event: SyntheticEvent<HTMLDetailsElement>) => void
}) {
  const active = isNavItemActive(entry, pathname)
  const branch = entry.branch
  // 目录自己的列表页就是入口自身；数据里不再存第二份地址
  const listHref = entry.href
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
  const onListPage = pathname === listHref

  return (
    <li>
      <details
        className="nav-group"
        open={active || hasActiveChild || undefined}
        onToggle={onGroupToggle}
      >
        <summary className="nav-group__summary" data-active={active ? 'true' : undefined}>
          <span>{messages[entry.label]}</span>
          <ChevronIcon />
        </summary>

        <ul className="nav-group__list">
          {/*
           * 第一行「全部文章」在抽屉里**必须留着**：触屏没有悬停，
           * 点开折叠是第一次点击，进来之后要再有一次明确的点击才能去列表页——
           * 这正是防止手指误触的设计。桌面下拉里则省掉这一行（入口本身就是它）。
           *
           * 但这一行不是无条件的：`linkable: false` 的纯目录（「页面」）
           * 自己没有索引页，画一行「全部页面」只会指向不存在的地址。
           * 那种情况下折叠区里直接就是真实子项。
           */}
          {branch.entryLabel && hasLanding(entry) ? (
            <li>
              <Link
                href={listHref}
                onClick={onNavigate}
                aria-current={onListPage ? 'page' : undefined}
                data-active={onListPage ? 'true' : undefined}
                className="nav-row nav-row--child"
              >
                {messages[branch.entryLabel]}
              </Link>
            </li>
          ) : null}

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

/**
 * 「更多」折叠行。
 *
 * 数据上它仍然是「标了 `section: 'more'` 的那些入口」，不是第二份清单——
 * 这里只是换了个呈现：一行折叠头 + 自己的子项，和文章 / 日记
 * 完全同构（同一个 `.nav-group`、同一个 chevron、同样在 active 时默认展开）。
 *
 * 与其它折叠行唯一的差别：它没有自己的列表页（没有 `/more` 这种路由），
 * 所以折叠区里不出现「全部 X」那一行。折叠头本身不是链接，点它只展开。
 */
function NavMoreGroup({
  entries,
  pathname,
  currentUrl,
  messages,
  onNavigate,
  onGroupToggle,
}: {
  entries: NavEntry[]
  pathname: string
  currentUrl: string
  messages: Record<MessageKey, string>
  onNavigate: () => void
  onGroupToggle: (event: SyntheticEvent<HTMLDetailsElement>) => void
}) {
  // 子项里有一项是当前页 → 这一行也算「在这里」，和目录型入口同一套判定
  const active = entries.some((entry) => isNavItemActive(entry, pathname))
  const hasActiveChild = entries.some(
    (entry) => entry.href === currentUrl || entry.href === pathname,
  )

  return (
    <li>
      <details
        className="nav-group"
        open={active || hasActiveChild || undefined}
        onToggle={onGroupToggle}
      >
        <summary className="nav-group__summary" data-active={active ? 'true' : undefined}>
          <span>{messages['nav.more']}</span>
          <ChevronIcon />
        </summary>

        <ul className="nav-group__list">
          {entries.map((entry) => {
            const itemActive = isNavItemActive(entry, pathname)
            return (
              <li key={entry.href}>
                <Link
                  href={entry.href}
                  onClick={onNavigate}
                  aria-current={itemActive ? 'page' : undefined}
                  data-active={itemActive ? 'true' : undefined}
                  className="nav-row nav-row--child"
                >
                  {messages[entry.label]}
                </Link>
              </li>
            )
          })}
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
