import Link from 'next/link'
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

/**
 * 阅读辅助区（Blog 与 Note 共用）
 *
 * 桌面：右栏常驻 —— 目录 → 环形进度 → 回到顶部，整块随页面滚动吸顶。
 * 移动：目录折叠在正文里，进度与回到顶部跟在目录下面一行。
 *
 * 两处共用同一套组件，只有容器不同：目录折叠逻辑（`<details>`）放在这里，
 * 页面不必各写一遍。
 */
export function ReadingAside({ items, targetId, backToTopLabel }: ReadingToolsProps) {
  return (
    <aside className="hidden xl:block">
      <div className="sticky top-28">
        {items.length >= 2 ? <Toc items={items} variant="rail" /> : null}
        <div className="mt-6 flex flex-col gap-4 border-t border-dashed border-[var(--edge)] pt-4">
          <ReadingProgressRing targetId={targetId} />
          <BackToTop label={backToTopLabel} />
        </div>
      </div>
    </aside>
  )
}

export function ReadingInline({ items, targetId, backToTopLabel }: ReadingToolsProps) {
  return (
    <div className="mt-10 xl:hidden">
      {items.length >= 2 ? (
        <details className="border-t border-dashed border-[var(--edge)] pt-4">
          <summary className="toc-summary meta flex cursor-pointer items-center justify-between select-none">
            目录
            <span aria-hidden="true" className="toc-chevron text-[var(--text-tertiary)]">
              ›
            </span>
          </summary>
          <div className="mt-1">
            <Toc items={items} variant="inline" />
          </div>
        </details>
      ) : null}

      <div className="mt-4 flex items-center justify-between gap-3">
        <ReadingProgressRing targetId={targetId} />
        <BackToTop label={backToTopLabel} />
      </div>
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
