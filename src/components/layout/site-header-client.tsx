'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  getQuickNav,
  hasLanding,
  HOME_NAV,
  isNavItemActive,
  type NavEntry,
} from '@/core/navigation'
import type { MessageKey } from '@/lib/i18n/dictionary'
import { CoverImage } from '@/components/ui/cover-image'
import { SearchPanel } from './search-panel'
import { SiteNavMenu } from './site-nav-menu'
import { ToolbarButton, ToolbarGroup } from './toolbar-button'
import { useHeaderScroll } from './use-header-scroll'

/** 收起动画时长：与 globals.css 的 `--nav-exit-duration` 必须一致 */
const EXIT_MS = 200

const MENU_ID = 'site-nav-menu'

interface SiteHeaderClientProps {
  /**
   * 导航树（`core/navigation` 的 `buildNav()` 结果）。
   *
   * 顶栏与菜单消费的都是这一棵树：顶栏取 `getQuickNav()` 的投影，
   * 菜单按 `section` 分成两段。上一版的 `quickNav` / `menuNav` / `moreNav` /
   * `groups` 四个 props 是同一份 `ALL_NAV` 的四次重新描述，已合并。
   */
  nav: NavEntry[]
  siteName: string
  avatarUrl: string | null
  messages: Record<MessageKey, string>
  /** 是否有搜索模块；关闭时不渲染搜索按钮 */
  searchEnabled: boolean
}

/**
 * 悬浮导航（桌面双态 / 手机单态）
 *
 * 形态：**一套 DOM，三种状态**，由 `<header data-mode>` 切换——
 *   - `top`：页面顶部，通栏透明的 Editorial Bar，与页面容器同宽对齐；
 *   - `hidden`：向下滚动，整块滑出视口，把阅读空间还给正文；
 *   - `floating`：离开顶部后向上滚动，收紧成居中悬浮的玻璃 Dock。
 *
 * 为什么不做两棵 DOM：两套导航轮流出现意味着重复的 HTML ID、两份菜单
 * 开关状态、两条 Tab 顺序，以及「哪一份才是真的」这个永远要解释的问题。
 * 这里导航数据、菜单状态、键盘顺序都只有一份，状态机只在
 * `use-header-scroll.ts` 里判断；CSS 只描述「每种形态长什么样」。
 *
 * 断点仍是项目已有的 md = 48rem：
 *   - ≥48rem：贴顶，三态生效；
 *   - <48rem：贴底悬浮（让出 `env(safe-area-inset-bottom)`），**不随滚动隐藏**
 *     —— 手机上它是唯一的导航，滑走就等于没有导航。三态的视觉规则全部写在
 *     桌面断点里，因此手机不需要 JS 判断视口，也不会被这套逻辑碰到。
 *
 * 信息架构：桌面顶栏是完整的横向导航——首页 / 文章 / 日记 / 探索 / 友链，
 * 文章与日记悬停即展开下级；一言与项目收进菜单。手机只留文章与日记
 * （头像承担首页），其余走菜单按钮。两端消费的是同一棵树。
 *
 * 为什么状态用「在哪个路由上打开的」而不是布尔值：路由一变 `open` 自然
 * 变 false，不需要在 effect 里 setState 同步，也不会在浏览器后退回到
 * 原路由时把菜单重新弹开。
 */
