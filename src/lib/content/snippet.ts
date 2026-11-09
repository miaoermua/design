/**
 * 搜索结果片段清洗
 *
 * 实测 `/search` 的 `highlight.snippet` 是**原始 Markdown 文本**（含 `##`、`[文字](url)`），
 * 并不保证已转义。因此这里做三件事：
 *   1. 把 Markdown 语法降级成纯文本（保留文字，丢掉标记）；
 *   2. 只保留 `<mark>` 标签，其余标签一律删除；
 *   3. `<mark>` 规范化为无属性标签，杜绝事件属性注入。
 *
 * 这样既保住了后端高亮，也不需要引入 sanitizer 依赖。
 */
export function sanitizeSnippet(snippet: string): string {
  let text = snippet

  // 图片 ![alt](src) → alt；链接 [text](url) → text
  text = text.replace(/!\[([^\]]*)\]\((?:[^()\s]|\([^)]*\))*\)/g, '$1')
  text = text.replace(/\[([^\]]*)\]\((?:[^()\s]|\([^)]*\))*\)/g, '$1')

  // 标题 / 引用 / 列表标记。片段是截断出来的，`## foo` 常常不在行首，
  // 所以按「空白后跟 #」判定，而不是只看行首（实测 `格式 ## squashfs`）。
  text = text.replace(/(^|[\s])#{1,6}\s+/g, '$1')
  text = text.replace(/(^|\n)\s{0,3}>\s?/g, '$1')
  text = text.replace(/(^|\n)\s{0,3}(?:[-*+]|\d+\.)\s+/g, '$1')

  // 容器块标记：::: tip / ::: details 标题
  text = text.replace(/:::[ \t]*[a-z-]*[ \t]*/gi, ' ')

  // 强调 / 删除线 / 行内代码标记
  text = text.replace(/\*\*|__|~~|`/g, '')

  return (
    text
      .replace(/<(?!\/?mark\b)[^>]*>/gi, '')
      .replace(/<mark[^>]*>/gi, '<mark>')
      .replace(/<\/mark[^>]*>/gi, '</mark>')
      // 片段是单行文本：换行折叠成空格，连续空白也压掉
      .replace(/\s*\n\s*/g, ' ')
      .replace(/[ \t]{2,}/g, ' ')
      .trim()
  )
}
