import { isFeatureEnabled } from '@/core/registry/features'
import { getArticleSummary, type ArticleSummary as ArticleSummaryModel } from '@/lib/api'

/**
 * 读取文章级 AI 摘要
 *
 * 开关关掉时**不发请求**：模块关闭的语义是「连取数都不发生」，
 * 而不是取回来再 `return null`。
 */
export async function readArticleSummary(
  id: string,
  lang?: string,
): Promise<ArticleSummaryModel | null> {
  if (!isFeatureEnabled('aiSummary')) return null
  return getArticleSummary(id, lang)
}
