import Link from 'next/link'
import type { SiteIdentity } from '@/lib/api'
import { getFooterNav } from '@/core/navigation'
import { siteDescription, siteTitle } from '@/lib/site'
import { toSocialLinks } from '@/lib/social'

export function SiteFooter({ identity }: { identity: SiteIdentity | null }) {
  const items = getFooterNav()
  const title = siteTitle(identity)
  const description = siteDescription(identity)
  const socials = toSocialLinks(identity?.owner.socialIds)
  const year = new Date().getFullYear()

  return (
    <footer className="mt-24 border-t border-dashed border-[var(--edge-strong)]">
      <div className="mx-auto grid max-w-[var(--container-wide)] gap-10 px-5 py-12 sm:grid-cols-[1.6fr_1fr_1fr] sm:px-8">
        <div>
          <p className="font-serif text-h3 text-[var(--text-primary)]">{title}</p>
          <p className="mt-2 max-w-[26rem] text-small text-[var(--text-secondary)]">
            {description}
          </p>
          {socials.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {socials.map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <a
                    href={link.href}
                    rel="me noopener noreferrer"
                    target={link.href.startsWith('mailto:') ? undefined : '_blank'}
                    className="meta link-quiet"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <nav aria-label="页脚导航">
          <p className="meta">浏览</p>
          <ul className="mt-3 flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="link-quiet text-small text-[var(--text-secondary)]"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="meta">订阅</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <a
                href="/feed.xml"
                className="link-quiet text-small text-[var(--text-secondary)]"
              >
                RSS
              </a>
            </li>
            <li>
              <Link
                href="/archives"
                className="link-quiet text-small text-[var(--text-secondary)]"
              >
                全部归档
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-[var(--container-wide)] flex-col gap-2 border-t border-[var(--edge)] px-5 py-5 text-meta text-[var(--text-tertiary)] sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>
          © {year} {identity?.owner.name ?? title}
        </p>
        <p>Folio · 基于 Mix Space API v2</p>
      </div>
    </footer>
  )
}
