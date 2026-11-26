import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { listSays } from '@/lib/api'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { SayGrid } from '@/features/says/say-grid'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'says.title'),
    description: t(locale, 'says.description'),
  }
}

export default async function SaysPage() {
  requireFeature('says')

  const locale = await getLocale()
  const result = await listSays(1, 50)

  return (
    <Container>
      <PageHeader
        title={t(locale, 'says.heading')}
        meta={
          <p className="meta">{tf(locale, 'says.count', { total: result.pagination.total })}</p>
        }
      />

      {result.items.length > 0 ? (
        <SayGrid items={result.items} locale={locale} />
      ) : (
        <EmptyState
          title={t(locale, 'says.emptyTitle')}
          description={t(locale, 'says.emptyHint')}
        />
      )}
    </Container>
  )
}
