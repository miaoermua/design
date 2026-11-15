import { isFeatureEnabled, type FeatureKey } from '../registry/features'
import type { MessageKey } from '@/lib/i18n/dictionary'

/** 与模块开关无关的固定入口（首页）：只描述路由与文案 */
export interface NavLink {
  href: string
  /**
   * 界面文案的字典键，而不是成品字符串。
   *
   * 导航项会作为 props 传给客户端组件，函数无法序列化；
   * 而成品字符串会在服务端渲染时被钉死在当前语言，客户端切换语言后不会更新。
   * 存键、在渲染处翻译，两个问题都不存在。
   */
  label: MessageKey
  /**
   * 当前页高亮的路径前缀。
   *
   * 用字符串而不是函数：同样是为了可序列化（见上）。
   */
  matchPrefixes?: string[]
}

export interface NavItem extends NavLink {
  feature: FeatureKey
  /**
   * 这个入口在菜单里的落位。
   *
   * `main`（默认）进主导航，`more` 进虚线以下的「更多」。这只是同一条目
   * 的展示归属，不是第二份清单——两处渲染的都是 `buildNav()` 返回的同一个对象。
   */
  section?: 'main' | 'more'
  /**
   * 顶栏是否直接可见。
   *
   * `always`（默认）两端都直接可见；`desktop` 只在桌面顶栏出现，手机上
   * 收进菜单——手机横向空间只够两条内容主线，这属于布局决策，
   * 不改路由、不改归属，菜单里照样有一条完整入口。
   */
  inBar?: 'always' | 'desktop'
}

/**
 * 主导航
 *
 * 配置仍保持扁平：文章 / 日记 / 探索 / 友链 / 页面；首页是单独的路由入口
 * （`HOME_NAV`，不归任何模块开关管）。
 *
 * 顶栏直接可见的是 **首页 / 文章 / 日记 / 探索 / 友链** 五条，与旧版一致：
 * 桌面横向空间足够，不需要为了「精简」把常规入口藏起来。手机上只有
 * 文章与日记留在顶栏（头像承担首页），其余由菜单承载。
 *
 * 「归档」与「标签」合并为「探索」：两者都是「按某个维度找到文章」，
 * 并列成两个顶栏入口会让导航退化成资源清单。合并只改入口，
 * 两套数据、查询与详情路由都保持不变。
 *
 * `/categories` 不在「探索」的高亮前缀里：分类归档从这一版起归属于
 * 「文章」这个入口，两处同时高亮会让当前位置变得含糊。
 *
 * 「页面」归主导航：它的子项（独立页面）在桌面由首页入口的悬停下拉承载，
 * 手机上菜单面板直接展示。`section: 'more'` 用于一言、项目等非核心入口。
 */
const ALL_NAV: NavItem[] = [
  { href: '/articles', label: 'nav.articles', feature: 'articles', matchPrefixes: ['/articles'] },
  { href: '/diaries', label: 'nav.diaries', feature: 'diaries', matchPrefixes: ['/diaries'] },
  {
    href: '/explore',
    label: 'nav.explore',
    feature: 'archives',
    // 旧路由仍然可达（兼容旧链接），高亮也要跟着走
    matchPrefixes: ['/explore', '/archives', '/tags'],
    // 桌面横向放得下三条主线，手机只留文章与日记
    inBar: 'desktop',
  },
  {
    href: '/friends',
    label: 'nav.friends',
    feature: 'friends',
    matchPrefixes: ['/friends'],
    // 桌面五条放得下；手机只留文章与日记，友链走菜单
    inBar: 'desktop',
  },
  {
    href: '/pages',
    label: 'nav.pages',
    feature: 'pages',
    matchPrefixes: ['/pages'],
  },
  {
    href: '/says',
    label: 'nav.says',
    feature: 'says',
    matchPrefixes: ['/says'],
    section: 'more',
  },
  {
    href: '/projects',
    label: 'nav.projects',
    feature: 'projects',
    matchPrefixes: ['/projects'],
    section: 'more',
  },
]

/** 只返回已启用模块的导航项 */
export function getPrimaryNav(): NavItem[] {
  return ALL_NAV.filter((item) => isFeatureEnabled(item.feature))
}

/**
 * 首页入口
 *
 * 首页是固定路由，不归任何模块开关管（`pages` 关掉时首页照旧存在），
 * 因此不能用 `NavItem`（它要求一个 feature）。快捷栏的头像与菜单顶部的
 * 「站点身份」都读这一条，不各自硬编码 `/`。
 */
