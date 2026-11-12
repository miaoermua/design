import type { ThemeSocial, ThemeSocialIcon } from '@/core/config/theme'

/**
 * 频道订阅
 *
 * 频道不是「另一个订阅系统」，而是一个**外部链接**：主题侧不保存订阅状态，
 * 也不为它新增接口。因此这里只做一件事——从 `theme.social.items` 里挑出
 * 明确标了 `channel: true` 的项，标题 / 图标 / 颜色 / 地址全部沿用那一项。
 *
 * 两条刻意保留的边界：
 *
 *   1. **没有 `mailto:`**。邮箱订阅已经在弹窗里以表单形式存在，邮箱地址
 *      不该再作为「频道」出现一次——同一个入口给两种交互方式只会让人犹豫。
 *   2. **`social.enabled` 关闭时为空**。社交模块关闭的语义是「这些入口整体
 *      不出现」，弹窗不该是唯一的例外。
 */
export interface SubscribeChannel {
  /** 稳定 key：在配置里的序号 */
  id: string
  title: string
  url: string
  icon: ThemeSocialIcon | null
  color: string | null
}

/** 只接受能直接跳转的 http(s) 频道；解析层已排除其它协议，这里再兜一次 */
const EXTERNAL_URL = /^https?:\/\//i

export function selectSubscribeChannels(social: ThemeSocial): SubscribeChannel[] {
  if (!social.enabled) return []

  return social.items
    .filter((item) => item.channel && EXTERNAL_URL.test(item.url))
    .map((item, index) => ({
      id: `channel:${index}`,
      title: item.title,
      url: item.url,
      icon: item.icon,
      color: item.color,
    }))
}
