import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { LIST_PAGE_SIZE } from '@/core/config/site'
import { requireFeature } from '@/core/registry/guard'
import { DiaryDayGroupView } from '@/features/diaries'
import { groupDiariesByDay, listDiaries, getSiteTimezone } from '@/lib/api'
import { pageHref } from '@/lib/routes'

export const metadata: Metadata = {
  title: '日记',
  description: '以日为单位的时间流：情绪、天气、地点与片段。',
}

interface DiariesPageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function DiariesPage({ searchParams }: DiariesPageProps) {
  requireFeature('diaries')

  const { page: pageParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()

  const result = await listDiaries({
    page,
    size: LIST_PAGE_SIZE,
    sortBy: 'createdAt',
    sortOrder: -1,
  })
  const groups = groupDiariesByDay(result.items, timeZone)

  return (
    <Container>
      <PageHeader
        kicker="日记"
        title="按天记录"
        description="没有主题，没有结构，只有时间。"
        meta={
          <p className="meta">
            共 {result.pagination.total} 篇 · 第 {result.pagination.page} /{' '}
            {result.pagination.totalPages} 页
          </p>
        }
      />

      {groups.length > 0 ? (
        <div>
          {groups.map((group) => (
            <DiaryDayGroupView key={group.date} group={group} timeZone={timeZone} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="这一页没有日记"
          description={
            result.pagination.total > 0
              ? '请求的页码超出了范围，请回到第 1 页。'
              : '还没有发布任何日记。'
          }
        />
      )}

      <Pagination
        pagination={result.pagination}
        buildHref={(target) => pageHref('/diaries', target)}
        prevLabel="更新的一页"
        nextLabel="更早的一页"
      />
    </Container>
  )
}
