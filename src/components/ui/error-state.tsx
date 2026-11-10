import { describeError } from '@/lib/api'

interface ErrorStateProps {
  title?: string
  error: unknown
  hint?: string
}

/**
 * 错误呈现：保留真实原因，方便部署者定位。
 * 不把错误伪装成「暂无内容」。
 */
export function ErrorState({ title = '内容加载失败', error, hint }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-line bg-paper-sunk/60 flex flex-col gap-2 border-l-2 border-l-[var(--color-danger)] px-5 py-4"
    >
      <p className="text-small font-medium text-[var(--text-heading)]">{title}</p>
      <p className="font-mono text-meta break-all text-[var(--text-secondary)]">
        {describeError(error)}
      </p>
      {hint ? <p className="text-meta text-[var(--text-tertiary)]">{hint}</p> : null}
    </div>
  )
}
