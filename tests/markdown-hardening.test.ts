import { describe, expect, it } from 'vitest'
import { renderInline, renderMarkdown } from '@/lib/content/markdown'

/** 渲染并取出正文 HTML */
async function html(markdown: string): Promise<string> {
  const { html: out } = await renderMarkdown(markdown)
  return out
}

describe('内联 CSS 白名单', () => {
  it('background-image / background 里的 url() 被丢弃', async () => {
    const out = await html(
      '<div style="background-image:url(https://evil.example/x.png)">A</div>\n\n<div style="background:url(https://evil.example/y.png)">B</div>',
    )

    expect(out).not.toContain('url(')
    expect(out).not.toContain('evil.example')
    expect(out).toContain('>A</div>')
    expect(out).toContain('>B</div>')
  })

  it('list-style-image / content / filter 里的 url() 被丢弃', async () => {
    const out = await html(
      '<ul style="list-style-image:url(https://evil.example/a.png)"><li>A</li></ul>\n\n<span style="content:url(https://evil.example/b.png)">B</span>\n\n<span style="filter:url(https://evil.example/c.svg)">C</span>',
    )

    expect(out).not.toContain('url(')
    expect(out).not.toContain('evil.example')
  })

  it('自定义属性也不能夹带 url()', async () => {
    const out = await html('<span style="--shiki-light:url(https://evil.example/a)">A</span>')

    expect(out).not.toContain('url(')
    expect(out).not.toContain('--shiki-light')
  })

  it('CSS 转义绕过被拦截', async () => {
    const out = await html('<div style="background:u\\72l(https://evil.example/x)">A</div>')

    expect(out).not.toContain('evil.example')
    expect(out).not.toContain('\\')
  })

  it('expression() 被拦截', async () => {
    const out = await html('<div style="width:expression(alert(1))">A</div>')

    expect(out).not.toContain('expression')
    expect(out).toContain('>A</div>')
  })

  it('fixed / sticky 定位与层级被拦截', async () => {
    const out = await html(
      '<div style="position:fixed;top:0;left:0;z-index:9999;width:100%;height:100%">遮罩</div>',
    )

    expect(out).not.toContain('position')
    expect(out).not.toContain('z-index')
    // 纯静态的尺寸声明保留（没有定位就无法覆盖页面）
    expect(out).toContain('width:100%;height:100%')
  })

  it('absolute 与 inset 被拦截', async () => {
    const out = await html(
      '<div style="position:absolute;inset:0;transform:translateY(-100%)">A</div>',
    )

    expect(out).not.toContain('position')
    expect(out).not.toContain('inset')
    expect(out).not.toContain('transform')
  })

  it('全部声明非法时连 style 属性一起移除', async () => {
    const out = await html('<div style="position:fixed;z-index:1">A</div>')

    expect(out).not.toContain('style=')
    expect(out).toContain('<div>A</div>')
  })

  it('KaTeX 需要的 position: relative 仍然保留', async () => {
    const out = await html('$\\sum_{i=0}^{n} i^2$')

    expect(out).toContain('position:relative')
  })

  it('作者版式所需的排版属性保留', async () => {
    const out = await html(
      '<div style="width:210px;border-color:Teal; text-align:center;font-weight:bold;color:Green;">居中</div>\n\n<div style="zoom:35%;">缩放</div>',
    )

    expect(out).toContain('width:210px')
    expect(out).toContain('border-color:Teal')
    expect(out).toContain('text-align:center')
    expect(out).toContain('font-weight:bold')
    expect(out).toContain('color:Green')
    expect(out).toContain('zoom:35%')
  })
})

