/**
 * Markdown 渲染管线（服务端）
 *
 * 流程：lexer → walkTokens（异步代码高亮）→ parser（自定义 renderer）
 * 支持：GFM、Shiki 高亮、KaTeX 行内/块级公式、Mermaid（客户端补水）、
 *      相册/轮播容器、标题锚点与 TOC、外链 noopener、图片图注。
 */

import katex from 'katex'
import { Marked, Renderer, type MarkedExtension, type Tokens } from 'marked'
import { escapeAttribute, escapeText } from './escape'
import { createGalleryExtension } from './gallery'
import { highlightCode, plainCodeBlock } from './highlight'
import { safeUrl, sanitizeRenderedHtml } from './sanitize'
import { createSlugger, stripHtml } from './slug'

export interface TocItem {
  id: string
  text: string
  depth: 2 | 3
}

export interface RenderedContent {
  html: string
  toc: TocItem[]
}

const MERMAID_FENCE = /^mermaid\b/i

function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: false,
      output: 'html',
      trust: false,
    })
  } catch {
    // 公式语法错误不影响正文：原样展示 TeX 源码
    return `<code class="katex-error">${escapeText(tex)}</code>`
  }
}

/**
 * Mermaid 只放源码与容器，渲染交给客户端补水组件。
 * 源码同时登记进本次渲染的 `sources`：安全边界只信任登记过的容器，
 * 作者手写同结构 HTML 无法凭 class + data 属性让客户端去渲染任意图表。
 */
function renderMermaid(code: string, sources: Set<string>): string {
  const encoded = Buffer.from(code, 'utf8').toString('base64')
  sources.add(encoded)
  return [
    `<div class="mermaid-block" data-mermaid-src="${encoded}">`,
    `<pre><code>${escapeText(code)}</code></pre>`,
    '</div>',
  ].join('')
}

/**
 * 数学扩展
 * 行内：$...$（首尾不允许空白，避免误吞金额 "$5"）
 * 块级：$$ ... $$
 *
 * 每次调用返回新对象：扩展注册只发生在引擎构造阶段，不同渲染任务之间不共享可变配置。
 */
function createMathExtensions(): MarkedExtension {
  return {
    extensions: [
      {
        name: 'blockMath',
        level: 'block',
        start(src: string) {
          const index = src.search(/^\$\$/m)
          return index >= 0 ? index : undefined
        },
        tokenizer(src: string) {
          const match = /^\$\$\n?([\s\S]*?)\n?\$\$(?:[ \t]*\n+|$)/.exec(src)
          if (!match) return undefined
          return { type: 'blockMath', raw: match[0], text: (match[1] ?? '').trim() }
        },
        renderer(token) {
          const tex = typeof token.text === 'string' ? token.text : ''
          return `<div class="math-block">${renderTex(tex, true)}</div>`
        },
      },
      {
        name: 'inlineMath',
        level: 'inline',
        start(src: string) {
          const index = src.search(/\$(?!\$)/)
          return index >= 0 ? index : undefined
        },
        tokenizer(src: string) {
          const match = /^\$(?![\s$])((?:\\.|[^\\$\n])+?)\$(?![\d$])/.exec(src)
          if (!match) return undefined
          return { type: 'inlineMath', raw: match[0], text: match[1] ?? '' }
        },
        renderer(token) {
          const tex = typeof token.text === 'string' ? token.text : ''
          return renderTex(tex, false)
        },
      },
    ],
  }
}

/** 一次渲染任务的全部可变状态（不允许跨任务复用） */
interface RenderState {
  toc: TocItem[]
  /** 渲染器真实产出的标题 id（含不进 TOC 的 h1 / h4+），安全边界据此保留 id */
  headingIds: Set<string>
  /** 渲染器真实产出的 Mermaid 源码 */
  mermaidSources: Set<string>
  /** 渲染器真实产出的相册容器 id，安全边界据此保留容器属性 */
  galleryIds: Set<string>
}

