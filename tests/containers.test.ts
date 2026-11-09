import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/content/markdown'
import { sanitizeRenderedHtml } from '@/lib/content/sanitize'

const wrap = (...lines: string[]): string => lines.join('\n')

describe('提示块（Callout）', () => {
  it('六种类型都能产出对应容器与默认标题', async () => {
    for (const type of ['info', 'warning', 'error', 'danger', 'success', 'note']) {
      const { html } = await renderMarkdown(wrap(`::: ${type}`, '正文', ':::'))
      expect(html).toContain(`class="md-callout md-callout--${type}"`)
      expect(html).toContain('class="md-callout__title"')
      expect(html).toContain('<p>正文</p>')
    }
  })

  it('支持自定义标题，标题文本被转义', async () => {
    const { html } = await renderMarkdown(wrap('::: warning 备份 <script> 已过期', '正文', ':::'))

    expect(html).toContain('备份 &lt;script&gt; 已过期')
    expect(html).not.toContain('<script>')
  })

  it('容器内部按块级 Markdown 渲染：列表、代码、公式、行内标记', async () => {
    const { html } = await renderMarkdown(
      wrap(
        '::: note',
        '- 项目一',
        '- 项目二',
        '',
        '```text',
        'const a = 1 < 2',
        '```',
        '',
        '行内 `code` 与 $a+b$',
        ':::',
      ),
    )

    expect(html).toContain('<ul>')
    expect(html).toContain('<li>项目一</li>')
    expect(html).toContain('<pre data-lang="text">')
    expect(html).toContain('const a = 1 &lt; 2')
    expect(html).toContain('class="katex"')
  })

  it('空容器保留结构但不报错', async () => {
    const { html } = await renderMarkdown(wrap('::: info', ':::'))

    expect(html).toContain('md-callout md-callout--info')
    expect(html).toContain('class="md-callout__body"></div>')
  })

  it('未知类型不消费容器，原文按普通文本输出', async () => {
    const { html } = await renderMarkdown(wrap('::: mystery', '正文', ':::'))

    expect(html).not.toContain('md-callout')
    expect(html).toContain('::: mystery')
    expect(html).toContain('正文')
  })

  it('未闭合容器不吞掉后续内容', async () => {
    const { html } = await renderMarkdown(wrap('::: info', '正文段落', '', '后面的段落'))

    expect(html).not.toContain('md-callout')
    // 起手行退化成普通文本，但两段正文都还在
    expect(html).toContain('正文段落')
    expect(html).toContain('<p>后面的段落</p>')
  })

  it('容器可以嵌套，闭合位置按深度配对', async () => {
    const { html } = await renderMarkdown(
      wrap('::: info', '外层', '', '::: warning', '内层', ':::', '', '外层结束', ':::'),
    )

    expect(html).toContain('md-callout--info')
    expect(html).toContain('md-callout--warning')
    // 外层内容里应包含「外层结束」，说明没有被内层的闭合行截断
    expect(html).toContain('外层结束')
    expect((html.match(/md-callout--info/g) ?? []).length).toBe(1)
  })

  it('与别的块级语法混排：标题、列表、引用、表格', async () => {
    const { html } = await renderMarkdown(
      wrap(
        '## 标题',
        '',
        '::: success',
        '> 引用',
        '',
        '| a | b |',
        '| --- | --- |',
        '| 1 | 2 |',
        ':::',
        '',
        '尾部段落',
      ),
    )

    expect(html).toContain('<h2 id="标题">')
    expect(html).toContain('<blockquote>')
    expect(html).toContain('<table>')
    expect(html).toContain('<p>尾部段落</p>')
  })

  it('容器内的标题照常进入 TOC', async () => {
    const { html, toc } = await renderMarkdown(wrap('::: info', '### 小节', ':::'))

    expect(html).toContain('<h3 id="小节">')
    expect(toc).toEqual([{ id: '小节', depth: 3, text: '小节' }])
  })

  it('容器内可以嵌相册', async () => {
    const { html } = await renderMarkdown(
      wrap('::: note', '', '::: gallery', '![图一](https://a.test/1.webp)', ':::', '', ':::', ''),
    )

    expect(html).toContain('md-callout--note')
    expect(html).toContain('md-gallery__track')
  })
})

describe('横幅（Banner）', () => {
  it('brace 形式产出 aside，与 callout 结构不同', async () => {
    const { html } = await renderMarkdown(wrap('::: banner{info}', '通栏提示', ':::'))

    expect(html).toContain('<aside class="md-banner md-banner--info">')
    expect(html).toContain('class="md-banner__body"')
    expect(html).not.toContain('md-callout__title')
    expect(html).toContain('<p>通栏提示</p>')
  })

  it('兼容 type= 写法与多余空白', async () => {
    const { html } = await renderMarkdown(wrap('::: banner{ type = warning }', '正文', ':::'))

    expect(html).toContain('md-banner--warning')
  })

  it('未知横幅类型不产出横幅', async () => {
    const { html } = await renderMarkdown(wrap('::: banner{rainbow}', '正文', ':::'))

    expect(html).not.toContain('md-banner')
    expect(html).toContain('正文')
  })

  it('缺少 brace 的 banner 不作为横幅', async () => {
    const { html } = await renderMarkdown(wrap('::: banner', '正文', ':::'))

    expect(html).not.toContain('md-banner')
  })
})

