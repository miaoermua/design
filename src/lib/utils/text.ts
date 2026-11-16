/** 文本工具：从 Markdown 提取纯文本，用于摘要与阅读时长估算 */

/**
 * 去掉常见 Markdown 标记，保留可读文字。
 *
 * 顺序有讲究，不要随手重排：
 *   1. 先整块删掉代码与容器围栏 —— 它们内部的行首符号不是标记；
 *   2. 再删图片（引用式与行内式），只留下真正的文字；
 *   3. 最后处理链接、原始 HTML 与零散符号。
 *
 * 摘要要「读起来像一段话」，因此这里的目标不是保留格式，而是**不留残渣**：
 * `::: gallery`、`![图][ref]`、`[^1]` 这些如果漏掉，会原样出现在摘要里。
 */
export function toPlainText(markdown: string): string {
  return (
    markdown
      // 代码块：围栏内外都不属于正文摘要
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/~~~[\s\S]*?~~~/g, ' ')
      // 容器围栏（`::: gallery` / `::: info` / `:::` 收尾）：整行删除，不留下 `:::`
      .replace(/^[ \t]{0,3}:{3,}[^\n]*$/gm, ' ')
      // 引用式图片定义行（`[ref]: https://…`）：整行删除
      .replace(/^[ \t]{0,3}\[[^\]]+\]:[ \t]*\S+[^\n]*$/gm, ' ')
      // 引用式图片 → 空；引用式链接 → 只留文字
      .replace(/!\[[^\]]*\]\[[^\]]*\]/g, ' ')
      .replace(/\[([^\]]*)\]\[[^\]]*\]/g, '$1')
      // 脚注引用（`[^1]`）：它不是可读文字，直接删除而不是换成空格，
      // 否则中文里会留下「结论在这里 。」这种标点前的空隙
      .replace(/\[\^[^\]]*\]/g, '')
      // 行内图片 → 空；行内链接 → 只留文字
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // 原始 HTML（含 `<img>`、`<br>`）与自动链接
      .replace(/<[^>]+>/g, ' ')
      // 行首标题 / 引用 / 列表标记
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s{0,3}>\s?/gm, '')
      .replace(/^\s{0,3}(?:[-*+]|\d+\.)\s+/gm, '')
      // 行内强调、行内代码残留
      .replace(/[*_~`]/g, '')
      // 表格竖线
      .replace(/\|/g, ' ')
      // 收尾：合并空白；中文标点前的空格一律去掉（删图 / 删标签会留下空隙），
      // 再清掉开头悬空的标点
      .replace(/\s+/g, ' ')
      .replace(/\s+([、，。；：！？）」』】…])/g, '$1')
      .replace(/^[\s、，。；：,.;:!?！？]+/, '')
      .trim()
  )
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