function createRenderer(state: RenderState): Renderer {
  const slugify = createSlugger()
  const renderer = new Renderer()

  renderer.heading = function (this: Renderer, token: Tokens.Heading): string {
    const inner = this.parser.parseInline(token.tokens)
    const plain = stripHtml(inner)
    const id = slugify(plain)
    const depth = Math.min(4, Math.max(1, token.depth))

    state.headingIds.add(id)
    if (depth === 2 || depth === 3) {
      state.toc.push({ id, text: plain, depth })
    }

    return [
      `<h${depth} id="${escapeAttribute(id)}">`,
      inner,
      `<a class="heading-anchor" href="#${escapeAttribute(id)}" aria-label="链接到本节">#</a>`,
      `</h${depth}>`,
    ].join('')
  }

  renderer.code = function (token: Tokens.Code): string {
    const highlighted = (token as Tokens.Code & { folioHtml?: string }).folioHtml
    if (highlighted) return highlighted
    return plainCodeBlock(token.text, token.lang ?? undefined)
  }

  renderer.link = function (this: Renderer, token: Tokens.Link): string {
    const inner = this.parser.parseInline(token.tokens)
    // 危险协议（javascript: / data: / vbscript: …）不产出链接，只保留链接文字
    const href = safeUrl(token.href)
    if (!href) return inner

    const isExternal = /^https?:\/\//i.test(href)
    const attrs = [
      `href="${escapeAttribute(href)}"`,
      token.title ? `title="${escapeAttribute(token.title)}"` : '',
      isExternal ? 'target="_blank" rel="noopener noreferrer"' : '',
    ]
      .filter(Boolean)
      .join(' ')
    return `<a ${attrs}>${inner}</a>`
  }

  renderer.image = function (token: Tokens.Image): string {
    const src = safeUrl(token.href, 'image')
    // 图片只允许 http / https；其余协议不渲染，避免 data: / javascript: 载体
    if (!src) return ''

    const alt = token.text ?? ''
    const img = `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy" decoding="async"${token.title ? ` title="${escapeAttribute(token.title)}"` : ''} />`
    if (!alt) return img
    return `<figure>${img}<figcaption>${escapeText(alt)}</figcaption></figure>`
  }

  return renderer
}

/**
 * 构造一次渲染任务专用的引擎。
 *
 * marked 的扩展（renderer / walkTokens）注册在实例上，实例状态在解析期间可被读取。
 * 因此**不能**跨请求共享实例：并发时后一次 `use()` 会覆盖前一次的 renderer，
 * 于是 A 文章的标题被写进 B 文章的 TOC；同一个实例反复 `use()` 还会把 walkTokens
 * 链式包裹，导致高亮回调随渲染次数累积。
 * 这里每次调用都新建实例，TOC 收集器、slug 计数器、高亮闭包全部属于当前任务。
 */
function createMarkdownEngine(state: RenderState): Marked {
  const engine = new Marked({ gfm: true, breaks: false, async: true })
  engine.use(createMathExtensions())
  // 相册/轮播：解析与 HTML 产出在 ./gallery，这里只把登记回调接进当前任务的状态
  engine.use(createGalleryExtension((id) => state.galleryIds.add(id)))
  engine.use({
    renderer: createRenderer(state),
    walkTokens: async (token) => {
      if (token.type !== 'code') return
      const code = token as Tokens.Code
      const lang = code.lang ?? ''
      const casted = code as Tokens.Code & { folioHtml?: string }

      if (MERMAID_FENCE.test(lang.trim())) {
        casted.folioHtml = renderMermaid(code.text, state.mermaidSources)
        return
      }
      casted.folioHtml = await highlightCode(code.text, lang.trim() || undefined)
    },
  })
  return engine
}

/**
 * 渲染 Markdown 为 HTML + TOC
 *
 * 渲染器只输出受控标签，但正文允许手写原始 HTML，最终统一过一遍安全边界
 * （见 `./sanitize`）：标签/属性白名单 + URL 协议白名单 + 事件处理器清除。
 */
export async function renderMarkdown(markdown: string): Promise<RenderedContent> {
  const state: RenderState = {
    toc: [],
    headingIds: new Set(),
    mermaidSources: new Set(),
    galleryIds: new Set(),
  }
  const engine = createMarkdownEngine(state)
  const html = await engine.parse(markdown)
  const sanitized = sanitizeRenderedHtml(typeof html === 'string' ? html : '', {
    headingIds: state.headingIds,
    mermaidSources: state.mermaidSources,
    galleryIds: state.galleryIds,
  })
  return { html: sanitized, toc: state.toc }
}

/**
 * 只渲染行内 Markdown（摘要、图注等）
 *
 * 独立构造同步引擎：不能复用异步实例（marked 禁止在 async 实例上按 sync 解析），
 * 同时行内场景不输出图片与原始 HTML。
 */
export function renderInline(markdown: string): string {
  const engine = new Marked({ gfm: true, breaks: false, async: false })
  engine.use(createMathExtensions())

  const renderer = new Renderer()
  renderer.image = () => ''
  renderer.html = () => ''
  renderer.link = function (this: Renderer, token: Tokens.Link): string {
    const inner = this.parser.parseInline(token.tokens)
    const href = safeUrl(token.href)
    return href ? `<a href="${escapeAttribute(href)}">${inner}</a>` : inner
  }

  const html = engine.parseInline(markdown, { renderer })
  return sanitizeRenderedHtml(typeof html === 'string' ? html : '')
}