export const HOME_NAV: NavLink = { href: '/', label: 'nav.home', matchPrefixes: ['/'] }

/**
 * 顶栏直接可见的入口：首页 + 主导航那一段。
 *
 * 这是 `ALL_NAV` 的一个投影，不是第二份清单：传进来的必须是
 * `buildNav()` 的结果，两处渲染的是同一批对象。
 *
 * 首页排在最前，且标成 `inBar: 'desktop'`：桌面顶栏读作「首页 / 文章 /
 * 日记 / 探索 / 友链」，与旧版一致；手机上首页由左侧头像承担，
 * 顶栏不再重复出现一条「首页」文字，留出空间给内容主线。
 *
 * 首页携带「页面」的 branch：桌面悬停首页时弹出独立页面列表（Pages），
 * 「页面」自身不再作为顶栏入口——子菜单已经挂在首页上了，桌面从首页
 * 悬停即可达，手机走菜单面板。
 *
 * `inBar: 'desktop'` 的条目两端都在 DOM 里，手机上由 CSS 收起
 * （`data-compact`）——只有一棵 DOM，不做 JS 视口判断，也就不会有水合不一致。
 */
export function getQuickNav(nav: NavEntry[]): NavBarItem[] {
  // 「页面」的下级数据挂在 /pages 入口上，取出来给首页用
  const pagesBranch = nav.find((entry) => entry.href === '/pages')?.branch
  return [
    { ...HOME_NAV, inBar: 'desktop', branch: pagesBranch },
    // /pages 不在顶栏出现：它的子菜单已挂到首页入口的悬停下拉里
    ...nav.filter((item) => (item.section ?? 'main') === 'main' && item.href !== '/pages'),
  ]
}

/** 该入口是否只在桌面顶栏出现（手机上由 CSS 收起） */
export function isDesktopOnly(item: NavBarItem): boolean {
  return item.inBar === 'desktop'
}

/** 目录型入口的一个子项（由服务端取数后以普通对象传下来） */
export interface NavBranchItem {
  href: string
  label: string
}

/**
 * 目录型入口的下级。
 *
 * 刻意**不含父级链接**：父级的 href 与文案由它所属的 `NavEntry` 提供。
 * 上一版把 `{ href: '/pages', label: nav.pages }` 手工塞进 items 当第一项，
 * 等于在数据里给同一个目的地存了两份，这里是那份重复的根。
 *
 * `status` 三态是刻意的：空列表（真的没有分类）和取数失败（暂时看不到）
 * 对用户是两件不同的事，合成一句「暂无内容」会掩盖故障。
 */
export interface NavBranch {
  /** 折叠区第一项（进入该入口自己的列表页）的文案 */
  entryLabel: MessageKey
  emptyLabel: MessageKey
  errorLabel: MessageKey
  status: 'ok' | 'empty' | 'error'
  items: NavBranchItem[]
}

/** 导航树的一个节点：普通链接 + 可选的目录型下级 */
export interface NavEntry extends NavItem {
  branch?: NavBranch
}

/** 顶栏里的一个入口：可能是固定的首页，也可能是 `ALL_NAV` 里的一条 */
export interface NavBarItem extends NavLink {
  branch?: NavBranch
  inBar?: 'always' | 'desktop'
}

/**
 * 导航的唯一装配入口。
 *
 * 顶栏与菜单消费的都是这个返回值：顶栏取 `getQuickNav()` 的投影，菜单
 * 按 `section` 分成两段渲染。父子关系挂在 `NavEntry.branch` 上，
 * 是数据结构里的真实层级，不再靠「另一份分组清单 + 手工映射标题」拼出来。
 *
 * `branches` 以 href 为键，因此装配时不需要知道 Group/分区之类的概念，
 * 加一个目录型入口只是多给一条数据。
 */
export function buildNav(branches: Partial<Record<string, NavBranch>> = {}): NavEntry[] {
  return getPrimaryNav().map((item) => ({ ...item, branch: branches[item.href] }))
}

/**
 * 供客户端组件判定当前导航项
 *
 * 首页单独判定：`matchPrefixes: ['/']` 的前缀匹配在下一条规则里会命中**所有**路径，
 * 首页只应在自己身上高亮。
 */
export function isNavItemActive(item: NavLink, pathname: string): boolean {
  if (item.href === '/') return pathname === '/'
  const prefixes = item.matchPrefixes ?? [item.href]
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
