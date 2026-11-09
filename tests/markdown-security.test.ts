import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/content/markdown'
import { sanitizeRenderedHtml } from '@/lib/content/sanitize'

describe('链接协议', () => {
  it('javascript: 链接不产出锚点，只保留文字', async () => {
    const { html } = await renderMarkdown('[点我](javascript:alert(1))')

    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('<a')
    expect(html).toContain('点我')
  })

  it('大小写混写的危险协议同样被拦截', async () => {
    const { html } = await renderMarkdown('[点我](JaVaScRiPt:alert(1))')

    expect(html.toLowerCase()).not.toContain('javascript:')
    expect(html).not.toContain('<a')
  })

  it('vbscript: 与 file: 被拦截', async () => {
    const { html } = await renderMarkdown('[一](vbscript:msgbox(1)) [二](file:///etc/passwd)')

    expect(html).not.toContain('vbscript:')
    expect(html).not.toContain('file:')
  })

  it('协议里夹控制字符的变形被拦截', async () => {
    const { html } = await renderMarkdown('[点我](<java\tscript:alert(1)>)')

    expect(html.toLowerCase()).not.toContain('javascript:')
  })

  it('正常 https 链接保留并转义查询参数', async () => {
    const { html } = await renderMarkdown('[外站](https://example.com/a?b=1&c=2)')

    expect(html).toContain('href="https://example.com/a?b=1&amp;c=2"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('站内相对链接与锚点保留', async () => {
    const { html } = await renderMarkdown('[站内](/posts/a) [锚点](#section)')

    expect(html).toContain('href="/posts/a"')
    expect(html).toContain('href="#section"')
  })
})

describe('图片协议', () => {
  it('data: 图片被丢弃', async () => {
    const { html } = await renderMarkdown('![图](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)')

    expect(html).not.toContain('<img')
    expect(html).not.toContain('data:image')
  })

  it('javascript: 图片被丢弃', async () => {
    const { html } = await renderMarkdown('![图](javascript:alert(1))')

    expect(html).not.toContain('<img')
  })

  it('https 图片保留', async () => {
    const { html } = await renderMarkdown('![图](https://example.com/a.png)')

    expect(html).toContain('<img src="https://example.com/a.png"')
  })
})

describe('原始 HTML', () => {
  it('事件处理器属性被清除', async () => {
    const { html } = await renderMarkdown(
      '<img src="https://example.com/a.png" onerror="alert(1)">',
    )

    expect(html).not.toContain('onerror')
    expect(html).toContain('src="https://example.com/a.png"')
  })

  it('script 标签连同内容一起丢弃', async () => {
    const { html } = await renderMarkdown('<script>alert(1)</script>\n\n正文')

    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
    expect(html).toContain('正文')
  })

  it('带 src 的 script 不会留下外部引用', async () => {
    const { html } = await renderMarkdown('<script src="https://evil.example/x.js"></script>')

    expect(html).not.toContain('evil.example')
  })

  it('SVG 及其事件处理器被丢弃', async () => {
    const { html } = await renderMarkdown('<svg onload="alert(1)"><circle r="10" /></svg>')

    expect(html).not.toContain('<svg')
    expect(html).not.toContain('onload')
  })

  it('原始 HTML 里的 javascript: 链接被拦截', async () => {
    const { html } = await renderMarkdown('<a href="javascript:alert(1)">点我</a>')

    expect(html).not.toContain('javascript:')
    expect(html).toContain('点我')
  })

  it('iframe 的 javascript: 地址被拦截', async () => {
    const { html } = await renderMarkdown('<iframe src="javascript:alert(1)"></iframe>')

    expect(html).not.toContain('javascript:')
  })

  it('script / style / object / form 标签都不在允许列表内', async () => {
    const { html } = await renderMarkdown(
      '<style>body{display:none}</style>\n\n<object data="x.swf"></object>\n\n<form action="/steal"><input name="a"></form>',
    )

    expect(html).not.toContain('<style')
    expect(html).not.toContain('<object')
    expect(html).not.toContain('<form')
  })

  it('注释被移除（不显示、也不执行）', async () => {
    const { html } = await renderMarkdown('前<!-- 隐藏内容 -->后')

    expect(html).not.toContain('隐藏内容')
    expect(html).toContain('前')
    expect(html).toContain('后')
  })
})

describe('现有正文依赖的原始 HTML 仍然可用', () => {
  it('图标元素保留 class', async () => {
    const { html } = await renderMarkdown('<i class="ri-github-fill"></i> 跟随')

    expect(html).toContain('<i class="ri-github-fill"></i>')
  })

  it('跨段落的居中容器保持嵌套，不被补闭合标签', async () => {
    const { html } = await renderMarkdown('<div align="center">\n\n居中内容\n\n</div>')

    expect(html).toMatch(/<div align="center">\s*<p>居中内容<\/p>\s*<\/div>/)
  })

  it('details / summary 折叠块保留', async () => {
    const { html } = await renderMarkdown(
      '<details>\n\n<summary>展开</summary>\n\n里面的内容\n\n</details>',
    )

    expect(html).toContain('<details>')
    expect(html).toContain('<summary>展开</summary>')
  })

  it('白名单来源的 iframe 与按钮型 input 保留', async () => {
    const { html } = await renderMarkdown(
      '<iframe src="https://api.paugram.com/bili?bv=BV1" style="height: 10em; width: 100%"></iframe>\n\n<input type="button" value="点我">',
    )

    expect(html).toContain('<iframe src="https://api.paugram.com/bili?bv=BV1"')
    expect(html).toContain('style="height:10em;width:100%"')
    expect(html).toContain('value="点我"')
  })

  it('Mermaid 容器的 data 属性不被破坏', async () => {
    const { html } = await renderMarkdown('```mermaid\ngraph TD\nA-->B\n```')

    expect(html).toContain('class="mermaid-block"')
    expect(html).toContain('data-mermaid-src="')
    expect(html).toContain('graph TD')
  })

  it('内联样式保留（Shiki / KaTeX 与作者版式依赖）', async () => {
    const { html } = await renderMarkdown('<div style="width: 100px">块</div>')

    // 属性名小写、去掉冒号后的空白，语义不变
    expect(html).toContain('<div style="width:100px">块</div>')
  })
})

describe('清洗幂等', () => {
  it('没有系统 id 与 Mermaid 容器时，清洗两次结果一致', async () => {
    const { html } = await renderMarkdown('正文 $x^2$\n\n```ts\nconst a = 1\n```')

    expect(sanitizeRenderedHtml(html)).toBe(html)
  })

  it('带上本次渲染的上下文后清洗两次结果一致', async () => {
    const { html } = await renderMarkdown(
      '## 标题\n\n正文 $x^2$\n\n```mermaid\ngraph TD\nA-->B\n```',
    )
    const headingIds = new Set([...html.matchAll(/<h[1-6] id="([^"]*)"/g)].map((m) => m[1] ?? ''))
    const mermaidSources = new Set(
      [...html.matchAll(/data-mermaid-src="([^"]*)"/g)].map((m) => m[1] ?? ''),
    )

    expect(sanitizeRenderedHtml(html, { headingIds, mermaidSources })).toBe(html)
  })
})
