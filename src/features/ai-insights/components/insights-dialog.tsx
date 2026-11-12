'use client'

import type { MouseEvent, RefObject } from 'react'
import { Dialog, DialogClose } from '@/components/ui/dialog'
import { Prose } from '@/components/ui/prose'
import { languageLabel } from '@/lib/i18n/config'
import type { InsightsDifficulty } from '@/lib/content/insights'
import type { AiInsightsView } from '../read'

const DIFFICULTY_LABEL: Record<InsightsDifficulty, string> = {
  easy: '轻松',
  medium: '适中',
  hard: '费力',
}

export interface InsightsDialogProps {
  insights: AiInsightsView
  /** 窗内标题的 id，供 `aria-labelledby` 使用 */
  titleId: string
  /** 关窗后焦点回到触发按钮 */
  returnFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  /** 点击精读里的 `§` 引用时调用；目标找不到时调用方会选择不动 */
  onJumpToRef: (targetId: string) => void
}

/**
 * AI 精读窗口
 *
 * 结构：固定标题栏 + 独立滚动的正文 + 固定署名栏。
 * 正文全部是**服务端已渲染并净化**的 HTML（`renderMarkdown` 走 sanitize-html），
 * 这里只负责把它放进 `Prose`——包括 Mermaid、KaTeX 的补水流程。
 * 不在这里重新解析 Markdown，也不把 AI 原文交给文章正文的解析器。
 *
 * `genre` 是 Core 的开放 key（`architecture` / `diary` …），只做分类不做文案，
 * 因此不直接抛给读者；展示的是阅读时长、难度、语种这三件读者真会用到的事。
 */
export function InsightsDialog({
  insights,
  titleId,
  returnFocusRef,
  onClose,
  onJumpToRef,
}: InsightsDialogProps) {
  const { meta, refs, isFallback, isTranslation, lang } = insights

  const facts = [
    meta.readingMinutes ? `约 ${meta.readingMinutes} 分钟` : null,
    meta.difficulty ? DIFFICULTY_LABEL[meta.difficulty] : null,
    isTranslation ? '译本' : isFallback ? `原文 ${languageLabel(lang)}` : null,
  ].filter((item): item is string => Boolean(item))

  const unresolved = refs.total - refs.resolved

  /**
   * 引用是页内锚点：默认行为会在滚动锁定的背景上跳一次、什么也看不到。
   * 因此截下来交给调用方——先关窗、再滚到正文对应章节。
   * 非页内链接（含任何外部地址）不拦截。
   */
  function handleBodyClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof Element)) return

    const anchor = target.closest('a')
    if (!(anchor instanceof HTMLAnchorElement)) return

    const href = anchor.getAttribute('href') ?? ''
    if (!href.startsWith('#') || href.length < 2) return

    event.preventDefault()
    let id = href.slice(1)
    try {
      id = decodeURIComponent(id)
    } catch {
      // 非法转义：保持原样，交给 getElementById 判定
    }
    onJumpToRef(id)
  }

  return (
    <Dialog
      labelledBy={titleId}
      onClose={onClose}
      className="ai-insights"
      returnFocusRef={returnFocusRef}
    >
      <header className="ai-insights__head">
        <div>
          <h2 id={titleId} className="ai-insights__title">
            AI 精读
          </h2>
          {facts.length > 0 ? <p className="ai-insights__facts">{facts.join(' · ')}</p> : null}
        </div>
        <DialogClose label="关闭 AI 精读" onClose={onClose} />
      </header>

      <div className="ai-insights__body" onClick={handleBodyClick}>
        <Prose html={insights.leadHtml} className="prose--compact" />
        {insights.restHtml ? (
          <div className="ai-insights__rest">
            <Prose html={insights.restHtml} className="prose--compact" />
          </div>
        ) : null}
      </div>

      <p className="ai-insights__foot">
        由 Mix Space Core 生成
        {refs.total > 0 ? ` · ${refs.total} 处原文引用` : null}
        {unresolved > 0 ? `（其中 ${unresolved} 处无法在原文定位）` : null}
      </p>
    </Dialog>
  )
}
