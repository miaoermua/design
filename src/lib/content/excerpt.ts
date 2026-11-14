/**
 * 文章列表正文概览：Markdown / HTML → 单行纯文本
 *
 * 数据来源是 `GET /posts?truncate=310` 返回的 `text`。后端按**字符**硬截断，
 * 返回的仍是原始 Markdown / HTML 混排文本（实测含 `<p align="center">`、
 * `<img>`、`<!-- 注释 -->`、围栏代码块），而且可能停在半个标签或半个链接上。
 *
 * 这里只做「降级成纯文本」，不做任何按字符的二次截断：
 *   - 复用项目已有的 `marked`（阅读页渲染管线同一依赖）做词法解析：
 *     代码块、HTML 注释、图片、表格按 token 整块丢弃，而不是靠正则猜；
 *   - 复用 `stripHtml` 提取 HTML 块里的可见文字并解码实体；
 *   - 截断残片（未闭合的 `[]()` / `<...` / 反引号）在末尾单独修补；
 *   - 最终显示长度完全交给 CSS `line-clamp-1`。
 *
 * 不引入 `remove-markdown`：marked 已在依赖里，且能区分 token 类型，
 * 对中文正文和被截断的残片更可控，也不增加打包体积。
 *
 * 这不是 AI 摘要，也不是官方 `summary` 的替身：两者在 UI 上各占一行。
 */

import { Marked } from 'marked'
import { stripHtml } from './slug'

const parser = new Marked({ gfm: true })

interface ExcerptToken {
  type?: string
  text?: string
  raw?: string
  tokens?: ExcerptToken[]
  items?: ExcerptToken[]
}

/** HTML 块：先整块删掉注释（含被 truncate 切掉 `-->` 的），只留可见文字 */
function htmlToText(value: string): string {
  return stripHtml(value.replace(/<!--[\s\S]*?(?:-->|$)/g, ' '))
}

/**
 * 修补硬截断留下的半截语法。
 * 只反复清理末尾，避免误伤正文里的正常标点（例如 `#标签`、连字符、下划线）。
 */
function trimBrokenTail(value: string): string {
  let out = value.trim()
  for (let i = 0; i < 3; i += 1) {
    const next = out
      .replace(/!\[[^\]]*\]\([^)]*$/, '')
      .replace(/\[([^\]]*)\]\([^)]*$/, '$1')
      .replace(/\[[^\]]*$/, '')
      .replace(/<[^>]*$/, '')
      .replace(/`{1,3}[^`]*$/, '')
      .replace(/\s+#{1,6}$/, '')
      .replace(/[ \t]+$/, '')
      .trim()
    if (next === out) break
    out = next
  }
  return out
}

function collect(token: ExcerptToken): string {
  switch (token.type) {
    // 不适合压进一行概览的块级内容，整块丢弃
    case 'space':
    case 'hr':
    case 'code':
    case 'image':
    case 'table':
      return ''
    case 'html':
      return htmlToText(token.raw ?? token.text ?? '')
    case 'br':
      return ' '
    default:
      break
  }
  // list / blockquote / heading / paragraph 都由内联 token 提供文字，
  // 链接只取锚文本、强调只取内容，标记本身不会进入结果
  if (token.items?.length) return token.items.map(collect).join(' ')
  if (token.tokens?.length) return token.tokens.map(collect).join('')
  return token.text ?? ''
}

/** 清理后没有有效文本时返回空串，调用方据此不渲染空概览 */
export function buildArticleExcerpt(text: string | null | undefined): string {
  if (!text || !text.trim()) return ''

  let tokens: ExcerptToken[]
  try {
    tokens = parser.lexer(text) as unknown as ExcerptToken[]
  } catch {
    // 正文概览是附加信息，畸形文本不应该让整个列表页失败
    return ''
  }

  const plain = tokens
    .map(collect)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()

  return stripHtml(
    trimBrokenTail(plain)
      // 容器块标记（::: info / ::: details）与残留强调标记
      .replace(/:::[ \t]*[a-z-]*[ \t]*/gi, ' ')
      .replace(/\*\*|~~/g, ''),
  )
    .replace(/\s+/g, ' ')
    .trim()
}
