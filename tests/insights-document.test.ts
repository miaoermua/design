import { describe, expect, it } from 'vitest'
import {
  parseInsightsDocument,
  resolveInsightRefs,
  splitInsightSections,
} from '@/lib/content/insights'

/**
 * AI 精读文档解析
 *
 * 样例取自线上真实响应（api.miaoer.net · 文章 147657505117847585），
 * 结构按 Core v12 提示词约定裁剪，不做美化。
 */

const SOURCE = `## 开源

CatWrt 是基于开源的 [Lean's LEDE](https://github.com/coolsnowwolf/lede) 仓库编译的 OpenWrt 发行版。

## 特性

固件中绝不含任何后门和可以监控或者劫持你的 TLS/SSL 闭源软件。

## 问答

Q：更新频率？`

const TOC = [{ id: '开源' }, { id: '特性' }, { id: '问答' }]

const REF_CONTENT = `## TL;DR

CatWrt 是一个发行版<ref quote="基于开源的 [Lean's LEDE](https://github.com/coolsnowwolf/lede) 仓库编译的 OpenWrt 发行版" section="§开源"/>。

## 特性

它强调纯净<ref quote="固件中绝不含任何后门和可以监控或者劫持你的 TLS/SSL 闭源软件" section="§特性"/>。

\`\`\`mermaid
flowchart TD
    A --> B
\`\`\`

<!-- insights-meta: {"reading_time_min":2,"difficulty":"easy","genre":"architecture"} -->`

describe('parseInsightsDocument', () => {
  it('剥离末尾 meta 注释并读回三个字段', () => {
    const { body, meta } = parseInsightsDocument(REF_CONTENT)

    expect(body.endsWith('-->')).toBe(false)
    expect(body).toContain('flowchart TD')
    expect(meta).toEqual({ readingMinutes: 2, difficulty: 'easy', genre: 'architecture' })
  })

  it('没有 meta 注释时正文原样返回，元信息为空', () => {
    const { body, meta } = parseInsightsDocument('# 普通内容\n\n一段话')

    expect(body).toBe('# 普通内容\n\n一段话')
    expect(meta).toEqual({ readingMinutes: null, difficulty: null, genre: null })
  })

  it('meta JSON 坏掉时只丢元信息，不丢正文', () => {
    const { body, meta } = parseInsightsDocument('正文\n\n<!-- insights-meta: {oops} -->')

    expect(body).toBe('正文')
    expect(meta.readingMinutes).toBeNull()
    expect(meta.difficulty).toBeNull()
  })

  it('拒绝非约定的难度值与非法阅读时长', () => {
    const { meta } = parseInsightsDocument(
      '正文\n\n<!-- insights-meta: {"reading_time_min":0,"difficulty":"extreme","genre":""} -->',
    )

    expect(meta.readingMinutes).toBeNull()
    expect(meta.difficulty).toBeNull()
    expect(meta.genre).toBeNull()
  })
})

describe('resolveInsightRefs', () => {
  it('把命中原文的 ref 换成指向章节的上标链接', () => {
    const { markdown, total, resolved } = resolveInsightRefs(REF_CONTENT, SOURCE, TOC)

    expect(total).toBe(2)
    expect(resolved).toBe(2)
    expect(markdown).toContain('<a href="#开源" class="insight-ref__link"')
    expect(markdown).toContain('<a href="#特性" class="insight-ref__link"')
    expect(markdown).not.toContain('<ref')
  })

  it('原文里找不到 quote 时降级为无链接标记，不造 href', () => {
    const body = '正文<ref quote="这句话原文里没有" section="§虚构"/>'
    const { markdown, total, resolved } = resolveInsightRefs(body, SOURCE, TOC)

    expect(total).toBe(1)
    expect(resolved).toBe(0)
    expect(markdown).toContain('insight-ref--plain')
    expect(markdown).not.toContain('href=')
  })

  it('quote 落在第一个标题之前时同样降级', () => {
    const source = `开头的引子。\n\n## 第一节\n\n正文。`
    const body = '<ref quote="开头的引子" section="opening"/>'
    const { resolved } = resolveInsightRefs(body, source, [{ id: '第一节' }])

    expect(resolved).toBe(0)
  })

  it('属性里的 XML 转义会被还原后用于定位', () => {
    // 原文里是普通引号；ref 的属性值按 XML 规则转义成 &quot;
    const source = '## 引用\n\n他说 "不要这样做"，然后走了。'
    const body = '<ref quote="他说 &quot;不要这样做&quot;" section="§引用"/>'
    const { resolved, markdown } = resolveInsightRefs(body, source, [{ id: '引用' }])

    expect(resolved).toBe(1)
    expect(markdown).toContain('href="#引用"')
  })

  it('代码块里的 ref 原样保留，不参与计数', () => {
    const source = '## 示例\n\n正文'
    const body = ['```html', '<ref quote="正文" />', '```', '<ref quote="正文" />'].join('\n')
    const { total, markdown } = resolveInsightRefs(body, source, [{ id: '示例' }])

    expect(total).toBe(1)
    expect(markdown).toContain('```html\n<ref quote="正文" />\n```')
  })

  it('代码块里的 ## 不会被当成标题', () => {
    const source = ['```bash', '## 这不是标题', '```', '', '## 真标题', '', '正文'].join('\n')
    const body = '<ref quote="正文" section="§真"/>'
    const { resolved, markdown } = resolveInsightRefs(body, source, [{ id: '真标题' }])

    expect(resolved).toBe(1)
    expect(markdown).toContain('href="#真标题"')
  })

  it('残留的闭合标签被清掉', () => {
    const { markdown } = resolveInsightRefs('正文</ref>', SOURCE, TOC)
    expect(markdown).toBe('正文')
  })

  it('标题数量与目录不一致时按标题文本对齐，不按序号硬配', () => {
    const source = '## 甲\n\n正文甲\n\n## 乙\n\n正文乙'
    // 目录少一项：按序号配会把「乙」错配到「甲」
    const toc = [{ id: 'h-yi', text: '乙' }]
    const body = '<ref quote="正文乙" section="§乙"/>'

    const { resolved, markdown } = resolveInsightRefs(body, source, toc)

    expect(resolved).toBe(1)
    expect(markdown).toContain('href="#h-yi"')
  })

  it('数量不一致且文本对不上时整体放弃锚点，宁可没有也不跳错', () => {
    const source = '## 甲\n\n正文甲\n\n## 乙\n\n正文乙'
    // 数量不一致 → 走文本匹配；文本又对不上 → 放弃
    const toc = [{ id: 'h-x', text: '完全不同的标题' }]
    const body = '<ref quote="正文甲" section="§甲"/>'

    const { resolved, markdown } = resolveInsightRefs(body, source, toc)

    expect(resolved).toBe(0)
    expect(markdown).not.toContain('href=')
  })
})

describe('splitInsightSections', () => {
  it('按 H2 切分，首个章节可为引子', () => {
    const sections = splitInsightSections('引子一段。\n\n## 甲\n\n内容甲\n\n## 乙\n\n内容乙')

    expect(sections.map((section) => section.title)).toEqual(['', '甲', '乙'])
    expect(sections[1]?.markdown.trim()).toBe('## 甲\n\n内容甲')
  })

  it('代码块里的 ## 不切分', () => {
    const sections = splitInsightSections('## 甲\n\n```md\n## 不是标题\n```\n')
    expect(sections).toHaveLength(1)
  })

  it('空文档返回空数组', () => {
    expect(splitInsightSections('   \n\n')).toEqual([])
  })
})
