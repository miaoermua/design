// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { StrictMode, type ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { SpoilerEnhancer } from '@/components/markdown/spoiler-enhancer'
import { renderMarkdown } from '@/lib/content/markdown'

async function mount(markdown: string, wrap = (node: ReactElement) => node): Promise<HTMLElement> {
  const { html } = await renderMarkdown(markdown)
  const view = render(
    wrap(
      <>
        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        <SpoilerEnhancer />
      </>,
    ),
  )
  return view.container
}

function getSpoiler(container: HTMLElement, index = 0): HTMLElement {
  const node = container.querySelectorAll<HTMLElement>('.md-spoiler')[index]
  if (!node) throw new Error('spoiler not found')
  return node
}

afterEach(() => {
  cleanup()
})

describe('Spoiler 渐进增强', () => {
  it('服务端不产出交互属性，增强后补齐 button 语义', async () => {
    const markdown = '前 ||隐藏|| 后'
    const staticHtml = (await renderMarkdown(markdown)).html
    expect(staticHtml).not.toContain('role="button"')
    expect(staticHtml).not.toContain('tabindex')

    const container = await mount(markdown)
    const node = getSpoiler(container)

    expect(node.getAttribute('role')).toBe('button')
    expect(node.tabIndex).toBe(0)
    expect(node.getAttribute('aria-expanded')).toBe('false')
    expect(node.dataset.spoilerReady).toBe('true')
    expect(node.textContent).toBe('隐藏')
  })

  it('点击切换展开与收起，aria-expanded 同步', async () => {
    const container = await mount('||隐藏||')
    const node = getSpoiler(container)

    fireEvent.click(node)
    expect(node.dataset.revealed).toBe('true')
    expect(node.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(node)
    expect(node.dataset.revealed).toBeUndefined()
    expect(node.getAttribute('aria-expanded')).toBe('false')
  })

  it('键盘 Enter / Space 可切换，其他键不改变状态', async () => {
    const container = await mount('||隐藏||')
    const node = getSpoiler(container)

    fireEvent.keyDown(node, { key: 'Enter' })
    expect(node.dataset.revealed).toBe('true')

    fireEvent.keyDown(node, { key: ' ' })
    expect(node.dataset.revealed).toBeUndefined()

    fireEvent.keyDown(node, { key: 'a' })
    expect(node.dataset.revealed).toBeUndefined()
  })

  it('内部可聚焦元素上的按键不劫持，交给浏览器默认行为', async () => {
    const container = await mount('||[链接](https://example.test/a)||')
    const node = getSpoiler(container)
    const link = node.querySelector('a')
    if (!link) throw new Error('link not found')

    // 链接自身可聚焦：Enter 应该激活链接，而不是折叠整段隐藏内容
    fireEvent.keyDown(link, { key: 'Enter' })
    expect(node.dataset.revealed).toBeUndefined()
  })

  it('多个 spoiler 状态互相独立', async () => {
    const container = await mount('||一|| 与 ||二||')
    const first = getSpoiler(container, 0)
    const second = getSpoiler(container, 1)

    fireEvent.click(first)
    expect(first.dataset.revealed).toBe('true')
    expect(second.dataset.revealed).toBeUndefined()
  })

  it('展开后点击内部链接不折叠', async () => {
    const container = await mount('||[链接](https://example.test/a)||')
    const node = getSpoiler(container)
    const link = node.querySelector('a')
    if (!link) throw new Error('link not found')

    fireEvent.click(node)
    expect(node.dataset.revealed).toBe('true')

    fireEvent.click(link)
    expect(node.dataset.revealed).toBe('true')
  })

  it('普通文本与其他行内标记不被打扰', async () => {
    const container = await mount('普通文本 ++新增++ ||隐藏||')
    const ins = container.querySelector('ins')

    expect(ins?.textContent).toBe('新增')
    expect(ins?.getAttribute('role')).toBeNull()
    expect(container.querySelectorAll('.md-spoiler')).toHaveLength(1)
  })

  it('StrictMode 下不会重复增强', async () => {
    const container = await mount('||隐藏||', (node) => <StrictMode>{node}</StrictMode>)
    const node = getSpoiler(container)

    expect(node.dataset.spoilerReady).toBe('true')
    fireEvent.click(node)
    expect(node.dataset.revealed).toBe('true')
    expect(node.getAttribute('aria-expanded')).toBe('true')
  })

  it('卸载后不再响应点击与键盘', async () => {
    const { html } = await renderMarkdown('||隐藏||')
    const view = render(
      <>
        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
        <SpoilerEnhancer />
      </>,
    )
    const node = getSpoiler(view.container)

    view.unmount()
    fireEvent.click(node)
    fireEvent.keyDown(node, { key: 'Enter' })

    expect(node.dataset.revealed).toBeUndefined()
  })

  it('一页多个正文时各自只认领自己的容器', async () => {
    const [first, second] = await Promise.all([
      renderMarkdown('||第一处||'),
      renderMarkdown('||第二处||'),
    ])

    const view = render(
      <>
        <div className="prose" dangerouslySetInnerHTML={{ __html: first.html }} />
        <SpoilerEnhancer />
        <div className="prose" dangerouslySetInnerHTML={{ __html: second.html }} />
        <SpoilerEnhancer />
      </>,
    )

    const spoilers = view.container.querySelectorAll<HTMLElement>('.md-spoiler')
    expect(spoilers).toHaveLength(2)
    for (const node of Array.from(spoilers)) expect(node.dataset.spoilerReady).toBe('true')
  })
})
