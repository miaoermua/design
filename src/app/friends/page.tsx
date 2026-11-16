import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { FriendCard } from '@/features/friends/friend-card'
import { listFriendLinks } from '@/lib/api'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'friends.title'),
    description: t(locale, 'friends.description'),
  }
}

export default async function FriendsPage() {
  requireFeature('friends')

  const locale = await getLocale()
  const links = await listFriendLinks()

  return (
    <Container>
      <PageHeader
        kicker={t(locale, 'friends.kicker')}
        title={t(locale, 'friends.heading')}
        description={t(locale, 'friends.description')}
        meta={<p className="meta">{tf(locale, 'friends.count', { count: links.length })}</p>}
      />

      {links.length > 0 ? (
        <ul className="grid grid-cols-1 justify-items-center gap-3 md:grid-cols-[repeat(2,minmax(0,19.5rem))] md:justify-center md:gap-10">
          {links.map((link) => (
            <li key={link.id}>
              <FriendCard link={link} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={t(locale, 'friends.emptyTitle')}
          description={t(locale, 'friends.emptyHint')}
        />
      )}
    </Container>
  )
}
