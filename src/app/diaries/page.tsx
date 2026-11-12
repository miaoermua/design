import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Pagination } from '@/components/ui/pagination'
import { LIST_PAGE_SIZE } from '@/core/config/site'
import { requireFeature } from '@/core/registry/guard'
import { DiaryDayGroupView } from '@/features/diaries'
import {
  getSiteTimezone,
  getTopicById,
  groupDiariesByDay,
  listDiaries,
  listDiariesByTopic,
} from '@/lib/api'
import { pageHref } from '@/lib/routes'

export const metadata: Metadata = {
  title: '日记',
  description: '以日为单位的时间流：情绪、天气、地点与片段。',
}

interface DiariesPageProps {
  searchParams: Promise<{ page?: string; topic?: string }>
}

export default async function DiariesPage({ searchParams }: DiariesPageProps) {
  requireFeature('diaries')

  const { page: pageParam, topic: topicParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()

  // 专栏来自顶栏选择器：找不到就是找不到，不偷偷退回「全部日记」，
  // 否则用户会以为筛选生效了，看到的却是全量列表。
  const topic = topicParam ? await getTopicById(topicParam) : null

  const result =
    topicParam && !topic
      ? null
      : await (topic
          ? listDiariesByTopic(topic.id, {
              page,
              size: LIST_PAGE_SIZE,
              sortBy: 'createdAt',
              sortOrder: -1,
            })
          : listDiaries({
              page,
              size: LIST_PAGE_SIZE,
              sortBy: 'createdAt',
              sortOrder: -1,
            }))

  const groups = result ? groupDiariesByDay(result.items, timeZone) : []

  return (
    <Container>
      <PageHeader
        kicker={topic ? '日记专栏' : '日记'}
        title={topic ? topic.name : '按天记录'}
        description={topic ? `只看「${topic.name}」里的日记。` : '没有主题，没有结构，只有时间。'}
        meta={
          result ? (
            <p className="meta">
              共 {result.pagination.total} 篇 · 第 {result.pagination.page} /{' '}
              {result.pagination.totalPages} 页
            </p>
          ) : null
        }
      />

      {topic ? (
        <p className="mb-8">
          <Link href="/diaries" className="link-quiet text-meta text-[var(--text-secondary)]">
            ← 查看全部日记
          </Link>
        </p>
      ) : null}

      {result === null ? (
        <EmptyState
          title="没有找到这个专栏"
          description="它可能已被删除或改名。可以从顶栏的「日记」重新选择。"
        />
      ) : groups.length > 0 ? (
        <div>
          {groups.map((group) => (
            <DiaryDayGroupView key={group.date} group={group} timeZone={timeZone} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={topic ? '这个专栏还没有日记' : '这一页没有日记'}
          description={
            topic
              ? '专栏存在，但里面暂时没有公开内容。'
              : result.pagination.total > 0
                ? '请求的页码超出了范围，请回到第 1 页。'
                : '还没有发布任何日记。'
          }
        />
      )}

      {result ? (
        <Pagination
          pagination={result.pagination}
          buildHref={(target) => pageHref('/diaries', target, { topic: topic?.id })}
          prevLabel="更新的一页"
          nextLabel="更早的一页"
        />
      ) : null}
    </Container>
  )
}
