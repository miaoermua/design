import type { TocItem } from '@/lib/content/markdown'
import { cn } from '@/lib/utils/cn'
import { TocList } from './toc-list'

interface TocProps {
  items: TocItem[]
  /**
   * rail  = 桌面端右侧常驻栏（自带「目录」小标题，滚动由外层容器接管）
   * inline = 移动端折叠在正文里的列表（标题由外层 <summary> 提供）
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
      className={isRail ? 'max-h-[calc(100dvh-18rem)] overflow-y-auto pb-1' : undefined}
    >
      {isRail ? <p className={cn('meta mb-2 text-[var(--text-tertiary)]')}>目录</p> : null}
      <TocList items={items} variant={variant} />
    </nav>
  )
}
