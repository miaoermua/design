/**
 * Markdown 渲染管线（服务端）
 *
 * 流程：lexer → walkTokens（异步代码高亮）→ parser（自定义 renderer）
 * 支持：GFM、Shiki 高亮、KaTeX 行内/块级公式、Mermaid（客户端补水）、
 *      标题锚点与 TOC、外链 noopener、图片图注。
 */

import katex from 'katex'
import { Marked, Renderer, type MarkedExtension, type Tokens } from 'marked'
import { highlightCode, plainCodeBlock } from './highlight'
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

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

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

/** Mermaid 只放源码与容器，渲染交给客户端补水组件 */
function renderMermaid(code: string): string {
  const encoded = Buffer.from(code, 'utf8').toString('base64')
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
 */
const mathExtensions: MarkedExtension = {
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

function createRenderer(toc: TocItem[]): Renderer {
  const slugify = createSlugger()
  const renderer = new Renderer()

  renderer.heading = function (this: Renderer, token: Tokens.Heading): string {
    const inner = this.parser.parseInline(token.tokens)
    const plain = stripHtml(inner)
    const id = slugify(plain)
    const depth = Math.min(4, Math.max(1, token.depth))

    if (depth === 2 || depth === 3) {
      toc.push({ id, text: plain, depth })
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
    const isExternal = /^https?:\/\//i.test(token.href)
    const attrs = [
      `href="${escapeAttribute(token.href)}"`,
      token.title ? `title="${escapeAttribute(token.title)}"` : '',
      isExternal ? 'target="_blank" rel="noopener noreferrer"' : '',
    ]
      .filter(Boolean)
      .join(' ')
    return `<a ${attrs}>${inner}</a>`
  }

  renderer.image = function (token: Tokens.Image): string {
    const alt = token.text ?? ''
    const img = `<img src="${escapeAttribute(token.href)}" alt="${escapeAttribute(alt)}" loading="lazy" decoding="async"${token.title ? ` title="${escapeAttribute(token.title)}"` : ''} />`
    if (!alt) return img
    return `<figure>${img}<figcaption>${escapeText(alt)}</figcaption></figure>`
  }

  return renderer
}

const markedInstance = new Marked({
  gfm: true,
  breaks: false,
  async: true,
  ...mathExtensions,
})

/**
 * 渲染 Markdown 为 HTML + TOC
 * 内容来自站点管理员，属于可信输入；渲染层仍然只输出受控标签。
 */
export async function renderMarkdown(markdown: string): Promise<RenderedContent> {
  const toc: TocItem[] = []
  const renderer = createRenderer(toc)

  markedInstance.use({
    renderer,
    walkTokens: async (token) => {
      if (token.type !== 'code') return
      const code = token as Tokens.Code
      const lang = code.lang ?? ''
      const casted = code as Tokens.Code & { folioHtml?: string }

      if (MERMAID_FENCE.test(lang.trim())) {
        casted.folioHtml = renderMermaid(code.text)
        return
      }
      casted.folioHtml = await highlightCode(code.text, lang.trim() || undefined)
    },
  })

  const html = await markedInstance.parse(markdown)
  return { html: typeof html === 'string' ? html : '', toc }
}

/** 只渲染行内 Markdown（摘要、图注等） */
export function renderInline(markdown: string): string {
  const renderer = new Renderer()
  renderer.image = () => ''
  return markedInstance.parseInline(markdown, { renderer, async: false }) as string
}
