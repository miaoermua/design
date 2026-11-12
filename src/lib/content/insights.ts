/**
 * AI 精读文档的结构解析（纯函数，服务端）
 *
 * Core 的 `insights.content` 是一个字符串，但有明确约定（v12 `ai.prompts.ts:162-201`）：
 *
 *   - 正文是 Markdown，用 H2/H3 分节，**不写文档标题**
 *   - 引用锚点是自闭合标签 `<ref quote="<原文逐字片段>" section="<可选位置提示>"/>`
 *   - 图表走 ```mermaid 围栏
 *   - 最后一行必须是一条 HTML 注释 `<!-- insights-meta: {"reading_time_min":…} -->`
 *
 * 所以渲染前要做三件事：剥掉尾部注释并读出 meta、把 `<ref/>` 换成可渲染的上标、
 * 把 `quote` 落到原文里定位到章节。定位不到就降级成无链接标记——
 * **绝不拼一个看起来能跳、实际跳不到任何地方的 href。**
 *
 * 区块名（TL;DR / Timeline / Key Concepts …）是开放集合，提示词明确要求按文章裁剪，
 * 因此这里不枚举、不解析语义，只按通用 Markdown 处理。
 */

import { escapeAttribute } from './escape'

export type InsightsDifficulty = 'easy' | 'medium' | 'hard'

export interface InsightsMeta {
  readingMinutes: number | null
  difficulty: InsightsDifficulty | null
  genre: string | null
}

export interface ParsedInsights {
  /** 已剥离 meta 注释的 Markdown 正文 */
  body: string
  meta: InsightsMeta
}

export interface InsightRefRewrite {
  /** 替换 `<ref/>` 之后的 Markdown */
  markdown: string
  /** 文档里出现的 ref 总数 */
  total: number
  /** 成功定位到原文章节的数量 */
  resolved: number
}

const META_COMMENT = /<!--\s*insights-meta:\s*([\s\S]*?)\s*-->\s*$/
const REF_TAG = /<ref\b([^>]*?)\/>/g
const REF_ATTRIBUTE = /(quote|section)\s*=\s*"([^"]*)"/g
const DIFFICULTIES: readonly InsightsDifficulty[] = ['easy', 'medium', 'hard']

const EMPTY_META: InsightsMeta = { readingMinutes: null, difficulty: null, genre: null }

/** 解析 `<ref>` 的属性值：产出侧按 XML 规则转义过，这里还原成原文 */
function decodeAttribute(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function parseMeta(raw: string): InsightsMeta {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // meta 坏了不影响正文：按「没有元信息」处理
    return EMPTY_META
  }
  if (!parsed || typeof parsed !== 'object') return EMPTY_META

  const record = parsed as Record<string, unknown>
  const minutes = record.reading_time_min
  const difficulty = record.difficulty
  const genre = record.genre

  return {
    readingMinutes:
      typeof minutes === 'number' && Number.isFinite(minutes) && minutes >= 1
        ? Math.round(minutes)
        : null,
    difficulty:
      typeof difficulty === 'string' && (DIFFICULTIES as readonly string[]).includes(difficulty)
        ? (difficulty as InsightsDifficulty)
        : null,
    genre: typeof genre === 'string' && genre.trim() ? genre.trim() : null,
  }
}

/** 剥离尾部 `insights-meta` 注释并读回元信息 */
export function parseInsightsDocument(content: string): ParsedInsights {
  const trimmed = content.trimEnd()
  const match = META_COMMENT.exec(trimmed)
  if (!match) return { body: trimmed, meta: EMPTY_META }

  return {
    body: trimmed.slice(0, match.index).trimEnd(),
    meta: parseMeta(match[1] ?? ''),
  }
}

interface DocumentScan {
  /** 每个 H2/H3 在原文中的字符偏移，顺序与 Markdown 中出现顺序一致 */
  headingOffsets: number[]
  /** 每个 H2/H3 的原始行内文本（含行内 Markdown 标记） */
  headingTexts: string[]
  /** 围栏代码块占据的区间（含围栏本身） */
  codeRanges: Array<[number, number]>
}

/**
 * 扫描原文：标题位置 + 代码块区间。
 *
 * 两个都必须在「忽略围栏内部」的前提下统计——否则代码块里的 `## ` 会被当成标题，
 * 里面出现的 `<ref>` 也会被当成真引用（提示词禁止这么做，但模型不一定守规矩）。
 */
