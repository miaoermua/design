import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, SectionHeading } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { ExpiredFriendItem, FriendCard } from '@/features/friends/friend-card'
import { listExpiredFriendLinks, listFriendLinks } from '@/lib/api'
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
  const [links, expiredLinks] = await Promise.all([listFriendLinks(), listExpiredFriendLinks()])

  return (
    <Container className="@container">
      <PageHeader
        kicker={t(locale, 'friends.kicker')}
        title={t(locale, 'friends.heading')}
        description={t(locale, 'friends.description')}
        meta={<p className="meta">{tf(locale, 'friends.count', { count: links.length })}</p>}
      />

      {/* 列数由内容容器的实际可用宽度决定（Container 上的 `@container`），不看视口。
          阈值 = 列数 × 卡片宽 19.5rem + (列数 − 1) × 列间距 2.5rem：
          两列 41.5rem（664px）、三列 63.5rem（1016px）。差 1px 都不放下一整列，
          所以轨道始终是完整的 19.5rem，卡片、邮票与文字区在任何列数下都不被压缩。 */}
      {links.length > 0 ? (
        <ul className="grid grid-cols-1 justify-items-center gap-3 @min-[41.5rem]:grid-cols-[repeat(2,minmax(0,19.5rem))] @min-[41.5rem]:justify-center @min-[41.5rem]:gap-10 @min-[63.5rem]:grid-cols-[repeat(3,minmax(0,19.5rem))]">
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

      {/* 已过期的友链：与上面的信封隔开、单开一类。只有站名与描述两行文字，
          不做卡片；轨道与上面信封完全相同（19.5rem 定宽列 + 2.5rem 列距 + 居中），
          在同一组容器断点上切换，所以两块的列缘逐列对齐。 */}
      {expiredLinks.length > 0 ? (
        <section className="mt-12" aria-label={t(locale, 'friends.expiredTitle')}>
          <SectionHeading
            title={t(locale, 'friends.expiredTitle')}
            action={
              <p className="meta">{tf(locale, 'friends.count', { count: expiredLinks.length })}</p>
            }
          />
          <ul className="mt-6 grid grid-cols-[minmax(0,19.5rem)] justify-center gap-x-10 gap-y-5 @min-[41.5rem]:grid-cols-[repeat(2,minmax(0,19.5rem))] @min-[63.5rem]:grid-cols-[repeat(3,minmax(0,19.5rem))]">
            {expiredLinks.map((link) => (
              <li key={link.id}>
                <ExpiredFriendItem link={link} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Container>
  )
}
