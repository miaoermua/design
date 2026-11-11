'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

export type ExploreTab = 'archives' | 'tags'

interface ExploreTabsProps {
  /** 当前激活的 Tab（由服务端按查询参数决定，避免首帧跳变） */
  active: ExploreTab
  labels: { archives: string; tags: string }
  archives: ReactNode
  tags: ReactNode
}

/**
 * 探索页的分区切换
 *
 * 用链接 + 查询参数（`?tab=tags`）而不是纯客户端 state：
 *   - 服务端就能决定渲染哪个分区，首帧正确、无 hydration 跳变；
 *   - Tab 状态可分享、可后退、可被搜索引擎分别索引；
 *   - 两个分区的数据都在服务端取好，切换不触发额外请求。
 *
 * 代价是切换会走一次路由（一次 RSC 往返）。对只有两个 Tabs 的页面，
 * 这个代价换来的是「无 JS 也能切换」，值得。
 */
export function ExploreTabs({ active, labels, archives, tags }: ExploreTabsProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const buildHref = (tab: ExploreTab) => {
    const params = new URLSearchParams(searchParams.toString())
    if (tab === 'archives') params.delete('tab')
    else params.set('tab', tab)
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  const tabClass = (isActive: boolean) =>
    cn(
      'relative -mb-px border-b-2 pb-2.5 text-small transition-colors duration-[var(--duration-fast)]',
      isActive
        ? 'border-[var(--accent)] text-[var(--text-heading)]'
        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
    )

  return (
    <div>
      <div
        role="tablist"
        aria-label="探索方式"
        className="flex gap-7 border-b border-[var(--edge)]"
      >
        <Link
          href={buildHref('archives')}
          role="tab"
          aria-selected={active === 'archives'}
          className={tabClass(active === 'archives')}
        >
          {labels.archives}
        </Link>
        <Link
          href={buildHref('tags')}
          role="tab"
          aria-selected={active === 'tags'}
          className={tabClass(active === 'tags')}
        >
          {labels.tags}
        </Link>
      </div>

      {/* 两个面板都渲染，用 hidden 控制可见性：切换时不重新挂载、不丢滚动位置 */}
      <div role="tabpanel" hidden={active !== 'archives'} className="pt-8">
        {archives}
      </div>
      <div role="tabpanel" hidden={active !== 'tags'} className="pt-8">
        {tags}
      </div>
    </div>
  )
}