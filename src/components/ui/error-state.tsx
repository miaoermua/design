import { describeError } from '@/lib/api'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/dictionary'

interface ErrorStateProps {
  title?: string
  error: unknown
  hint?: string
  locale?: Locale
}

/**
 * 错误呈现：保留真实原因，方便部署者定位。
 * 不把错误伪装成「暂无内容」。
 *
 * `describeError(error)` 的输出来自数据层，属于面向部署者的诊断信息，
 * 不参与界面翻译——翻译它只会让排查变难。
 */
export function ErrorState({
  title,
  error,
  hint,
  locale = DEFAULT_LOCALE,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="border-line bg-paper-sunk/60 flex flex-col gap-2 border-l-2 border-l-[var(--state-danger)] px-5 py-4"
    >
      <p className="text-small font-medium text-[var(--text-heading)]">
        {title ?? t(locale, 'state.errorTitle')}
      </p>
      <p className="font-mono text-meta break-all text-[var(--text-secondary)]">
        {describeError(error)}
      </p>
      {hint ? <p className="text-meta text-[var(--text-secondary)]">{hint}</p> : null}
    </div>
  )
}