function scanDocument(markdown: string): DocumentScan {
  const headingOffsets: number[] = []
  const headingTexts: string[] = []
  const codeRanges: Array<[number, number]> = []

  let offset = 0
  let fenceChar: string | null = null
  let fenceStart = 0

  for (const line of markdown.split('\n')) {
    const trimmed = line.trimStart()
    const indent = line.length - trimmed.length

    if (fenceChar) {
      if (trimmed.startsWith(fenceChar)) {
        codeRanges.push([fenceStart, offset + line.length])
        fenceChar = null
      }
    } else if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      fenceChar = trimmed.slice(0, 3)
      fenceStart = offset + indent
    } else if (/^#{2,3}\s+\S/.test(trimmed)) {
      headingOffsets.push(offset + indent)
      headingTexts.push(trimmed.replace(/^#{2,3}\s+/, '').trim())
    }

    offset += line.length + 1
  }

  // 未闭合的围栏一直延续到文档末尾
  if (fenceChar) codeRanges.push([fenceStart, markdown.length])

  return { headingOffsets, headingTexts, codeRanges }
}

/** 去掉行内标记与空白，用于「标题文本」层面的比较 */
function normalizeHeading(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * 把原文标题位置与目录项对齐。
 *
 * 正常情况下两边数量一致（目录就是同一份 Markdown 渲染出来的），直接按序号配对。
 * 数量不一致时**不能**按序号硬配——错位会让锚点跳到不相干的章节，
 * 比没有锚点更糟。这时改为按标题文本顺序匹配；匹配不上就返回空数组，
 * 调用方据此把所有引用降级为无链接标记。
 */
function alignHeadingOffsets(scan: DocumentScan, toc: ReadonlyArray<{ text?: string }>): number[] {
  if (scan.headingOffsets.length === toc.length) return scan.headingOffsets

  const aligned: number[] = []
  let cursor = 0

  for (const item of toc) {
    const target = normalizeHeading(item.text ?? '')
    if (!target) return []

    let found = -1
    for (let i = cursor; i < scan.headingTexts.length; i += 1) {
      if (normalizeHeading(scan.headingTexts[i] ?? '') === target) {
        found = i
        break
      }
    }
    if (found < 0) return []

    aligned.push(scan.headingOffsets[found] ?? Number.POSITIVE_INFINITY)
    cursor = found + 1
  }

  return aligned
}

function isInsideRanges(index: number, ranges: Array<[number, number]>): boolean {
  return ranges.some(([start, end]) => index >= start && index < end)
}

/** 找出包含 `index` 的最近一个章节标题；没有则为 null */
function findHeadingId(
  index: number,
  headingOffsets: number[],
  toc: ReadonlyArray<{ id: string }>,
): string | null {
  let candidate = -1
  for (let i = 0; i < headingOffsets.length; i += 1) {
    if ((headingOffsets[i] ?? Number.POSITIVE_INFINITY) > index) break
    candidate = i
  }
  if (candidate < 0) return null
  return toc[candidate]?.id ?? null
}

/**
 * 把精读里的 `<ref/>` 换成上标标记，并尽量定位到原文章节。
 *
 * @param body        已剥离 meta 的精读正文
 * @param source      原文 Markdown（文章的 `content`）
 * @param toc         原文渲染后得到的目录项，顺序与 `##` / `###` 标题一致
 *
 * 命中：渲染成 `<sup class="insight-ref"><a href="#章节id">§</a></sup>`
 * 未命中：渲染成 `<sup class="insight-ref insight-ref--plain">§</sup>`，不带 href
 */
export function resolveInsightRefs(
  body: string,
  source: string,
  toc: ReadonlyArray<{ id: string; text?: string }>,
): InsightRefRewrite {
  // 两处扫描针对不同文本：标题位置来自原文（ref 指向原文），
  // 代码块区间来自精读正文（要屏蔽的是正文里被误写进代码块的 ref）。
  const headingOffsets = alignHeadingOffsets(scanDocument(source), toc)
  const { codeRanges } = scanDocument(body)

  let total = 0
  let resolved = 0

  const markdown = body.replace(REF_TAG, (match, rawAttributes: string, offset: number) => {
    // 代码块里的 `<ref>` 是示例文本，原样保留（外层围栏已转义，不会真的生效）
    if (isInsideRanges(offset, codeRanges)) return match

    let quote = ''
    let section = ''
    for (const attribute of rawAttributes.matchAll(REF_ATTRIBUTE)) {
      const [, name, value = ''] = attribute
      if (name === 'quote') quote = decodeAttribute(value).trim()
      else if (name === 'section') section = decodeAttribute(value).trim()
    }

    total += 1

    // `quote` 缺失或原文里找不到：不制造跳转
    const position = quote ? source.indexOf(quote) : -1
    const headingId = position >= 0 ? findHeadingId(position, headingOffsets, toc) : null
    const label = section || '原文'

    if (!headingId) {
      return `<sup class="insight-ref insight-ref--plain" title="${escapeAttribute(label)}">§</sup>`
    }

    resolved += 1
    return [
      '<sup class="insight-ref">',
      `<a href="#${escapeAttribute(headingId)}" class="insight-ref__link"`,
      ` title="${escapeAttribute(label)}">§</a>`,
      '</sup>',
    ].join('')
  })

  return {
    // 容忍模型写成非自闭合形式：残留的闭合标签只会输出成空文本
    markdown: markdown.replaceAll('</ref>', ''),
    total,
    resolved,
  }
}

export interface InsightSection {
  /** 章节标题（H2/H3 的纯文本）；首个章节可能为空串（TL;DR 之前的引子） */
  title: string
  markdown: string
}

/**
 * 按 H2 切分正文，用于「只展开首段、其余折叠」。
 *
 * 只认 `## `：H3 属于上一节的内容，切开会把一个小节孤立出来。
 */
export function splitInsightSections(body: string): InsightSection[] {
  const lines = body.split('\n')
  const sections: InsightSection[] = []
  let current: InsightSection = { title: '', markdown: '' }
  let fence: string | null = null

  for (const line of lines) {
    const trimmed = line.trimStart()

    if (fence) {
      if (trimmed.startsWith(fence)) fence = null
    } else if (trimmed.startsWith('```') || trimmed.startsWith('~~~')) {
      fence = trimmed.slice(0, 3)
    } else if (/^##\s+\S/.test(trimmed)) {
      sections.push(current)
      current = { title: trimmed.replace(/^##\s+/, '').trim(), markdown: `${line}\n` }
      continue
    }

    current.markdown += `${line}\n`
  }

  sections.push(current)
  return sections.filter((section) => section.markdown.trim().length > 0)
}
