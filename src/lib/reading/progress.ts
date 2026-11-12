/**
 * 阅读进度（纯函数）
 *
 * 单独抽出来的原因：进度计算是「页面滚动了多少」的数学，不是 DOM 逻辑。
 * 把它放在组件里会让测试必须伪造一整页布局；放在这里可以用几个数字
 * 覆盖「短正文 / 长正文 / 未开始 / 已读完 / 超出边界」。
 *
 * 口径：以正文元素的顶部为起点、到底部为终点，视口高度以内的滚动不计。
 * 即「读完」= 正文底部与视口底部对齐，而不是滚动到页面最底（页脚不算）。
 */

export interface ProgressInput {
  /** 当前滚动位置（document 坐标） */
  scrollY: number
  /** 视口高度 */
  viewportHeight: number
  /** 正文顶部在 document 坐标中的位置 */
  contentTop: number
  /** 正文高度 */
  contentHeight: number
}

export function computeReadingProgress({
  scrollY,
  viewportHeight,
  contentTop,
  contentHeight,
}: ProgressInput): number {
  if (!Number.isFinite(scrollY) || !Number.isFinite(contentHeight)) return 0
  if (contentHeight <= 0 || viewportHeight <= 0) return 0

  const total = contentHeight - viewportHeight

  // 正文比视口还短：只有「已经越过正文底部」才算读完，否则一律 0。
  if (total <= 0) {
    return contentTop + contentHeight <= scrollY + viewportHeight ? 1 : 0
  }

  const current = (scrollY - contentTop) / total
  return clamp01(current)
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** 百分比取整：与屏幕上的数字保持一致，避免「99% 却已读完」的错觉 */
export function progressPercent(progress: number): number {
  return Math.round(clamp01(progress) * 100)
}
