/**
 * 正文 HTML 安全边界（仅服务端使用）
 *
 * 输入是 `renderMarkdown()` 的完整输出：渲染器生成的受控标签（标题锚点、Shiki 高亮、
 * KaTeX 公式、Mermaid 容器）与作者在 Markdown 里手写的原始 HTML 混在同一个字符串里。
 *
 * 为什么整篇清洗而不是逐 token 清洗：
 * marked 会把未闭合的原始 HTML 拆成独立 token（单独一行的 `<div align="center">` 是一个
 * token，闭合的 `</div>` 是另一个）。逐 token 交给 HTML 解析器会各自补上闭合标签，正文
 * 结构被破坏；而整篇输出的标签在文档级别是配平的，解析器能原样保留嵌套关系。
 *
 * 策略：
 *   - 标签白名单：script / style / object / embed / form 等不在名单内，整块丢弃
 *   - 属性白名单：`on*` 事件处理器不在名单内，一律丢弃；`data-*` 不再是通配，
 *     只放行渲染器真实产出的 `data-lang` / `data-mermaid-src`
 *   - URL 协议白名单：链接 http / https / mailto；图片与 iframe 仅 http / https
 *   - iframe：只允许 `IFRAME_POLICIES` 里的来源，sandbox / referrerpolicy 由本文件强制写入，
 *     作者提供的同名属性被覆盖，`srcdoc` / `allow` 直接丢弃
 *   - `style`：属性名 + 值双向白名单（见 `sanitizeStyle`），只放行 Shiki 双主题变量、
 *     KaTeX 排版所需的行内尺寸与作者版式用到的排版属性；`url()` 等外部资源一律丢弃
 *   - `id`：只有本次渲染真实产出的标题 id 才保留，作者手写的 id 不进入输出
 *   - Mermaid：占位容器必须同时满足「class 含 mermaid-block」且「data-mermaid-src 属于
 *     本次渲染登记的源码集合」，作者伪造的容器会被降级为普通 div
 */

import sanitizeHtml from 'sanitize-html'

/** 链接允许的协议 */
const LINK_SCHEMES = ['http', 'https', 'mailto'] as const

/** 图片与 iframe 允许的协议（不允许 data:、javascript:、file:） */
const MEDIA_SCHEMES = ['http', 'https'] as const

export type UrlKind = 'link' | 'image'

/**
 * 校验 URL 是否为可安全输出的绝对/相对地址。
 * 返回原始值（保留作者写法）或 null（调用方应丢弃该 URL）。
 *
 * 判定只依赖 protocol 前缀，不做字符串替换：
 *   - 相对路径、锚点、协议相对地址（`//host`）直接放行
 *   - 其余必须命中协议白名单
 *   - 先剔除控制字符再判定，避免 `java\tscript:`、`java\nscript:` 绕过
 */
export function safeUrl(raw: string, kind: UrlKind = 'link'): string | null {
  const value = raw.trim()
  if (!value) return null

  const normalized = value.replace(/[\u0000-\u0020\u007f]/g, '')
  const match = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(normalized)
  if (!match) return value

  const scheme = (match[1] ?? '').toLowerCase()
  const allowed: readonly string[] = kind === 'image' ? MEDIA_SCHEMES : LINK_SCHEMES
  return allowed.includes(scheme) ? value : null
}

/* ------------------------------------------------------------------ *
 * CSS：属性名 + 值白名单
 * ------------------------------------------------------------------ */

/** 颜色值：十六进制（含 8 位带 alpha）、rgb()/hsl() 系列、具名颜色与关键字 */
const COLOR = /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?)\([0-9a-z.,%\s/+-]*\)|[a-z]{3,20})$/i

/** 长度值：数字 + 可选单位（KaTeX 用 em，作者版式用 px / %） */
const LENGTH = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:em|ex|px|pt|pc|in|cm|mm|q|rem|ch|vh|vw|vmin|vmax|%)$/i

/** 纯数字或百分比（`zoom: 35%`） */
const NUMBER_OR_PERCENT = /^\d+(?:\.\d+)?%?$/

type Validator = (value: string) => boolean

