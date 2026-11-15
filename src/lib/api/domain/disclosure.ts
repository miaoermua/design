/**
 * AI 参与声明（Core 的 `meta.aiGen` 预设字段）
 *
 * 后端语义（core `meta-preset.service.ts` 的内置预设）：
 *   - 字段类型是**复选框组**，所以值可能是标量（早期单选写法）或数组；
 *   - `allowCustomOption: true`，因此可能混入自定义字符串。
 *
 * 已知等级的数值语义（core 内置预设，不可在前端改写）：
 *    -1 纯人工 / 0 写作辅助 / 1 润色 / 2 完全由 AI 生成 / 3 结构梳理
 *     4 标题生成 / 5 校对 / 6 灵感来源 / 7 改写 / 8 AI 生成图像 / 9 口述转写
 *
 * 这里只保留「数值 / 自定义字符串」，不在这里做翻译：文案属于界面层，
 * 放进 i18n 字典才能跟随语言切换。
 */
export interface AiDisclosure {
  /** 已知等级数值（升序去重，范围 -1..9） */
  levels: number[]
  /** 已知等级之外的自定义项，原样保留用于展示 */
  custom: string[]
}

/** 数值 → 已知等级集合：只收录 core 内置预设的取值 */
export const KNOWN_AI_GEN_LEVELS = new Set([-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9])

/** 是否为空声明（没有可用信息时不渲染整块） */
export function isEmptyDisclosure(disclosure: AiDisclosure | null): boolean {
  return !disclosure || (disclosure.levels.length === 0 && disclosure.custom.length === 0)
}
