// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CustomCssLinks } from '@/components/layout/custom-css-links'
import { DEFAULT_THEME_CONFIG } from '@/core/config/theme'
import type { ThemeCustom } from '@/core/config/theme'

/**
 * 自定义样式表渲染
 *
 * 这里验证的是 `custom.css` 的**最终 HTML 输出方式**：
 * 一个 URL 一条 `<link rel="stylesheet">`，不输出 `<style>`，
 * 空数组一条都不输出。
 *
 * 注意查询位置：React 19 会把带 `precedence` 的样式表**提升到 `<head>`**，
 * 所以断言要查 `document.head`，而不是组件挂载的容器。
 */

beforeEach(() => {
  document.head.innerHTML = ''
})

afterEach(cleanup)

/** 只取自定义样式表（按 data-precedence 区分，排除 preload 提示） */
function customLinks(): HTMLLinkElement[] {
  return Array.from(
    document.head.querySelectorAll<HTMLLinkElement>('link[data-precedence="folio-custom"]'),
  )
}

function renderLinks(custom: ThemeCustom): HTMLLinkElement[] {
  render(<CustomCssLinks custom={custom} />)
  return customLinks()
}

describe('Custom CSS：渲染为 link', () => {
  it('每个 URL 渲染一条 link，顺序与配置一致', () => {
    const links = renderLinks({
      css: ['https://a.example/x.css', 'https://b.example/y.css'],
    })
    expect(links).toHaveLength(2)
    expect(links.map((l) => l.getAttribute('rel'))).toEqual(['stylesheet', 'stylesheet'])
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      'https://a.example/x.css',
      'https://b.example/y.css',
    ])
  })

  it('不再输出 <style> 或 data-folio-custom-css', () => {
    render(<CustomCssLinks custom={{ css: ['https://a.example/x.css'] }} />)
    expect(document.querySelector('style')).toBeNull()
    expect(document.documentElement.innerHTML).not.toContain('data-folio-custom-css')
  })

  it('空数组不输出任何 link', () => {
    expect(renderLinks({ css: [] })).toHaveLength(0)
  })

  it('默认配置不输出任何 link', () => {
    expect(renderLinks(DEFAULT_THEME_CONFIG.custom)).toHaveLength(0)
  })

  it('URL 里的非法字符已被编码，不会破坏标签结构', () => {
    render(<CustomCssLinks custom={{ css: ['https://a.example/%22onmouseover=%22alert(1)'] }} />)
    const link = customLinks()[0]
    expect(link).toBeDefined()
    // 属性值里的引号已被百分号编码，不会断开属性
    expect(link?.getAttribute('onmouseover')).toBeNull()
    expect(document.querySelector('script')).toBeNull()
  })

  it('归入独立的 precedence 组，与主题样式分开排序', () => {
    // 用独立 href：React 对同一个 href 只会插入一次样式表，
    // 重复用同一个地址会让后一个用例查不到新建的元素。
    const links = renderLinks({ css: ['https://precedence.example/only.css'] })
    expect(links[0]?.getAttribute('data-precedence')).toBe('folio-custom')
  })

  it('多条时保持同组，顺序即配置顺序', () => {
    const links = renderLinks({
      css: ['https://a.example/1.css', 'https://a.example/2.css', 'https://a.example/3.css'],
    })
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      'https://a.example/1.css',
      'https://a.example/2.css',
      'https://a.example/3.css',
    ])
    expect(new Set(links.map((l) => l.getAttribute('data-precedence')))).toEqual(
      new Set(['folio-custom']),
    )
  })
})
