/**
 * 标题锚点 ID
 *
 * 规则：
 *   - 保留中英文与数字（中文标题直接作为 id，可读性优先）
 *   - 空白 → '-'
 *   - 去掉标点/符号
 *   - 重复标题追加 -1/-2
 */
export function createSlugger() {
  const seen = new Map<string, number>()

  return function slugify(input: string): string {
    const base = input
      .trim()
      .toLowerCase()
      .replace(/[\s\u3000]+/g, '-')
      .replace(/[!-/:-@[-`{-~\u2000-\u206f\u3001-\u303f\uff01-\uff5e]/g, '')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '')

    const key = base.length > 0 ? base : 'section'
    const count = seen.get(key) ?? 0
    seen.set(key, count + 1)
    return count === 0 ? key : `${key}-${count}`
  }
}

/** 去掉 HTML 标签，用于从渲染后的标题取纯文本 */
export function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}