export function SiteHeaderClient({
  nav,
  siteName,
  avatarUrl,
  messages,
  searchEnabled,
}: SiteHeaderClientProps) {
  const pathname = usePathname()
  // 顶栏直接可见的高频入口：同一棵树上的投影，不另存一份清单
  const quickNav = getQuickNav(nav)
  const [searchOpen, setSearchOpen] = useState(false)
  const [openAt, setOpenAt] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  /**
   * 路由一变，立刻作废「在哪个路由上打开的」。
   *
   * 这是「随输入变化调整 state」而不是同步外部系统，所以在渲染期直接改状态，
   * 不用 effect（effect 里 setState 会多一次提交，还会让菜单在新页面上闪一下）。
   * 只隐藏不清理的话，浏览器后退回到原路由会把菜单重新弹开。
   */
  const [routeOfState, setRouteOfState] = useState(pathname)
  if (routeOfState !== pathname) {
    setRouteOfState(pathname)
    setOpenAt(null)
    setClosing(false)
  }

  const open = openAt === pathname
  const mounted = open || closing

  /**
   * 下拉悬停的冻结标志。
   *
   * 指针停在「文章 / 日记」的下拉上时，导航不该因为一次滚轮就滑走——
   * 菜单是卡片的子节点，卡片走了菜单也就没了。用 ref 而不是 state：
   * 指针每进出一次下拉就 setState，会把整棵导航（含菜单子树）重渲染一遍。
   *
   * 冻结期间滚过的距离要补算：`holdFrom` 记下进入下拉时的位置，指针离开时
   * 若页面已经挪动过，就按新位置重新落定（否则那条通栏透明的 Editorial Bar
   * 会一直停在正文上方）。
   */
  const flyoutHold = useRef(false)
  const holdFrom = useRef<number | null>(null)

  // 搜索面板或菜单打开时锁定导航；下拉悬停同样冻结（两者都不允许滑走）
  const { mode, resync } = useHeaderScroll(searchOpen || open, flyoutHold)

  const rootRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const exitTimer = useRef<number | null>(null)

  const clearExitTimer = useCallback(() => {
    if (exitTimer.current !== null) {
      window.clearTimeout(exitTimer.current)
      exitTimer.current = null
    }
  }, [])

  useEffect(() => () => clearExitTimer(), [clearExitTimer])

  const closeMenu = useCallback(
    (restoreFocus: boolean) => {
      clearExitTimer()
      setOpenAt(null)
      // 关闭动画：面板在 DOM 里多留一帧时长做反向收起；减弱动效时直接卸载
      if (prefersReducedMotion()) {
        setClosing(false)
      } else {
        setClosing(true)
        exitTimer.current = window.setTimeout(() => {
          exitTimer.current = null
          setClosing(false)
        }, EXIT_MS)
      }
      if (restoreFocus) triggerRef.current?.focus()
    },
    [clearExitTimer],
  )

  const openMenu = useCallback(
    (focusFirst: boolean) => {
      clearExitTimer()
      setClosing(false)
      setOpenAt(pathname)
      if (focusFirst) {
        // 等面板挂载后再取焦点，否则查询到的是上一帧的空节点
        window.requestAnimationFrame(() => {
          const first = panelRef.current?.querySelector<HTMLElement>('a, button, summary')
          first?.focus()
        })
      }
    },
    [clearExitTimer, pathname],
  )

  // 点击菜单外部收起；Escape 收起并把焦点还给触发按钮
  useEffect(() => {
    if (!mounted) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        closeMenu(true)
      }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [mounted, closeMenu])

  // ⌘K / Ctrl+K 打开搜索，Esc 关闭；不拦截输入框里的普通输入
  useEffect(() => {
    if (!searchEnabled) return

    const onKeyDown = (event: KeyboardEvent) => {
      const isK = event.key.toLowerCase() === 'k'
      if (isK && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setSearchOpen((value) => !value)
        return
      }
      // Escape 只在面板由本组件打开时处理；面板内部也有自己的处理
      if (event.key === 'Escape') setSearchOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchEnabled])

  /** 解除下拉冻结：冻结期间页面挪动过就按新位置落定，别让旧形态留在屏幕上 */
  const releaseFlyoutHold = useCallback(() => {
    if (!flyoutHold.current) return
    flyoutHold.current = false
    if (holdFrom.current !== null && Math.abs(window.scrollY - holdFrom.current) > 1) resync()
    holdFrom.current = null
  }, [resync])

  const closeSearch = useCallback(() => setSearchOpen(false), [])

  /**
   * Spotlight：鼠标在卡片内移动时把指针位置写进两个 CSS 变量。
   *
   * 刻意**不进 React 状态**：pointermove 每秒几十次，setState 会让整棵导航
   * 反复重渲染（还带上菜单子树）。这里只在 rAF 里改自身 style，
   * 由 CSS 的 radial-gradient 消费，React 完全不参与。
   * 只在「有精确指针 + 未要求减弱动效」时挂监听：触屏与键盘用户不会残留光斑。
   *
   * 右下工具胶囊用的是同一个 hook、同一套变量：两处是同一块玻璃的两种尺寸，
   * 光斑逻辑没有第二份实现。
   */
  useSpotlight(cardRef)
  useSpotlight(dockRef)

  return (
    <>
      <header ref={rootRef} data-mode={mode} className="site-nav">
        <div className="nav-shell">
          <div
            ref={cardRef}
            className="nav-card"
            /*
             * 指针进出下拉时写冻结标志。`pointerover` 会从子元素冒泡上来，
             * 所以直接看落点是否在 `.nav-flyout` 里；离开整张卡片时清掉
             * （下拉面板是卡片的子孙，指进去不会触发 pointerleave）。
             * 触屏没有 hover，这里拿到的永远是 false，不影响手机行为。
             */
            onPointerOver={(event) => {
              const inside = Boolean((event.target as Element | null)?.closest?.('.nav-flyout'))
              if (inside) {
                if (!flyoutHold.current) holdFrom.current = window.scrollY
                flyoutHold.current = true
              } else {
                releaseFlyoutHold()
              }
            }}
            onPointerLeave={releaseFlyoutHold}
          >
            {/*
             * 玻璃单独一层：不能直接给 .nav-card 加 backdrop-filter ——
             * 滤镜会让卡片成为 position: fixed 后代的包含块，
             * 移动端菜单面板会被缩进卡片内部而不是横跨视口。
             */}
            <span aria-hidden="true" className="nav-glass glass-nav" />
            {/* 光斑层：永远在内容之下、不接收指针事件 */}
            <span aria-hidden="true" className="nav-spotlight" />

            {/* 快捷栏：桌面为 首页 / 文章 / 日记 / 探索 / 友链；手机上头像承担首页 */}
            <nav aria-label={messages['nav.quick']} className="nav-quick">
              <ul className="nav-quick__list">
                {/*
                 * 头像回首页，两端都在：它是站点身份，也是最快的一条回首页
                 * 路径。桌面同时还有「首页」文字入口（旧版就是这样并存的）：
                 * 头像认身份、文字认导航。
                 */}
                <li className="nav-home">
                  <Link
                    href={HOME_NAV.href}
                    aria-current={pathname === HOME_NAV.href ? 'page' : undefined}
                    aria-label={messages[HOME_NAV.label]}
                    title={siteName}
                    className="nav-avatar"
                  >
                    {avatarUrl ? (
                      <CoverImage
                        src={avatarUrl}
                        alt=""
                        width={40}
                        height={40}
                        className="nav-avatar__image"
                      />
                    ) : (
                      <span aria-hidden="true" className="nav-avatar__fallback">
                        {siteName.trim().charAt(0) || '·'}
                      </span>
                    )}
                  </Link>
                </li>

                {quickNav.map((item) => {
                  const active = isNavItemActive(item, pathname)
                  // 只在桌面顶栏出现的入口：手机断点由 CSS 收起
                  const compact = item.inBar === 'desktop' ? 'hide' : undefined
                  const branch = item.branch

                  // 没有下级的入口就是一条普通链接
                  if (!branch) {
                    return (
                      <li key={item.href} data-compact={compact}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          data-active={active ? 'true' : undefined}
                          // 手机断点收起：手机上的首页入口是头像
                          data-compact={compact}
                          className="nav-link"
                        >
                          {messages[item.label]}
                        </Link>
                      </li>
                    )
                  }

                  /*
                   * 桌面用悬停下拉展示下级：鼠标移到入口上就看得见分类，
                   * 不必先打开菜单。移动端没有 hover，这一段由 CSS 收掉，
                   * 仍然走菜单按钮（`SiteNavMenu` 里同一份 `branch`）。
                   * 焦点进入时同样展开（`:focus-within`），键盘用户不必点开。
                   *
                   * 顶栏刻意**不加任何箭头或 more 图标**：入口读起来就是一条
                   * 普通导航链接，是否还有一层只在鼠标停上去（或菜单抽屉里）
                   * 才显现，不靠装饰性符号暗示。
                   *
                   * 下拉里**一律不出现「全部 X」那一行**，没有例外：
                   * 有鼠标时「点入口 = 去那里」是同一件事，再列一行只是把
                   * 同一个目的地说两遍。手机相反——没有悬停，抽屉里必须保留
                   * 这一行做二次确认，对手指来说「展开子项」与「进入列表页」
                   * 是两次不同的点击。抽屉里那一行的地址直接取入口自己的
                   * `href`，数据里不存第二份。
                   */
                  return (
                    <li key={item.href} className="nav-flyout" data-compact={compact}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        data-active={active ? 'true' : undefined}
                        className="nav-link"
                      >
                        {messages[item.label]}
                      </Link>

                      <div className="nav-flyout__panel">
                        <div className="nav-flyout__card">
                          <ul className="nav-flyout__list">
                            {branch.status === 'ok' ? (
                              branch.items.map((child) => (
                                <li key={child.href}>
                                  <Link
                                    href={child.href}
                                    aria-current={child.href === pathname ? 'page' : undefined}
                                    title={child.label}
                                    className="nav-row nav-row--child"
                                  >
                                    {child.label}
                                  </Link>
                                </li>
                              ))
                            ) : (
                              <li className="nav-flyout__empty">
                                {
                                  messages[
                                    branch.status === 'error'
                                      ? branch.errorLabel
                                      : branch.emptyLabel
                                  ]
                                }
                              </li>
                            )}
                          </ul>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/*
              右侧动作区：分隔线 + 菜单按钮。
              单独成组是为了让桌面端能把「身份与入口」和「菜单」分别贴在
              卡片两端（space-between），不必为此改动快捷栏的 DOM。
            */}
            <div className="nav-actions">
              <span aria-hidden="true" className="nav-rule" />

              <button
                ref={triggerRef}
                type="button"
                aria-expanded={open}
                aria-controls={MENU_ID}
                aria-label={messages['action.menu']}
                title={messages['action.menu']}
                data-open={open ? 'true' : undefined}
                className="nav-menu-trigger"
                onClick={(event) => {
                  // detail === 0：键盘触发的 click（Enter / Space），把焦点带进菜单
                  if (open) closeMenu(false)
                  else openMenu(event.detail === 0)
                }}
              >
                <span
                  aria-hidden="true"
                  className="nav-menu-glyph"
                  data-open={open ? 'true' : undefined}
                >
                  <span />
                  <span />
                </span>
              </button>
            </div>

            {mounted ? (
              <SiteNavMenu
                id={MENU_ID}
                closing={closing}
                nav={nav}
                messages={messages}
                siteName={siteName}
                avatarUrl={avatarUrl}
                onNavigate={() => closeMenu(false)}
                panelRef={panelRef}
              />
            ) : null}
          </div>
        </div>

        {/*
          无 JS 兜底：菜单按钮需要 JS 才能展开，因此把完整入口在这里以普通链接
          给出来。它只在脚本不可用时显示，有 JS 时不占空间、也不会被读成第二份导航。
          清单同样来自 `nav`（父级 + 它自己的子项），不再手抄一份 href。
        */}
        <noscript>
          <div className="nav-noscript">
            <a href={HOME_NAV.href}>{messages[HOME_NAV.label]}</a>
            {/*
              跳过「自己不是可去目的地」的纯目录入口（目前只有「页面」）：
              它的 `href` 只是 branch 的挂载键，`/pages` 并不是主题的路由，
              在这里给它一条链接就是死链。它的子项由下面那段照常列出。
            */}
            {nav.filter(hasLanding).map((entry) => (
              <a key={entry.href} href={entry.href}>
                {messages[entry.label]}
              </a>
            ))}
            {nav.flatMap((entry) =>
              (entry.branch?.items ?? []).map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              )),
            )}
            {searchEnabled ? <a href="/search">{messages['action.search']}</a> : null}
          </div>
        </noscript>
      </header>

      {/* 固定顶栏不占文档流：≥48rem 时用占位块让正文不被卡片盖住（移动端贴底，不需要） */}
      <div aria-hidden="true" className="site-nav-spacer" />

      {/* 菜单展开时工具浮标让位：面板在移动端几乎满宽，浮标会压在菜单项上 */}
      <div ref={dockRef} className="toolbar-dock" data-nav-open={open ? 'true' : undefined}>
        {/*
         * 与顶栏同一块玻璃：材质层 `.glass-nav` 与光斑层 `.nav-spotlight` 都是
         * 导航卡片那两个类，这里只是换了个尺寸更小的宿主（竖排三格）。
         * 不复制一套参数——顶栏将来换模糊半径或遮罩浓度，这里自动跟上。
         */}
        <span aria-hidden="true" className="nav-glass glass-nav" />
        <span aria-hidden="true" className="nav-spotlight" />

        {/* 无 JS 时的搜索出口：搜索面板不可用时仍保留普通链接。 */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `<a href="/search" style="position:relative;z-index:1" class="text-meta px-2 py-1.5 text-[var(--text-secondary)] underline decoration-[var(--edge-strong)] underline-offset-4">${messages['action.search']}</a>`,
          }}
        />
        {/* 搜索不在这里：面板仍由 ⌘K / Ctrl+K 与 /search 页承担。
            主题与语言已迁到页脚（全站只有那一处设置入口），右下角只剩回顶。 */}
        <ToolbarGroup label={messages['toolbar.group']}>
          <ToolbarButton
            label={messages['action.backToTop']}
            onClick={() => {
              const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
              window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
            }}
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
            kindPost: messages['search.kindPost'],
            kindNote: messages['search.kindNote'],
          }}
        />
      ) : null}
    </>
  )
}

/**
 * 把指针坐标写进宿主自身的 `--nav-pointer-x/y`，供 `.nav-spotlight` 消费。
 *
 * 宿主可以是导航卡片，也可以是右下工具胶囊：光斑层按 `inset: 0` 铺满宿主，
 * 坐标相对宿主的 border box 计算，所以尺寸无关。
 */
function useSpotlight(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = ref.current
    if (!host || typeof window.matchMedia !== 'function') return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let frame = 0
    let clientX = 0
    let clientY = 0

    const apply = () => {
      frame = 0
      const rect = host.getBoundingClientRect()
      host.style.setProperty('--nav-pointer-x', `${clientX - rect.left}px`)
      host.style.setProperty('--nav-pointer-y', `${clientY - rect.top}px`)
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      clientX = event.clientX
      clientY = event.clientY
      if (!frame) frame = window.requestAnimationFrame(apply)
    }

    host.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      host.removeEventListener('pointermove', onMove)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [ref])
}

/** `prefers-reduced-motion` 只影响关闭动画，不影响启停本身 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
