'use client'

import { useCallback, useId, useRef, useState } from 'react'
import { languageLabel } from '@/lib/i18n/config'
import { useLocale } from '@/lib/i18n/client'
import { t, tf } from '@/lib/i18n/dictionary'
import type { ArticleSummary as ArticleSummaryModel } from '@/lib/api'
import { MingCuteIcon } from '@/components/ui/mingcute-icon'
import { InsightsDialog } from '@/features/ai-insights'
import type { AiInsightsView } from '@/features/ai-insights'

/**
 * AI 摘要卡
 *
 * 位置：标题 / 作者 / 时间之后，正文之前。它是**导读**，所以不能进正文
 * （会变成作者的话），也不能进 TOC（目录只回答「这篇文章有哪些章节」）。
 *
 * 交互契约：
 *   - 整条标题区域是折叠开关，默认展开；
 *   - 「AI 精读」是与之并列的独立按钮，点它只开窗，不收起摘要；
 *   - 精读窗口的数据**由服务端随页面一起送来**，客户端不发请求：
 *     重复打开不会重复请求，也不会有一份会过期的客户端缓存。
 *     `key={文章 id}` 由页面负责，切换文章即整块重挂载，不会残留上一篇的内容。
 *
 * 为什么这里跨 feature 引用 ai-insights：摘要是精读的入口，卡片是两者的组合点。
 * 依赖是单向的（ai-insights 不知道 ai-summary 存在），不会成环。
 */
export interface AISummaryCardProps {
  summary: ArticleSummaryModel
  /** 精读不可用（未启用 / 没有数据 / 渲染失败）时为 null，入口整个不渲染 */
  insights: AiInsightsView | null
}

export function AISummaryCard({ summary, insights }: AISummaryCardProps) {
  const locale = useLocale()
  const [open, setOpen] = useState(true)
  const [reading, setReading] = useState(false)
  const readButtonRef = useRef<HTMLButtonElement>(null)
  const bodyId = useId()
  const titleId = useId()

  const languageNote = summary.isFallback
    ? tf(locale, 'summary.original', { lang: languageLabel(summary.lang) })
    : null

  /**
   * 关闭窗口后把读者送到引用对应的章节。
   * 目标不存在时**什么也不做**（连窗口都不关）——制造一次失败的跳转比不跳更糟。
   */
  const jumpToRef = useCallback((targetId: string) => {
    const target = document.getElementById(targetId)
    if (!target) return

    setReading(false)
    window.requestAnimationFrame(() => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
    })
  }, [])

  const closeReading = useCallback(() => setReading(false), [])

  return (
    <section aria-label={t(locale, 'summary.label')} className="ai-summary" data-open={open}>
      <div className="ai-summary__bar">
        <button
          type="button"
          className="ai-summary__toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((value) => !value)}
        >
          <AiMark />
          <span className="ai-summary__label">{t(locale, 'summary.label')}</span>
          {languageNote ? <span className="ai-summary__note">{languageNote}</span> : null}
          <Chevron />
        </button>

        {insights ? (
          <button
            ref={readButtonRef}
            type="button"
            className="ai-summary__read"
            aria-haspopup="dialog"
            onClick={() => setReading(true)}
          >
            {t(locale, 'summary.openInsights')}
            <ArrowUpRight />
          </button>
        ) : null}
      </div>

      <div id={bodyId} className="ai-summary__body" inert={!open}>
        <div className="ai-summary__body-inner">
          <div className="ai-summary__content">
            <p className="ai-summary__text">{summary.text}</p>
          </div>
        </div>
      </div>

      {reading && insights ? (
        <InsightsDialog
          insights={insights}
          titleId={titleId}
          returnFocusRef={readButtonRef}
          onClose={closeReading}
          onJumpToRef={jumpToRef}
        />
      ) : null}
    </section>
  )
}

function AiMark() {
  return <MingCuteIcon name="mingcute:sparkles-2-line" className="ai-summary__icon" />
}

function Chevron() {
  // 方向由 `.ai-summary[data-open]` 控制，避免状态既在 JSX 又在 CSS 里各写一份
  return <MingCuteIcon name="mingcute:up-line" className="ai-summary__chevron" />
}

function ArrowUpRight() {
  return <MingCuteIcon name="mingcute:arrow-right-up-line" />
}
