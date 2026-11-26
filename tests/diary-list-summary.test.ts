import { describe, expect, it } from 'vitest'
import { firstImageSource } from '@/lib/content/inline-media'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { excerpt, toPlainText } from '@/lib/utils/text'

/**
 * 日记列表：摘要与代表图
 *
 * 这两件事共同决定了「列表页不再渲染完整正文」是否真的成立：
 *   - 摘要是**纯文本**，不能把 Markdown 记号漏进 UI；
 *   - 代表图是**源码级**选择的，不能为了它跑一遍完整渲染。
 *
 * 组件本身是 async RSC，jsdom 里渲染成本高且会连带 Markdown 管线；
 * 这里只钉住两条纯函数契约（它们才是「渲染层限制」的实际执行者），
 * 组件结构的断言用源码文本 + 浏览器度量补齐，见文件末尾。
 */

describe('摘要：把 Markdown 清成可读的一段话', () => {
  const clean = (input: string) => toPlainText(input)

  it('标题、强调、行内代码的记号都不留', () => {
    expect(clean('## 标题\n\n这里有 **粗体** 与 _斜体_ 与 `code`。')).toBe(
      '标题 这里有 粗体 与 斜体 与 code。',
    )
  })

  it('围栏代码块整段消失，不把代码当正文', () => {
    const text = clean('说明\n\n```js\nconst a = 1\n```\n\n结尾')
    expect(text).toBe('说明 结尾')
    expect(text).not.toContain('const a')
  })

  it('容器围栏（::: gallery）不留 ::: 残渣', () => {
    const text = clean('正文\n\n::: gallery\n![一](a.webp)\n:::\n\n收尾')
    expect(text).toBe('正文 收尾')
    expect(text).not.toContain(':::')
  })

  it('行内图片消失，链接只留文字', () => {
    expect(clean('看这张 ![截图](https://cdn.test/a.webp) 和[链接](https://x.com)')).toBe(
      '看这张 和链接',
    )
  })

  it('引用式图片与定义行都不留地址', () => {
    const text = clean('正文\n\n![图][shot]\n\n[shot]: https://cdn.test/a.webp')
    expect(text).toBe('正文')
    expect(text).not.toContain('cdn.test')
  })

  it('脚注引用不进入摘要', () => {
    expect(clean('结论在这里[^1]。')).toBe('结论在这里。')
  })

  it('原始 HTML 与裸地址标记被剥掉', () => {
    expect(clean('<p>段落</p><br><img src="a.webp">')).toBe('段落')
  })

  it('开头的中文标点被清掉，不会以「，正文」开头', () => {
    expect(clean('，正文开始')).toBe('正文开始')
  })

  it('纯图片日记摘出空串（由组件降级成「只有标题」）', () => {
    expect(clean('::: gallery\n![一](a.webp)\n![二](b.webp)\n:::')).toBe('')
  })

  it('空正文是空串，不产出「…」', () => {
    expect(clean('')).toBe('')
    expect(excerpt('', 140)).toBe('')
  })
})

describe('摘要：长度与截断', () => {
  it('短文本原样返回，不加省略号', () => {
    expect(excerpt('很短的一段话', 140)).toBe('很短的一段话')
  })

  it('超长文本按字数截断并以省略号收尾', () => {
    const long = '字'.repeat(300)
    const out = excerpt(long, 140)
    expect(out).toHaveLength(141)
    expect(out.endsWith('…')).toBe(true)
  })

  it('中英数混排只按字符数截断，不产生半个标签', () => {
    const mixed = `Hello 世界 123 ${'x'.repeat(200)}`
    const out = excerpt(mixed, 60)
    expect(out.length).toBeLessThanOrEqual(61)
    expect(out).not.toContain('<')
  })
})