const isColor: Validator = (value) => COLOR.test(value)
const isLength: Validator = (value) => value === '0' || LENGTH.test(value)
const isSize: Validator = (value) => value === 'auto' || isLength(value)
const oneOf = (values: readonly string[]): Validator => {
  const set = new Set(values)
  return (value) => set.has(value.toLowerCase())
}
const isVerticalAlign: Validator = (value) =>
  isLength(value) ||
  oneOf(['baseline', 'sub', 'super', 'text-top', 'text-bottom', 'middle', 'top', 'bottom'])(value)
const isFontWeight: Validator = (value) =>
  /^[1-9]00$/.test(value) || oneOf(['normal', 'bold', 'bolder', 'lighter'])(value)
const isTextDecoration: Validator = (value) =>
  /^(?:none|underline|overline|line-through|blink)(?:\s+(?:solid|double|dotted|dashed|wavy))?$/i.test(
    value,
  )

/**
 * 允许的内联声明。表外属性一律丢弃，因此 `position: fixed`、`z-index`、`inset`、
 * `background`（含 url）、`background-image`、`transform`、`filter` 天然不可用。
 *
 * 保留理由：
 *   - `--shiki-*`：Shiki 双主题高亮靠这四个变量切深浅色
 *   - KaTeX：`height` / `min-width` / `margin-*` / `padding-left` / `top` / `bottom` /
 *     `vertical-align` / `border-*-width` / `position: relative`（vlist 堆叠定位）
 *   - 作者版式：`color` / `border-color` / `text-align` / `font-weight` / `width` / `zoom`
 */
const STYLE_RULES: Record<string, Validator> = {
  '--shiki-light': isColor,
  '--shiki-dark': isColor,
  '--shiki-light-bg': isColor,
  '--shiki-dark-bg': isColor,
  color: isColor,
  'background-color': isColor,
  'border-color': isColor,
  'border-top-color': isColor,
  'border-right-color': isColor,
  'border-bottom-color': isColor,
  'border-left-color': isColor,
  position: oneOf(['relative']),
  top: isLength,
  right: isLength,
  bottom: isLength,
  left: isLength,
  width: isSize,
  height: isSize,
  'min-width': isSize,
  'max-width': isSize,
  'min-height': isSize,
  'max-height': isSize,
  margin: isLength,
  'margin-top': isLength,
  'margin-right': isLength,
  'margin-bottom': isLength,
  'margin-left': isLength,
  padding: isLength,
  'padding-top': isLength,
  'padding-right': isLength,
  'padding-bottom': isLength,
  'padding-left': isLength,
  'vertical-align': isVerticalAlign,
  'text-align': oneOf(['left', 'right', 'center', 'justify', 'start', 'end']),
  'text-indent': isLength,
  'font-weight': isFontWeight,
  'font-style': oneOf(['normal', 'italic', 'oblique']),
  'font-size': isSize,
  'text-decoration': isTextDecoration,
  'border-width': isLength,
  'border-top-width': isLength,
  'border-right-width': isLength,
  'border-bottom-width': isLength,
  'border-left-width': isLength,
  'border-style': oneOf(['none', 'solid', 'dashed', 'dotted', 'double']),
  'border-top-style': oneOf(['none', 'solid', 'dashed', 'dotted', 'double']),
  'border-right-style': oneOf(['none', 'solid', 'dashed', 'dotted', 'double']),
  'border-bottom-style': oneOf(['none', 'solid', 'dashed', 'dotted', 'double']),
  'border-left-style': oneOf(['none', 'solid', 'dashed', 'dotted', 'double']),
  'border-radius': isLength,
  display: oneOf([
    'inline',
    'block',
    'inline-block',
    'table',
    'table-row',
    'table-cell',
    'table-row-group',
    'inline-table',
    'none',
  ]),
  zoom: (value) => NUMBER_OR_PERCENT.test(value),
}

/**
 * 值级别的兜底：CSS 里能发起网络请求或执行代码的构造函数。
 * 不进 `STYLE_RULES` 的属性本来就被丢弃，这条只是第二道闸。
 */
