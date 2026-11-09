import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/content/markdown'

/** 脚注 id 里的随机令牌：`fn-<token>-1` / `fnref-<token>-1` */
function tokenOf(html: string): string {
  const match = /id="fn-([a-z0-9]{6})-\d+"/.exec(html)
  if (!match?.[1]) throw new Error(`没有脚注 id：${html}`)
  return match[1]
}

const wrap = (...lines: string[]): string => lines.join('\n')

describe('脚注：引用与编号', () => {
  it('数字标识符生成上标引用，文章末尾生成脚注列表', async () => {
    const { html } = await renderMarkdown(wrap('正文[^1]。', '', '[^1]: 脚注内容。'))
    const token = tokenOf(html)

    expect(html).toContain(`<sup class="footnote-ref" id="fnref-${token}-1">`)
    expect(html).toContain(`<a href="#fn-${token}-1" title="跳转到脚注 1">1</a>`)
    expect(html).toContain('<div class="footnotes">')
    expect(html).toContain(`<li class="footnote-item" id="fn-${token}-1">`)
    expect(html).toContain('<p>脚注内容。')
    expect(html).toContain(`href="#fnref-${token}-1"`)
  })

  it('文本标识符同样可用，显示编号与标识符无关', async () => {
    const { html } = await renderMarkdown(wrap('正文[^note]。', '', '[^note]: 文本脚注。'))

    expect(html).toContain('title="跳转到脚注 1">1</a>')
    expect(html).not.toContain('note</a>')
    expect(html).toContain('<p>文本脚注。')
  })

  it('编号按正文首次引用顺序，而不是定义顺序', async () => {
    const { html } = await renderMarkdown(
      wrap('先引用 [^b]，再引用 [^a]。', '', '[^a]: A 的定义。', '', '[^b]: B 的定义。'),
    )

    expect(html).toContain('title="跳转到脚注 1">1</a>')
    expect(html).toContain('title="跳转到脚注 2">2</a>')
    // 列表第一条是 b，第二条是 a
    const list = html.slice(html.indexOf('<ol class="footnotes__list">'))
    expect(list.indexOf('B 的定义')).toBeLessThan(list.indexOf('A 的定义'))
  })

  it('引用出现在定义之前也能解析', async () => {
    const { html } = await renderMarkdown(
      wrap('正文[^x]。', '', '中间段落。', '', '[^x]: 定义在最后。'),
    )

    expect(html).toContain('<p>定义在最后。')
    expect(html).toContain('title="跳转到脚注 1">1</a>')
  })

  it('同一标识符多次引用：只生成一条定义，每个引用有独立返回锚点', async () => {
    const { html } = await renderMarkdown(
      wrap('第一处[^src]，第二处[^src]，第三处[^src]。', '', '[^src]: 同一条脚注。'),
    )
    const token = tokenOf(html)

    // 只有一条脚注项
    expect(html.match(/class="footnote-item"/g)).toHaveLength(1)
    // 三个引用，编号都是 1
    expect(html.match(/title="跳转到脚注 1"/g)).toHaveLength(3)
    // 三个不同的返回锚点
    expect(html).toContain(`id="fnref-${token}-1"`)
    expect(html).toContain(`id="fnref-${token}-1-2"`)
    expect(html).toContain(`id="fnref-${token}-1-3"`)
    // 返回链接逐处对应
    expect(html).toContain(`href="#fnref-${token}-1"`)
    expect(html).toContain(`href="#fnref-${token}-1-2"`)
    expect(html).toContain(`href="#fnref-${token}-1-3"`)
    expect(html).toContain('返回到正文第 3 处引用')
  })

  it('多个脚注各自编号与返回锚点互不冲突', async () => {
    const { html } = await renderMarkdown(
      wrap('甲[^1] 乙[^2]。', '', '[^1]: 一。', '', '[^2]: 二。'),
    )
    const token = tokenOf(html)
    const ids = Array.from(html.matchAll(/id="([^"]+)"/g), (match) => match[1])

    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(`fn-${token}-1`)
    expect(ids).toContain(`fn-${token}-2`)
  })
})