describe('iframe 来源策略', () => {
  const allow = 'https://api.paugram.com/bili?bv=BV1'

  it('白名单来源保留并强制安全属性', async () => {
    const out = await html(`<iframe src="${allow}"></iframe>`)

    expect(out).toContain(`<iframe src="${allow}"`)
    expect(out).toContain('sandbox="allow-popups allow-popups-to-escape-sandbox"')
    expect(out).toContain('referrerpolicy="no-referrer"')
    expect(out).toContain('loading="lazy"')
  })

  it.each([
    ['未登记域名', 'https://evil.example/embed'],
    ['http 协议', 'http://api.paugram.com/bili?bv=BV1'],
    ['子域伪装', 'https://sub.api.paugram.com/bili?bv=BV1'],
    ['域名后缀伪装', 'https://api.paugram.com.evil.example/bili'],
    ['协议相对地址', '//api.paugram.com/bili?bv=BV1'],
    ['相对路径', '/embed'],
  ])('%s 的 iframe 被整个丢弃', async (_label, src) => {
    const out = await html(`<iframe src="${src}"></iframe>`)

    expect(out).not.toContain('<iframe')
  })

  it('作者无法用属性放宽 sandbox', async () => {
    const out = await html(
      `<iframe src="${allow}" sandbox="allow-scripts allow-same-origin allow-top-navigation" allow="camera; microphone" referrerpolicy="unsafe-url"></iframe>`,
    )

    expect(out).toContain('sandbox="allow-popups allow-popups-to-escape-sandbox"')
    expect(out).not.toContain('allow-scripts')
    expect(out).not.toContain('allow-same-origin')
    expect(out).not.toContain('allow-top-navigation')
    expect(out).not.toContain('camera')
    expect(out).toContain('referrerpolicy="no-referrer"')
    expect(out).not.toContain('unsafe-url')
  })

  it('srcdoc 与 allowfullscreen 被丢弃', async () => {
    const out = await html(
      `<iframe src="${allow}" srcdoc="<script>alert(1)</script>" allowfullscreen></iframe>`,
    )

    expect(out).not.toContain('srcdoc')
    expect(out).not.toContain('allowfullscreen')
    expect(out).not.toContain('<script')
  })

  it('属性里的样式仍然过 CSS 白名单', async () => {
    const out = await html(
      `<iframe src="${allow}" style="height:10em;width:100%;position:fixed"></iframe>`,
    )

    expect(out).toContain('style="height:10em;width:100%"')
    expect(out).not.toContain('position')
  })
})

