import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { t } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'

/**
 * 404
 *
 * 这里也走 i18n：404 是读者最常撞见的一页，留中文会显得整个英文站点
 * 只有这一块没翻译。`not-found.tsx` 仍处在请求上下文里，可以读 locale。
 */
export default async function NotFound() {
  const locale = await getLocale()

  return (
    <Container>
      <div className="py-24 sm:py-32">
        <p className="meta">404</p>
        <h1 className="mt-3 font-serif text-title text-[var(--text-heading)]">
          {t(locale, 'notFound.title')}
        </h1>
        <p className="mt-3 max-w-[var(--measure-copy)] text-small text-[var(--text-secondary)]">
          {t(locale, 'notFound.description')}
        </p>
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/" className="link-quiet text-small">
            {t(locale, 'notFound.backHome')}
          </Link>
          <Link href="/archives" className="link-quiet text-small">
            {t(locale, 'notFound.browseArchives')}
          </Link>
          <Link href="/search" className="link-quiet text-small">
            {t(locale, 'notFound.search')}
          </Link>
        </div>
      </div>
    </Container>
  )
}