const FORBIDDEN_VALUE = /(?:url|src|expression|image|image-set|cross-fade|element|paint)\s*\(|\\|</i

/** 按分号切分声明，跳过括号与引号内的分号（手写扫描，不用正则当解析器） */
function splitDeclarations(style: string): string[] {
  const declarations: string[] = []
  let buffer = ''
  let depth = 0
  let quote = ''

  for (const char of style) {
    if (quote) {
      buffer += char
      if (char === quote) quote = ''
      continue
    }
    if (char === '"' || char === "'") {
      quote = char
      buffer += char
      continue
    }
    if (char === '(') depth += 1
    else if (char === ')') depth = Math.max(0, depth - 1)

    if (char === ';' && depth === 0) {
      declarations.push(buffer)
      buffer = ''
      continue
    }
    buffer += char
  }

  declarations.push(buffer)
  return declarations
}

/**
 * 过滤一段内联样式，返回可安全输出的声明串（可能为空串）。
 * 未识别的属性、非法的值、含 `url()` 等外部资源的值全部丢弃。
 */
export function sanitizeStyle(style: string): string {
  const kept: string[] = []

  for (const declaration of splitDeclarations(style)) {
    const separator = declaration.indexOf(':')
    if (separator < 0) continue

    const property = declaration.slice(0, separator).trim().toLowerCase()
    const value = declaration.slice(separator + 1).trim()
    if (!property || !value) continue
    if (FORBIDDEN_VALUE.test(value)) continue

    const validate = STYLE_RULES[property]
    if (!validate || !validate(value)) continue

    kept.push(`${property}:${value}`)
  }

  return kept.join(';')
}

/* ------------------------------------------------------------------ *
 * iframe：来源白名单 + 强制安全属性
 * ------------------------------------------------------------------ */

interface IframePolicy {
  /** 强制写入的 sandbox（作者提供的同名属性会被覆盖） */
  sandbox: string
  /** 强制写入的 referrerpolicy */
  referrerpolicy: string
  /** 是否允许全屏（仅视频播放器需要） */
  allowFullscreen?: boolean
}

/**
 * 允许嵌入的来源。按主机名精确匹配，不匹配任何子域。
 *
 * 现状（实测 78 篇正文）：只有 `api.paugram.com/bili` 的 B 站卡片，
 * 返回纯 HTML + CSS（0 个 `<script>`），链接为 `target="_blank"`。
 * 因此只给「弹窗」权限：脚本、同源、表单、顶层跳转都不给。
 * 新增来源时必须先确认该服务是否需要脚本，再决定 sandbox。
 */
const IFRAME_POLICIES: Record<string, IframePolicy> = {
  'api.paugram.com': {
    sandbox: 'allow-popups allow-popups-to-escape-sandbox',
    referrerpolicy: 'no-referrer',
  },
}

/** 解析并校验 iframe 来源；返回策略或 null（null = 整个元素丢弃） */
function resolveIframePolicy(raw: string | undefined): IframePolicy | null {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  return IFRAME_POLICIES[url.hostname.toLowerCase()] ?? null
}

/* ------------------------------------------------------------------ *
 * 清洗配置
 * ------------------------------------------------------------------ */

const ALLOWED_TAGS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'div',
  'span',
  'a',
  'em',
  'strong',
  'b',
  'i',
  'u',
  's',
  'del',
  'ins',
  'mark',
  'small',
  'sub',
  'sup',
  'code',
  'pre',
  'kbd',
  'samp',
  'var',
  'abbr',
  'cite',
  'q',
  'time',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'blockquote',
  'details',
  'summary',
  'figure',
  'figcaption',
  'img',
  'iframe',
  'input',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
]

/** 本次渲染的真实产出，用于区分「系统生成」与「作者手写」 */
export interface SanitizeContext {
  /** TOC 里的标题 id；不在集合内的 `id` 一律丢弃 */
  headingIds?: ReadonlySet<string>
  /** 渲染器登记的 Mermaid 源码（base64） */
  mermaidSources?: ReadonlySet<string>
}

const HEADING = /^h[1-6]$/
const MERMAID_CLASS = 'mermaid-block'

/** 从 class 串里摘掉一个类名 */
function removeClassToken(value: string | undefined, token: string): string {
  if (!value) return ''
  return value
    .split(/\s+/)
    .filter((item) => item && item !== token)
    .join(' ')
}

