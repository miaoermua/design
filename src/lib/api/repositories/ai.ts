import { DEFAULT_LOCALE } from '../../i18n/config'
import { requestV2 } from '../client/http'
import type { V2AiInsights, V2AiSummary } from '../contracts/v2/ai'
import type { ArticleInsights, ArticleSummary } from '../domain/ai'

/**
 * AI 资源读取（只读，绝不让后端生成）
 *
 * 三条硬规则，来自 PHASE-5C-C-AI-INTEGRATION 审计：
 *
 *   1. **必须带 `onlyDb=true`**。不带它，core 在库中没有内容时会调用 LLM 并写库；
 *      阅读页每次渲染都可能变成一次生成任务。这里把它写死在查询参数里，
 *      调用方无法「顺手」去掉。
 *   2. **失败一律返回 null**。页面对 `page`、速记、不存在的 ID 调这个接口会被
 *      400/1002 拒绝，AI 资源缺失不是错误，只是「没有这块内容」。
 *   3. **语言不回退到其它语种**。core 的查询是 `(refId, lang)` 精确匹配，
 *      英文摘要没生成时不会拿中文顶上。Folio 先请求当前语种，未命中再显式退到
 *      默认语种，并标记 `isFallback`，让展示层自己决定怎么说明。
 */

/** AI 资源跟随正文缓存：300 秒内重复访问不再打后端 */
const AI_REVALIDATE = 300

async function fetchSummary(id: string, lang?: string): Promise<ArticleSummary | null> {
  try {
    const body = await requestV2<V2AiSummary | null>(`/ai/summaries/article/${id}`, {
      query: { lang, onlyDb: true },
      revalidate: AI_REVALIDATE,
    })

    // 没有摘要时 core 返回 200 + null，而不是 404
    if (!body || typeof body.summary !== 'string') return null
    const text = body.summary.trim()
    if (!text) return null
    return { text, lang: body.lang ?? lang ?? DEFAULT_LOCALE, isFallback: false }
  } catch {
    return null
  }
}

/**
 * `GET /ai/summaries/article/:id`
 *
 * 只对 Post / Note 有意义；Page 会 400，返回 null。
 */
export async function getArticleSummary(id: string, lang?: string): Promise<ArticleSummary | null> {
  const primary = await fetchSummary(id, lang)
  if (primary) return primary
  if (!lang || lang === DEFAULT_LOCALE) return null

  const fallback = await fetchSummary(id, DEFAULT_LOCALE)
  return fallback ? { ...fallback, isFallback: true } : null
}

async function fetchInsights(id: string, lang?: string): Promise<ArticleInsights | null> {
  try {
    const body = await requestV2<V2AiInsights | null>(`/ai/insights/article/${id}`, {
      query: { lang, onlyDb: true },
      revalidate: AI_REVALIDATE,
    })

    if (!body || typeof body.content !== 'string') return null
    if (!body.content.trim()) return null
    return {
      content: body.content,
      lang: body.lang ?? lang ?? DEFAULT_LOCALE,
      isFallback: false,
      isTranslation: Boolean(body.is_translation),
    }
  } catch {
    return null
  }
}

/**
 * `GET /ai/insights/article/:id`
 *
 * 返回的是 Core 的原始 Markdown，解析（meta 注释、`<ref/>`、锚点）在
 * `lib/content/insights` 里做，数据层不掺展示逻辑。
 */
export async function getArticleInsights(
  id: string,
  lang?: string,
): Promise<ArticleInsights | null> {
  const primary = await fetchInsights(id, lang)
  if (primary) return primary
  if (!lang || lang === DEFAULT_LOCALE) return null

  const fallback = await fetchInsights(id, DEFAULT_LOCALE)
  return fallback ? { ...fallback, isFallback: true } : null
}
