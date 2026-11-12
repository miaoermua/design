import { readDonateConfig, isDonateVisible } from '../config'

import { DonateAction } from './donate-action'

interface DonateSlotProps {
  /** 主题配置（或任何同形对象）；这里只读取 `donate` 子树 */
  theme: unknown
  className?: string
}

/**
 * Donate 的唯一入口组件，文章页与日记条目共用。
 *
 * 所有「显示与否」的判断都在服务端完成：不可见时连客户端组件都不渲染，
 * 不给页面增加任何水合成本。
 */
export function DonateSlot({ theme, className }: DonateSlotProps) {
  const config = readDonateConfig(theme)
  if (!isDonateVisible(config)) return null

  return <DonateAction label={config.label} qrcodes={config.qrcodes} className={className} />
}
