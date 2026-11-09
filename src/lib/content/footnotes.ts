/**
 * 脚注（服务端）：解析 + 编号 + 列表产出
 *
 * 语法（标准 Markdown 脚注）：
 *
 *   正文里的第一处引用[^1]，再次引用[^1]，也可以是文本标识符[^note]。
 *
 *   [^1]: 脚注内容，支持 **行内 Markdown** 与 `code`。
 *         缩进四格的续行属于同一条脚注定义。
 *
 *     第二段（空行 + 四格缩进）同样属于这条定义。
 *
 *   [^note]: 另一条。
 *
 * 编号规则：
 *   - 编号由渲染器按「正文首次引用顺序」生成，与作者的标识符无关；
 *   - 标识符与编号的映射只存在于本次渲染的 `FootnoteState` 里；
 *   - 同一个标识符被引用多次时只占一个编号，每次引用各自有一个返回锚点
 *     （`fnref-1`、`fnref-1-2`…），返回链接因此可以逐处对应。
 *
 * 安全边界：
 *   - HTML id 形如 `fn-<本次渲染令牌>-1`，编号由渲染器按首次引用顺序生成，
 *     作者标识符只留在 `FootnotesState` 里，从不进入 HTML，不存在编码后撞车；
 *   - 令牌是每次渲染随机生成的短串：作者无法在 Markdown / 原始 HTML 里「预知」它，
 *     因此手写 `id="fn-1"` 这类伪造锚点必然对不上，清洗时按普通作者 id 丢弃；
 *   - id 仍然走 `claimId`（与标题锚点共用一张已占用表），撞名时追加 -2/-3；
 *   - 产出的 id 全部登记进 `trustedIds`，清洗只在 `sup` / `li` 上接受这些值。
 *
 * 状态生命周期：`createFootnoteState()` 在每次 `renderMarkdown()` 时新建，
 * 作为闭包交给扩展与列表渲染，渲染结束即随局部变量回收；模块级没有任何可变 Map。
 */

import type { MarkedExtension, Parser, Token, Tokens } from 'marked'
import { escapeAttribute, escapeText } from './escape'

/** 定义起手行：`[^label]: 内容` */
const DEFINITION_HEAD = /^ {0,3}\[\^([^\]\n]+)\]:[ \t]*(.*)$/

/** 正文引用：`[^label]`，标签不允许空、不允许换行、不允许 `]` */
const REFERENCE = /^\[\^([^\]\n]+)\]/

/** 缩进四格（或一个制表符）= 定义续行 */
const CONTINUATION = /^(?: {4}|\t)(.*)$/

export interface FootnoteState {
  /** 本次渲染的随机令牌：让脚注 id 无法被作者手写的 HTML 猜到 */
  token: string
  /** 标识符 → 定义内容（块级 token）；重复定义只保留第一次 */
  definitions: Map<string, Token[]>
  /** 按正文首次引用顺序排列的标识符 */
  order: string[]
  /** 标识符 → 显示编号 */
  numbers: Map<string, number>
  /** 标识符 → 脚注项 id（`fn-1`） */
  itemIds: Map<string, string>
  /** 标识符 → 各个引用位置的 id（`fnref-1`、`fnref-1-2`…） */
  refIds: Map<string, string[]>
  /** 标识符 → 已被引用次数 */
  refCounts: Map<string, number>
  /** 本次渲染真实产出的脚注 id，清洗列表时作为信任凭据 */
  trustedIds: Set<string>
  /** 首次渲染引用时捕获的 parser，用于渲染定义里的块级内容 */
  parser?: Parser
}

/** 分配 id：与标题锚点共用同一张占用表，冲突时追加 -2/-3 */
export type ClaimId = (base: string) => string

/** 6 位 36 进制令牌：足够随机，又不会把 id 拉得太长 */
function randomToken(): string {
  const bytes = new Uint8Array(4)
  crypto.getRandomValues(bytes)
  let value = 0
  for (const byte of bytes) value = (value * 256 + byte) % 36 ** 6
  return value.toString(36).padStart(6, '0')
}

