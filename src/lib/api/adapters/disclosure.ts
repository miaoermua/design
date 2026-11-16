import type { AiDisclosure } from '../domain/disclosure'
import { KNOWN_AI_GEN_LEVELS } from '../domain/disclosure'

/**
 * `meta` → AI 参与声明
 *
 * 三种线上形态都要接住（core 的 `jsonb @>` 过滤同时兼容前两种）：
 *   1. 标量：`{ aiGen: 2 }`
 *   2. 数组：`{ aiGen: [0, 8] }`
 *   3. 缺失 / 非法：null
 *
 * 自定义选项的值类型不受约束（`MetaFieldOption.value: any`），
 * 因此数字与字符串都要处理：数字落在已知等级内进 `levels`，
 * 其余一律原样转成字符串进 `custom`，宁可展示原文也不丢信息。
 */
export function readAiDisclosure(meta: unknown): AiDisclosure | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null

  const raw = (meta as Record<string, unknown>).aiGen
  const values = Array.isArray(raw) ? raw : raw === undefined || raw === null ? [] : [raw]
  if (values.length === 0) return null

  const levels = new Set<number>()
  const custom: string[] = []
  const seenCustom = new Set<string>()

  for (const value of values) {
    if (typeof value === 'number' && KNOWN_AI_GEN_LEVELS.has(value)) {
      levels.add(value)
      continue
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      // 超出内置预设的数值 = 自定义选项的数值形态
      const text = String(value)
      if (!seenCustom.has(text)) {
        seenCustom.add(text)
        custom.push(text)
      }
      continue
    }

    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) continue
      // 字符串但能解析成已知等级（部分后端会把数字序列化成字符串）
      const asNumber = Number(trimmed)
      if (Number.isFinite(asNumber) && KNOWN_AI_GEN_LEVELS.has(asNumber)) {
        levels.add(asNumber)
        continue
      }
      if (!seenCustom.has(trimmed)) {
        seenCustom.add(trimmed)
        custom.push(trimmed)
      }
    }
  }

  if (levels.size === 0 && custom.length === 0) return null

  return {
    levels: [...levels].sort((a, b) => a - b),
    custom,
  }
}
