import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/content/markdown'

describe('基础渲染', () => {
  it('标题输出级别、锚点与 TOC 深度', async () => {
    const { html, toc } = await renderMarkdown('# 一级\n\n## 二级\n\n### 三级\n\n#### 四级')

    expect(html).toContain('<h1 id="一级">')
    expect(html).toContain('<h4 id="四级">')
    expect(html).toContain('class="heading-anchor"')
    // 只有 h2 / h3 进入 TOC
    expect(toc.map((item) => [item.id, item.depth])).toEqual([
      ['二级', 2],
      ['三级', 3],
    ])
  })

  it('段落、列表、引用、行内代码', async () => {
    const { html } = await renderMarkdown(
      [
        '段落文本',
        '',
        '- 项目一',
        '- 项目二',
        '',
        '1. 第一',
        '2. 第二',
        '',
        '> 引用内容',
        '',
        '行内 `code` 结束',
      ].join('\n'),
    )

    expect(html).toContain('<p>段落文本</p>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<ol>')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<code>code</code>')
  })

  it('GFM 表格', async () => {
    const { html } = await renderMarkdown('| 列一 | 列二 |\n| --- | --- |\n| a | b |')

    expect(html).toContain('<table>')
    expect(html).toContain('<thead>')
    expect(html).toContain('<td>a</td>')
  })

  it('代码块在未知语言下降级为纯文本 pre，并保留语言标记', async () => {
    const { html } = await renderMarkdown('```text\nconst a = 1 < 2\n```')

    expect(html).toContain('<pre data-lang="text">')
    expect(html).toContain('const a = 1 &lt; 2')
  })

  it('已知语言走 Shiki 高亮，保留双主题变量与 data-lang', async () => {
    const { html } = await renderMarkdown('```ts\nconst a: number = 1\n```')

    expect(html).toContain('class="shiki')
    expect(html).toContain('--shiki-light')
    expect(html).toContain('--shiki-dark')
    expect(html).toContain('data-lang="typescript"')
  })

  it('图片输出 figure / figcaption 与懒加载属性', async () => {
    const { html } = await renderMarkdown('![示例图](https://example.com/a.png)')

    expect(html).toContain('<figure>')
    expect(html).toContain('src="https://example.com/a.png"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('<figcaption>示例图</figcaption>')
  })

  it('外链补 target 与 rel，站内链接不补', async () => {
    const { html } = await renderMarkdown('[外站](https://example.com) 与 [站内](/posts/hello)')

    expect(html).toContain('href="https://example.com" target="_blank" rel="noopener noreferrer"')
    expect(html).toContain('href="/posts/hello"')
    expect(html).not.toContain('href="/posts/hello" target=')
  })

  it('删除线等 GFM 行内语法', async () => {
    const { html } = await renderMarkdown('~~已删除~~')

    expect(html).toContain('<del>已删除</del>')
  })
})

describe('公式', () => {
  it('行内公式走 KaTeX 服务端渲染', async () => {
    const { html } = await renderMarkdown('质能方程 $E = mc^2$ 结束')

    expect(html).toContain('class="katex"')
    expect(html).toContain('katex-html')
    expect(html).not.toContain('$E = mc^2$')
  })

  it('块级公式包在 math-block 容器内', async () => {
    const { html } = await renderMarkdown('$$\n\\frac{a}{b}\n$$')

    expect(html).toContain('<div class="math-block">')
    expect(html).toContain('katex-display')
  })

  it('非法公式不抛错，正文继续渲染', async () => {
    const { html } = await renderMarkdown('前 $\\frac{1}{$ 后')

    expect(html).toContain('katex')
    expect(html).toContain('前')
    expect(html).toContain('后')
  })

  it('美元金额不被识别为公式', async () => {
    const { html } = await renderMarkdown('价格 $5 与 $10 元')

    expect(html).not.toContain('class="katex"')
    expect(html).toContain('$5 与 $10')
  })

  it('KaTeX 的内联样式在安全清洗后保留', async () => {
    const { html } = await renderMarkdown('$\\frac{1}{2}$')

    // 公式排版依赖 KaTeX 自己的 height / vertical-align 内联样式
    expect(html).toMatch(/class="[^"]*katex[^"]*"[^>]*style="[^"]+"/)
  })
})

describe('TOC', () => {
  it('重复标题生成唯一 id', async () => {
    const { toc, html } = await renderMarkdown('## 重复\n\n## 重复\n\n## 重复')

    expect(toc.map((item) => item.id)).toEqual(['重复', '重复-1', '重复-2'])
    expect(html).toContain('id="重复-2"')
  })

  it('没有标题时 TOC 为空且正文正常', async () => {
    const { toc, html } = await renderMarkdown('只有正文。')

    expect(toc).toEqual([])
    expect(html).toContain('<p>只有正文。</p>')
  })

  it('标题里的行内格式不进入 TOC 文本', async () => {
    const { toc } = await renderMarkdown('## 标题 `code` **加粗**')

    expect(toc[0]?.text).toBe('标题 code 加粗')
  })
})
