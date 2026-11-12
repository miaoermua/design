import type { TocItem } from '@/lib/content/markdown'
import { cn } from '@/lib/utils/cn'
import { TocList } from './toc-list'

interface TocProps {
  items: TocItem[]
  /**
   * rail   = 桌面端右侧常驻栏的列表（标题行由 `ReadingAside` 提供，进度环在同一条线上）
   * inline = 移动端折叠在正文里的列表（标题由外层 <summary> 提供）
   * 两者都只负责列表：标题属于容器，不在这里重复画
   */
  variant?: 'rail' | 'inline'
}

/** 文章目录：标题来自服务端渲染的 heading，高亮交给 TocList 增强 */
export function Toc({ items, variant = 'rail' }: TocProps) {
  if (items.length < 2) return null

  const isRail = variant === 'rail'

  return (
    <nav
      aria-label="本文目录"
      className={cn(isRail && 'max-h-[calc(100dvh-24rem)] overflow-y-auto pb-1')}
    >
      <TocList items={items} variant={variant} />
    </nav>
  )
}
