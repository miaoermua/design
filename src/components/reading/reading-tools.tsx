import Link from 'next/link'
import type { ReactNode } from 'react'
import type { TocItem } from '@/lib/content/markdown'
import { BackToTop } from '@/components/ui/back-to-top'
import { ReadingProgressBar } from '@/components/ui/reading-progress'
import { ReadingProgressRing } from '@/components/ui/reading-progress'
import { Toc } from '@/components/ui/toc'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/dictionary'

interface ReadingToolsProps {
  items: TocItem[]
  /** 正文元素 id，进度环以此为口径 */
  targetId: string
  backToTopLabel?: string
  locale?: Locale
}

interface ReadingAsideProps extends ReadingToolsProps {
  /** 操作栏由页面传入：桌面落在目录下方，移动端落在文末 */
  actions: ReactNode
}

/**
 * 阅读辅助区（Blog 与 Note 共用）
 *
 * 桌面：右栏常驻 —— 目录列表（带竖线高亮）→ 阅读进度条 → 操作按钮 → 回到顶部。
 * 移动：目录折叠在正文里（标题行同样带进度环），这里只剩文末的操作栏与回到顶部。
 *
 * 参考 Shiro 的侧栏做法：目录 accent 色竖线高亮、操作按钮纯图标竖排、
 * 阅读进度作为竖向进度条集成在侧栏底部，去掉虚线分隔改用间距。
 */
export function ReadingAside({
  items,
  targetId,
  backToTopLabel,
  locale = DEFAULT_LOCALE,
  actions,
}: ReadingAsideProps) {
  const hasToc = items.length >= 2

  return (
    <aside className="min-w-0 xl:col-start-2 xl:row-start-1">
      <div className="mt-8 pt-4 xl:sticky xl:top-28 xl:mt-0 xl:pt-0">
        <div className="hidden xl:block">
          {hasToc ? (
            <>
              <p className="text-meta font-medium tracking-[0.06em] uppercase text-[var(--text-secondary)]">
                {t(locale, 'toc.title')}
              </p>
              <div className="mt-3">
                <Toc items={items} variant="rail" label={t(locale, 'toc.label')} />
              </div>
            </>
          ) : null}

          <div className="mt-4">
            <ReadingProgressBar targetId={targetId} />
          </div>
        </div>

        {/* 操作按钮：桌面端纯图标竖排；移动端保持横排带文字 */}
        <div className="w-full max-w-[26rem] xl:mt-5">
          {actions}
        </div>

        <div className="mt-3 flex xl:mt-4">
          <BackToTop label={backToTopLabel} />
        </div>
      </div>
    </aside>
  )
}

export function ReadingInline({ items, targetId, locale = DEFAULT_LOCALE }: ReadingToolsProps) {
  const hasToc = items.length >= 2

  return (
    <div className="mt-10 xl:hidden">
      {hasToc ? (
        <details className="border-t border-dashed border-[var(--edge)] pt-4">
          <summary className="toc-summary meta flex cursor-pointer items-center justify-between gap-3 select-none">
            <span>{t(locale, 'toc.title')}</span>
            <span className="flex items-center gap-2">
              <ReadingProgressRing targetId={targetId} />
              <span aria-hidden="true" className="toc-chevron text-[var(--text-tertiary)]">
                ›
              </span>
            </span>
          </summary>
          <div className="mt-1">
            <Toc items={items} variant="inline" label={t(locale, 'toc.label')} />
          </div>
        </details>
      ) : (
        <div className="flex justify-end border-t border-dashed border-[var(--edge)] pt-4">
          <ReadingProgressRing targetId={targetId} />
        </div>
      )}
    </div>
  )
}

/** 目录折叠时仍需要一条「返回列表」的轻量出口；单独导出以便页面复用 */
export function ReadingBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="link-quiet text-small text-[var(--text-secondary)]">
      {label}
    </Link>
  )
}
