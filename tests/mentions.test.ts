import { describe, expect, it } from 'vitest'
import { renderInline, renderMarkdown } from '@/lib/content/markdown'

/** 取出 HTML 里所有 href，便于断言「指向了哪几个地址」 */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)]
    .map((match) => match[1])
    .filter((href): href is string => Boolean(href))
}

/** 提及链接的 href（只取带 md-mention 类名的 <a>） */
function mentionHrefsOf(html: string): string[] {
  return [...html.matchAll(/<a class="md-mention[^"]*" href="([^"]*)"/g)]
    .map((match) => match[1])
    .filter((href): href is string => Boolean(href))
}

describe('提及：平台与链接', () => {
  it('GitHub 提及渲染为真实外链，且不被拆开', async () => {
    const { html } = await renderMarkdown('联系 {GH@Innei} 谢谢。')

    expect(html).toContain(
      '<p>联系 <a class="md-mention md-mention--gh" href="https://github.com/Innei" target="_blank" rel="noopener noreferrer">Innei</a> 谢谢。</p>',
    )
  })

  it('Twitter / X 提及指向 twitter.com', async () => {
    const { html } = await renderMarkdown('{TW@Innei}')

    expect(html).toContain('class="md-mention md-mention--tw"')
    expect(html).toContain('href="https://twitter.com/Innei"')
    expect(html).toContain('>Innei</a>')
  })

  it('Telegram 提及指向 t.me', async () => {
    const { html } = await renderMarkdown('{TG@Innei}')

    expect(html).toContain('class="md-mention md-mention--tg"')
    expect(html).toContain('href="https://t.me/Innei"')
    expect(html).toContain('>Innei</a>')
  })

  it('三种平台混排时各自独立解析', async () => {
    const { html } = await renderMarkdown('{GH@Innei} {TW@Innei} {TG@Innei}')

    expect(mentionHrefsOf(html)).toEqual([
      'https://github.com/Innei',
      'https://twitter.com/Innei',
      'https://t.me/Innei',
    ])
  })

  it('同一平台的多个账号不会互相吞并', async () => {
    const { html } = await renderMarkdown('{GH@Innei} 和 {GH@mx-space}')

    expect(mentionHrefsOf(html)).toEqual([
      'https://github.com/Innei',
      'https://github.com/mx-space',
    ])
    expect(html).toContain('>mx-space</a>')
  })

  it('用户名大小写按作者写法保留', async () => {
    const { html } = await renderMarkdown('{TW@INNEI}')

    expect(html).toContain('href="https://twitter.com/INNEI"')
    expect(html).toContain('>INNEI</a>')
  })

  it('中文正文里的提及照常解析，前后文字不被吞掉', async () => {
    const { html } = await renderMarkdown('感谢 {GH@Innei} 对本站的长期维护。')

    expect(html).toContain('<p>感谢 <a class="md-mention')
    expect(html).toContain('对本站的长期维护。</p>')
  })

  it('紧跟标点时只吞掉花括号范围', async () => {
    const { html } = await renderMarkdown('作者是 {GH@Innei}，欢迎关注。')

    expect(html).toContain('>Innei</a>，欢迎关注。')
  })

  it('GitHub 用户名允许连字符（Kami 的 \\w+ 不接受，这里有意放宽）', async () => {
    const { html } = await renderMarkdown('{GH@some-user}')

    expect(html).toContain('href="https://github.com/some-user"')
  })
})

describe('提及：不解析的输入', () => {
  it('未知平台保持原文', async () => {
    const { html } = await renderMarkdown('{XX@Innei}')

    expect(html).toContain('{XX@Innei}')
    expect(html).not.toContain('md-mention')
  })

  it('小写平台标识符保持原文（Kami 只认大写）', async () => {
    const { html } = await renderMarkdown('{gh@Innei} 与 {tg@Innei}')

    expect(html).toContain('{gh@Innei} 与 {tg@Innei}')
    expect(html).not.toContain('md-mention')
  })

  it('空用户名保持原文', async () => {
    const { html } = await renderMarkdown('{GH@} 与 {GH@ }')

    expect(html).toContain('{GH@} 与 {GH@ }')
    expect(html).not.toContain('md-mention')
  })

  it('缺少右花括号时保持原文', async () => {
    const { html } = await renderMarkdown('{GH@Innei 没有闭合')

    expect(html).toContain('{GH@Innei 没有闭合')
    expect(html).not.toContain('md-mention')
  })

  it('多出来的右花括号留在正文里', async () => {
    const { html } = await renderMarkdown('{GH@Innei}} 收尾')

    expect(mentionHrefsOf(html)).toEqual(['https://github.com/Innei'])
    expect(html).toContain('>Innei</a>} 收尾')
  })

  it('用户名含平台不允许的字符时保持原文', async () => {
    const { html } = await renderMarkdown('{TW@some-user} 与 {GH@-x} 与 {GH@x_}')

    expect(html).not.toContain('md-mention')
    expect(html).toContain('{TW@some-user} 与 {GH@-x} 与 {GH@x_}')
  })

  it('行内代码里的提及不解析', async () => {
    const { html } = await renderMarkdown('写法是 `{GH@Innei}` 这样。')

    expect(html).toContain('<code>{GH@Innei}</code>')
    expect(html).not.toContain('md-mention')
  })

  it('围栏代码里的提及不解析', async () => {
    const { html } = await renderMarkdown('```text\n{GH@Innei}\n```')

    expect(html).toContain('<pre data-lang="text"')
    expect(html).toContain('{GH@Innei}')
    expect(html).not.toContain('md-mention')
  })

  it('转义后的花括号保持文字', async () => {
    const { html } = await renderMarkdown('\\{GH@Innei\\}')

    expect(html).toContain('{GH@Innei}')
    expect(html).not.toContain('md-mention')
  })

  it('链接文字里不生成嵌套提及链接', async () => {
    const { html } = await renderMarkdown('[看 {GH@Innei}](https://example.test)')

    expect(html).toContain('href="https://example.test"')
    expect(html).toContain('看 {GH@Innei}</a>')
    expect(html).not.toContain('md-mention')
  })
})

describe('提及：与现有能力共存', () => {
  it('提示块内正常工作', async () => {
    const { html } = await renderMarkdown('::: note\n提示 {GH@Innei}\n:::')

    expect(html).toContain('md-callout--note')
    expect(html).toContain('href="https://github.com/Innei"')
  })

  it('横幅的参数花括号不会被误判成提及', async () => {
    const { html } = await renderMarkdown('::: banner{info}\n横幅 {TW@Innei}\n:::')

    expect(html).toContain('md-banner--info')
    expect(html).toContain('href="https://twitter.com/Innei"')
  })

  it('折叠块内正常工作', async () => {
    const { html } = await renderMarkdown('隐藏 ||{TG@Innei}|| 内容')

    expect(html).toContain('md-spoiler')
    expect(html).toContain('href="https://t.me/Innei"')
  })

  it('表格单元格内正常工作', async () => {
    const { html } = await renderMarkdown('| 平台 | 账号 |\n| --- | --- |\n| GH | {GH@Innei} |')

    expect(html).toContain('<td><a class="md-mention md-mention--gh"')
  })

  it('标题里的提及成为链接，TOC 文本只取用户名', async () => {
    const { html, toc } = await renderMarkdown('## 关于 {GH@Innei}')

    expect(html).toContain('id="关于innei"')
    expect(html).toContain('href="https://github.com/Innei"')
    expect(toc).toEqual([{ id: '关于innei', text: '关于 Innei', depth: 2 }])
  })

  it('脚注定义内容里的提及正常工作', async () => {
    const { html } = await renderMarkdown('正文[^1]。\n\n[^1]: 作者 {GH@Innei}。')

    expect(html).toContain('class="footnote-item"')
    expect(html).toContain('href="https://github.com/Innei"')
    expect(html).toContain('class="footnote-backref"')
  })

  it('renderInline 也解析提及并保留样式类', () => {
    const html = renderInline('你好 {GH@Innei}')

    expect(html).toContain('class="md-mention md-mention--gh"')
    expect(html).toContain('href="https://github.com/Innei"')
    expect(html).toContain('>Innei</a>')
  })

  it('renderInline 里不合法的标记同样保持原文', () => {
    expect(renderInline('{XX@Innei}')).toBe('{XX@Innei}')
  })
})

describe('提及：每次渲染独立', () => {
  it('两次渲染产出的链接互不影响', async () => {
    const first = await renderMarkdown('{GH@Innei}')
    const second = await renderMarkdown('{TW@Innei}')

    expect(hrefsOf(first.html)).toContain('https://github.com/Innei')
    expect(hrefsOf(second.html)).toEqual(['https://twitter.com/Innei'])
    expect(second.html).not.toContain('md-mention--gh')
  })
})
