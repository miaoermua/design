import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/content/markdown'
import { sanitizeRenderedHtml } from '@/lib/content/sanitize'

const wrap = (...lines: string[]): string => lines.join('\n')

/** 从渲染结果里取回本次渲染产出的脚注 id（模拟服务端的信任凭据） */
function footnoteIdsOf(html: string): Set<string> {
  return new Set(Array.from(html.matchAll(/id="((?:fn|fnref)-[^"]+)"/g), (match) => match[1] ?? ''))
}

function headingIdsOf(html: string): Set<string> {
  return new Set(Array.from(html.matchAll(/<h[1-6] id="([^"]+)"/g), (match) => match[1] ?? ''))
}

describe('脚注：ID 伪造与清洗', () => {
  it('作者手写的 id="fn-1" 被摘掉，渲染器产出的 id 保留', async () => {
    const { html } = await renderMarkdown(
      wrap('<sup id="fn-1">伪造</sup>', '', '正文[^1]。', '', '[^1]: 真实内容。'),
    )

    expect(html).not.toContain('id="fn-1"')
    // 真实脚注仍然带 id，且不是作者写的那种可预测形式
    expect(html).toMatch(/<li class="footnote-item" id="fn-[a-z0-9]{6}-1">/)
    expect(html).toContain('真实内容。')
  })

  it('作者伪造引用标记的 id 也到不了输出', async () => {
    const { html } = await renderMarkdown(
      wrap(
        '<sup class="footnote-ref" id="fnref-1"><a href="#fn-1">1</a></sup>',
        '',
        '正文[^1]。',
        '',
        '[^1]: 内容。',
      ),
    )

    expect(html).not.toContain('id="fnref-1"')
    expect(html).toMatch(/<sup class="footnote-ref" id="fnref-[a-z0-9]{6}-1">/)
    // 伪造的返回链接不会因 id 被保留而"命中"真实脚注
    expect(html).toContain('href="#fn-1"')
    expect(html).not.toContain('id="fn-1"')
  })

  it('只有 sup / li 能持有脚注 id，其他标签一律丢弃', async () => {
    const { html } = await renderMarkdown(wrap('正文[^1]。', '', '[^1]: 内容。'))
    const ids = footnoteIdsOf(html)
    expect(ids.size).toBeGreaterThan(0)

    const [itemId] = Array.from(ids).filter(
      (id) => id.startsWith('fn-') && !id.startsWith('fnref-'),
    )
    // 同一个 id 只能用一次（重复会被去重），这里用两个派生值分别验证 sup / li
    const supId = `${itemId}-s`
    const liId = `${itemId}-l`
    const scoped = new Set([...ids, supId, liId])

    const sanitized = sanitizeRenderedHtml(
      wrap(
        `<p id="${supId}">段落</p>`,
        `<div id="${supId}">容器</div>`,
        `<span id="${supId}">行内</span>`,
        `<sup id="${supId}">上标</sup>`,
        `<ul><li id="${liId}">条目</li></ul>`,
      ),
      { footnoteIds: scoped },
    )

    expect(sanitized).toContain(`<sup id="${supId}">`)
    expect(sanitized).toContain(`<li id="${liId}">`)
    expect(sanitized).not.toContain(`<p id="${supId}">`)
    expect(sanitized).not.toContain(`<div id="${supId}">`)
    expect(sanitized).not.toContain(`<span id="${supId}">`)
  })

  it('同一 id 重复出现时只保留第一个', () => {
    const ids = new Set(['fn-token-1'])
    const sanitized = sanitizeRenderedHtml(
      '<sup id="fn-token-1">第一</sup><sup id="fn-token-1">第二</sup>',
      { footnoteIds: ids },
    )

    expect(sanitized.match(/id="fn-token-1"/g)).toHaveLength(1)
    expect(sanitized).toContain('第一')
    expect(sanitized).toContain('第二')
  })
})

describe('脚注：内容注入', () => {
  it('定义内容里的事件属性与危险样式被清除', async () => {
    const { html } = await renderMarkdown(
      wrap(
        '正文[^1]。',
        '',
        '[^1]: <b onclick="alert(1)" style="position:fixed;top:0">粗</b>',
        '    <img src="x" onerror="alert(2)">',
      ),
    )

    // 标签与文字保留、事件属性清除；style 只留下排版白名单里的声明
    expect(html).toContain('>粗</b>')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('position:fixed')
  })

  it('定义里的危险 URL 只保留文字', async () => {
    const { html } = await renderMarkdown(
      wrap('正文[^1]。', '', '[^1]: [点我](javascript:alert(1)) 与 ![图](javascript:alert(2))'),
    )

    expect(html).toContain('点我')
    expect(html).not.toContain('javascript:')
  })

  it('特殊字符标识符不会拼进 HTML（含引号的注入尝试）', async () => {
    const { html } = await renderMarkdown(
      wrap(
        '正文[^"><img src=x onerror=alert(1)>]。',
        '',
        '[^"><img src=x onerror=alert(1)>]: 内容。',
      ),
    )

    expect(html).not.toContain('onerror')
    expect(html).not.toContain('<img src=x')
    expect(html).toMatch(/id="fn-[a-z0-9]{6}-1"/)
  })

  it('脚注列表里的返回链接指向本次渲染真实存在的锚点', async () => {
    const { html } = await renderMarkdown(
      wrap('正文[^1] 与 [^2]。', '', '[^1]: 一。', '', '[^2]: 二。'),
    )

    const targets = Array.from(html.matchAll(/href="#([^"]+)"/g), (match) => match[1] ?? '').filter(
      (id) => id.startsWith('fn'),
    )
    const ids = new Set(Array.from(html.matchAll(/id="([^"]+)"/g), (match) => match[1] ?? ''))

    expect(targets.length).toBeGreaterThan(0)
    for (const target of targets) expect(ids.has(target)).toBe(true)
  })
})

describe('脚注：清洗幂等与结构一致', () => {
  const sample = wrap(
    '## 标题',
    '',
    '正文[^a] 与同一处的再次引用[^a]，还有[^b]。',
    '',
    '[^a]: 含 **粗体**、`code`、[链接](https://example.test) 与 $x^2$。',
    '',
    '    第二段。',
    '',
    '[^b]: 另一条。',
  )

  it('再洗一遍结果完全不变', async () => {
    const { html } = await renderMarkdown(sample)

    const again = sanitizeRenderedHtml(html, {
      headingIds: headingIdsOf(html),
      footnoteIds: footnoteIdsOf(html),
    })

    expect(again).toBe(html)
  })

  it('清洗前后脚注结构数量一致', async () => {
    const { html } = await renderMarkdown(sample)
    const count = (value: string): number[] => [
      (value.match(/class="footnote-ref"/g) ?? []).length,
      (value.match(/class="footnote-item"/g) ?? []).length,
      (value.match(/class="footnote-backref"/g) ?? []).length,
    ]

    const cleaned = sanitizeRenderedHtml(html, {
      headingIds: headingIdsOf(html),
      footnoteIds: footnoteIdsOf(html),
    })

    expect(count(cleaned)).toEqual(count(html))
    expect(count(cleaned)).toEqual([3, 2, 3])
  })
})
