import type { ThemeSocial } from '@/core/config/theme'

export interface SocialLink {
  label: string
  href: string
  /** 展示用图标名；未配置时由 SocialIcon 按 label 自行回退 */
  icon?: string
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

/**
 * 账号来源固定是 `/aggregate` 的 `user.social_ids`。
 *
 * Theme Snippet 只负责三件事：是否显示、顺序、图标名覆盖。
 * 刻意**不在 YAML 里存账号地址**——账号是身份数据，属于后端；
 * 放进主题配置会产生两份真相，改一处忘一处就会出现死链。
 */
export function toSocialLinks(
  socialIds: Record<string, string> | null | undefined,
  options: { theme?: ThemeSocial } = {},
): SocialLink[] {
  const links: SocialLink[] = []
  for (const [key, value] of Object.entries(socialIds ?? {})) {
    const trimmed = value.trim()
    if (!trimmed) continue
    const rule = SOCIAL_RULES[key]
    if (rule) {
      links.push({ label: key, href: rule(trimmed) })
      continue
    }
    if (/^https?:\/\//.test(trimmed)) links.push({ label: key, href: trimmed })
  }

  const theme = options.theme
  if (!theme) return links

  // 图标覆盖：只改外观，不改链接是否存在的判断
  const withIcons = links.map((link) => {
    const icon = theme.icons[link.label.toLowerCase()]
    return icon ? { ...link, icon } : link
  })

  if (theme.order.length === 0) return withIcons

  // 按 order 排序：order 里没有的平台排在后面，保持 /aggregate 的原始顺序。
  // 这样「新增一个社交账号」不会因为忘了改 order 就消失。
  const rank = new Map(theme.order.map((key, index) => [key, index]))
  return [...withIcons].sort((a, b) => {
    const ra = rank.get(a.label.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(b.label.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}