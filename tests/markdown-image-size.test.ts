/**
 * 正文图尺寸（T4）：给 `<img>` 补 `width` / `height`，消掉滚动时的持续位移。
 *
 * 这里钉住的是**三条边界**，而不是"实现了功能"：
 *   1. 命中附件元数据 → 输出真实宽高，浏览器能据此算出 aspect-ratio；
 *   2. 未命中 → **一个属性都不加**，绝不猜一个比例（猜错会把图撑成长条，
 *      比继续有 CLS 更糟）；
 *   3. 只有一个维度有效 / 值为 0 / 视频附件 → 同样不写，走未命中分支。
 */

import { describe, expect, it } from 'vitest'
import { imageSizeIndex } from '@/lib/content/inline-media'
import { renderMarkdown } from '@/lib/content/markdown'

const A = 'https://static.example.com/notes/a.webp'
const B = 'https://static.example.com/notes/b.webp'

/** 从渲染结果里取出某张图的属性字符串 */
function imgTag(html: string, src: string): string {
  const match = new RegExp(`<img[^>]*src="${src}"[^>]*>`).exec(html)
  if (!match) throw new Error(`没有渲染出 ${src}`)
  return match[0]
}

describe('imageSizeIndex：只收两个维度都有效的图片附件', () => {
  it('收下完整的宽高', () => {
    const index = imageSizeIndex([{ src: A, width: 1024, height: 768, kind: 'image' }])
    expect(index.get(A)).toEqual({ width: 1024, height: 768 })
  })

  it('缺任一维度就整条丢弃：半个比例比没有比例更糟', () => {
    const index = imageSizeIndex([
      { src: A, width: 1024, kind: 'image' },
      { src: B, height: 768, kind: 'image' },
    ])
    expect(index.size).toBe(0)
  })

  it('0 与非有限值不算尺寸', () => {
    const index = imageSizeIndex([
      { src: A, width: 0, height: 768 },
      { src: B, width: Number.NaN, height: 768 },
    ])
    expect(index.size).toBe(0)
  })

  it('视频附件不参与：它的宽高是视频轨道，不是封面图', () => {
    const index = imageSizeIndex([{ src: A, width: 1920, height: 1080, kind: 'video' }])
    expect(index.size).toBe(0)
  })

  it('同一地址重复出现时保留第一条', () => {
    const index = imageSizeIndex([
      { src: A, width: 100, height: 50 },
      { src: A, width: 999, height: 999 },
    ])
    expect(index.get(A)).toEqual({ width: 100, height: 50 })
  })

  it('空输入不炸', () => {
    expect(imageSizeIndex(undefined).size).toBe(0)
    expect(imageSizeIndex(null).size).toBe(0)
    expect(imageSizeIndex([]).size).toBe(0)
  })
})

describe('renderMarkdown：正文图带上真实尺寸', () => {
  it('命中时输出 width / height，且保留 alt 与懒加载', async () => {
    const markdown = `![一张图](${A})`
    const { html } = await renderMarkdown(markdown, 'zh-CN', {
      imageSizes: imageSizeIndex([{ src: A, width: 1024, height: 768 }]),
    })

    const tag = imgTag(html, A)
    expect(tag).toContain('width="1024"')
    expect(tag).toContain('height="768"')
    expect(tag).toContain('loading="lazy"')
    expect(tag).toContain('decoding="async"')
    expect(html).toContain('<figcaption>')
  })

  // 未命中是**默认路径**：不传 options 时行为必须与改造前逐字一致
  it('未命中时一个尺寸属性都不加', async () => {
    const markdown = `![一张图](${A})`
    const { html } = await renderMarkdown(markdown, 'zh-CN', {
      imageSizes: imageSizeIndex([{ src: B, width: 1024, height: 768 }]),
    })

    const tag = imgTag(html, A)
    expect(tag).not.toContain('width=')
    expect(tag).not.toContain('height=')
  })

  it('不传 options 时与改造前一致（旧调用点零感知）', async () => {
    const markdown = `![一张图](${A})`
    const legacy = await renderMarkdown(markdown, 'zh-CN')
    const withEmpty = await renderMarkdown(markdown, 'zh-CN', { imageSizes: new Map() })

    expect(legacy.html).toBe(withEmpty.html)
    expect(imgTag(legacy.html, A)).not.toContain('width=')
  })

  it('相册里的图同样带尺寸（容器不影响 renderer）', async () => {
    const markdown = `::: gallery\n![甲](${A})\n![乙](${B})\n:::`
    const { html } = await renderMarkdown(markdown, 'zh-CN', {
      imageSizes: imageSizeIndex([
        { src: A, width: 800, height: 600 },
        { src: B, width: 400, height: 300 },
      ]),
    })

    expect(imgTag(html, A)).toContain('width="800"')
    expect(imgTag(html, B)).toContain('width="400"')
  })

  it('安全性不受影响：非法协议仍然不渲染', async () => {
    const { html } = await renderMarkdown(`![x](javascript:alert(1))`, 'zh-CN', {
      imageSizes: imageSizeIndex([{ src: 'javascript:alert(1)', width: 10, height: 10 }]),
    })
    expect(html).not.toContain('<img')
  })

  it('宽高不会被当成 HTML 注入载体（值是数字）', async () => {
    const { html } = await renderMarkdown(`![x](${A})`, 'zh-CN', {
      imageSizes: imageSizeIndex([{ src: A, width: 1024.4, height: 768.6 }]),
    })
    // 小数被取整，不会出现引号或尖括号
    expect(imgTag(html, A)).toContain('width="1024"')
    expect(imgTag(html, A)).toContain('height="769"')
  })
})