function createOptions(context: SanitizeContext): sanitizeHtml.IOptions {
  const headingIds = context.headingIds ?? new Set<string>()
  const mermaidSources = context.mermaidSources ?? new Set<string>()
  const seenIds = new Set<string>()

  return {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      // class / style 供渲染器与作者版式使用；style 的值在 transformTags 里过白名单。
      // 不再放行 `data-*` / `aria-*` 通配。
      '*': ['class', 'title', 'lang', 'dir', 'align', 'style'],
      a: ['href', 'target', 'rel', 'hreflang', 'type', 'name'],
      img: ['src', 'alt', 'width', 'height', 'loading', 'decoding', 'referrerpolicy'],
      iframe: [
        'src',
        'width',
        'height',
        'loading',
        'sandbox',
        'referrerpolicy',
        'allowfullscreen',
        'frameborder',
        'scrolling',
        'title',
      ],
      input: ['type', 'value', 'checked', 'disabled', 'name'],
      // 渲染器产出的语言标记与 Mermaid 源码；作者写同名属性只在通过校验后保留
      pre: ['data-lang', 'tabindex'],
      div: ['data-mermaid-src'],
      h1: ['id'],
      h2: ['id'],
      h3: ['id'],
      h4: ['id'],
      h5: ['id'],
      h6: ['id'],
      ol: ['start', 'reversed', 'type'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
      time: ['datetime'],
    },
    allowedSchemes: [...LINK_SCHEMES],
    allowedSchemesByTag: {
      img: [...MEDIA_SCHEMES],
      iframe: [...MEDIA_SCHEMES],
    },
    allowProtocolRelative: true,
    // style 由 transformTags 自己清洗，这里不让 sanitize-html 再解析一遍
    parseStyleAttributes: false,
    disallowedTagsMode: 'discard',
    // script / style 等标签连同内容一起丢弃；其余不在白名单的标签只丢标签、保留文字
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template'],
    transformTags: {
      '*': (tagName, attribs) => {
        const next: Record<string, string> = { ...attribs }

        // 1. 内联样式：属性名 + 值白名单
        if (typeof next.style === 'string') {
          const style = sanitizeStyle(next.style)
          if (style) next.style = style
          else delete next.style
        } else {
          delete next.style
        }

        // 2. id：只保留本次渲染真实产出的标题锚点（且只保留第一次出现的那个）
        if ('id' in next) {
          const id = next.id
          const keep = HEADING.test(tagName) && headingIds.has(id) && !seenIds.has(id)
          if (keep) seenIds.add(id)
          else delete next.id
        }

        // 3. Mermaid 容器：class 与源码必须同时对上本次渲染的登记
        if (tagName === 'div' || tagName === 'figure') {
          const classes = next.class ?? ''
          const src = next['data-mermaid-src']
          const trusted =
            classes.split(/\s+/).includes(MERMAID_CLASS) &&
            typeof src === 'string' &&
            mermaidSources.has(src)
          if (!trusted) {
            delete next['data-mermaid-src']
            if (classes.includes(MERMAID_CLASS)) {
              const rest = removeClassToken(classes, MERMAID_CLASS)
              if (rest) next.class = rest
              else delete next.class
            }
          }
        } else if ('data-mermaid-src' in next) {
          delete next['data-mermaid-src']
        }

        // 4. iframe：来源策略由本文件写死，作者属性不可覆盖
        if (tagName === 'iframe') {
          const policy = resolveIframePolicy(next.src)
          delete next.allow
          delete next.srcdoc
          if (policy) {
            next.sandbox = policy.sandbox
            next.referrerpolicy = policy.referrerpolicy
            next.loading = 'lazy'
            if (policy.allowFullscreen) next.allowfullscreen = 'allowfullscreen'
            else delete next.allowfullscreen
          }
        }

        // 5. tabindex 只允许 0 / -1（Shiki 给可滚动代码块加的可聚焦标记）
        if ('tabindex' in next && !/^-?[01]$/.test(next.tabindex ?? '')) delete next.tabindex

        // 6. 外链补 rel
        if (tagName === 'a') {
          const href = next.href ?? ''
          const external = /^https?:\/\//i.test(href)
          if (external || next.target === '_blank') next.rel = 'noopener noreferrer'
        }

        return { tagName, attribs: next }
      },
    },
    exclusiveFilter: (frame) =>
      frame.tag === 'iframe' && resolveIframePolicy(frame.attribs.src) === null,
  }
}

/**
 * 清洗一整篇已渲染的正文 HTML。
 * 对受控渲染产出的标签应当是幂等的：同一份 HTML（同一 context）清洗两次结果一致。
 */
export function sanitizeRenderedHtml(html: string, context: SanitizeContext = {}): string {
  if (!html) return ''
  return sanitizeHtml(html, createOptions(context))
}
