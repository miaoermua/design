/**
 * 代码围栏的信息串解析（服务端）
 *
 * 围栏的写法是 ` ```lang ` 后面跟任意属性串。这里只认 Shiro 那套约定，
 * 不自己发明语法：
 *
 *   ```ts filename="app/page.tsx"        文件名 → 卡片显示独立标题栏
 *   ```ts title="app/page.tsx"           Shiki 生态的等价写法
 *   ```ts {3,8-12}                       行号高亮 → 这些行加 .highlighted
 *   ```ts expand                         强制展开，不参与折叠
 *   ```diff                              diff 语言：按行首 +/- 判定增删
 *   ```ts // [!code ++]                  记号式增删行 → .diff.add / .diff.remove
 *   ```ts // [!code highlight]           记号式整行高亮
 *
 * **纯函数、无依赖**：只有服务端高亮链用得到，因此不 import shiki，
 * 单测可以直接跑。
 */

/** 代码块在卡片上需要的全部元信息 */
export interface CodeFenceMeta {
  /** 语言标识（作者写法，`ts` 仍是 `ts`） */
  lang?: string
  /** 文件名；有值时卡片显示独立标题栏 */
  filename?: string
  /** 需要整行高亮的行号（1 起） */
  highlightLines: readonly number[]
  /** 作者写了 `expand`：无论多长都不折叠 */
  expand: boolean
}

const FILENAME_DOUBLE = /(?:file|file)?name\s*=\s*"([^"]*)"|title\s*=\s*"([^"]*)"/i
const FILENAME_SINGLE = /(?:file|file)?name\s*=\s*'([^']*)'|title\s*=\s*'([^']*)'/i
const LINE_SET = /\{([\d,\s-]+)\}/
const EXPAND = /(?:^|\s)expand(?:\s|$)/

/**
 * 拆出语言标识。
 *
 * 语言只能是第一段连续非空白字符，`{` 也视为分隔 —— ` ```ts{1,3} ` 这种
 * 不带空格的写法同样能认出 `ts`。
 */
function splitLang(info: string): { lang?: string; rest: string } {
  const match = /^(\S*?)(?=[\s{]|$)/.exec(info)
  const lang = match?.[1] ?? ''
  // 纯属性串（没有语言）时第一段可能是 `filename="…"`，不能当语言
  if (!lang || lang.includes('=') || lang.startsWith('{')) {
    return { lang: undefined, rest: info }
  }
  return { lang, rest: info.slice(lang.length) }
}

/** `{1,3-5,9}` → `[1,3,4,5,9]`；区间倒置时自动交换，重复行去重并升序 */
function parseLineSet(raw: string): number[] {
  const lines = new Set<number>()

  for (const part of raw.split(',')) {
    const piece = part.trim()
    if (!piece) continue

    const range = /^(\d+)\s*-\s*(\d+)$/.exec(piece)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      const from = Math.min(start, end)
      const to = Math.max(start, end)
      // 上界保护：`{1-100000}` 不该让渲染期去铺一张十万行的表
      for (let line = from; line <= Math.min(to, from + 5000); line += 1) {
        if (line > 0) lines.add(line)
      }
      continue
    }

    const single = Number(piece)
    if (Number.isInteger(single) && single > 0) lines.add(single)
  }

  return [...lines].sort((a, b) => a - b)
}

function readFilename(rest: string): string | undefined {
  const double = FILENAME_DOUBLE.exec(rest)
  const single = double ? null : FILENAME_SINGLE.exec(rest)
  const value = double ? (double[1] ?? double[2]) : single ? (single[1] ?? single[2]) : undefined
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** 解析围栏信息串（含语言） */
export function parseFenceInfo(info?: string): CodeFenceMeta {
  const source = info?.trim() ?? ''
  if (!source) return { highlightLines: [], expand: false }

  const { lang, rest } = splitLang(source)
  const filename = readFilename(rest)
  const lines = LINE_SET.exec(rest)

  return {
    ...(lang ? { lang } : {}),
    ...(filename ? { filename } : {}),
    highlightLines: lines?.[1] ? parseLineSet(lines[1]) : [],
    expand: EXPAND.test(rest),
  }
}
