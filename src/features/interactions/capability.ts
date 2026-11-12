import type { ThemeSocial } from '@/core/config/theme'
import { isFeatureEnabled } from '@/core/registry/features'
import { getSubscribeCapability, type SubscribeCapability } from '@/lib/api'
import { selectSubscribeChannels, type SubscribeChannel } from './channels'

/**
 * 交互能力（Like / Subscribe）的总开关
 *
 * Feature Registry 的约定是「关模块 = 改一个布尔值」：关掉 `interactions` 之后
 * 不仅入口要消失，也不能再向 core 发探测请求。这里就是那道闸门——
 * 页面只调用本文件，不直接碰 `getSubscribeCapability()`。
 */
export function isInteractionEnabled(): boolean {
  return isFeatureEnabled('interactions')
}

async function readSubscribeCapability(): Promise<SubscribeCapability> {
  if (!isInteractionEnabled()) return { enabled: false, types: [] }
  return getSubscribeCapability()
}

/**
 * 订阅弹窗需要的东西：邮件订阅能力 + 频道列表。
 *
 * 两者来源不同（core 的 `/subscribe/status` 与主题 Snippet 的 `social.items`），
 * 但在页面上是同一个入口，所以在这里合并，而不是让每个页面各拼一次。
 */
export interface SubscribeOptions extends SubscribeCapability {
  /** 已按配置过滤；为空时弹窗只保留邮件 / RSS */
  channels: SubscribeChannel[]
}

export async function readSubscribeOptions(social: ThemeSocial): Promise<SubscribeOptions> {
  const capability = await readSubscribeCapability()
  // 模块关闭时连配置都不读：入口不渲染，读出来的频道也没有去处
  if (!isInteractionEnabled()) return { ...capability, channels: [] }

  return { ...capability, channels: selectSubscribeChannels(social) }
}