export function createFootnoteState(): FootnoteState {
  return {
    token: randomToken(),
    definitions: new Map(),
    order: [],
    numbers: new Map(),
    itemIds: new Map(),
    refIds: new Map(),
    refCounts: new Map(),
    trustedIds: new Set(),
  }
}

interface DefinitionScan {
  label: string
  content: string
  raw: string
}

/**
 * 从 `src` 开头扫出一条脚注定义。
 *
 * 返回 null 表示「不是定义」，调用方不消费任何字符（正文原样继续解析）。
 * 只有起手行命中才进来，因此这里不会误吞普通段落。
 */
export function scanFootnoteDefinition(src: string): DefinitionScan | null {
  const firstBreak = src.indexOf('\n')
  const firstLine = (firstBreak === -1 ? src : src.slice(0, firstBreak)).replace(/\r$/, '')
  const head = DEFINITION_HEAD.exec(firstLine)
  if (!head) return null

  const label = (head[1] ?? '').trim()
  if (!label) return null

  const lines: string[] = [head[2] ?? '']
  // 起点：第一行之后（含换行）
  let offset = firstBreak === -1 ? src.length : firstBreak + 1
  let rawEnd = offset
  /** 已跳过、但还没确认归属的空行 */
  let pendingBlanks = 0

  while (offset < src.length) {
    const next = src.indexOf('\n', offset)
    const end = next === -1 ? src.length : next
    const line = src.slice(offset, end).replace(/\r$/, '')
    const nextOffset = next === -1 ? src.length : end + 1

    if (!line.trim()) {
      pendingBlanks += 1
      offset = nextOffset
      continue
    }

    const continued = CONTINUATION.exec(line)
    if (!continued) break

    // 空行要跟着续行一起算进 raw：否则会把定义截断成两半
    for (let index = 0; index < pendingBlanks; index += 1) lines.push('')
    pendingBlanks = 0
    lines.push(continued[1] ?? '')
    rawEnd = nextOffset
    offset = nextOffset
  }

  return {
    label,
    content: lines.join('\n').replace(/\s+$/, ''),
    raw: src.slice(0, rawEnd),
  }
}

interface DefinitionToken extends Tokens.Generic {
  type: 'footnoteDefinition'
  label: string
  tokens: Token[]
}

interface ReferenceToken extends Tokens.Generic {
  type: 'footnoteRef'
  label: string
}

/**
 * marked 扩展：块级定义 + 行内引用。
 *
 * 定义在词法阶段就被收进本次渲染的状态（`state.definitions`），因此引用出现在
 * 定义之前也能正确编号；定义本身不产出任何正文内容（渲染成空串）。
 */
