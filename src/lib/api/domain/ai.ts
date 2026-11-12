/**
 * AI 资源的领域模型
 *
 * 只描述「Folio 需要什么」，不照搬 Core 的列。适配器负责剥掉
 * `hash` / `model_info` 这类前端用不到、也不该依赖的字段。
 */

/** 文章级 AI 摘要：一段纯文本 + 它实际是哪种语言 */
export interface ArticleSummary {
  text: string
  /** 实际命中的语种（可能不等于请求语种，见 `isFallback`） */
  lang: string
  /**
   * 请求语种没有摘要、退到默认语种时为 true。
   * 展示层必须如实标注语言，不能假装它就是当前语种。
   */
  isFallback: boolean
}

/** 文章级 AI 精读：仍是 Markdown 原文，由内容层负责解析与锚点定位 */
export interface ArticleInsights {
  /** Core 返回的 `content` 原文（含 `<ref/>` 与 meta 注释） */
  content: string
  lang: string
  isFallback: boolean
  /** Core 标注的译文（`is_translation`），展示层据此说明来源 */
  isTranslation: boolean
}
