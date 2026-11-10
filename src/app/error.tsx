'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Container } from '@/components/ui/container'
// 客户端错误边界只依赖纯错误工具，避免把服务端数据层打进客户端包
import { describeError } from '@/lib/api/errors'

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
  useEffect(() => {
    console.error('[folio] render failed:', error)
  }, [error])

  return (
    <Container>
      <div className="py-24">
        <p className="meta">出错了</p>
        <h1 className="mt-3 font-serif text-title text-[var(--text-heading)]">
          这个页面没能完成渲染
        </h1>
        <p className="mt-4 max-w-[var(--container-prose)] font-mono text-caption break-words text-[var(--text-secondary)]">
          {describeError(error)}
        </p>
        {error.digest ? <p className="meta mt-2">digest: {error.digest}</p> : null}

        <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3">
          <button
            type="button"
            onClick={reset}
            className="border border-[var(--text-primary)] bg-[var(--text-primary)] px-4 py-2 text-small text-[var(--surface)]"
          >
            重试
          </button>
          <Link href="/" className="link-quiet text-small">
            回到首页
          </Link>
        </div>
      </div>
    </Container>
  )
}