export function createFootnoteExtension(state: FootnoteState, claimId: ClaimId): MarkedExtension {
  return {
    extensions: [
      {
        name: 'footnoteDefinition',
        level: 'block',
        // 定义里的代码块也要走高亮流程
        childTokens: ['tokens'],
        start(src) {
          const index = src.search(/^ {0,3}\[\^/m)
          return index >= 0 ? index : undefined
        },
        tokenizer(src) {
          const scanned = scanFootnoteDefinition(src)
          if (!scanned) return undefined

          const tokens = scanned.content.trim() ? this.lexer.blockTokens(scanned.content) : []
          // 重复定义：先到先得，后来的整条丢弃（内容不留在正文里）
          if (!state.definitions.has(scanned.label)) state.definitions.set(scanned.label, tokens)

          const token: DefinitionToken = {
            type: 'footnoteDefinition',
            raw: scanned.raw,
            label: scanned.label,
            tokens,
          }
          return token
        },
        renderer() {
          return ''
        },
      },
      {
        name: 'footnoteRef',
        level: 'inline',
        start(src) {
          const index = src.indexOf('[^')
          return index >= 0 ? index : undefined
        },
        tokenizer(src) {
          const match = REFERENCE.exec(src)
          if (!match) return undefined

          const label = (match[1] ?? '').trim()
          if (!label) return undefined

          const token: ReferenceToken = { type: 'footnoteRef', raw: match[0], label }
          return token
        },
        renderer(token) {
          const reference = token as ReferenceToken
          const definition = state.definitions.get(reference.label)

          // 没有对应定义：原样输出作者写的标记，不静默吞掉正文
          if (!definition) return escapeText(reference.raw)

          if (!state.parser) state.parser = this.parser

          let number = state.numbers.get(reference.label)
          if (number === undefined) {
            number = state.order.length + 1
            state.order.push(reference.label)
            state.numbers.set(reference.label, number)

            const itemId = claimId(`fn-${state.token}-${number}`)
            state.itemIds.set(reference.label, itemId)
            state.refIds.set(reference.label, [])
            state.trustedIds.add(itemId)
          }

          const count = (state.refCounts.get(reference.label) ?? 0) + 1
          state.refCounts.set(reference.label, count)

          const prefix = `fnref-${state.token}-${number}`
          const refId = claimId(count === 1 ? prefix : `${prefix}-${count}`)
          state.refIds.get(reference.label)?.push(refId)
          state.trustedIds.add(refId)

          const itemId = state.itemIds.get(reference.label) ?? ''
          return [
            `<sup class="footnote-ref" id="${escapeAttribute(refId)}">`,
            `<a href="#${escapeAttribute(itemId)}" title="跳转到脚注 ${number}">${number}</a>`,
            '</sup>',
          ].join('')
        },
      },
    ],
  }
}

/** 返回链接：一次引用一个，title 让多次引用的返回入口可以区分 */
function renderBackrefs(state: FootnoteState, label: string): string {
  const ids = state.refIds.get(label) ?? []
  const multiple = ids.length > 1

  return ids
    .map((id, index) => {
      // 多次引用时用可见的「第 N 处」提示，不再引入 aria-* 属性：
      // title 已能说明去向，可见文字对读屏也成立
      const hint = multiple ? `第 ${index + 1} 处` : ''
      const title = multiple ? `返回到正文第 ${index + 1} 处引用` : '返回到正文'
      return `<a class="footnote-backref" href="#${escapeAttribute(id)}" title="${title}">↩${hint ? `<span class="footnote-backref__hint">${hint}</span>` : ''}</a>`
    })
    .join('')
}

/**
 * 渲染文章末尾的脚注列表。
 *
 * 只包含「被正文引用过」的脚注，按首次引用顺序排列；没被引用的定义不出现。
 * 定义内容里的块级 Markdown 用引用时捕获的 parser 渲染，因此代码高亮、公式、
 * 列表等与正文完全一致。
 */
export function renderFootnoteList(state: FootnoteState): string {
  if (state.order.length === 0 || !state.parser) return ''

  const items = state.order.map((label) => {
    const itemId = state.itemIds.get(label) ?? ''
    const tokens = state.definitions.get(label) ?? []
    // parser 产出的块级 HTML 末尾带换行，先截掉再判断结尾形态
    const body = (tokens.length ? state.parser!.parse(tokens) : '').replace(/\s+$/, '')
    const backrefs = renderBackrefs(state, label)

    // 主体以段落结尾时把返回链接放进最后一段，保持「脚注 + 返回」同一行；
    // 否则（空定义 / 以列表或代码块结尾）单独补一个返回段。
    const content = body.endsWith('</p>')
      ? `${body.slice(0, -4)}${backrefs}</p>`
      : `${body}<p class="footnote-item__back">${backrefs}</p>`

    return `<li class="footnote-item" id="${escapeAttribute(itemId)}">${content}</li>`
  })

  return [
    '<div class="footnotes">',
    '<h2 class="footnotes__title">脚注</h2>',
    `<ol class="footnotes__list">${items.join('')}</ol>`,
    '</div>',
  ].join('')
}
