import { isFeatureEnabled } from '@/core/registry/features'
import { getArticleInsights } from '@/lib/api'
import {
  parseInsightsDocument,
  resolveInsightRefs,
  splitInsightSections,
  type InsightsMeta,
} from '@/lib/content/insights'
import { renderMarkdown, type TocItem } from '@/lib/content/markdown'

export interface AiInsightsView {
  /** 首段（通常是 TL;DR）；默认可见 */
  leadHtml: string
  /** 其余章节；折叠在「展开完整精读」里 */
  restHtml: string | null
  meta: InsightsMeta
  /** `total` = 文档里 ref 数量，`resolved` = 成功对应到原文章节的数量 */
  refs: { total: number; resolved: number }
  /** 实际命中的语种 */
  lang: string
  isFallback: boolean
  isTranslation: boolean
}

/**
 * 精读渲染时给标题 id 加前缀
 *
 * 精读与正文在同一个页面里，两边都可能有「## 背景」这种标题。
 * `renderMarkdown` 每次调用都会新建 slugger，两份 HTML 拼在一页就会出现重复 id，
 * 锚点跳转随之变得不确定。加前缀是最小代价的隔离方式。
 */
function prefixHeadingIds(html: string, prefix: string): string {
  return html.replace(/(<h[1-6][^>]*\sid=")([^"]+)(")/g, `$1${prefix}$2$3`)
}

/**
 * 读取并渲染文章级 AI 精读
 *
 * 全部在服务端完成：数据读取、结构解析、锚点定位、Markdown 渲染。
 * 任何一环失败都返回 null —— 精读是附加内容，不能影响正文。
 *
 * @param id     文章 / 笔记 ID
 * @param source 原文 Markdown，用于把 `<ref quote>` 落到真实章节
 * @param toc    原文目录，顺序与 `##` / `###` 标题一致，提供章节 id
 */
export async function readArticleInsights(input: {
  id: string
  lang?: string
  source: string
  toc: TocItem[]
}): Promise<AiInsightsView | null> {
  if (!isFeatureEnabled('aiInsights')) return null

  const raw = await getArticleInsights(input.id, input.lang)
  if (!raw) return null

  const { body, meta } = parseInsightsDocument(raw.content)
  if (!body.trim()) return null

  const { markdown, total, resolved } = resolveInsightRefs(body, input.source, input.toc)
  const sections = splitInsightSections(markdown)
  const [lead, ...rest] = sections
  if (!lead) return null

  const leadRendered = await renderMarkdown(lead.markdown)
  const restMarkdown = rest.map((section) => section.markdown).join('\n')
  const restRendered = restMarkdown.trim() ? await renderMarkdown(restMarkdown) : null

  return {
    leadHtml: prefixHeadingIds(leadRendered.html, 'insight-lead-'),
    restHtml: restRendered ? prefixHeadingIds(restRendered.html, 'insight-rest-') : null,
    meta,
    refs: { total, resolved },
    lang: raw.lang,
    isFallback: raw.isFallback,
    isTranslation: raw.isTranslation,
  }
}
