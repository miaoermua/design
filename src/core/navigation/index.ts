import { isFeatureEnabled, type FeatureKey } from '../registry/features'

export interface NavItem {
  href: string
  label: string
  feature: FeatureKey
  /**
   * 当前页高亮的路径前缀。
   *
   * 用字符串而不是函数：导航项会作为 props 传给客户端组件，
   * 函数无法被序列化（Next.js 会直接报错）。
   */
  matchPrefixes?: string[]
}

const ALL_NAV: NavItem[] = [
  { href: '/articles', label: '文章', feature: 'articles', matchPrefixes: ['/articles'] },
  { href: '/diaries', label: '日记', feature: 'diaries', matchPrefixes: ['/diaries'] },
  { href: '/archives', label: '归档', feature: 'archives', matchPrefixes: ['/archives'] },
  { href: '/tags', label: '标签', feature: 'taxonomy', matchPrefixes: ['/tags', '/categories'] },
  { href: '/search', label: '搜索', feature: 'search', matchPrefixes: ['/search'] },
  { href: '/about', label: '关于', feature: 'about', matchPrefixes: ['/about'] },
]

/** 只返回已启用模块的导航项 */
export function getPrimaryNav(): NavItem[] {
  return ALL_NAV.filter((item) => isFeatureEnabled(item.feature))
}

export function getFooterNav(): NavItem[] {
  const extra: NavItem[] = [
    { href: '/friends', label: '友链', feature: 'friends', matchPrefixes: ['/friends'] },
  ]
  return [...ALL_NAV, ...extra].filter((item) => isFeatureEnabled(item.feature))
}

/** 供客户端组件判定当前导航项 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const prefixes = item.matchPrefixes ?? [item.href]
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