describe('脚注：定义内容', () => {
  it('支持行内 Markdown', async () => {
    const { html } = await renderMarkdown(
      wrap('正文[^1]。', '', '[^1]: 含 **粗体**、*斜体*、`code` 与 [链接](https://example.test)。'),
    )

    expect(html).toContain('<strong>粗体</strong>')
    expect(html).toContain('<em>斜体</em>')
    expect(html).toContain('<code>code</code>')
    expect(html).toContain('<a href="https://example.test"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('支持多段落（空行 + 四格缩进）', async () => {
    const { html } = await renderMarkdown(
      wrap('正文[^1]。', '', '[^1]: 第一段。', '', '    第二段。'),
    )

    expect(html).toContain('<p>第一段。')
    expect(html).toContain('<p>第二段。')
  })

  it('支持列表与代码块，代码块走原有高亮流程', async () => {
    const { html } = await renderMarkdown(
      wrap(
        '正文[^1]。',
        '',
        '[^1]: 步骤如下：',
        '',
        '    - 一',
        '    - 二',
        '',
        '    ```js',
        '    const a = 1',
        '    ```',
      ),
    )

    expect(html).toContain('<ul>')
    expect(html).toContain('<li>一</li>')
    expect(html).toContain('<li>二</li>')
    // Shiki 会把 js 归一成 javascript，并按既有流程注入双主题变量
    expect(html).toContain('<pre data-lang="javascript" class="shiki')
  })

  it('定义里的行内公式照常渲染', async () => {
    const { html } = await renderMarkdown(wrap('正文[^1]。', '', '[^1]: 公式 $a^2+b^2$。'))

    expect(html).toContain('class="katex"')
  })

  it('定义里的第二段以列表结尾时，返回链接单独成段', async () => {
    const { html } = await renderMarkdown(
      wrap('正文[^1]。', '', '[^1]: 要点：', '', '    - 一', '    - 二'),
    )

    expect(html).toContain('<p class="footnote-item__back">')
    expect(html).toContain('class="footnote-backref"')
  })
})

describe('脚注：边界与策略', () => {
  it('未定义的引用保留原文，不静默吞掉正文', async () => {
    const { html } = await renderMarkdown(wrap('正文[^missing] 继续。'))

    expect(html).toContain('[^missing]')
    expect(html).not.toContain('footnotes')
  })

  it('未被引用的定义不进入脚注列表', async () => {
    const { html } = await renderMarkdown(
      wrap('正文[^1]。', '', '[^1]: 会被展示。', '', '[^ghost]: 不该出现。'),
    )

    expect(html).toContain('会被展示。')
    expect(html).not.toContain('不该出现')
    expect(html.match(/class="footnote-item"/g)).toHaveLength(1)
  })

  it('重复定义先到先得，后来的整条丢弃', async () => {
    const { html } = await renderMarkdown(
      wrap('正文[^dup]。', '', '[^dup]: 第一次。', '', '[^dup]: 第二次。'),
    )

    expect(html).toContain('第一次。')
    expect(html).not.toContain('第二次。')
    expect(html.match(/class="footnote-item"/g)).toHaveLength(1)
  })

  it('空定义仍生成条目，只是没有正文', async () => {
    const { html } = await renderMarkdown(wrap('正文[^empty]。', '', '[^empty]:'))
    const token = tokenOf(html)

    expect(html).toContain(`<li class="footnote-item" id="fn-${token}-1">`)
    expect(html).toContain('class="footnote-backref"')
  })

  it('空引用不是脚注，原样保留', async () => {
    const { html } = await renderMarkdown(wrap('正文[^] 与 [^ ] 结束。'))

    expect(html).toContain('[^]')
    expect(html).not.toContain('footnotes')
  })

  it('特殊字符标识符可用，且不进入 HTML id', async () => {
    const { html } = await renderMarkdown(
      wrap('正文[^a.b&c/d] 与 [^注-1]。', '', '[^a.b&c/d]: 特殊一。', '', '[^注-1]: 特殊二。'),
    )
    const token = tokenOf(html)

    expect(html).toContain('特殊一。')
    expect(html).toContain('特殊二。')
    expect(html).toContain(`id="fn-${token}-1"`)
    expect(html).not.toContain('id="a.b')
    expect(html).not.toContain('注-1"')
  })

  it('代码块与行内代码里的脚注标记不解析', async () => {
    const { html } = await renderMarkdown(
      wrap('```text', '正文[^1]', '```', '', '行内 `[^1]` 保持原样。', '', '[^1]: 只有定义。'),
    )

    expect(html).not.toContain('footnote-ref')
    expect(html).not.toContain('footnotes')
    expect(html).toContain('[^1]')
  })

  it('没有脚注的文章不生成空脚注区域', async () => {
    const { html } = await renderMarkdown(wrap('# 标题', '', '普通段落。'))

    expect(html).not.toContain('footnotes')
  })

  it('脚注列表不进入 TOC', async () => {
    const { html, toc } = await renderMarkdown(
      wrap('## 小节', '', '正文[^1]。', '', '[^1]: 内容。'),
    )

    expect(toc).toEqual([{ id: '小节', depth: 2, text: '小节' }])
    expect(html).not.toContain('footnotes__title" id=')
  })
})

describe('脚注：与其他扩展共存', () => {
  it('提示块里的引用照常编号', async () => {
    const { html } = await renderMarkdown(
      wrap('::: note', '提示里也有脚注[^n]。', ':::', '', '[^n]: 定义在容器外。'),
    )

    expect(html).toContain('md-callout--note')
    expect(html).toContain('title="跳转到脚注 1">1</a>')
    expect(html).toContain('<p>定义在容器外。')
  })

  it('与标题、相册、Spoiler 混排时互不影响', async () => {
    const { html } = await renderMarkdown(
      wrap(
        '## 标题',
        '',
        '::: gallery',
        '![图](https://a.test/1.webp)',
        ':::',
        '',
        '隐藏 ||秘密|| 与脚注[^1]。',
        '',
        '[^1]: 末条。',
      ),
    )

    expect(html).toContain('<h2 id="标题">')
    expect(html).toContain('md-gallery')
    expect(html).toContain('md-spoiler')
    expect(html).toContain('title="跳转到脚注 1">1</a>')
  })

  it('两次渲染互不共享状态：编号都从 1 开始，id 令牌不同', async () => {
    const [first, second] = await Promise.all([
      renderMarkdown(wrap('A 文[^1]。', '', '[^1]: A 的脚注。')),
      renderMarkdown(wrap('B 文[^x] 与 [^y]。', '', '[^x]: B1。', '', '[^y]: B2。')),
    ])

    expect(first.html).toContain('跳转到脚注 1')
    expect(second.html).toContain('跳转到脚注 1')
    expect(tokenOf(first.html)).not.toBe(tokenOf(second.html))
    expect(first.html).not.toContain('B1')
    expect(second.html).not.toContain('A 的脚注')
  })
})
