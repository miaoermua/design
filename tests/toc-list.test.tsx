// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TocList } from '@/components/ui/toc-list'
import type { TocItem } from '@/lib/content/markdown'

/**
 * 目录列表
 *
 * 三条硬规则写进断言：单行截断（`truncate` = overflow hidden + ellipsis +
 * white-space nowrap）、不靠缩字号容纳长标题（字号类固定为 `text-caption`）、
 * 完整标题仍留在 DOM 与 `title` 里供读屏和鼠标查看。
 */

afterEach(cleanup)

const LONG = '一个非常非常长的标题用于验证目录不会因为标题太长而把侧栏撑宽或者折成两行显示'

const ITEMS: TocItem[] = [
  { id: 'intro', text: '开始', depth: 2 },
  { id: 'long', text: LONG, depth: 2 },
  { id: 'nested', text: '更细的一节', depth: 3 },
]

function linkFor(text: string) {
  return screen.getByText(text).closest('a') as HTMLAnchorElement
}

describe('TocList 截断与锚点', () => {
  it('每一项都是指向标题 id 的锚点', () => {
    render(<TocList items={ITEMS} variant="rail" />)
    expect(linkFor('开始').getAttribute('href')).toBe('#intro')
    expect(linkFor(LONG).getAttribute('href')).toBe('#long')
  })

  it('长标题单行截断，且不通过缩小字号容纳', () => {
    render(<TocList items={ITEMS} variant="rail" />)
    const link = linkFor(LONG)

    expect(link.className).toContain('truncate')
    expect(link.className).toContain('text-caption')
    // 任何「按长度调字号」的写法都不该出现
    expect(link.className).not.toMatch(/text-\[(0\.)?[0-6]px\]/)
  })

  it('完整标题同时存在于文本与 title，辅助技术仍可读到', () => {
    render(<TocList items={ITEMS} variant="rail" />)
    const link = linkFor(LONG)
    expect(link.textContent).toBe(LONG)
    expect(link.getAttribute('title')).toBe(LONG)
  })

  it('二级与三级标题用缩进区分层级', () => {
    render(<TocList items={ITEMS} variant="rail" />)
    expect(linkFor('开始').className).toContain('pl-4')
    expect(linkFor('更细的一节').className).toContain('pl-6')
  })

  it('空目录渲染空列表，不抛错', () => {
    const { container } = render(<TocList items={[]} variant="inline" />)
    expect(container.querySelectorAll('li')).toHaveLength(0)
  })
})
