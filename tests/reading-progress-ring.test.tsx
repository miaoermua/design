// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { ReadingProgressRing } from '@/components/ui/reading-progress'

/**
 * 环形阅读进度（组件层）
 *
 * 纯函数已经覆盖数学部分；这里只验证「组件确实把正文矩形与滚动位置接上了」，
 * 以及 100% 出现在正文底部而不是页面底部。
 */

afterEach(cleanup)

const CONTENT_TOP = 600
const CONTENT_HEIGHT = 3000

function mountTarget() {
  const target = document.createElement('div')
  target.id = 'article-content'
  document.body.appendChild(target)

  // jsdom 没有布局：直接把正文矩形固定下来
  target.getBoundingClientRect = () =>
    ({
      top: CONTENT_TOP - window.scrollY,
      bottom: CONTENT_TOP - window.scrollY + CONTENT_HEIGHT,
      height: CONTENT_HEIGHT,
      left: 0,
      right: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect

  return target
}

function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, writable: true, value: y })
  window.dispatchEvent(new Event('scroll'))
}

function percentText() {
  return screen.getByText(/%$/).textContent
}

describe('ReadingProgressRing 尺寸与可读性', () => {
  it('环缩到 26px，百分比在环右侧而不是圈内', () => {
    render(<ReadingProgressRing targetId="missing" />)
    const ring = document.querySelector('[data-reading-progress]') as HTMLElement
    const label = screen.getByText(/%$/)
    const svg = ring.querySelector('svg') as SVGElement

    // jsdom 没有布局：尺寸看 svg 属性
    expect(svg.getAttribute('width')).toBe('26')
    expect(svg.getAttribute('height')).toBe('26')
    // 环只画弧：文字既不在 svg 里，也在 svg 外层包装之后
    expect(svg.contains(label)).toBe(false)
    expect(ring.contains(label)).toBe(true)
    expect(svg.parentElement?.nextElementSibling).toBe(label)
  })
})

describe('ReadingProgressRing', () => {
  it('没有正文元素时安静地停在 0%', () => {
    render(<ReadingProgressRing targetId="missing" />)
    expect(percentText()).toBe('0%')
  })

  it('滚到正文一半时显示 50%', async () => {
    mountTarget()
    render(<ReadingProgressRing targetId="article-content" />)

    // 可滚动区间 = 3000 - 768(jsdom 视口高)，取正中间
    const viewport = window.innerHeight
    scrollTo(CONTENT_TOP + (CONTENT_HEIGHT - viewport) / 2)

    await waitFor(() => expect(percentText()).toBe('50%'))
  })

  it('正文底部与视口底部对齐时到 100%', async () => {
    mountTarget()
    render(<ReadingProgressRing targetId="article-content" />)

    scrollTo(CONTENT_TOP + CONTENT_HEIGHT - window.innerHeight)

    await waitFor(() => expect(percentText()).toBe('100%'))
    document.getElementById('article-content')?.remove()
  })

  it('还没滚到正文时是 0%，不会因为页面已滚动就提前计数', async () => {
    mountTarget()
    render(<ReadingProgressRing targetId="article-content" />)

    scrollTo(0)

    await waitFor(() => expect(percentText()).toBe('0%'))
    document.getElementById('article-content')?.remove()
  })
})
