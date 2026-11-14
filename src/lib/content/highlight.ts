/**
 * 代码高亮（Shiki，服务端）
 *
 * - 只在服务端执行，客户端零高亮 JS
 * - 双主题（light/dark）通过 `--shiki-*` 变量输出，切主题只需改 CSS 变量
 * - 未注册的语言降级为纯文本 pre，不抛错（内容仍可读）
 * - 围栏属性（文件名 / `{1,3}` / `expand`）由 `./code-meta` 解析
 * - 整行高亮与 diff 增删行走 `./code-transformers` 挂 class，不改写着色
 *
 * 产出的是**完整代码卡片**，不是裸 `<pre>`：标题栏、行号槽与滚动区都在这里
 * 一次性拼出来。高亮结果（`<pre>…</pre>`）原样嵌进去，**不重新解析** ——
 * 行号数量直接从源码行数得到，语言与文件名来自围栏，都不依赖 HTML 结构。
 */

import type { Highlighter } from 'shiki'
import type { CodeFenceMeta } from './code-meta'
import { createCodeTransformers } from './code-transformers'

const LANGS = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'json',
  'css',
  'html',
  'bash',
  'sql',
  'python',
  'rust',
  'go',
  'yaml',
  'markdown',
  'diff',
] as const

const ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  py: 'python',
  rs: 'rust',
  golang: 'go',
}

let highlighterPromise: Promise<Highlighter> | null = null

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['vitesse-light', 'vitesse-dark'],
        langs: [...LANGS],
      }),
    )
  }
  return highlighterPromise
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/**
 * 行号槽：每行一个 `<span>`。它是 `<pre>` 的兄弟节点，复制时天然取不到。
 *
 * 不在这里写 `aria-hidden` —— 清洗边界不放行 `aria-*`（见 `./sanitize`），
 * 写了也会被剥掉，只会让人误以为静态产出已经对读屏隐藏。实际由客户端增强补上。
 */
function renderGutter(lineCount: number): string {
  const rows: string[] = []
  for (let line = 1; line <= lineCount; line += 1) rows.push(`<span>${line}</span>`)
  return `<div class="code-block__gutter">${rows.join('')}</div>`
}

interface CardOptions {
  /** `<pre>…</pre>` 原文（Shiki 高亮结果或纯文本降级） */
  pre: string
  /** 归一后的语言 */
  lang?: string
  /** 作者写的语言；与归一值不同时优先显示它（`ts` 比 `typescript` 短） */
  requestedLang?: string
  filename?: string
  /** 源码行数，决定行号槽的高度 */
  lineCount: number
  /** 作者写了 expand：不参与折叠 */
  expand: boolean
}

/**
 * 把 `<pre>` 包成代码卡片。
 *
 * 结构固定四层，样式职责见 `code-block.css`：
 *   .code-block           卡片：边框、圆角、底色
 *   ├── __header          标题栏：文件名 / 语言标识 + 右侧复制按钮（客户端插入）
 *   └── __body            两列：行号槽 + 滚动区
 *       ├── __gutter      行号（逐行产出，不参与文本选择）
 *       └── __content     横向滚动容器，里面就是原样的 `<pre>`
 */
function renderCard(options: CardOptions): string {
  const label = options.requestedLang ?? options.lang
  const classes = ['code-block']
  // 作者明确要求展开：客户端据此跳过折叠，不必再多读一个 data 属性
  if (options.expand) classes.push('code-block--expand')
  if (!options.filename && !label) classes.push('code-block--bare')

  const headerParts: string[] = []
  if (options.filename) {
    headerParts.push(`<span class="code-block__filename">${escapeHtml(options.filename)}</span>`)
  }
  if (label) {
    headerParts.push(`<span class="code-block__lang">${escapeHtml(label)}</span>`)
  }

  return [
    `<div class="${classes.join(' ')}">`,
    `<div class="code-block__header">${headerParts.join('')}</div>`,
    '<div class="code-block__body">',
    renderGutter(Math.max(1, options.lineCount)),
    `<div class="code-block__content">${options.pre}</div>`,
    '</div>',
    '</div>',
  ].join('')
}

/** 纯文本代码块（未知语言 / 高亮失败）：没有着色，但标题栏、行号与折叠照样成立 */
export function plainCodeBlock(
  code: string,
  meta: CodeFenceMeta = { highlightLines: [], expand: false },
): string {
  const attr = meta.lang ? ` data-lang="${escapeHtml(meta.lang)}"` : ''
  // 逐行包成 `.line`，与 Shiki 的输出同构：这样「一行一格」的布局规则、
  // 行号与正文的对齐、以及复制时只读 `.line` 都只有一条代码路径。
  const lines = code
    .split('\n')
    .map((line) => `<span class="line">${escapeHtml(line)}</span>`)
    .join('')

  return renderCard({
    pre: `<pre${attr}><code>${lines}</code></pre>`,
    ...(meta.lang ? { lang: meta.lang, requestedLang: meta.lang } : {}),
    ...(meta.filename ? { filename: meta.filename } : {}),
    lineCount: code.split('\n').length,
    expand: meta.expand,
  })
}

/**
 * 返回完整的代码卡片片段。
 * 失败时降级为纯文本卡片 —— 降级只影响着色，不影响内容。
 */
export async function highlightCode(
  code: string,
  meta: CodeFenceMeta = { highlightLines: [], expand: false },
): Promise<string> {
  const requested = meta.lang
  const normalized = requested ? (ALIASES[requested] ?? requested) : undefined
  const supported = normalized && (LANGS as readonly string[]).includes(normalized)

  if (!supported) return plainCodeBlock(code, meta)

  const wrap = (pre: string) =>
    renderCard({
      pre,
      lang: normalized,
      ...(requested && requested !== normalized ? { requestedLang: requested } : {}),
      ...(meta.filename ? { filename: meta.filename } : {}),
      lineCount: code.split('\n').length,
      expand: meta.expand,
    })

  try {
    const highlighter = await getHighlighter()
    const html = highlighter.codeToHtml(code, {
      lang: normalized,
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
      defaultColor: false,
      transformers: createCodeTransformers({
        diffLines: normalized === 'diff',
        highlightLines: meta.highlightLines,
      }),
    })
    // 注入 data-lang：CSS 与测试都靠它认语言，与标题栏里的显示文本同源
    const label = escapeHtml(normalized)
    return wrap(html.replace('<pre class="shiki', `<pre data-lang="${label}" class="shiki`))
  } catch {
    return plainCodeBlock(code, { ...meta, lang: requested })
  }
}
