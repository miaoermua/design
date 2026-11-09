import type { TocItem } from '@/lib/content/markdown'
import { cn } from '@/lib/utils/cn'

interface TocProps {
  items: TocItem[]
  /**
   * rail  = 桌面端右侧常驻栏（自带「目录」小标题、吸顶）
   * inline = 移动端折叠在正文里的列表（标题由外层 <summary> 提供）
   */
  variant?: 'rail' | 'inline'
}

/** 文章目录：只由服务端渲染时得到的 heading 生成，不做滚动监听 */
export function Toc({ items, variant = 'rail' }: TocProps) {
  if (items.length < 2) return null

  const isRail = variant === 'rail'

  return (
    <nav
      aria-label="本文目录"
      className={isRail ? 'sticky top-24 max-h-[calc(100dvh-8rem)] overflow-auto' : undefined}
    >
      {isRail ? <p className="meta">目录</p> : null}
      <ul className={cn('border-l border-[var(--edge)]', isRail && 'mt-3')}>
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className={cn(
                'block py-1 text-caption leading-[1.55] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]',
                item.depth === 3 ? 'pl-6 pr-2' : 'pl-3 pr-2',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