describe('Mermaid 容器信任边界', () => {
  it('正常围栏代码块产出可信容器', async () => {
    const out = await html('```mermaid\ngraph TD\nA-->B\n```')

    expect(out).toContain('class="mermaid-block"')
    expect(out).toContain('data-mermaid-src="')
    expect(out).toContain('graph TD')
  })

  it('作者手写同结构 HTML 不被信任', async () => {
    const forged = Buffer.from('graph TD\nA-->X', 'utf8').toString('base64')
    const out = await html(`<div class="mermaid-block" data-mermaid-src="${forged}">伪造</div>`)

    expect(out).not.toContain('data-mermaid-src')
    expect(out).not.toContain('mermaid-block')
    expect(out).toContain('伪造')
  })

  it('真实围栏与伪造容器混排时只保留真实的那一个', async () => {
    const forged = Buffer.from('graph TD\nA-->X', 'utf8').toString('base64')
    const out = await html(
      `<div class="mermaid-block" data-mermaid-src="${forged}">伪造</div>\n\n\`\`\`mermaid\ngraph TD\nA-->B\n\`\`\``,
    )

    expect([...out.matchAll(/data-mermaid-src="/g)]).toHaveLength(1)
    expect(out).toContain(Buffer.from('graph TD\nA-->B', 'utf8').toString('base64'))
    expect(out).not.toContain(forged)
  })

  it('空源码与非法 base64 不影响其它内容', async () => {
    const out = await html('<div class="mermaid-block" data-mermaid-src="">A</div>')

    expect(out).not.toContain('mermaid-block')
    expect(out).toContain('A')
  })
})

describe('data-* 精确允许列表', () => {
  it('未登记的 data 属性被移除', async () => {
    const out = await html('<div data-foo="1" data-track="x" aria-hidden="true">A</div>')

    expect(out).not.toContain('data-foo')
    expect(out).not.toContain('data-track')
    expect(out).not.toContain('aria-hidden')
    expect(out).toContain('>A</div>')
  })

  it('代码块语言标记保留', async () => {
    const out = await html('```ts\nconst a = 1\n```')

    // Shiki 会把 ts 归一成 typescript
    expect(out).toContain('data-lang="typescript"')
  })

  it('作者手写的 data-lang 只能出现在 pre 上', async () => {
    const out = await html('<div data-lang="ts">A</div>\n\n<span data-lang="ts">B</span>')

    expect(out).not.toContain('data-lang')
  })
})

describe('作者 HTML 的 id 边界', () => {
  it('作者仓储与非标题元素的 id 被移除', async () => {
    const out = await html('<div id="main">A</div>\n\n<span id="anchor">B</span>')

    expect(out).not.toContain('id="main"')
    expect(out).not.toContain('id="anchor"')
  })

  it('作者手写标题 id 不在系统集合内，被移除', async () => {
    const out = await html('## 真标题\n\n<h2 id="evil">假标题</h2>')

    expect(out).not.toContain('id="evil"')
    expect([...out.matchAll(/<h2 id="/g)]).toHaveLength(1)
  })

  it('重复使用系统 id 会被去重', async () => {
    const { html: out, toc } = await renderMarkdown(
      '## Intro\n\n正文\n\n<h2 id="Intro">又一遍</h2>',
    )
    const generated = toc[0]?.id ?? 'intro'

    expect(toc).toHaveLength(1)
    expect([...out.matchAll(new RegExp(`id="${generated}"`, 'g'))]).toHaveLength(1)
    expect(out).toContain(`href="#${generated}"`)
  })

  it('标题锚点与 TOC 一一对应', async () => {
    const { html: out, toc } = await renderMarkdown('## 一\n\n### 二\n\n#### 三\n\n## 一')

    expect(toc.map((item) => item.id)).toEqual(['一', '二', '一-1'])
    for (const item of toc) {
      expect(out).toContain(`id="${item.id}"`)
    }
    // h4 不进 TOC，但锚点仍然保留
    expect(out).toContain('id="三"')
  })
})

describe('renderInline 的边界', () => {
  it('行内原始 HTML 与图片被丢弃，文本保留', async () => {
    const out = renderInline('前<b onclick="alert(1)">粗</b>后 ![图](https://example.com/a.png)')

    expect(out).not.toContain('onclick')
    expect(out).not.toContain('<img')
    expect(out).toContain('前')
    expect(out).toContain('后')
  })

  it('行内公式保留 KaTeX 结构', () => {
    const out = renderInline('值 $x^2$')

    expect(out).toContain('class="katex"')
    expect(out).toContain('style="')
  })

  it('行内链接仍然过滤协议', () => {
    const out = renderInline('[点我](javascript:alert(1))')

    expect(out).not.toContain('javascript:')
    expect(out).toContain('点我')
  })
})

describe('Shiki 高亮回归', () => {
  it('双主题变量保留（浅色 / 深色各一套）', async () => {
    const out = await html('```ts\nconst a: number = 1 // 注释\n```')

    expect(out).toContain('class="shiki')
    expect(out).toContain('--shiki-light:#')
    expect(out).toContain('--shiki-dark:#')
    expect(out).toContain('--shiki-light-bg:#')
    expect(out).toContain('--shiki-dark-bg:#')
  })

  it('token 级变量与可聚焦标记保留', async () => {
    const out = await html('```ts\nconst a = 1\n```')

    expect(out).toContain('<span style="--shiki-light:')
    expect(out).toContain('tabindex="0"')
  })

  it('diff 背景与删除标记不依赖外部资源', async () => {
    const out = await html('```diff\n- a\n+ b\n```')

    expect(out).toContain('--shiki-light-bg:')
    expect(out).toContain('--shiki-dark-bg:')
    expect(out).not.toContain('url(')
  })
})

describe('KaTeX 回归', () => {
  it('行内公式的 strut 高度与垂直对齐保留', async () => {
    const out = await html('$\\frac{a}{b} + \\sqrt{x}$')

    expect(out).toContain('class="katex"')
    expect(out).toContain('height:')
    expect(out).toContain('vertical-align:')
    // 根号的左侧留白与最小宽度
    expect(out).toContain('padding-left:')
    expect(out).toContain('min-width:')
  })

  it('块级公式的居中容器与间距保留', async () => {
    const out = await html('$$\\begin{aligned} f(x) &= x^2 \\\\ g(x) &= x \\end{aligned}$$')

    expect(out).toContain('class="katex-display"')
    expect(out).toContain('margin-right:')
  })

  it('矩阵与表格线保留', async () => {
    const out = await html('$\\begin{array}{c|c}a&b\\\\\\hline c&d\\end{array}$')

    expect(out).toContain('<span class="mtable">')
    expect(out).toContain('border-right-style:')
    expect(out).toContain('border-bottom-width:')
  })
})
