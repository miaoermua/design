import type { Say } from '@/lib/api/domain/say'
import type { Locale } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/dictionary'

/**
 * 一言卡片网格
 *
 * 设计语言：暖纸底上的语录卡片，左缘 3px 彩色竖线（色相由 id 哈希决定），
 * 每条是一个 `<blockquote>` —— 文字 → 出处/作者 → 时间。
 * 桌面双列、移动单列，卡片 surface-raised + 暖阴影。
 */

function stringToHue(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
    hash |= 0
  }
  return Math.abs(hash) % 360
}

function formatRelativeDate(isoDate: string): string {
  const date = new Date(isoDate)
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays < 1) return '今天'
  if (diffDays < 2) return '昨天'
  if (diffDays < 30) return `${diffDays} 天前`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} 个月前`
  return `${Math.floor(diffDays / 365)} 年前`
}

interface SayGridProps {
  items: Say[]
  locale: Locale
}

export function SayGrid({ items, locale }: SayGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {items.map((say) => {
        const hue = stringToHue(say.id)
        const hasSource = say.source.length > 0
        const hasAuthor = say.author.length > 0

        return (
          <blockquote
            key={say.id}
            className="group relative border-l-[3px] bg-[var(--surface-raised)] px-5 py-4 shadow-[var(--shadow-raise)] transition-shadow duration-200 hover:shadow-[var(--shadow-pop)]"
            style={{
              borderLeftColor: `hsl(${hue}, 45%, 65%)`,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <p className="text-body leading-relaxed text-[var(--text-heading)]">{say.text}</p>

            <footer className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="text-meta text-[var(--text-secondary)]">
                {hasSource && hasAuthor
                  ? `${say.source}，${say.author}`
                  : hasSource
                    ? say.source
                    : hasAuthor
                      ? say.author
                      : t(locale, 'says.ownerSays')}
              </p>
              <time dateTime={say.createdAt} className="text-meta text-[var(--text-secondary)]">
                {formatRelativeDate(say.createdAt)}
              </time>
            </footer>
          </blockquote>
        )
      })}
    </div>
  )
}
