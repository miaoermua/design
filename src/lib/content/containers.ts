/**
 * `:::` 容器扩展（服务端）：提示块 / 横幅 / 折叠块
 *
 * 语法（`:::` 后为空行表示闭合）：
 *
 *   ::: info
 *   正文，**支持 Markdown**
 *   :::
 *
 *   ::: warning 自定义标题
 *   …
 *   :::
 *
 *   ::: banner{info}
 *   通栏提示
 *   :::
 *
 *   ::: details 概要
 *   折叠内容
 *   :::
 *
 * 与相册扩展的关系：两者都从 `:::` 起手，但只认自己的容器名。
 * 这里认 `info / warning / error / danger / success / note / banner{…} / details`，
 * 其余 `:::` 内容一律不消费，交给后续扩展或当作普通文本输出（未知类型的安全降级）。
 *
 * 嵌套：内部每遇到一个非空的 `:::` 起手行就把深度 +1，裸 `:::` 减 1，
 * 因此提示块里嵌提示块、或嵌相册都能找到正确的闭合位置。
 * 未闭合（扫到文末仍没闭合）时整块不消费，原文按普通 Markdown 输出，不会吞掉后半篇文章。
 */

import type { MarkedExtension, Token, Tokens } from 'marked'
import { isCalloutType, renderDetailsHtml, renderNoticeHtml, type CalloutType } from './notice'

/** 任意 `:::` 行：第一个捕获组是容器名（可能为空 = 闭合行） */
const FENCE = /^ {0,3}:::[ \t]*(.*?)[ \t]*$/

/** `banner{info}` / `banner{type=info}`，逗号可选 */
const BANNER_HEADER =
  /^banner[ \t]*\{[ \t]*(?:type[ \t]*=[ \t]*)?["']?([a-zA-Z-]+)["']?[ \t]*\}[ \t]*(.*)$/
const NAMED_HEADER = /^([a-zA-Z][a-zA-Z-]*)[ \t]*(.*)$/

type ContainerHeader =
  | { kind: 'callout'; type: CalloutType; title: string }
  | { kind: 'banner'; type: CalloutType; title: string }
  | { kind: 'details'; title: string }

/**
 * 解析容器起手行。
 * 返回 null 表示「不是本扩展认的容器」，调用方既不消费也不报错。
 */
export function parseContainerHeader(raw: string): ContainerHeader | null {
  const line = raw.trim()
  if (!line) return null

  const banner = BANNER_HEADER.exec(line)
  if (banner) {
    const type = (banner[1] ?? '').toLowerCase()
    if (!isCalloutType(type)) return null
    return { kind: 'banner', type, title: (banner[2] ?? '').trim() }
  }

  const named = NAMED_HEADER.exec(line)
  if (!named) return null

  const name = (named[1] ?? '').toLowerCase()
  const rest = (named[2] ?? '').trim()

  if (name === 'details') return { kind: 'details', title: rest }
  if (isCalloutType(name)) return { kind: 'callout', type: name, title: rest }

  return null
}

interface ScannedContainer {
  header: ContainerHeader
  body: string
  /** 被消费掉的原文长度（token.raw） */
  raw: string
}

/**
 * 从 `src` 开头扫出一个完整的容器。
 * `src` 必须以容器起手行开始；未闭合、首行不是容器一律返回 null。
 */
export function scanContainer(src: string): ScannedContainer | null {
  const firstBreak = src.indexOf('\n')
  const firstLine = (firstBreak === -1 ? src : src.slice(0, firstBreak)).replace(/\r$/, '')
  const opening = FENCE.exec(firstLine)
  if (!opening) return null

  const header = parseContainerHeader(opening[1] ?? '')
  if (!header) return null

  let offset = firstBreak === -1 ? src.length : firstBreak + 1
  let depth = 0
  let closed = false
  const body: string[] = []

  while (offset < src.length) {
    const next = src.indexOf('\n', offset)
    const end = next === -1 ? src.length : next
    const line = src.slice(offset, end).replace(/\r$/, '')
    const fence = FENCE.exec(line)

    if (fence) {
      const inner = (fence[1] ?? '').trim()
      if (!inner) {
        if (depth === 0) {
          offset = next === -1 ? src.length : end + 1
          closed = true
          break
        }
        depth -= 1
      } else {
        // 任何非空 `:::` 都算开口：未知容器名也计入，闭合行才能配平
        depth += 1
      }
    }

    body.push(line)
    if (next === -1) {
      offset = src.length
      break
    }
    offset = end + 1
  }

  if (!closed) return null
  return { header, body: body.join('\n'), raw: src.slice(0, offset) }
}

interface ContainerToken extends Tokens.Generic {
  type: 'folioContainer'
  header: ContainerHeader
  tokens: Token[]
}

export function createContainerExtension(): MarkedExtension {
  return {
    extensions: [
      {
        name: 'folioContainer',
        level: 'block',
        childTokens: ['tokens'],
        start(src) {
          const index = src.search(/^ {0,3}:::/m)
          return index >= 0 ? index : undefined
        },
        tokenizer(src) {
          const scanned = scanContainer(src)
          if (!scanned) return undefined

          const token: ContainerToken = {
            type: 'folioContainer',
            raw: scanned.raw,
            header: scanned.header,
            tokens: [],
          }

          // 内部按块级 Markdown 再走一遍：标题进 TOC、代码高亮、列表嵌套全部复用主流程
          if (scanned.body.trim()) token.tokens = this.lexer.blockTokens(scanned.body)
          return token
        },
        renderer(token) {
          const container = token as ContainerToken
          const body = container.tokens.length ? this.parser.parse(container.tokens) : ''
          const { header } = container

          if (header.kind === 'details') return renderDetailsHtml(header.title, body)
          return renderNoticeHtml(header.kind, header.type, header.title, body)
        },
      },
    ],
  }
}
