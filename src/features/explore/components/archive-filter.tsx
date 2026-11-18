'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

export type ArchiveFilterType = 'all' | 'post' | 'note' | 'memory'

interface ArchiveFilterProps {
  active: ArchiveFilterType
  label: string
  labels: Record<ArchiveFilterType, string>
}

/**
 * 时间轴内容类型筛选
 *
 * 与 ExploreTabs 同理：用链接 + 查询参数，服务端决定数据，首帧正确。
 * 筛选条件编码为 `?type=post/note` 或 `?memory=1`，`all` 时删除这些参数。
 */
export function ArchiveFilter({ active, label, labels }: ArchiveFilterProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const buildHref = (filter: ArchiveFilterType) => {
    const params = new URLSearchParams(searchParams.toString())
    // 清除旧的筛选参数
    params.delete('type')
    params.delete('memory')
    // 设置新参数
    if (filter === 'post') params.set('type', 'post')
    else if (filter === 'note') params.set('type', 'note')
    else if (filter === 'memory') params.set('memory', '1')
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  const filters: ArchiveFilterType[] = ['all', 'post', 'note', 'memory']

  return (
    <nav aria-label={label} className="mb-6 flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Link
          key={filter}
          href={buildHref(filter)}
          aria-current={active === filter ? 'page' : undefined}
          className={cn(
            'text-small rounded-full px-3.5 py-1 transition-colors duration-[var(--duration-fast)]',
            active === filter
              ? 'bg-[var(--accent-wash)] text-[var(--accent-strong)]'
              : 'bg-[var(--surface-sunk)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
          )}
        >
          {labels[filter]}
        </Link>
      ))}
    </nav>
  )
}
