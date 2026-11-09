/**
 * 行内标记扩展（服务端）：Spoiler / Ins
 *
 *   ||点我展开||      → <span class="md-spoiler">点我展开</span>
 *   ++新增内容++      → <ins>新增内容</ins>
 *
 * 两条语法都要求：
 *   - 单行内闭合，允许内部行内 Markdown（`**粗**`、`code`、链接、公式）；
 *   - 分隔符本身不能被同类符号包住（`+++x+++`、`|||x|||` 不匹配），
 *     避免把 `a +++ b` 这类普通文本吞掉；
 *   - 内容非空、且首尾都不是空白：`1 ++ 2`、`a || b` 仍然只是文本。
 *
 * Ins 的语义标签是 `<ins>`（HTML 原生「插入」语义），不是自己造的 class；
 * Spoiler 需要交互，服务端只给 class，点击展开由客户端 `spoiler-enhancer` 接管，
 * 没有 JS 时内容正常可见（渐进增强，不做「藏起来却没法打开」的死路）。
 */

import type { MarkedExtension, Token, TokenizerAndRendererExtension, Tokens } from 'marked'

/** `||内容||`：内部允许除竖线外的任意行内内容，单行闭合 */
const SPOILER = /^\|\|(?!\|)([^\n]+?)(?<!\|)\|\|(?!\|)/

/** `++内容++` */
const INSERT = /^\+\+(?!\+)([^\n]+?)(?<!\+)\+\+(?!\+)/

interface InlineMarkToken extends Tokens.Generic {
  type: 'spoiler' | 'insert'
  tokens: Token[]
}

/** 首尾空白与空内容都不算标记，避免误吞普通符号表达式 */
function usable(text: string): boolean {
  return text.trim().length > 0 && text === text.trim()
}

function createInlineMark(
  name: 'spoiler' | 'insert',
  pattern: RegExp,
  render: (inner: string) => string,
): TokenizerAndRendererExtension {
  return {
    name,
    level: 'inline',
    start(src) {
      const index = src.indexOf(name === 'spoiler' ? '||' : '++')
      return index >= 0 ? index : undefined
    },
    tokenizer(src) {
      const match = pattern.exec(src)
      if (!match) return undefined

      const text = match[1] ?? ''
      if (!usable(text)) return undefined

      const token: InlineMarkToken = {
        type: name,
        raw: match[0],
        tokens: this.lexer.inlineTokens(text),
      }
      return token
    },
    renderer(token) {
      const mark = token as InlineMarkToken
      return render(mark.tokens.length ? this.parser.parseInline(mark.tokens) : '')
    },
  }
}

export function createInlineMarkExtensions(): MarkedExtension {
  return {
    extensions: [
      createInlineMark('spoiler', SPOILER, (inner) => `<span class="md-spoiler">${inner}</span>`),
      createInlineMark('insert', INSERT, (inner) => `<ins>${inner}</ins>`),
    ],
  }
}
