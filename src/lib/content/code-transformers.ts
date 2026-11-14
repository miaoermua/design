/**
 * 代码块的 Shiki 转换器（服务端）
 *
 * 只做一件事：给**已经高亮好的行**打上语义 class，让样式层能画出
 * 「整行高亮 / 新增行 / 删除行」。不重新解析 HTML，也不改语言着色 ——
 * 着色仍由 Shiki 的 vitesse 双主题输出，这里只往行元素上挂 class。
 *
 * 三种来源，对应 Shiro 的三条约定：
 *   1. `diff` 语言：按行首的 `+` / `-` 判定（`+++` / `---` 是文件头，不算增删）
 *   2. 记号：行尾注释里写 `[!code ++]` / `[!code --]` / `[!code highlight]`，
 *      判定后把这段注释从渲染结果里剪掉 —— 记号是给人看的写法，不该出现在正文
 *   3. 围栏属性 `{1,3-5}`：指定行整行高亮
 *
 * 不用 `@shikijs/transformers`：那套要按 matchAlgorithm 版本适配，且会把
 * `[!code word:xxx]` 之类的写法一并接管；这里只需要上面三条，自己写反而更好读。
 */

import type { ShikiTransformer } from 'shiki'

/**
 * HAST 元素类型。
 *
 * 直接从 `line` 钩子的形参上取，不 import `hast` —— 那是 shiki 的传递依赖，
 * 在 pnpm 的严格 node_modules 下不一定可解析，取形参则永远跟着 shiki 走。
 */
type LineElement = Parameters<NonNullable<ShikiTransformer['line']>>[0]

/** 行尾的记号注释：行注释 `//` / `#` / `--`，或块注释 `/* … *\/` 包住记号 */
const NOTATION_TAIL =
  /\s*(?:\/\/|#|--|\/\*|<!--)\s*\[!code (?:\+\+|--|highlight)\]\s*(?:\*\/|-->)?\s*$/

/** 从行首判定 diff 行类型；`+++` / `---` 是 unified diff 的文件头 */
function diffKind(line: string): 'add' | 'remove' | 'hunk' | null {
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+++') || line.startsWith('---')) return null
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'remove'
  return null
}

/**
 * 剪掉行尾的记号注释。
 *
 * 记号通常落在**同一条注释 token** 里，也就是行元素的最后一个文本节点，
 * 所以从右往左找第一个命中的文本节点即可；记号被语法拆成多个 token 时
 * 匹配不上，此时保留原样（宁可露出注释，也不要吃掉真实代码）。
 */
function stripNotation(node: LineElement): boolean {
  for (let index = node.children.length - 1; index >= 0; index -= 1) {
    const child = node.children[index]
    if (!child) continue

    if (child.type === 'text') {
      const next = child.value.replace(NOTATION_TAIL, '')
      if (next !== child.value) {
        child.value = next
        return true
      }
      // 最后一个文本节点不含记号就没必要继续往左找
      return false
    }

    if (child.type === 'element' && stripNotation(child)) return true
  }

  return false
}

export interface CodeTransformerOptions {
  /** 语言为 `diff` 时按行首的 +/- 判定增删 */
  diffLines: boolean
  /** 围栏属性 `{1,3-5}` 指定的行号 */
  highlightLines: readonly number[]
}

/**
 * 返回本次高亮要用的转换器数组。
 *
 * `line` 钩子能拿到 `this.source`（原始代码），因此判定依据始终是源码文本，
 * 与着色结果无关 —— 改主题、改语法都不会让增删行的判定漂移。
 */
export function createCodeTransformers(options: CodeTransformerOptions): ShikiTransformer[] {
  const highlighted = new Set(options.highlightLines)

  return [
    {
      name: 'folio:code-block',
      line(node, lineNumber) {
        const classes: string[] = []

        if (options.diffLines) {
          const raw = this.source.split('\n')[lineNumber - 1] ?? ''
          const kind = diffKind(raw)
          if (kind === 'add') classes.push('diff', 'add')
          else if (kind === 'remove') classes.push('diff', 'remove')
          else if (kind === 'hunk') classes.push('diff-hunk')
        } else {
          const raw = this.source.split('\n')[lineNumber - 1] ?? ''
          const marked = NOTATION_TAIL.test(raw.trimEnd())
          if (marked) {
            const bare = raw.trimEnd()
            if (/\[!code \+\+\]/.test(bare)) classes.push('diff', 'add')
            else if (/\[!code --\]/.test(bare)) classes.push('diff', 'remove')
            else classes.push('highlighted')
            stripNotation(node)
          }
        }

        if (highlighted.has(lineNumber)) classes.push('highlighted')
        if (classes.length === 0) return

        const existing = typeof node.properties.class === 'string' ? node.properties.class : ''
        node.properties.class = [existing, ...classes].filter(Boolean).join(' ')
      },
    },
  ]
}
