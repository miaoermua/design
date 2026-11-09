import type { Metadata } from 'next'
import { Container } from '@/components/ui/container'
import { CoverImage } from '@/components/ui/cover-image'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { requireFeature } from '@/core/registry/guard'
import { listFriendLinks, type FriendLink } from '@/lib/api'

export const metadata: Metadata = {
  title: '友链',
  description: '这里记录长期互相阅读的站点。',
}

/** 只接受 http(s)：友链 URL 来自后端，主题不替它承担 javascript: 之类的风险 */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

function FriendCard({ link }: { link: FriendLink }) {
  const clickable = isHttpUrl(link.url)

  const body = (
    <>
      {link.avatar ? (
        <CoverImage
          src={link.avatar}
          alt={link.name}
          width={56}
          height={56}
          className="size-14 shrink-0 border border-[var(--edge)] object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center border border-[var(--edge)] bg-[var(--surface-sunk)] font-serif text-h3 text-[var(--text-tertiary)]"
        >
          {link.name.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-serif text-h3 text-[var(--text-primary)]">
          {link.name}
        </span>
        {link.description ? (
          <span className="mt-1 line-clamp-2 block text-small text-[var(--text-secondary)]">
            {link.description}
          </span>
        ) : null}
        <span className="meta mt-1 block truncate">{link.url}</span>
      </span>
    </>
  )

  return clickable ? (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-4 border border-[var(--edge)] bg-[var(--surface-raised)] p-4 transition-colors duration-[var(--duration-fast)] hover:border-[var(--accent)]"
    >
      {body}
    </a>
  ) : (
    <div className="flex items-start gap-4 border border-dashed border-[var(--edge)] p-4">
      {body}
    </div>
  )
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
        <ul className="grid gap-4 sm:grid-cols-2">
          {links.map((link) => (
            <li key={link.id}>
              <FriendCard link={link} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="还没有公开的友链"
          description="还没有通过审核的友链。"
        />
      )}
    </Container>
  )
}
