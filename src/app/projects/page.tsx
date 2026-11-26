import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { listProjects } from '@/lib/api'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { ProjectGrid } from '@/features/projects/project-grid'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'projects.title'),
    description: t(locale, 'projects.description'),
  }
}

export default async function ProjectsPage() {
  requireFeature('projects')

  const locale = await getLocale()
  const result = await listProjects()

  return (
    <Container>
      <PageHeader
        title={t(locale, 'projects.heading')}
        meta={
          <p className="meta">{tf(locale, 'projects.count', { count: result.items.length })}</p>
        }
      />

      {result.items.length > 0 ? (
        <ProjectGrid items={result.items} locale={locale} />
      ) : (
        <EmptyState
          title={t(locale, 'projects.emptyTitle')}
          description={t(locale, 'projects.emptyHint')}
        />
      )}
    </Container>
  )
}
