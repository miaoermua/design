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
 * 结构上刻意保持扁平：文章 / 日记 / 探索 / 页面 / 关于。
 *
 * 「归档」与「标签」合并为「探索」：两者都是「按某个维度找到文章」，
 * 并列成两个顶栏入口会让导航退化成资源清单。合并只改入口，
 * 两套数据、查询与详情路由都保持不变。
 */
const ALL_NAV: NavItem[] = [
  { href: '/articles', label: 'nav.articles', feature: 'articles', matchPrefixes: ['/articles'] },
  { href: '/diaries', label: 'nav.diaries', feature: 'diaries', matchPrefixes: ['/diaries'] },
  {
    href: '/explore',
    label: 'nav.explore',
    feature: 'archives',
    // 旧路由仍然可达（兼容旧链接），高亮也要跟着走
    matchPrefixes: ['/explore', '/archives', '/tags', '/categories'],
  },
  { href: '/pages', label: 'nav.pages', feature: 'pages', matchPrefixes: ['/pages'] },
  { href: '/about', label: 'nav.about', feature: 'about', matchPrefixes: ['/about'] },
]

/** 只返回已启用模块的导航项 */
export function getPrimaryNav(): NavItem[] {
  return ALL_NAV.filter((item) => isFeatureEnabled(item.feature))
}

/**
 * 页脚导航
 *
 * 搜索不在顶栏主导航里——它现在是右侧的工具按钮（点开面板）。
 * 这里保留文字入口，保证无 JS 时仍然能找到搜索页。
 */
export function getFooterNav(): NavItem[] {
  const search: NavItem = {
    href: '/search',
    label: 'action.search',
    feature: 'search',
    matchPrefixes: ['/search'],
  }
  const extra: NavItem[] = [
    { href: '/friends', label: 'nav.friends', feature: 'friends', matchPrefixes: ['/friends'] },
  ]
  return [...ALL_NAV, search, ...extra].filter((item) => isFeatureEnabled(item.feature))
}

/** 供客户端组件判定当前导航项 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const prefixes = item.matchPrefixes ?? [item.href]
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

/** 「探索」的路径前缀：/explore 与两条兼容旧路由共用同一高亮与 Tab 语义 */
export const EXPLORE_PATH_PREFIXES = ['/explore', '/archives', '/tags', '/categories'] as const