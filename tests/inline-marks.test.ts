import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/content/markdown'

describe('Spoiler', () => {
  it('产出带 class 的 span，内容保留', async () => {
    const { html } = await renderMarkdown('这里是 ||隐藏内容|| 结尾')

    expect(html).toContain('<span class="md-spoiler">隐藏内容</span>')
    expect(html).toContain('这里是')
    expect(html).toContain('结尾')
  })

  it('支持行内 Markdown：粗体、行内代码、公式', async () => {
    const { html } = await renderMarkdown('||**粗** 与 `code` 与 $a^2$||')

    expect(html).toContain('<span class="md-spoiler">')
    expect(html).toContain('<strong>粗</strong>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('class="katex"')
  })

  it('不在同一段落内跨行匹配', async () => {
    const { html } = await renderMarkdown('||开始\n结束||')

    expect(html).not.toContain('md-spoiler')
    expect(html).toContain('||开始')
  })

  it('竖线表格与普通文本不受影响', async () => {
    const { html } = await renderMarkdown(
      '| a | b |\n| --- | --- |\n| 1 | 2 |\n\n表达式 a || b 不是标记',
    )

    expect(html).toContain('<table>')
    expect(html).not.toContain('md-spoiler')
    expect(html).toContain('a || b')
  })

  it('三个竖线不当作 spoiler', async () => {
    const { html } = await renderMarkdown('|||x|||')

    expect(html).not.toContain('md-spoiler')
  })

  it('内容里的 HTML 会被清洗，事件属性与脚本不保留', async () => {
    const { html } = await renderMarkdown(
      '||<b onclick="alert(1)">x</b><script>alert(2)</script>||',
    )

    expect(html).toContain('<span class="md-spoiler">')
    expect(html).toContain('<b>x</b>')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('<script>')
  })

  it('内部危险链接只保留文字', async () => {
    const { html } = await renderMarkdown('||[点我](javascript:alert(1))||')

    expect(html).toContain('点我')
    expect(html).not.toContain('javascript:')
  })

  it('空内容与首尾空白不匹配', async () => {
    const empty = await renderMarkdown('||||')
    expect(empty.html).not.toContain('md-spoiler')

    const spaced = await renderMarkdown('|| 前后有空格 ||')
    expect(spaced.html).not.toContain('md-spoiler')
  })

  it('多次出现互不影响', async () => {
    const { html } = await renderMarkdown('||一|| 中间 ||二||')

    expect((html.match(/md-spoiler/g) ?? []).length).toBe(2)
  })
})

describe('Ins', () => {
  it('产出原生 ins 标签', async () => {
    const { html } = await renderMarkdown('这里 ++新增内容++ 结尾')

    expect(html).toContain('<ins>新增内容</ins>')
  })

  it('支持行内 Markdown 且转义尖括号文本', async () => {
    const { html } = await renderMarkdown('++**加粗** 与 `code` 与 < 符号++')

    expect(html).toContain('<ins>')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('&lt; 符号')
    expect(html).not.toContain('<符号')
  })

  it('不吞普通加号表达式', async () => {
    for (const source of ['1 ++ 2', 'a ++ b', 'x+++y+++z', 'i++ 后继续']) {
      const { html } = await renderMarkdown(source)
      expect(html).not.toContain('<ins>')
    }
  })

  it('内容里的属性注入被清除', async () => {
    const { html } = await renderMarkdown(
      '++<a href="/x" onclick="alert(1)" target="_blank">链接</a>++',
    )

    expect(html).toContain('<ins>')
    expect(html).toContain('<a href="/x"')
    expect(html).not.toContain('onclick')
  })

  it('块级容器内部的 Ins 同样生效', async () => {
    const { html } = await renderMarkdown(['::: note', '++补充++', ':::'].join('\n'))

    expect(html).toContain('md-callout--note')
    expect(html).toContain('<ins>补充</ins>')
  })

  it('代码块与行内代码里的加号不解析', async () => {
    const { html } = await renderMarkdown(
      ['```text', 'a++b++c', '```', '', '行内 `++x++` 保持原样'].join('\n'),
    )

    expect(html).toContain('a++b++c')
    expect(html).toContain('++x++')
    expect(html).not.toContain('<ins>')
  })
})
