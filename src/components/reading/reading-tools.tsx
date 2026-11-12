import Link from 'next/link'
import type { ReactNode } from 'react'
import type { TocItem } from '@/lib/content/markdown'
import { BackToTop } from '@/components/ui/back-to-top'
import { ReadingProgressRing } from '@/components/ui/reading-progress'
import { Toc } from '@/components/ui/toc'

interface ReadingToolsProps {
  items: TocItem[]
  /** 正文元素 id，进度环以此为口径 */
  targetId: string
  backToTopLabel?: string
}

interface ReadingAsideProps extends ReadingToolsProps {
  /** 操作栏由页面传入：桌面落在目录下方，移动端落在文末 */
  actions: ReactNode
}

/**
 * 阅读辅助区（Blog 与 Note 共用）
 *
 * 桌面：右栏常驻 —— 标题行（目录 ｜ 环形进度）→ 目录列表 → 操作栏 → 回到顶部。
 * 移动：目录折叠在正文里（标题行同样带进度环），这里只剩文末的操作栏与回到顶部。
 *
 * 进度不再单独占一行：它是目录标题的附属信息，压在标题行右侧；
 * 操作栏也不再是独立竖栏，而是目录列表下方的一排。
 * 回到顶部是次级操作，留在操作栏之外，避免和四个主操作抢点击区。
 */
export function ReadingAside({ items, targetId, backToTopLabel, actions }: ReadingAsideProps) {
  const hasToc = items.length >= 2

  return (
    <aside className="min-w-0 xl:col-start-2 xl:row-start-1">
      <div className="mt-8 border-t border-dashed border-[var(--edge)] pt-4 xl:sticky xl:top-28 xl:mt-0 xl:border-t-0 xl:pt-0">
        <div className="hidden xl:block">
          {hasToc ? (
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="meta text-[var(--text-tertiary)]">目录</p>
              <ReadingProgressRing targetId={targetId} />
            </div>
          ) : (
            // 短正文没有目录，进度环仍然保留：它是这页唯一的「读到哪」提示
            <div className="mb-2 flex justify-end">
              <ReadingProgressRing targetId={targetId} />
            </div>
          )}

          <Toc items={items} variant="rail" />
        </div>

        {/* 平板宽度下不让四项被拉成满屏：收在 26rem 内，间距仍然均匀 */}
        <div className="w-full max-w-[26rem] xl:mt-4 xl:border-t xl:border-dashed xl:border-[var(--edge)] xl:pt-4">
          {actions}
        </div>

        <div className="mt-3 flex justify-end">
          <BackToTop label={backToTopLabel} />
        </div>
      </div>
    </aside>
  )
}

export function ReadingInline({ items, targetId }: ReadingToolsProps) {
  const hasToc = items.length >= 2

  return (
    <div className="mt-10 xl:hidden">
      {hasToc ? (
        <details className="border-t border-dashed border-[var(--edge)] pt-4">
          <summary className="toc-summary meta flex cursor-pointer items-center justify-between gap-3 select-none">
            <span>目录</span>
            <span className="flex items-center gap-2">
              <ReadingProgressRing targetId={targetId} />
              <span aria-hidden="true" className="toc-chevron text-[var(--text-tertiary)]">
                ›
              </span>
            </span>
          </summary>
          <div className="mt-1">
            <Toc items={items} variant="inline" />
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
