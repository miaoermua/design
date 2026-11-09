/**
 * 代码高亮（Shiki，服务端）
 *
 * - 只在服务端执行，客户端零高亮 JS
 * - 双主题（light/dark）通过 `--shiki-*` 变量输出，切主题只需改 CSS 变量
 * - 未注册的语言降级为纯文本 pre，不抛错（内容仍可读）
 */

import type { Highlighter } from 'shiki'

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

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** 纯文本代码块（未知语言 / 高亮失败） */
export function plainCodeBlock(code: string, lang?: string): string {
  const attr = lang ? ` data-lang="${escapeHtml(lang)}"` : ''
  return `<pre${attr}><code>${escapeHtml(code)}</code></pre>`
}

/**
 * 返回完整的 `<pre>` 片段（不含外层 figure）。
 * 失败时返回纯文本 pre —— 降级只影响着色，不影响内容。
 */
export async function highlightCode(code: string, lang?: string): Promise<string> {
  const normalized = lang ? (ALIASES[lang] ?? lang) : undefined
  const supported = normalized && (LANGS as readonly string[]).includes(normalized)

  if (!supported) return plainCodeBlock(code, lang)

  try {
    const highlighter = await getHighlighter()
    const html = highlighter.codeToHtml(code, {
      lang: normalized,
      themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
      defaultColor: false,
    })
    // 注入 data-lang，供 CSS 显示语言标签
    const label = escapeHtml(normalized)
    return html.replace('<pre class="shiki', `<pre data-lang="${label}" class="shiki`)
  } catch {
    return plainCodeBlock(code, lang)
  }
}
