import { describe, expect, it } from 'vitest'
import { pickGalleryImages, selectGalleryImages } from '@/lib/content/gallery'
import { renderMarkdown } from '@/lib/content/markdown'

const gallery = (body: string, variant = 'gallery'): string =>
  [`::: ${variant}`, body, ':::'].join('\n')

describe('独立行图片解析', () => {
  it('识别整行 Markdown 图片并保留 alt / src / title', () => {
    expect(pickGalleryImages('![图片一](1.webp "标题")')).toEqual([
      { src: '1.webp', alt: '图片一', title: '标题' },
    ])
  })

  it('忽略空行与说明文字，只保留图片', () => {
    const images = pickGalleryImages('说明文字\n\n![一](1.webp)\n再来一行\n![二](2.webp)')

    expect(images.map((image) => image.src)).toEqual(['1.webp', '2.webp'])
  })

  it('裸 URL 不算图片', () => {
    expect(pickGalleryImages('https://example.com/a.webp')).toEqual([])
  })

  it('HTML 图片不算图片', () => {
    expect(pickGalleryImages('<img src="a.webp" alt="x">')).toEqual([])
  })

  it('行内图片与行尾带文字的图片都不算独立行', () => {
    expect(pickGalleryImages('文字 ![一](1.webp) 继续')).toEqual([])
    expect(pickGalleryImages('![一](1.webp) 说明')).toEqual([])
  })

  it('带空格的 alt 与一层括号的 URL 正常解析', () => {
    expect(pickGalleryImages('![网络 拓扑](https://example.com/a(1).webp)')).toEqual([
      { src: 'https://example.com/a(1).webp', alt: '网络 拓扑' },
    ])
  })

  it('非法协议在提取阶段就被丢弃', () => {
    expect(selectGalleryImages('![一](javascript:alert(1))')).toEqual([])
    expect(selectGalleryImages('![一](data:image/png;base64,AAAA)')).toEqual([])
  })
})

describe('相册容器渲染', () => {
  it('renderMarkdown 产出受信任的相册容器', async () => {
    const { html } = await renderMarkdown(gallery('![一](/a.webp)\n![二](/b.webp)\n![三](/c.webp)'))

    expect(html).toContain('class="md-gallery md-gallery--gallery"')
    expect(html).toContain('data-gallery-id="g1"')
    expect(html.match(/<li class="md-gallery__item">/g)).toHaveLength(3)
    expect(html.indexOf('/a.webp')).toBeLessThan(html.indexOf('/b.webp'))
    expect(html).toContain('alt="二"')
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('decoding="async"')
  })

  it('carousel 与 gallery 共用同一套结构，只换容器修饰类', async () => {
    const { html } = await renderMarkdown(gallery('![一](/a.webp)', 'carousel'))

    expect(html).toContain('md-gallery--carousel')
    expect(html).toContain('class="md-gallery__track"')
    expect(html).toContain('/a.webp')
  })

  it('单张图片的相册仍然产出容器', async () => {
    const { html } = await renderMarkdown(gallery('![唯一](/only.webp)'))

    expect(html).toContain('md-gallery')
    expect(html.match(/md-gallery__item/g)).toHaveLength(1)
  })

  it('空相册不产出容器，也不留空壳', async () => {
    const { html } = await renderMarkdown(gallery(''))

    expect(html).not.toContain('md-gallery')
    expect(html.trim()).toBe('')
  })

  it('只有说明文字没有图片时按普通 Markdown 渲染', async () => {
    const { html } = await renderMarkdown(gallery('这里只有文字\n\n没有图片'))

    expect(html).not.toContain('md-gallery')
    expect(html).toContain('这里只有文字')
    expect(html).toContain('没有图片')
  })

  it('相册内的非图片文字被忽略，图片顺序不受影响', async () => {
    const { html } = await renderMarkdown(
      gallery('第一张\n\n![一](/a.webp)\n\n中间说明\n\n![二](/b.webp)'),
    )

    expect(html.match(/md-gallery__item/g)).toHaveLength(2)
    expect(html).not.toContain('中间说明')
    expect(html.indexOf('/a.webp')).toBeLessThan(html.indexOf('/b.webp'))
  })

  it('全部图片非法时整段降级为普通渲染', async () => {
    const { html } = await renderMarkdown(gallery('![一](javascript:alert(1))'))

    expect(html).not.toContain('md-gallery')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('javascript:')
  })

  it('多个相册各自独立，id 不重复', async () => {
    const { html } = await renderMarkdown(
      [gallery('![一](/a.webp)'), '中间段落', gallery('![二](/b.webp)', 'carousel')].join('\n\n'),
    )

    expect(html).toContain('data-gallery-id="g1"')
    expect(html).toContain('data-gallery-id="g2"')
    expect(html).toContain('md-gallery--gallery')
    expect(html).toContain('md-gallery--carousel')
  })

  it('未闭合容器不会吞掉后文', async () => {
    const { html } = await renderMarkdown(
      ['::: gallery', '![一](/a.webp)', '后面的段落'].join('\n'),
    )

    expect(html).not.toContain('data-gallery-id')
    expect(html).toContain('后面的段落')
    expect(html).toContain('/a.webp')
  })

  it('相册与标题、段落、代码块混排时互不影响', async () => {
    const source = [
      '## 标题',
      '',
      '前置段落。',
      '',
      gallery('![一](/a.webp)'),
      '',
      '后置段落。',
    ].join('\n')

    const { html, toc } = await renderMarkdown(source)

    expect(toc.map((item) => item.text)).toEqual(['标题'])
    expect(html).toContain('<h2 id="标题">')
    expect(html).toContain('前置段落。')
    expect(html).toContain('后置段落。')
    expect(html).toContain('md-gallery')
  })

  it('alt 里的 HTML 与引号被转义', async () => {
    const { html } = await renderMarkdown(gallery('![<b>"引号"</b>](/a.webp)'))

    expect(html).toContain('alt="&lt;b&gt;&quot;引号&quot;&lt;/b&gt;"')
    expect(html).not.toContain('<b>')
  })
})

describe('相册容器的安全边界', () => {
  it('作者手写的 md-gallery 容器被摘掉 class 与 data 属性', async () => {
    const { html } = await renderMarkdown(
      '<div class="md-gallery md-gallery--carousel" data-gallery-id="g1"><p>伪造</p></div>',
    )

    expect(html).not.toContain('data-gallery-id')
    expect(html).not.toContain('md-gallery')
    expect(html).toContain('伪造')
  })

  it('作者无法通过 data-gallery-id 让普通 div 被客户端增强', async () => {
    const { html } = await renderMarkdown('<div data-gallery-id="g1">只是 div</div>')

    expect(html).not.toContain('data-gallery-id')
  })

  it('容器不会因为相册而放开任意 data-* 或 style', async () => {
    const { html } = await renderMarkdown(
      gallery('![一](/a.webp)') + '\n\n<div data-x="1" style="position:fixed">x</div>',
    )

    expect(html).not.toContain('data-x')
    expect(html).not.toContain('position:fixed')
  })
})
