/**
 * 代码块：围栏信息解析 + 服务端卡片骨架 + 安全边界
 *
 * 三层分开断言：
 *   1. `code-meta` 的解析是纯函数，各种写法都在这里对齐
 *   2. 真实渲染管线产出的卡片结构（标题栏、语言标识、行号槽）与行级 class
 *      （行高亮、diff 增删）
 *   3. 作者手写的 `<pre>` 不会凭空长出一个「看起来像系统产出」的卡片
 *
 * 客户端增强（复制、折叠）依赖真实布局与剪贴板，静态契约覆盖不到，见文末说明。
 */

import { describe, expect, it } from 'vitest'
import { parseFenceInfo } from '@/lib/content/code-meta'
import { renderMarkdown } from '@/lib/content/markdown'

const render = async (md: string) => (await renderMarkdown(md)).html

/**
 * 剥掉标签后比对文本。
 *
 * Shiki 会把一行拆成多个着色 token（`const ` / `a` / ` = ` / `1`），
 * 直接对 HTML 做子串断言会因为跨标签而失败 —— 这里只看文本内容。
 */
const textOf = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')

/** 取每个 `<span class="line …">` 的附加 class */
const lineClasses = (html: string) =>
  [...html.matchAll(/<span class="line([^"]*)"/g)].map((match) => match[1].trim())

/**
 * 取行号槽里的数字序列。
 *
 * 不匹配 `aria-hidden` —— 服务端不写它（写了也会被清洗掉），由客户端增强补。
 */
const gutterRows = (html: string) => {
  const block = /<div class="code-block__gutter">(.*?)<\/div>/s.exec(html)
  return block ? [...block[1].matchAll(/<span>(\d+)<\/span>/g)].map((m) => Number(m[1])) : null
}

describe('围栏信息解析', () => {
  it('语言与属性共存：语言只取第一段', () => {
    const meta = parseFenceInfo('ts filename="app/page.tsx" {2,4-5} expand')

    expect(meta.lang).toBe('ts')
    expect(meta.filename).toBe('app/page.tsx')
    expect(meta.highlightLines).toEqual([2, 4, 5])
    expect(meta.expand).toBe(true)
  })

  it('没有语言也能解析属性（不会把 filename 当成语言）', () => {
    const meta = parseFenceInfo('filename="a.txt"')

    expect(meta.lang).toBeUndefined()
    expect(meta.filename).toBe('a.txt')
  })

  it('title 与单引号是等价写法', () => {
    expect(parseFenceInfo('ts title="a.ts"').filename).toBe('a.ts')
    expect(parseFenceInfo("ts filename='b.ts'").filename).toBe('b.ts')
  })

  it('语言与行号集合之间可以没有空格', () => {
    expect(parseFenceInfo('ts{2}').lang).toBe('ts')
    expect(parseFenceInfo('ts{2}').highlightLines).toEqual([2])
  })

  it('行号集合：区间展开、倒置区间交换、去重升序', () => {
    expect(parseFenceInfo('ts {5-3,1,3}').highlightLines).toEqual([1, 3, 4, 5])
    expect(parseFenceInfo('ts {0,-2,1-2}').highlightLines).toEqual([1, 2])
  })

  it('`expand` 是整词匹配，不会被别的单词误伤', () => {
    expect(parseFenceInfo('ts').expand).toBe(false)
    expect(parseFenceInfo('ts expanded').expand).toBe(false)
    expect(parseFenceInfo('ts expand').expand).toBe(true)
  })

  it('空信息串不抛错', () => {
    expect(parseFenceInfo(undefined)).toEqual({ highlightLines: [], expand: false })
    expect(parseFenceInfo('   ').highlightLines).toEqual([])
  })
})