describe('折叠块（Details / Summary）', () => {
  it('`::: details` 产出原生 details 结构，内部渲染 Markdown', async () => {
    const { html } = await renderMarkdown(wrap('::: details 点击展开', '- 一', '- 二', ':::'))

    expect(html).toContain('<details class="md-details">')
    expect(html).toContain('<summary class="md-details__summary">点击展开</summary>')
    expect(html).toContain('<li>一</li>')
    expect(html).not.toContain('open')
  })

  it('省略概要时回落到默认文案', async () => {
    const { html } = await renderMarkdown(wrap('::: details', '内容', ':::'))

    expect(html).toContain('>详情</summary>')
  })

  it('手写 HTML details 保留 open，且事件属性被清除', async () => {
    const { html } = await renderMarkdown(
      wrap(
        '<details open onclick="alert(1)">',
        '<summary onmouseover="alert(2)">概要</summary>',
        '<p>内容</p>',
        '</details>',
      ),
    )

    expect(html).toContain('<details open>')
    expect(html).toContain('<summary>概要</summary>')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('onmouseover')
  })
})

describe('GitHub Alerts', () => {
  const samples = [
    ['NOTE', 'note'],
    ['TIP', 'tip'],
    ['IMPORTANT', 'important'],
    ['WARNING', 'warning'],
    ['CAUTION', 'caution'],
  ] as const

  it('五种类型都能转换成提示块，标题各不相同', async () => {
    const labels = new Set<string>()

    for (const [marker, type] of samples) {
      const { html } = await renderMarkdown(wrap(`> [!${marker}]`, '> 正文'))

      expect(html).toContain(`md-callout--${type}`)
      expect(html).toContain('<p>正文</p>')
      const label = /class="md-callout__title">(.+?)<\/p>/.exec(html)?.[1] ?? ''
      expect(label).not.toBe('')
      labels.add(label)
    }

    expect(labels.size).toBe(samples.length)
  })

  it('大小写不敏感', async () => {
    const { html } = await renderMarkdown(wrap('> [!warning]', '> 正文'))

    expect(html).toContain('md-callout--warning')
  })

  it('内部保留嵌套列表、代码块与引用', async () => {
    const { html } = await renderMarkdown(
      wrap(
        '> [!TIP]',
        '> - 一',
        '>   - 嵌套',
        '>',
        '> ```text',
        '> code',
        '> ```',
        '>',
        '> > 二级引用',
      ),
    )

    expect(html).toContain('md-callout--tip')
    expect(html).toContain('<ul>')
    expect(html).toContain('嵌套')
    expect(html).toContain('<pre data-lang="text">')
    expect(html).toContain('<blockquote>')
  })

  it('普通 blockquote 不受影响', async () => {
    const { html } = await renderMarkdown(wrap('> 普通引用', '> 第二行'))

    expect(html).toContain('<blockquote>')
    expect(html).not.toContain('md-callout')
  })

  it('marker 不在首行 / 类型未知时按普通引用处理', async () => {
    const inline = await renderMarkdown(wrap('> 前缀', '> [!NOTE]'))
    expect(inline.html).not.toContain('md-callout')

    const unknown = await renderMarkdown(wrap('> [!UNKNOWN]', '> 正文'))
    expect(unknown.html).not.toContain('md-callout')
    expect(unknown.html).toContain('<blockquote>')
  })

  it('标记行之后立刻结束（空内容）不报错', async () => {
    const { html } = await renderMarkdown('> [!NOTE]')

    expect(html).toContain('md-callout--note')
    expect(html).toContain('class="md-callout__body"></div>')
  })
})

describe('容器与提示的安全边界', () => {
  it('作者手写提示结构时属性被清洗（只剩排版用的 class）', async () => {
    const { html } = await renderMarkdown(
      [
        '<div class="md-callout md-callout--danger" style="background:url(javascript:alert(1))" data-x="1" onclick="alert(2)">',
        '<p class="md-callout__title">伪造标题</p>',
        '<p>内容</p>',
        '</div>',
      ].join('\n'),
    )

    expect(html).toContain('class="md-callout md-callout--danger"')
    expect(html).not.toContain('style=')
    expect(html).not.toContain('data-x')
    expect(html).not.toContain('onclick')
  })

  it('aside 只保留全局允许的属性', async () => {
    const { html } = await renderMarkdown(
      '<aside class="md-banner md-banner--info" onmouseover="alert(1)" aria-hidden="true" id="b1">x</aside>',
    )

    expect(html).toContain('<aside class="md-banner md-banner--info">')
    expect(html).not.toContain('onmouseover')
    expect(html).not.toContain('aria-hidden')
    expect(html).not.toContain('id="b1"')
  })

  it('标题与提示内容里的危险 URL 被拦下', async () => {
    const { html } = await renderMarkdown(
      [
        '::: warning [危险](javascript:alert(1))',
        '::: banner{info}',
        '![x](javascript:alert(2))',
        ':::',
      ].join('\n'),
    )

    expect(html).not.toContain('javascript:')
  })

  it('清洗幂等：对已清洗的提示 HTML 再跑一次结果不变', async () => {
    const { html } = await renderMarkdown(
      [
        '::: info 标题',
        '正文 ++新增++ 与 ||隐藏||',
        '',
        '> [!WARNING]',
        '> 引用提示',
        ':::',
        '',
        '::: details 概要',
        '折叠',
        ':::',
        '',
        '::: banner{success}',
        '横幅',
        ':::',
      ].join('\n'),
    )

    expect(sanitizeRenderedHtml(html)).toBe(html)
  })
})
