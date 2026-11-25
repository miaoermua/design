/**
 * 阅读目录在「阅读页 ↔ 顶栏菜单」之间的同步
 *
 * 这一组钉住的是**跨页面切换时的所有权**，而不是渲染：
 * 目录的清空由旧页面发起，目录的写入由新页面发起，两者不保证同一提交。
 * 一旦清理无条件执行，就会出现「从 A 跳到 B 后菜单里目录时有时无」。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { tocStore } from '@/lib/reading/toc-store'

const makeToc = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `h-${index}`,
    text: `第 ${index + 1} 节`,
    depth: 2 as const,
  }))

beforeEach(() => {
  tocStore.clear()
})

describe('阅读目录存储', () => {
  it('少于两节按「没有目录」处理：菜单不为一行标题腾地方', () => {
    tocStore.setItems(makeToc(1))
    expect(tocStore.getSnapshot()).toEqual([])

    tocStore.setItems(makeToc(2))
    expect(tocStore.getSnapshot()).toHaveLength(2)
  })

  it('旧页面的清理不会抹掉新页面刚写进去的目录', () => {
    const oldPage = Symbol('old')
    const newPage = Symbol('new')

    tocStore.setItems(makeToc(2), oldPage)
    // 新页面先挂载（Suspense 边界下旧页面可能晚一拍才卸载）
    tocStore.setItems(makeToc(3), newPage)
    // 旧页面的清理这时才跑
    tocStore.clear(oldPage)

    expect(tocStore.getSnapshot()).toHaveLength(3)
  })

  it('自己的令牌能清掉自己那一份', () => {
    const token = Symbol('page')
    tocStore.setItems(makeToc(4), token)
    tocStore.clear(token)

    expect(tocStore.getSnapshot()).toEqual([])
  })

  it('内容变化与清空都会通知订阅者', () => {
    const listener = vi.fn()
    const unsubscribe = tocStore.subscribe(listener)

    tocStore.setItems(makeToc(2))
    expect(listener).toHaveBeenCalledTimes(1)

    tocStore.clear()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    tocStore.setItems(makeToc(2))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('快照引用保持稳定：同一份内容不会触发无谓重渲染', () => {
    const items = makeToc(3)
    tocStore.setItems(items)
    const first = tocStore.getSnapshot()

    tocStore.setItems(items)
    expect(tocStore.getSnapshot()).toBe(first)

    // 空目录同样是一个稳定常量，不是每次新建的 []
    tocStore.clear()
    const empty = tocStore.getSnapshot()
    tocStore.clear()
    expect(tocStore.getSnapshot()).toBe(empty)
  })
})
