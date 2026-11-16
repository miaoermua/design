import type { AiDisclosure as AiDisclosureData } from '@/lib/api/domain/disclosure'
import { isEmptyDisclosure } from '@/lib/api/domain/disclosure'
import type { Locale } from '@/lib/i18n/config'
import { t, type MessageKey } from '@/lib/i18n/dictionary'

/**
 * 等级数值 → 字典键
 *
 * 数值语义以 core 的 `meta-preset.service.ts` 内置预设为准，
 * 不在前端另立一套编号。
 */
const LEVEL_LABEL: Record<number, MessageKey> = {
  [-1]: 'article.aiGen.handcrafted',
  0: 'article.aiGen.writing',
  1: 'article.aiGen.polishing',
  2: 'article.aiGen.fullyGenerated',
  3: 'article.aiGen.structure',
  4: 'article.aiGen.titleGen',
  5: 'article.aiGen.proofreading',
  6: 'article.aiGen.inspiration',
  7: 'article.aiGen.rewriting',
  8: 'article.aiGen.imagery',
  9: 'article.aiGen.dictation',
}

/**
 * 把声明解析成可直接展示的文案。
 *
 * `-1`（纯人工）与 `2`（完全由 AI 生成）在 core 里都标了 `exclusive`：
 * 出现 `-1` 时忽略其它等级，避免同一句声明里既说「没有用 AI」又列出
 * 「AI 生成图像」这种自相矛盾的组合。
 */
function resolveLabels(disclosure: AiDisclosureData, locale: Locale): string[] {
  if (disclosure.levels.includes(-1)) {
    return [t(locale, 'article.aiGen.handcrafted')]
  }

  const labels = disclosure.levels
    .map((level) => LEVEL_LABEL[level])
    .filter((key): key is MessageKey => Boolean(key))
    .map((key) => t(locale, key))

  // 自定义选项（`allowCustomOption`）原样输出，不做翻译
  return [...labels, ...disclosure.custom]
}

interface AiDisclosureProps {
  disclosure: AiDisclosureData | null
  locale: Locale
}

/**
 * AI 参与声明
 *
 * 定位：作者对自己创作过程的**主动披露**，不是平台给出的判定。
 * 因此措辞克制、位置安静（正文结束处、文章信息之上），
 * 用最小的字号与一条左缘细线表示「这是一段附注」。
 *
 * 未声明（null / 空）时整块不渲染：没有声明不等于「没有用 AI」，
 * 不能替作者补一句「纯人工」。
 */
export function AiDisclosure({ disclosure, locale }: AiDisclosureProps) {
  if (isEmptyDisclosure(disclosure)) return null

  const labels = resolveLabels(disclosure as AiDisclosureData, locale)
  if (labels.length === 0) return null

  return (
    <section className="ai-gen" aria-label={t(locale, 'article.aiGen.label')}>
      <p className="ai-gen__head">
        <span aria-hidden="true" className="ai-gen__mark">
          AI
        </span>
        <span className="ai-gen__label">{t(locale, 'article.aiGen.label')}</span>
      </p>
      <ul className="ai-gen__list">
        {labels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
    </section>
  )
}
