/**
 * GitHub Alerts（服务端）
 *
 *   > [!NOTE]
 *   > 正文，支持 **Markdown**
 *
 * 识别规则严格照 GitHub：标记行独占一行、位于引用块第一行，五种类型
 * NOTE / TIP / IMPORTANT / WARNING / CAUTION（大小写不敏感）。
 *
 * 为什么不用 `blockquote` 渲染器改写：渲染器拿到的是已经词法化的子 token，
 * 想把 `[!NOTE]` 从首段里摘掉就得改 token 内部的 text / tokens，
 * 既容易破坏嵌套列表与代码块，也无法保证再解析一次不重复。
 * 这里改成块级 tokenizer：先按行情剥掉引用前缀，再把剩下的整段交给
 * `lexer.blockTokens`，因此嵌套列表、代码块、引用都能原样复用主流程。
 *
 * 普通引用块不含标记行，tokenizer 直接返回 undefined，行为完全不变。
 */

import type { MarkedExtension, Token, Tokens } from 'marked'
import { renderNoticeHtml, type NoticeType } from './notice'

/** 首行：[!TYPE] 独占一行 */
const ALERT_HEADER = /^ {0,3}>[ \t]?\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*$/i

/** 引用行：捕获去掉一级 `>` 后的内容 */
const QUOTE_LINE = /^ {0,3}>[ \t]?(.*)$/

const ALERT_TYPES: Record<string, NoticeType> = {
  NOTE: 'note',
  TIP: 'tip',
  IMPORTANT: 'important',
  WARNING: 'warning',
  CAUTION: 'caution',
}

interface AlertToken extends Tokens.Generic {
  type: 'githubAlert'
  notice: NoticeType
  tokens: Token[]
}

interface ScannedAlert {
  notice: NoticeType
  body: string
  raw: string
}

/** 从 `src` 开头扫出一个完整的 alert 引用块；不符合标记时返回 null */
export function scanAlert(src: string): ScannedAlert | null {
  const firstBreak = src.indexOf('\n')
  const firstLine = (firstBreak === -1 ? src : src.slice(0, firstBreak)).replace(/\r$/, '')
  const header = ALERT_HEADER.exec(firstLine)
  if (!header) return null

  const notice = ALERT_TYPES[(header[1] ?? '').toUpperCase()]
  if (!notice) return null

  let offset = firstBreak === -1 ? src.length : firstBreak + 1
  const body: string[] = []

  // 只吃连续的引用行：普通段落（惰性续行）与空行都视为引用结束
  while (offset < src.length) {
    const next = src.indexOf('\n', offset)
    const end = next === -1 ? src.length : next
    const line = src.slice(offset, end).replace(/\r$/, '')
    const quoted = QUOTE_LINE.exec(line)
    if (!quoted) break

    body.push(quoted[1] ?? '')
    if (next === -1) {
      offset = src.length
      break
    }
    offset = end + 1
  }

  return { notice, body: body.join('\n'), raw: src.slice(0, offset) }
}

export function createAlertExtension(): MarkedExtension {
  return {
    extensions: [
      {
        name: 'githubAlert',
        level: 'block',
        childTokens: ['tokens'],
        start(src) {
          const index = src.search(/^ {0,3}>[ \t]?\[!/m)
          return index >= 0 ? index : undefined
        },
        tokenizer(src) {
          const scanned = scanAlert(src)
          if (!scanned) return undefined

          const token: AlertToken = {
            type: 'githubAlert',
            raw: scanned.raw,
            notice: scanned.notice,
            tokens: [],
          }
          if (scanned.body.trim()) token.tokens = this.lexer.blockTokens(scanned.body)
          return token
        },
        renderer(token) {
          const alert = token as AlertToken
          const body = alert.tokens.length ? this.parser.parse(alert.tokens) : ''
          return renderNoticeHtml('alert', alert.notice, '', body)
        },
      },
    ],
  }
}
