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
   * `main`（默认）进主导航，`more` 收进菜单最后一行「更多」。这只是同一条目
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
  /**
   * 这个入口自身是否有可去的落地页。默认 `true`。
   *
   * `false` 表示它**只是一个容器**：值得把子项列出来，自己却没有一个
   * 可访问的索引页，因此任何「把入口渲染成链接」的地方都要跳过它
   * （顶栏、无 JS 兜底清单、抽屉里的「全部 X」行），否则就是死链。
   *
   * 为什么用配置层字段而不是「branch 存不存在」来判断：branch 是服务端
   * 取数的结果，取数失败时它也会缺失，但布局不该随网络状况变化。
   * 目前唯一的 `false` 是「页面」——独立页面只有详情路由。
   */
  linkable?: boolean
}

/**
 * 主导航
 *
 * 配置仍保持扁平：文章 / 日记 / 探索 / 友链 / 页面 / 一言 / 项目；首页是
 * 单独的路由入口（`HOME_NAV`，不归任何模块开关管）。
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
 * 「页面」归主导航：它**只是一个目录**——子项（各独立页面）在桌面由首页
 * 入口的悬停下拉承载，手机上菜单面板直接展示。它自己没有列表页
 * （主题不提供 `/pages` 索引，上游也只有页面详情路由），因此它的
 * `href` 只承担两件事：作 `branch` 的挂载键，以及给 `matchPrefixes`
 * 提供高亮前缀。任何把它渲染成链接的地方都要跳过（见 `hasListPage()`）。
 *
 * 「一言」与「项目」标 `section: 'more'`，收进菜单的「更多」那一行。
 */
const ALL_NAV: NavItem[] = [
  { href: '/articles', label: 'nav.articles', feature: 'articles', matchPrefixes: ['/articles'] },
  { href: '/notes', label: 'nav.diaries', feature: 'diaries', matchPrefixes: ['/notes'] },
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
    // 只有子项（各独立页面），自己没有索引页：任何地方都不渲染成链接
    linkable: false,
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
 * 这个入口自身有没有可去的落地页。
 *
 * 读 `linkable`，**不读** `branch`：子项取数失败不该让入口从顶栏消失。
 */
export function hasLanding(entry: { linkable?: boolean }): boolean {
  return entry.linkable !== false
}

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
 * 首页携带「页面」的 branch：桌面悬停首页时弹出独立页面列表，
 * 「页面」自身不再作为顶栏入口——子菜单已经挂在首页上了，桌面从首页
 * 悬停即可达，手机走菜单面板。
 *
 * 顶栏只收「点了能到达某处」的入口：`linkable: false` 的纯目录排除在外。
 * 顶栏把入口渲染成 `<Link>`，指向一个不存在的路由就是死链。
 *
 * `inBar: 'desktop'` 的条目两端都在 DOM 里，手机上由 CSS 收起
 * （`data-compact`）——只有一棵 DOM，不做 JS 视口判断，也就不会有水合不一致。
 */
export function getQuickNav(nav: NavEntry[]): NavBarItem[] {
  // 「页面」只有一个目录、没有自己的列表页，它的下级挂到首页入口上
  const pagesBranch = nav.find((entry) => entry.href === '/pages')?.branch
  return [
    { ...HOME_NAV, inBar: 'desktop', branch: pagesBranch },
    ...nav.filter((item) => (item.section ?? 'main') === 'main' && hasLanding(item)),
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
 * 默认**不含任何链接**：进入该目录列表页的地址就是父级 `NavEntry` 自己的
 * `href`（文章 → `/articles`），在这里再存一份就是同一个目的地存两遍。
 * 抽屉里那一行「全部 X」因此直接取 `entry.href`。
 *
 * `entryLabel` 可省略，用于表达「这个目录没有列表页可回退」：目前只有
 * 「页面」是这种情形——它列的是各独立页面，自己没有 `/pages` 索引。
 * 省略之后抽屉里就不画「全部页面」那一行，折叠区直接是子项。
 * 渲染处还有第二道判据 `hasLanding(entry)`，两者一致才画。
 */
export interface NavBranch {
  /** 目录自己的列表页文案；省略 = 该目录没有列表页，不画「全部 X」那一行 */
  entryLabel?: MessageKey
  /**
   * 「全部 X」那一行指向的地址；省略时取入口自身的 `href`。
   *
   * 只有日记需要这一项：`/notes` 定位到最新一篇，列表在 `/notes/list`。
   * 入口链接与列表地址第一次分家，所以不能再用「列表页 = 入口自身」那条简化。
   */
  listHref?: string
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
/**
 * 入口是否处于「当前页」。
 *
 * `listHref` 是为「入口 ≠ 列表页」准备的（目前只有日记）：`/notes` 落最新一篇、
 * `/notes/list` 是时间线。两者是父子前缀关系，只看前缀会把**入口与列表页同时**
 * 标成 `aria-current="page"`——同一份导航里两个「当前页」，读屏播报两次，
 * 视觉上也是两处高亮。
 *
 * 所以列表页在场时，当前页归列表那一行；入口只保留「所属分区」语义。
 * 详情页 `/notes/:nid` 不受影响，仍然高亮入口。
 */
export function isNavItemActive(
  item: NavLink,
  pathname: string,
  listHref?: string,
): boolean {
  if (item.href === '/') return pathname === '/'
  if (listHref && listHref !== item.href && pathname === listHref) return false
  const prefixes = item.matchPrefixes ?? [item.href]
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
