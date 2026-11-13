import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { FriendCard } from '@/features/friends/friend-card'
import { listFriendLinks } from '@/lib/api'

export const metadata: Metadata = {
  title: '友链',
  description: '这里记录长期互相阅读的站点。',
}

export default async function FriendsPage() {
  requireFeature('friends')

  const links = await listFriendLinks()

  return (
    <Container>
      <PageHeader
        kicker="友链"
        title="朋友们"
        description="这里只展示已通过审核且未被隐藏的友链；审核中、已过期与已拒绝的条目不会出现。"
        meta={<p className="meta">{links.length} 个站点</p>}
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
        <EmptyState title="还没有公开的友链" description="还没有通过审核的友链。" />
      )}
    </Container>
  )
}
