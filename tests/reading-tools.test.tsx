// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReadingAside, ReadingInline } from '@/components/reading/reading-tools'
import type { TocItem } from '@/lib/content/markdown'

/**
 * 阅读辅助区的结构约束
 *
 * 这些断言都是「位置关系」，不是像素：进度环必须和目录标题同排、操作栏必须
 * 排在目录列表之后、回到顶部必须留在操作栏之外。像素交给视觉采集脚本。
 */

afterEach(cleanup)

const ITEMS: TocItem[] = [
  { id: 'first', text: '第一节', depth: 2 },
  { id: 'second', text: '第二节', depth: 2 },
]

const ACTIONS = (
  <div role="group" aria-label="文章操作">
    <button type="button">喜欢</button>
    <button type="button">分享</button>
  </div>
)

describe('ReadingAside 桌面栏', () => {
  it('目录标题在左、环形进度在右，同处一行', () => {
    render(<ReadingAside items={ITEMS} targetId="body" actions={ACTIONS} />)
    const header = screen.getByText('目录').parentElement as HTMLElement
    const ring = document.querySelector('[data-reading-progress]') as HTMLElement

    expect(header.contains(ring)).toBe(true)
    expect(header.firstElementChild).toBe(screen.getByText('目录'))
    expect(header.lastElementChild).toBe(ring)
  })

  it('进度只有一处，不再单独占一行', () => {
    render(<ReadingAside items={ITEMS} targetId="body" actions={ACTIONS} />)
    expect(document.querySelectorAll('[data-reading-progress]')).toHaveLength(1)
  })

  it('操作栏排在目录列表之后', () => {
    render(<ReadingAside items={ITEMS} targetId="body" actions={ACTIONS} />)
    const nav = screen.getByRole('navigation', { name: '本文目录' })
    const group = screen.getByRole('group', { name: '文章操作' })

    expect(nav.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('回到顶部是操作栏之外的次级操作', () => {
    render(<ReadingAside items={ITEMS} targetId="body" actions={ACTIONS} />)
    const group = screen.getByRole('group', { name: '文章操作' })
    const backToTop = screen.getByRole('button', { name: '回到顶部' })

    expect(group.contains(backToTop)).toBe(false)
    expect(group.compareDocumentPosition(backToTop) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('短正文没有目录时仍保留进度环', () => {
    render(<ReadingAside items={[ITEMS[0]]} targetId="body" actions={ACTIONS} />)

    expect(screen.queryByRole('navigation', { name: '本文目录' })).toBeNull()
    expect(document.querySelector('[data-reading-progress]')).toBeTruthy()
  })
})

describe('ReadingInline 移动端折叠目录', () => {
  it('折叠标题行同样带进度环，且标题在环之前', () => {
    render(<ReadingInline items={ITEMS} targetId="body" />)
    const summary = document.querySelector('summary') as HTMLElement
    const ring = summary.querySelector('[data-reading-progress]') as HTMLElement

    expect(summary.textContent).toContain('目录')
    expect(ring).toBeTruthy()
    expect(
      screen.getByText('目录').compareDocumentPosition(ring) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('没有目录时不渲染折叠块，但进度环仍在', () => {
    render(<ReadingInline items={[ITEMS[0]]} targetId="body" />)

    expect(document.querySelector('summary')).toBeNull()
    expect(document.querySelector('[data-reading-progress]')).toBeTruthy()
  })
})
