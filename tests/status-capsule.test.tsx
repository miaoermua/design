// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  snapshot: { kind: 'realtime' as string | null, message: '实时连接已断开，正在重试', attempt: 2 },
}))

vi.mock('@/lib/status/use-status', () => ({
  useStatusSnapshot: () => state.snapshot,
}))

import { StatusCapsule } from '@/components/ui/status-capsule'

afterEach(cleanup)

beforeEach(() => {
  state.snapshot = { kind: 'realtime', message: '实时连接已断开，正在重试', attempt: 2 }
})

describe('StatusCapsule', () => {
  it('横向拖动后关闭当前状态胶囊', () => {
    render(<StatusCapsule />)
    const capsule = screen.getByRole('status')

    fireEvent.pointerDown(capsule, { pointerId: 1, button: 0, clientX: 180 })
    fireEvent.pointerUp(capsule, { pointerId: 1, button: 0, clientX: 110 })

    expect(screen.queryByRole('status')).toBeNull()
  })

  it('状态快照出现新实例时重新显示胶囊', () => {
    const view = render(<StatusCapsule />)
    const capsule = screen.getByRole('status')
    fireEvent.pointerDown(capsule, { pointerId: 1, button: 0, clientX: 180 })
    fireEvent.pointerUp(capsule, { pointerId: 1, button: 0, clientX: 110 })
    expect(screen.queryByRole('status')).toBeNull()

    state.snapshot = { kind: null, message: '', attempt: 0 }
    view.rerender(<StatusCapsule />)
    state.snapshot = { kind: 'realtime', message: '实时连接已断开，正在重试', attempt: 2 }
    view.rerender(<StatusCapsule />)

    expect(screen.getByRole('status')).toBeTruthy()
  })

  it('提供可键盘操作的关闭按钮', () => {
    render(<StatusCapsule locale="en" />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss status notification' }))

    expect(screen.queryByRole('status')).toBeNull()
  })
})
