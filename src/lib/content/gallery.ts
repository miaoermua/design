/**
 * 相册扩展（服务端）：解析 + HTML 产出
 *
 * 语法（只此一种，不派生变体）：
 *
 *   ::: gallery
 *   ![图片一](1.webp)
 *   ![图片二](2.webp)
 *   :::
 *
 *   ::: carousel
 *   ![...](...)
 *   :::
 *
 * 行为参考 my-kami 的 `pickImagesFromMarkdown`：逐行识别「独立成行的 Markdown
 * 图片」，裸 URL、行内文字里的图片、HTML `<img>` 都不算相册项。与 Kami 的差异是
 * 这里要求整行只有一个图片语法（Kami 允许行尾跟文字），避免把 `![a](b) 说明` 里
 * 的说明文字吞掉。
 *
 * 解析与渲染分离：
 *   - `pickGalleryImages()` 只做纯文本解析，可单独测试；
 *   - `renderGalleryHtml()` 只负责把图片数组拼成受控 HTML；
 *   - `createGalleryExtension()` 把它们接进 marked。
 *
 * 所有最终 HTML 仍然要过 `./sanitize`（容器 id 与 class 需要登记才保留）。
 */

import type { MarkedExtension, Token, Tokens } from 'marked'
import { escapeAttribute } from './escape'
import { safeUrl } from './sanitize'

export type GalleryVariant = 'gallery' | 'carousel'

/** 相册里的一张图；字段与 Markdown 图片语义一一对应 */
export interface GalleryImage {
  src: string
  alt: string
  /** `![alt](src "title")` 里的 title */
  title?: string
}

/** 容器起点的粗匹配：给 marked 的 `start()` 用，只负责“这里可能有容器” */
const CONTAINER_START = /^ {0,3}:::[ \t]*(?:gallery|carousel)[ \t]*$/m

/** 完整容器：允许空内容（`::: gallery\n:::`），也允许尾声没有换行 */
const CONTAINER =
  /^ {0,3}:::[ \t]*(gallery|carousel)[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?[ \t]*:::[ \t]*(?:\r?\n+|$)/

/**
 * 一行 Markdown 图片：alt 允许一层方括号，URL 允许一层圆括号（wiki 链接常见）。
 * 行首行尾必须是图片本身，因此 `![a](b) 说明` 不算。
 */
const IMAGE_LINE =
  /^!\[((?:[^[\]]|\[[^\]]*\])*)\]\(\s*<?((?:[^\s<>()]|\([^\s()]*\))+)>?(?:\s+["']([^"']*)["'])?\s*\)$/

/**
 * 从容器正文里提取独立行图片。
 * 非图片行（说明文字、空行、HTML、裸 URL）一律忽略，顺序保持不变。
 */
export function pickGalleryImages(content: string): GalleryImage[] {
  const images: GalleryImage[] = []

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const match = IMAGE_LINE.exec(line)
    if (!match) continue

    const src = match[2]?.trim()
    if (!src) continue

    const image: GalleryImage = { src, alt: match[1] ?? '' }
    if (match[3]) image.title = match[3]
    images.push(image)
  }

  return images
}

/**
 * 提取并过滤掉不安全 URL。
 * 与普通图片同一套规则（仅 http / https）：`javascript:` / `data:` 之类的项直接不进入相册，
 * 否则后续会把非法 URL 交给客户端渲染。
 */
export function selectGalleryImages(content: string): GalleryImage[] {
  return pickGalleryImages(content).flatMap((image) => {
    const src = safeUrl(image.src, 'image')
    return src ? [{ ...image, src }] : []
  })
}

/** 相册容器 HTML：无 JS 时仍然是一排可横向滚动、可点击查看原图的图片 */
export function renderGalleryHtml(
  id: string,
  variant: GalleryVariant,
  images: GalleryImage[],
): string {
  const items = images
    .map((image) => {
      const title = image.title ? ` title="${escapeAttribute(image.title)}"` : ''
      return [
        '<li class="md-gallery__item">',
        `<a class="md-gallery__link" href="${escapeAttribute(image.src)}" target="_blank" rel="noopener noreferrer">`,
        `<img src="${escapeAttribute(image.src)}" alt="${escapeAttribute(image.alt)}" loading="lazy" decoding="async"${title} />`,
        '</a>',
        '</li>',
      ].join('')
    })
    .join('')

  return [
    `<div class="md-gallery md-gallery--${variant}" data-gallery-id="${escapeAttribute(id)}">`,
    `<ul class="md-gallery__track">${items}</ul>`,
    '</div>',
  ].join('')
}

interface GalleryToken extends Tokens.Generic {
  type: 'galleryContainer'
  variant: GalleryVariant
  id: string
  images: GalleryImage[]
  tokens: Token[]
}

/**
 * marked 块级扩展。
 *
 * `register` 在真正产出容器时登记 id：安全边界只保留登记过的容器，
 * 作者手写 `<div class="md-gallery" data-gallery-id="...">` 会被降级成普通 div。
 *
 * 没有任何可用图片时**不产出相册**，而是把正文按普通 Markdown 渲染：
 * 文字继续可见，非法图片自然被清洗掉（空相册不占位、不报错）。
 */
export function createGalleryExtension(register: (id: string) => void): MarkedExtension {
  let counter = 0

  return {
    extensions: [
      {
        name: 'galleryContainer',
        level: 'block',
        // 让 marked 的 walkTokens 继续走进降级时词法化出来的子 token（代码高亮需要）
        childTokens: ['tokens'],
        start(src) {
          const index = src.search(CONTAINER_START)
          return index >= 0 ? index : undefined
        },
        tokenizer(src) {
          const match = CONTAINER.exec(src)
          if (!match) return undefined

          const variant: GalleryVariant = match[1] === 'carousel' ? 'carousel' : 'gallery'
          const content = match[2] ?? ''
          const images = selectGalleryImages(content)

          const token: GalleryToken = {
            type: 'galleryContainer',
            raw: match[0],
            variant,
            id: `g${++counter}`,
            images,
            tokens: [],
          }

          if (images.length === 0) {
            token.tokens = this.lexer.blockTokens(content)
          }

          return token
        },
        renderer(token) {
          const gallery = token as GalleryToken

          if (gallery.images.length === 0) {
            return gallery.tokens.length > 0 ? this.parser.parse(gallery.tokens) : ''
          }

          register(gallery.id)
          return renderGalleryHtml(gallery.id, gallery.variant, gallery.images)
        },
      },
    ],
  }
}
