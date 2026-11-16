// @vitest-environment jsdom
/**
 * Toaster 的无障碍契约
 *
 * 审计时发现：`notifications-store.test.ts` 测了队列/去重/计时，但**没有任何测试
 * 断言 Toaster 输出给读屏的语义**。而 Toaster 是唯一把通知送到用户面前的组件 ——
 * 它的 `role` / `aria-live` 就是"这条提示会不会被念出来"的全部依据。
 *
 * 四条边界：
 *   1. 空队列**不渲染任何东西**（不留一个空的 live region 干扰读屏）；
 *   2. 非紧急（info/success）走 `role="status"` + `aria-live="polite"`（不打断）；
 *   3. 紧急（warning/error）走 `role="alert"` + `aria-live="assertive"`；
 *   4. 容器是 `role="region"` 且有 `aria-label`，方便按区域跳转。
 */

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Toaster } from '@/components/ui/toaster'
import { notificationStore } from '@/lib/notifications/store'

beforeEach(() => {
  notificationStore.clear()
})

afterEach(() => {
  cleanup()
  notificationStore.clear()
})

describe('Toaster：空队列', () => {
  it('什么都不渲染，不留空 live region', () => {
    const { container } = render(<Toaster />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
    expect(document.querySelector('[aria-live]')).toBeNull()
  })
})

describe('Toaster：非紧急提示', () => {
  it('info 用 role="status" + aria-live="polite"', () => {
    notificationStore.notify({ level: 'info', title: '已保存' })
    render(<Toaster />)

    const item = screen.getByRole('status')
    expect(item.getAttribute('aria-live')).toBe('polite')
    expect(item.textContent).toContain('已保存')
  })

  it('success 同样走 polite', () => {
    notificationStore.notify({ level: 'success', title: '订阅成功' })
    render(<Toaster />)

    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
  })
})

describe('Toaster：紧急提示', () => {
  it('error 用 role="alert" + aria-live="assertive"', () => {
    notificationStore.notify({ level: 'error', title: '网络异常' })
    render(<Toaster />)

    const item = screen.getByRole('alert')
    expect(item.getAttribute('aria-live')).toBe('assertive')
    expect(item.textContent).toContain('网络异常')
  })

  it('warning 同样走 assertive', () => {
    notificationStore.notify({ level: 'warning', title: '内容未发布' })
    render(<Toaster />)

    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive')
  })
})

describe('Toaster：容器语义', () => {
  it('容器是带 aria-label 的 region，逐条提示挂在里面', () => {
    notificationStore.notify({ level: 'info', title: '第一条' })
    render(<Toaster />)

    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toBeTruthy()
    // 提示在 region 内，而不是平铺到 body
    expect(region.contains(screen.getByRole('status'))).toBe(true)
  })

  it('多条并存时各自带自己的 role，不会串味', () => {
    notificationStore.notify({ level: 'info', title: '普通' })
    notificationStore.notify({ level: 'error', title: '出错' })
    render(<Toaster />)

    expect(screen.getAllByRole('status')).toHaveLength(1)
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })
})
