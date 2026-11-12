import { describe, expect, it } from 'vitest'
import { computeReadingProgress, progressPercent } from '@/lib/reading/progress'

/**
 * 阅读进度口径
 *
 * 这些数字不是随手编的：正文顶部在 800、高度 4000、视口 800 时，
 * 「可滚动区间」= 4000 - 800 = 3200，即读到底的滚动位置是 800 + 3200。
 * 边界（未开始 / 已读完 / 越过终点）比中间值更容易写错，优先覆盖。
 */
const BASE = { viewportHeight: 800, contentTop: 800, contentHeight: 4000 }

describe('computeReadingProgress', () => {
  it('回到正文顶部之前一律 0', () => {
    expect(computeReadingProgress({ ...BASE, scrollY: 0 })).toBe(0)
    expect(computeReadingProgress({ ...BASE, scrollY: 799 })).toBe(0)
  })

  it('正文顶部与视口顶部对齐时是 0', () => {
    expect(computeReadingProgress({ ...BASE, scrollY: 800 })).toBe(0)
  })

  it('正文底部与视口底部对齐时是 1（读完）', () => {
    expect(computeReadingProgress({ ...BASE, scrollY: 800 + 3200 })).toBe(1)
  })

  it('中间位置线性推进', () => {
    expect(computeReadingProgress({ ...BASE, scrollY: 800 + 1600 })).toBeCloseTo(0.5, 5)
  })

  it('越过终点后停在 1，不会超过', () => {
    expect(computeReadingProgress({ ...BASE, scrollY: 99_999 })).toBe(1)
  })

  it('正文比视口短：没滚到底部以下算 0，越过底部才算读完', () => {
    const short = { viewportHeight: 800, contentTop: 800, contentHeight: 400 }
    // 正文底部 1200，视口底部 800 + 0 = 800，还没到
    expect(computeReadingProgress({ ...short, scrollY: 0 })).toBe(0)
    // 视口底部 800 + 400 = 1200，正好对齐
    expect(computeReadingProgress({ ...short, scrollY: 400 })).toBe(1)
  })

  it('高度为 0 或非有限值时返回 0，而不是 NaN', () => {
    expect(computeReadingProgress({ ...BASE, contentHeight: 0, scrollY: 900 })).toBe(0)
    expect(computeReadingProgress({ ...BASE, viewportHeight: 0, scrollY: 900 })).toBe(0)
    expect(
      computeReadingProgress({ ...BASE, contentHeight: Number.POSITIVE_INFINITY, scrollY: 900 }),
    ).toBe(0)
    expect(computeReadingProgress({ ...BASE, scrollY: Number.NaN })).toBe(0)
  })
})

describe('progressPercent', () => {
  it('四舍五入到整数百分比', () => {
    expect(progressPercent(0)).toBe(0)
    expect(progressPercent(0.005)).toBe(1)
    expect(progressPercent(0.334)).toBe(33)
    expect(progressPercent(0.335)).toBe(34)
    expect(progressPercent(1)).toBe(100)
  })

  it('越过 0..1 的输入会被夹住', () => {
    expect(progressPercent(-1)).toBe(0)
    expect(progressPercent(4)).toBe(100)
    expect(progressPercent(Number.NaN)).toBe(0)
  })
})