describe('代表图：源码级取第一张，不渲染', () => {
  it('行内图片取第一个', () => {
    expect(firstImageSource('前文\n\n![一](https://cdn.test/a.webp)\n\n![二](b.webp)')).toBe(
      'https://cdn.test/a.webp',
    )
  })

  it('代码块里的「图片」不算真图', () => {
    const source = ['```md', '![假的](fake.webp)', '```', '', '![真的](real.webp)'].join('\n')
    expect(firstImageSource(source)).toBe('real.webp')
  })

  it('行内代码里的图片语法也不算', () => {
    expect(firstImageSource('写作 `![x](fake.webp)` 然后 ![真的](real.webp)')).toBe('real.webp')
  })

  it('引用式图片能解析到定义', () => {
    expect(firstImageSource('![一][shot]\n\n[shot]: https://cdn.test/shot.webp')).toBe(
      'https://cdn.test/shot.webp',
    )
  })

  it('原始 HTML 图片能认出来', () => {
    expect(firstImageSource('<img src="https://cdn.test/h.webp" />')).toBe(
      'https://cdn.test/h.webp',
    )
  })

  it('「第一张」按原文位置判定，与写法无关', () => {
    // HTML 图在前、行内图在后 → 取 HTML 那张
    const source = '<img src="first.webp" />\n\n![二](second.webp)'
    expect(firstImageSource(source)).toBe('first.webp')
  })

  it('不安全协议直接跳过，退回下一张', () => {
    expect(firstImageSource('![坏](javascript:alert(1))\n![好](ok.webp)')).toBe('ok.webp')
  })

  it('没有图片时返回 null（组件据此不渲染图片容器）', () => {
    expect(firstImageSource('纯文字，没有图')).toBeNull()
    expect(firstImageSource('')).toBeNull()
  })

  it('同一张图出现多次时仍只返回一个地址', () => {
    const source = '![一](a.webp)\n\n![一](a.webp)'
    expect(firstImageSource(source)).toBe('a.webp')
  })
})

describe('列表组件契约：不渲染正文', () => {
  const source = readFileSync(
    join(import.meta.dirname, '../src/features/diaries/components/diary-entry.tsx'),
    'utf8',
  )

  it('不再调用 renderMarkdown，也不再输出 Prose', () => {
    expect(source).not.toContain('renderMarkdown')
    expect(source).not.toContain('<Prose')
    expect(source).not.toContain('prose--compact')
  })

  it('摘要走 excerpt()，与首页 DiaryCard 同一个工具', () => {
    expect(source).toContain("from '@/lib/utils/text'")
    expect(source).toContain('excerpt(diary.content')
  })

  it('代表图来自源码扫描，不来自渲染结果', () => {
    expect(source).toContain('firstImageSource')
    expect(source).not.toContain('inlineMediaSources')
  })

  it('只渲染一个图片容器（不是 images.map）', () => {
    // 旧实现是 `diary.images.map(...)`：711 张图会全部进 DOM
    expect(source).not.toContain('diary.images.map')
    expect((source.match(/<CoverImage/g) ?? []).length).toBe(1)
  })

  it('图片优先按原始比例显示，取不到尺寸才退回比例盒', () => {
    // 有宽高：交给原生 width/height 属性等比缩放，只限制最大宽与最大高
    expect(source).toContain('coverHasSize')
    expect(source).toContain('max-h-[22rem]')
    // 4:3 盒子只作为「附件没带尺寸」时的降级分支，不能是唯一路径
    expect(source).toMatch(/coverHasSize \? [^:]+ : 'aspect-\[4\/3\] w-full'/)
    // 不再用 object-cover 统一裁切
    expect(source).not.toContain('object-cover')
  })

  it('图片宽度上限在 300–340px 之间', () => {
    expect(source).toContain('max-w-[20rem] sm:max-w-[21.25rem]')
  })

  it('受密码保护时不取摘要也不取图', () => {
    expect(source).toContain('diary.hasPassword')
    expect(source).toMatch(/readable = !diary\.hasPassword/)
  })

  it('标题链接扩展为整条日记入口，不再重复显示继续阅读', () => {
    expect(source).toContain('className="diary-entry"')
    expect(source).toContain('diary-entry__title-link')
    expect(source).not.toContain("t(locale, 'diary.continueReading')")
    expect(source).toContain('notePath(diary.nid)')
    expect(source).toContain('diary.readCount')
    expect(source).toContain("t(locale, 'diary.unlock')")
  })
})
