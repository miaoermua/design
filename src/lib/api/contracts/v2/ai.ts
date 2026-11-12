/**
 * Mix Space API v2 — AI 摘要 / AI 精读契约
 *
 * 来源：`git show v12.10.0:apps/core/src/modules/ai/...` + api.miaoer.net 实测
 * （见 docs/audits/PHASE-5C-C-AI-INTEGRATION.md）
 *
 * 两个端点都是公开的，都只接受 **内容 ID**（slug 会被 EntityIdDto 判 422），
 * 且都支持 `onlyDb=true`：带它才「不触发生成」。缺少该参数时 core 会调 LLM 并写库。
 *
 *   GET /ai/summaries/article/:id?lang=&onlyDb=true
 *     → 裸对象（不包 data）；没有摘要时 body 为 null
 *   GET /ai/insights/article/:id?lang=&onlyDb=true
 *     → 裸对象；没有精读时 body 为 null
 *
 * 仅 `post` / `note` 可用；`page` 与速记会被 core 以 1002（ContentNotFoundCantProcess）拒绝。
 */

import type { EntityId, IsoDateString } from './common'

/** `GET /ai/summaries/article/:id` 的响应 */
export interface V2AiSummary {
  id: EntityId
  /** 生成时的正文内容 md5；正文改动后 core 不再返回这条摘要 */
  hash: string
  summary: string
  ref_id: EntityId
  lang: string | null
  created_at?: IsoDateString
}

/**
 * `GET /ai/insights/article/:id` 的响应
 *
 * `content` 是字符串，但**不是**随意文本：Markdown 正文 + 内联 `<ref quote section/>`
 * + Mermaid 围栏 + 末行 `<!-- insights-meta: {...} -->`。
 */
export interface V2AiInsights {
  id: EntityId
  ref_id: EntityId
  lang: string
  /** 与 `V2AiSummary.hash` 同源，用于判定精读是否对应当前正文 */
  hash: string
  content: string
  is_translation?: boolean
  source_insights_id?: EntityId | null
  source_lang?: string | null
  /** `{ provider, model }`；不同部署可能为 null，前端只做展示用提示，不解析结构 */
  model_info?: Record<string, unknown> | null
  created_at?: IsoDateString
}