describe('服务端产出：卡片骨架', () => {
  it('文件名写进标题栏，语言标识同时保留', async () => {
    const html = await render('```ts filename="app/page.tsx"\nconst a = 1\n```')

    expect(html).toContain('class="code-block"')
    expect(html).toContain('<span class="code-block__filename">app/page.tsx</span>')
    expect(html).toContain('<span class="code-block__lang">ts</span>')
    // 归一后的语言仍然写进 pre，样式与测试都靠它认语言
    expect(html).toContain('data-lang="typescript"')
  })

  it('无文件名时只有语言标识，卡片不进入 bare 形态', async () => {
    const html = await render('```ts\nconst a = 1\n```')

    expect(html).not.toContain('code-block__filename')
    expect(html).toContain('<span class="code-block__lang">ts</span>')
    expect(html).not.toContain('code-block--bare')
  })

  it('行号槽逐行产出，行数与代码行数一致', async () => {
    expect(gutterRows(await render('```ts\na\nb\nc\n```'))).toEqual([1, 2, 3])
  })

  it('空代码块仍有一行行号，不会出现空槽', async () => {
    expect(gutterRows(await render('```ts\n```'))).toEqual([1])
  })

  it('未知语言降级为纯文本，但标题栏与行号照常成立', async () => {
    const html = await render('```foobar filename="x.txt"\nhello\nworld\n```')

    expect(html).toContain('data-lang="foobar"')
    expect(html).toContain('<span class="code-block__filename">x.txt</span>')
    // 纯文本也逐行包成 `.line`：两种产出同构，复制与对齐只有一条代码路径
    expect(html).toContain('<span class="line">hello</span><span class="line">world</span>')
    expect(gutterRows(html)).toEqual([1, 2])
  })

  it('既无文件名也无语言时进入 bare 形态', async () => {
    const html = await render('```\nplain\n```')

    expect(html).toContain('code-block--bare')
    expect(html).not.toContain('code-block__lang')
  })

  it('`expand` 落到 class 上，客户端据此跳过折叠', async () => {
    expect(await render('```ts expand\nconst a = 1\n```')).toContain('code-block--expand')
  })

  it('mermaid 仍走独立容器，不被包成代码卡片', async () => {
    const html = await render('```mermaid\ngraph TD\nA-->B\n```')

    expect(html).toContain('class="mermaid-block"')
    expect(html).toContain('data-mermaid-src=')
    expect(html).not.toContain('code-block')
  })
})

describe('服务端产出：行级 class', () => {
  it('`{2,4-5}` 把对应行标成 highlighted', async () => {
    const lines = lineClasses(await render('```ts {2,4-5}\na\nb\nc\nd\ne\n```'))

    expect(lines).toHaveLength(5)
    expect(lines.map((value) => value.includes('highlighted'))).toEqual([
      false,
      true,
      false,
      true,
      true,
    ])
  })

  it('diff 语言按行首判定增删，文件头与 hunk 不误判', async () => {
    const lines = lineClasses(
      await render(
        ['```diff', '- old', '+ new', '@@ -1 +1 @@', '--- a/x', '+++ b/x', ' same', '```'].join(
          '\n',
        ),
      ),
    )

    expect(lines[0]).toContain('diff remove')
    expect(lines[1]).toContain('diff add')
    expect(lines[2]).toContain('diff-hunk')
    expect(lines[3]).not.toContain('diff ')
    expect(lines[4]).not.toContain('diff ')
    expect(lines[5]).not.toContain('diff ')
  })

  it('记号式增删行：判定后把记号注释剪掉', async () => {
    const html = await render(
      ['```ts', 'const a = 1 // [!code ++]', 'const b = 2 // [!code --]', '```'].join('\n'),
    )
    const lines = lineClasses(html)

    expect(lines[0]).toContain('diff add')
    expect(lines[1]).toContain('diff remove')
    expect(html).not.toContain('[!code')
    // 代码本身保留，只剪掉注释；着色把一行拆成多个 token，只能按文本比对
    expect(textOf(html)).toContain('const a = 1')
    expect(textOf(html)).toContain('const b = 2')
  })

  it('`[!code highlight]` 与 `{n}` 落到同一个 highlighted 类', async () => {
    const html = await render(['```ts', 'const a = 1 // [!code highlight]', '```'].join('\n'))

    expect(html).toContain('highlighted')
    expect(html).not.toContain('[!code')
  })

  it('`+` / `-` 在非 diff 语言里只是普通字符，不触发增删配色', async () => {
    const lines = lineClasses(await render('```ts\n+ const a = 1\n- const b = 2\n```'))

    expect(lines.some((value) => value.includes('diff'))).toBe(false)
  })
})

describe('安全边界：作者写不出「系统产出的卡片」', () => {
  it('手写 `<pre class="shiki">` 只会得到裸 pre，不会被包成卡片', async () => {
    const html = await render('<pre class="shiki">x</pre>')

    expect(html).toContain('class="shiki"')
    expect(html).not.toContain('class="code-block"')
    expect(html).not.toContain('code-block__header')
  })

  it('手写 code-block 结构不会被补上行号槽', async () => {
    const html = await render('<div class="code-block"><pre>x</pre></div>')

    expect(html).not.toContain('code-block__gutter')
  })

  it('作者手写 data-lang 仍只允许出现在 pre 上', async () => {
    const html = await render('<div data-lang="ts">A</div>')

    expect(html).not.toContain('data-lang')
  })
})

// 未覆盖：复制成功/失败、折叠展开、行号与正文的对齐、横向滚动。
// 这些依赖真实布局与剪贴板权限，需在 Dev Server 里用浏览器验收。
