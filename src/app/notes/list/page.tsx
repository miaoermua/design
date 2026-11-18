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
  listTopics,
} from '@/lib/api'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { NOTE_LIST_PATH, noteListPath, pageHref } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'

/**
 * 日记时间线：全部日记，按天分组，支持分页与专栏筛选。
 *
 * 这是原 `/diaries` 列表页的整体迁移，分组组件与取数逻辑直接复用。
 * `/notes` 只负责把读者送到最新一篇，时间线让给了这条静态路由。
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'diaries.title'),
    description: t(locale, 'diaries.description'),
    alternates: { canonical: NOTE_LIST_PATH },
  }
}

interface NotesListPageProps {
  searchParams: Promise<{ page?: string; topic?: string }>
}

export default async function NotesListPage({ searchParams }: NotesListPageProps) {
  requireFeature('diaries')

  const { page: pageParam, topic: topicParam } = await searchParams
  const page = Math.max(1, Number.parseInt(pageParam ?? '1', 10) || 1)
  const timeZone = getSiteTimezone()
  const locale = await getLocale()

  // 专栏找不到就是找不到，不偷偷退回「全部日记」：否则用户以为筛选生效了，
  // 看到的却是全量列表。
  const topic = topicParam ? await getTopicById(topicParam) : null

  /*
   * 筛选条要列出全部专栏。取不到就整条不渲染——半个专栏的筛选器比没有更糟
   * （点下去才发现筛不出来）。这里失败不影响下面的列表本身。
   */
  const topics = await listTopics().catch(() => [])

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

      {/*
        专栏筛选条：导航里不展开专栏，筛选入口只在这里。

        视觉与探索页的内容类型筛选一致（胶囊 + `--accent-wash` 选中态），
        但不抽成共享组件：两边切换的是不同维度（内容类型 vs 专栏），
        强行抽象会为了复用而多一层参数。样式规范复用，组件不复用。

        窄屏横向滚动而不是换行：专栏数量不可控，换行会把首屏标题挤下去，
        而且多行胶囊不如一行可滑动好扫。

        链接直接指向新 URL（服务端渲染），刷新、前进/后退、新标签页都天然可用；
        `?topic=` 变化时丢弃 page——换了筛选条件还停在旧页码会落到空页面。
      */}
      {topics.length > 0 ? (
        <nav
          aria-label={t(locale, 'diaries.filterLabel')}
          className="mb-8 flex gap-2 overflow-x-auto pb-1"
        >
          <FilterChip href={NOTE_LIST_PATH} active={!topic} label={t(locale, 'diaries.filterAll')} />
          {topics.map((item) => (
            <FilterChip
              key={item.id}
              href={noteListPath(item.id)}
              active={topic?.id === item.id}
              label={item.name}
            />
          ))}
        </nav>
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
          buildHref={(target) => pageHref(NOTE_LIST_PATH, target, { topic: topic?.id })}
          prevLabel={t(locale, 'pagination.newer')}
          nextLabel={t(locale, 'pagination.older')}
        />
      ) : null}
    </Container>
  )
}

/**
 * 一枚筛选胶囊。
 *
 * 选中态用 `--accent-wash`（与探索页同一 Token），未选中只给一点底色，
 * 不加边框——一排描边胶囊会把筛选条读成一次表单。
 */
function FilterChip({
  href,
  active,
  label,
}: {
  href: string
  active: boolean
  label: string
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'text-small shrink-0 rounded-full px-3.5 py-1 whitespace-nowrap transition-colors duration-[var(--duration-fast)]',
        active
          ? 'bg-[var(--accent-wash)] text-[var(--accent-strong)]'
          : 'bg-[var(--surface-sunk)] text-[var(--text-secondary)] hover:text-[var(--text-heading)]',
      )}
    >
      {label}
    </Link>
  )
}
