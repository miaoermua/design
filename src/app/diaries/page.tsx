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
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { pageHref } from '@/lib/routes'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'diaries.title'),
    description: t(locale, 'diaries.description'),
  }
}

interface DiariesPageProps {
  searchParams: Promise<{ page?: string; topic?: string }>
}

export default async function DiariesPage({ searchParams }: DiariesPageProps) {
  requireFeature('diaries')

  const { page: pageParam, topic: topicParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()
  const locale = await getLocale()

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
        kicker={topic ? t(locale, 'diaries.kickerTopic') : t(locale, 'diaries.kicker')}
        title={topic ? topic.name : t(locale, 'diaries.heading')}
        description={
          topic
            ? tf(locale, 'diaries.topicIntro', { name: topic.name })
            : t(locale, 'diaries.intro')
        }
        meta={
          result ? (
            <p className="meta">
              {tf(locale, 'meta.listSummary', {
                total: result.pagination.total,
                page: result.pagination.page,
                pages: result.pagination.totalPages,
              })}
            </p>
          ) : null
        }
      />

      {topic ? (
        <p className="mb-8">
          <Link href="/diaries" className="link-quiet text-meta text-[var(--text-secondary)]">
            {t(locale, 'diaries.viewAll')}
          </Link>
        </p>
      ) : null}

      {result === null ? (
        <EmptyState
          title={t(locale, 'diaries.topicMissingTitle')}
          description={t(locale, 'diaries.topicMissingDescription')}
        />
      ) : groups.length > 0 ? (
        <div>
          {groups.map((group) => (
            <DiaryDayGroupView key={group.date} group={group} timeZone={timeZone} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={topic ? t(locale, 'diaries.emptyTopic') : t(locale, 'diaries.emptyPage')}
          description={
            topic
              ? t(locale, 'diaries.emptyTopicHint')
              : result.pagination.total > 0
                ? t(locale, 'diaries.emptyOutOfRange')
                : t(locale, 'diaries.emptyNone')
          }
        />
      )}

      {result ? (
        <Pagination
          pagination={result.pagination}
          locale={locale}
          buildHref={(target) => pageHref('/diaries', target, { topic: topic?.id })}
          prevLabel={t(locale, 'pagination.newer')}
          nextLabel={t(locale, 'pagination.older')}
        />
      ) : null}
    </Container>
  )
}
