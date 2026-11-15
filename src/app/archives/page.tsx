import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { ArchiveSection, buildYears } from '@/features/explore'
import { getSiteTimezone, getTimeline } from '@/lib/api'
import { t } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'

/**
 * /archives —— 兼容路由
 *
 * 「归档」已经并入 /explore。这个路由保留下来，是因为旧链接可能已经流出去了，
 * 直接 404 会让外部引用与书签失效。内容与 /explore 的归档分区完全同源，
 * 只是保留了自己的页头与 metadata（外部搜索结果的落地页仍是它）。
 *
 * 归档的取数与分组逻辑已移到 features/explore，两处共用，不再各写一份。
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'archives.title'),
    description: t(locale, 'archives.description'),
  }
}

export default async function ArchivesPage() {
  requireFeature('archives')

  const locale = await getLocale()
  const timeZone = getSiteTimezone()
  const timeline = await getTimeline()
  const years = buildYears(timeline.articles, timeline.diaries, timeZone)
  const total = timeline.articles.length + timeline.diaries.length

  return (
    <Container>
      <PageHeader
        kicker={t(locale, 'archives.kicker')}
        title={t(locale, 'archives.heading')}
        description={t(locale, 'explore.archivesDescription')}
      />
      <ArchiveSection years={years} total={total} idPrefix="year" locale={locale} />
    </Container>
  )
}
