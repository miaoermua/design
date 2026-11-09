export interface SocialLink {
  label: string
  href: string
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

export function toSocialLinks(socialIds: Record<string, string> | null | undefined): SocialLink[] {
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
  return links
}
