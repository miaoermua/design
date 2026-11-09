/** 文本工具：从 Markdown 提取纯文本，用于摘要与阅读时长估算 */

/** 去掉常见 Markdown 标记，保留可读文字 */
export function toPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/[*_~`]/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 截断到指定字数（按字符，不切断英文单词不做处理——中文场景足够） */
export function excerpt(text: string, length: number): string {
  const plain = toPlainText(text)
  if (plain.length <= length) return plain
  return `${plain.slice(0, length).trimEnd()}…`
}

/**
 * 阅读时长估算：中文按 380 字/分钟，代码与英文按 200 词/分钟折中。
 * 这是本地估算值，UI 必须以「约」标注，且不写入任何统计数据。
 */
export function readingMinutes(markdown: string): number {
  const plain = toPlainText(markdown)
  if (plain.length === 0) return 1
  return Math.max(1, Math.round(plain.length / 380))
}
