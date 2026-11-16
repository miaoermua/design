import { describe, expect, it } from 'vitest'
import { inlineMediaSources } from '@/lib/content/inline-media'
import { renderMarkdown } from '@/lib/content/markdown'

/**
 * 文末附件去重
 *
 * core 的 `images` 是从正文里抽出来的全部图片，相册里的也在其中。日记页要把
 * 「正文已经渲染过的」剔掉，否则用 `::: gallery` 的日记会把同一批图显示两次。
 * 这里钉住判定依据本身：渲染结果里的 `<img>` / `<video>` src。
 */

const gallery = (body: string, variant = 'gallery'): string =>
  [`::: ${variant}`, body, ':::'].join('\n')

describe('读出正文里已渲染的媒体', () => {
  it('相册里的每一张图都被认出来', async () => {
    const { html } = await renderMarkdown(gallery('![一](a.webp)\n![二](b.webp)'))
    const sources = inlineMediaSources(html)

    expect(sources.has('a.webp')).toBe(true)
    expect(sources.has('b.webp')).toBe(true)
  })

  it('普通 Markdown 图片同样被认出来', async () => {
    const { html } = await renderMarkdown('正文\n\n![一](a.webp)\n')
    expect(inlineMediaSources(html).has('a.webp')).toBe(true)
  })

  it('视频容器（`<video src>`）也算', () => {
    const sources = inlineMediaSources('<video src="clip.mp4" controls></video>')
    expect(sources.has('clip.mp4')).toBe(true)
  })

  it('相册的 <a href> 不单独登记：同一张图只算一次', async () => {
    const { html } = await renderMarkdown(gallery('![一](a.webp)'))
    expect(inlineMediaSources(html).size).toBe(1)
  })

  it('属性里的转义还原成原样，才能与 images.src 逐字比对', () => {
    const sources = inlineMediaSources('<img src="https://cdn.test/a.webp?x=1&amp;y=2" />')
    expect(sources.has('https://cdn.test/a.webp?x=1&y=2')).toBe(true)
  })

  it('没有图片时是空集合', () => {
    expect(inlineMediaSources('<p>纯文字</p>').size).toBe(0)
  })
})

describe('文末附件过滤', () => {
  const images = [{ src: 'a.webp' }, { src: 'b.webp' }, { src: 'only-attachment.webp' }]

  it('只保留正文里没出现过的附件', async () => {
    const { html } = await renderMarkdown(gallery('![一](a.webp)\n![二](b.webp)'))
    const sources = inlineMediaSources(html)

    expect(images.filter((image) => !sources.has(image.src))).toEqual([
      { src: 'only-attachment.webp' },
    ])
  })

  it('正文全是相册图时，文末整块不渲染', async () => {
    const { html } = await renderMarkdown(gallery('![一](a.webp)\n![二](b.webp)'))
    const sources = inlineMediaSources(html)

    expect(images.filter((image) => !sources.has(image.src)).length).toBe(1)
    expect(
      [{ src: 'a.webp' }, { src: 'b.webp' }].filter((image) => !sources.has(image.src)),
    ).toEqual([])
  })
})
