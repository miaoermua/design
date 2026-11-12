import type { ThemeSocial, ThemeSocialIcon } from '@/core/config/theme'

/**
 * 社交项目的运行时视图
 *
 * 与配置类型 `ThemeSocialItem` 的区别：这里是**合并之后**的结果，
 * 因此多了 `id`（稳定 key）、`source`（来自 API 还是配置）和 `platform`
 * （仅 API 派生项有，用于图标兜底，不参与唯一性）。
 */
export interface SocialItem {
  /** 稳定的 React key：`api:<平台>` 或 `theme:<序号>` */
  id: string
  /** 已经可读的标题，页面直接渲染 */
  title: string
  url: string
  icon: ThemeSocialIcon | null
  color: string | null
  source: 'api' | 'theme'
  platform: string | null
}

/**
 * 只对「有确定 URL 规则」的平台做拼接。
 * 未知平台若本身是完整 http(s) URL 才渲染，否则跳过——不猜地址、不生成死链。
 */
const SOCIAL_RULES: Record<string, (value: string) => string> = {
  github: (value) => `https://github.com/${value}`,
  x: (value) => `https://x.com/${value}`,
  twitter: (value) => `https://x.com/${value}`,
  telegram: (value) => `https://t.me/${value}`,
  bilibili: (value) => `https://space.bilibili.com/${value}`,
  zhihu: (value) => `https://www.zhihu.com/people/${value}`,
  email: (value) => `mailto:${value}`,
  mail: (value) => `mailto:${value}`,
}

export const BRAND_LABEL: Record<string, string> = {
  github: 'GitHub',
  x: 'X',
  twitter: 'X',
  telegram: 'Telegram',
  bilibili: '哔哩哔哩',
  zhihu: '知乎',
  email: 'Email',
  mail: 'Email',
  netease: '网易云音乐',
  rss: 'RSS 订阅',
}

/** 平台键 → 可读标题；未收录的平台直接用键名，不猜品牌 */
export function socialLabel(platform: string): string {
  return BRAND_LABEL[platform.toLowerCase()] ?? platform
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * 从 `/aggregate` 的 `user.social_ids` 派生项目。
 *
 * `social_ids` 的语义是「平台 → 账号」：一个平台只能有一个值，
 * 值可能是用户名（需要按规则拼接）或完整 URL。因此这里天然不会产生
 * 同平台的多个项目——同平台多链接只能来自 `items[]`。
 */
function apiItems(socialIds: Record<string, string> | null | undefined): SocialItem[] {
  const items: SocialItem[] = []
  for (const [platform, value] of Object.entries(socialIds ?? {})) {
    const trimmed = value.trim()
    if (!trimmed) continue

    const rule = SOCIAL_RULES[platform]
    const url = rule ? rule(trimmed) : isHttpUrl(trimmed) ? trimmed : null
    // 猜不出地址就跳过：宁可少一个图标，也不要一个 404
    if (!url) continue

    items.push({
      id: `api:${platform}`,
      title: socialLabel(platform),
      url,
      // 图标先用平台键兜底，配置里的覆盖在下面处理
      icon: { type: 'builtin', name: platform.toLowerCase() },
      color: null,
      source: 'api',
      platform: platform.toLowerCase(),
    })
  }
  return items
}

/**
 * 合并 Social API 数据与自定义项目。
 *
 * ## 唯一标识
 *
 * **URL 是身份，平台名不是。** 理由是可验证的：`social_ids` 里
 * 「一个平台一个值」，平台名唯一；但 `items[]` 允许同平台多个链接
 * （两个 Telegram 频道、两个 GitHub 组织）。若按平台名去重，
 * 后一个会被吞掉——这正是要避免的行为。
 *
 * 反过来，两个条目指向同一个 URL 时，它们对读者就是同一个入口，
 * 显示两次没有意义。所以去重键取 URL。
 *
 * ## 冲突规则
 *
 * 同一个 URL 同时出现在 API 与配置中时，**以配置为准**：
 * 配置带了标题、图标和颜色，是更明确的表达；API 只给出账号值。
 * 位置也以配置为准（配置项排在前面），避免「我调了顺序但没生效」。
 *
 * ## 顺序
 *
 * 配置项按 `items` 顺序在前，然后是 API 派生项。
 * API 派生项内部按旧配置 `order` 排序，未列出的保持 `/aggregate` 原始
 * 顺序——这样「新增一个账号」不会因为忘了改 order 就消失。
 */
export function toSocialItems(
  socialIds: Record<string, string> | null | undefined,
  options: { theme?: Pick<ThemeSocial, 'items' | 'order' | 'icons'> } = {},
): SocialItem[] {
  const fromApi = apiItems(socialIds)
  const theme = options.theme

  if (!theme) return fromApi

  // 旧配置的图标覆盖：只改外观，不改「这个链接是否存在」的判断
  const overridden = fromApi.map((item) => {
    const override = theme.icons[item.platform ?? '']
    return override ? { ...item, icon: { type: 'builtin' as const, name: override } } : item
  })

  const rank = new Map(theme.order.map((key, index) => [key, index]))
  const ordered =
    rank.size === 0
      ? overridden
      : [...overridden].sort((a, b) => {
          const ra = rank.get(a.platform ?? '') ?? Number.MAX_SAFE_INTEGER
          const rb = rank.get(b.platform ?? '') ?? Number.MAX_SAFE_INTEGER
          return ra - rb
        })

  const fromTheme: SocialItem[] = theme.items.map((item, index) => ({
    id: `theme:${index}`,
    title: item.title,
    url: item.url,
    icon: item.icon,
    color: item.color,
    source: 'theme',
    platform: null,
  }))

  // 配置项优先；API 项里 URL 已被配置项覆盖的跳过
  const claimed = new Set(fromTheme.map((item) => item.url))
  const merged = [...fromTheme]

  for (const item of ordered) {
    if (claimed.has(item.url)) continue
    claimed.add(item.url)
    merged.push(item)
  }

  return merged
}

/**
 * 是否需要加载图标样式表。
 *
 * 只有当真的存在 `css` 类型图标时才为它加载样式表：配了样式表却没有
 * 图标用它，等于白送一次阻塞请求；配了 css 图标却没配样式表，
 * 那个图标本来就不成立（解析层允许它存在，渲染层会降级）。
 */
export function needsIconStylesheets(social: Pick<ThemeSocial, 'items' | 'iconStylesheets'>): boolean {
  return (
    social.iconStylesheets.length > 0 &&
    social.items.some((item) => item.icon?.type === 'css')
  )
}
