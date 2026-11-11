import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { ArchiveSection, buildYears } from '@/features/explore'
import { getSiteTimezone, getTimeline } from '@/lib/api'

/**
 * /archives —— 兼容路由
 *
 * 「归档」已经并入 /explore。这个路由保留下来，是因为旧链接可能已经流出去了，
 * 直接 404 会让外部引用与书签失效。内容与 /explore 的归档分区完全同源，
 * 只是保留了自己的页头与 metadata（外部搜索结果的落地页仍是它）。
 *
 * 归档的取数与分组逻辑已移到 features/explore，两处共用，不再各写一份。
 */
export const metadata: Metadata = {
  title: '归档',
  description: '文章与日记合并成的时间轴，按年月排列。',
}

export default async function ArchivesPage() {
  requireFeature('archives')

  const timeZone = getSiteTimezone()
  const timeline = await getTimeline()
  const years = buildYears(timeline.articles, timeline.diaries, timeZone)
  const total = timeline.articles.length + timeline.diaries.length

  return (
    <Container>
      <PageHeader
        kicker="归档"
        title="时间轴"
        description="文章与日记共用一条时间轴：最近的月份在最上面。"
      />
      <ArchiveSection years={years} total={total} idPrefix="year" />
    </Container>
  )
}