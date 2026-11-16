'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Container } from '@/components/ui/container'
// 客户端错误边界只依赖纯错误工具，避免把服务端数据层打进客户端包
import { describeError } from '@/lib/api/errors'
import { useLocale } from '@/lib/i18n/client'
import { t } from '@/lib/i18n/dictionary'

/**
 * 错误边界
 *
 * 展示真实的错误信息：主题不做「出了点问题」这类掩盖，
 * 部署者需要看到是环境变量、网络还是后端返回了错误。
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const locale = useLocale()

  useEffect(() => {
    console.error('[folio] render failed:', error)
  }, [error])

  return (
    <Container>
      <div className="py-24">
        <p className="meta">{t(locale, 'error.kicker')}</p>
        <h1 className="mt-3 font-serif text-title text-[var(--text-heading)]">
          {t(locale, 'error.title')}
        </h1>
        <p className="mt-4 max-w-[var(--measure-copy)] font-mono text-caption break-words text-[var(--text-secondary)]">
          {describeError(error)}
        </p>
        {error.digest ? <p className="meta mt-2">digest: {error.digest}</p> : null}

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
          <button
            type="button"
            onClick={reset}
            className="border border-[var(--text-primary)] bg-[var(--text-primary)] px-4 py-2 text-small text-[var(--surface)]"
          >
            {t(locale, 'action.retry')}
          </button>
          <Link href="/" className="link-quiet text-small">
            {t(locale, 'action.backHome')}
          </Link>
        </div>
      </div>
    </Container>
  )
}
