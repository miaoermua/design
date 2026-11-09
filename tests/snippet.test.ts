import { describe, expect, it } from 'vitest'
import { sanitizeSnippet } from '@/lib/content/snippet'

describe('sanitizeSnippet', () => {
  it('把 Markdown 链接降级成文字', () => {
    expect(sanitizeSnippet('见 [openwrt-leigodacc-manager](https://github.com/x/y) 仓库')).toBe(
      '见 openwrt-leigodacc-manager 仓库',
    )
  })

  it('丢掉行首与行中的标题标记', () => {
    expect(sanitizeSnippet('## 前言\n在下载')).toBe('前言 在下载')
    expect(sanitizeSnippet('包括文件系统,格式 ## squashfs 先了解')).toBe(
      '包括文件系统,格式 squashfs 先了解',
    )
  })

  it('丢掉容器块标记', () => {
    expect(sanitizeSnippet('::: tip 提示\n内容')).toBe('提示 内容')
  })

  it('删除除 <mark> 之外的所有标签', () => {
    expect(sanitizeSnippet('<i class="ri-github-fill"></i>图标')).toBe('图标')
  })

  it('保留 <mark> 并清掉属性', () => {
    expect(sanitizeSnippet('<mark onclick="alert(1)" class="x">Openwrt</mark> 可用')).toBe(
      '<mark>Openwrt</mark> 可用',
    )
  })

  it('折叠多余空白', () => {
    expect(sanitizeSnippet('  多余   空白  ')).toBe('多余 空白')
  })
})
