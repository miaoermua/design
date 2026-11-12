import { isFeatureEnabled, type FeatureKey } from '../registry/features'
import type { MessageKey } from '@/lib/i18n/dictionary'

export interface NavItem {
  href: string
  /**
   * 界面文案的字典键，而不是成品字符串。
   *
   * 导航项会作为 props 传给客户端组件，函数无法序列化；
   * 而成品字符串会在服务端渲染时被钉死在当前语言，客户端切换语言后不会更新。
   * 存键、在渲染处翻译，两个问题都不存在。
   */
  label: MessageKey
  feature: FeatureKey
  /**
   * 当前页高亮的路径前缀。
   *
   * 用字符串而不是函数：同样是为了可序列化（见上）。
   */
  matchPrefixes?: string[]
}

/**
 * 主导航
 *
 * 结构上刻意保持扁平：文章 / 日记 / 探索 / 友链 / 页面 / 关于。
 * 其中文章、日记、页面在顶栏展开成目录型选择器（见 `NavGroup`），
 * 其余仍是普通链接。
 *
 * 「归档」与「标签」合并为「探索」：两者都是「按某个维度找到文章」，
 * 并列成两个顶栏入口会让导航退化成资源清单。合并只改入口，
 * 两套数据、查询与详情路由都保持不变。
 *
 * `/categories` 不在「探索」的高亮前缀里：分类归档从这一版起归属于
 * 「文章」这个入口，两处同时高亮会让当前位置变得含糊。
 *
 * 「友链」从页脚导航移到顶栏：页脚不再承载导航，否则 /friends 会失去
 * 站点内唯一的入口（只能在 sitemap 里找到）。
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
  },
  { href: '/friends', label: 'nav.friends', feature: 'friends', matchPrefixes: ['/friends'] },
  { href: '/pages', label: 'nav.pages', feature: 'pages', matchPrefixes: ['/pages'] },
  { href: '/about', label: 'nav.about', feature: 'about', matchPrefixes: ['/about'] },
]

/** 只返回已启用模块的导航项 */
export function getPrimaryNav(): NavItem[] {
  return ALL_NAV.filter((item) => isFeatureEnabled(item.feature))
}

/**
 * 顶栏「目录型」入口：Blog 分类 / Note 专栏 / Pages。
 *
 * 与 `NavItem` 的区别是它带一组子项。子项在服务端取好后以普通对象传下来，
 * 客户端只负责展开、键盘与空态展示——不在浏览器里发请求。
 *
 * `status` 三态是刻意的：空列表（真的没有分类）和取数失败（暂时看不到）
 * 对用户是两件不同的事，合成一句「暂无内容」会掩盖故障。
 */
export interface NavGroupItem {
  href: string
  label: string
}

export interface NavGroup {
  key: 'articles' | 'diaries' | 'pages'
  label: MessageKey
  href: string
  matchPrefixes: string[]
  allLabel: MessageKey
  emptyLabel: MessageKey
  errorLabel: MessageKey
  status: 'ok' | 'empty' | 'error'
  items: NavGroupItem[]
}

/** 供客户端组件判定当前导航项 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const prefixes = item.matchPrefixes ?? [item.href]
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
