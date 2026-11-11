'use client'

import { useEffect, useRef, useState } from 'react'

/** 顶部安全区：滚动小于这个值永远显示顶栏 */
const TOP_ALWAYS_VISIBLE = 72
/** 向下滚动累计超过这个距离才隐藏（触控板抖动远小于此值） */
const HIDE_THRESHOLD = 96
/** 向上滚动累计超过这个距离才显示（比隐藏更敏感：用户想找导航时会往回滚） */
const SHOW_THRESHOLD = 40
/** 方向反转后需要稳定的最小位移，避免同一帧内来回翻 */
const DIRECTION_EPSILON = 6
/**
 * 单帧位移超过这个值视为「跳转」而不是滚动。
 *
 * 锚点跳转、回到顶部、浏览器恢复滚动位置都会产生几百到几千像素的一次性位移；
 * 若按滚动处理，用户点一下「回到文章目录」顶栏就会立刻滑走，很突兀。
 */
const JUMP_THRESHOLD = 240

interface HeaderScrollState {
  /** 是否应该隐藏（滑出视口） */
  hidden: boolean
  /** 是否已离开页首（用于决定是否显示投影/加深背景） */
  detached: boolean
}

/**
 * 顶栏滚动行为
 *
 * 判据不是「最后一次滚动方向」，而是**同方向上的累计距离**：
 *
 *   - 向下：累计超过 96px 才隐藏。触控板的惯性回弹只有几像素，
 *     单次方向判定会让顶栏反复抽搐；累计距离天然过滤这种抖动。
 *   - 向上：累计超过 40px 就显示。往回滚通常意味着「我想找导航」，
 *     所以显示比隐藏更积极，两者用不同阈值是有意的。
 *   - 反向时累计值归零并重新计数，方向改变本身不立刻改变可见性。
 *   - scrollY ≤ 72 时永远显示——页面在顶部时顶栏消失会很怪。
 *
 * 性能：滚动回调只做算术，不读布局（不碰 getBoundingClientRect），
 * 不写 DOM；状态变化才触发一次 React 更新。rAF 合帧，passive 监听。
 *
 * @param locked 交互锁定（搜索面板打开、输入框聚焦等）：为 true 时强制显示
 */
export function useHeaderScroll(locked = false): HeaderScrollState {
  const [state, setState] = useState<HeaderScrollState>({ hidden: false, detached: false })
  const accumulated = useRef(0)
  const lastY = useRef(0)
  const ticking = useRef(false)
  const hiddenRef = useRef(false)

  useEffect(() => {
    lastY.current = window.scrollY
    accumulated.current = 0

    const update = () => {
      ticking.current = false

      const y = window.scrollY
      const delta = y - lastY.current
      lastY.current = y

      // 页首附近永远显示，并清空累计（回顶时不残留「该隐藏」的惯性）
      if (y <= TOP_ALWAYS_VISIBLE) {
        accumulated.current = 0
        if (hiddenRef.current) {
          hiddenRef.current = false
          setState({ hidden: false, detached: false })
        } else {
          setState((prev) => (prev.detached ? { hidden: false, detached: false } : prev))
        }
        return
      }

      const detached = y > TOP_ALWAYS_VISIBLE

      if (Math.abs(delta) < 1) {
        setState((prev) => (prev.detached === detached ? prev : { ...prev, detached }))
        return
      }

      // 一次性超大位移不是「用户在滚」，而是跳转（锚点、回到顶部、路由切换）。
      // 这类跳转不该触发隐藏：把位置记住、累计清零，直接返回。
      if (Math.abs(delta) > JUMP_THRESHOLD) {
        accumulated.current = 0
        if (hiddenRef.current) {
          hiddenRef.current = false
          setState({ hidden: false, detached })
        } else {
          setState((prev) => (prev.detached === detached ? prev : { ...prev, detached }))
        }
        return
      }

      // 方向反转：只有位移达到 epsilon 才算真的换向，避免同一帧内来回翻导致累计值反复清零
      if (
        Math.abs(delta) >= DIRECTION_EPSILON &&
        ((delta > 0 && accumulated.current < 0) || (delta < 0 && accumulated.current > 0))
      ) {
        accumulated.current = 0
      }
      accumulated.current += delta

      let hidden = hiddenRef.current
      let changed = false

      if (delta > 0 && !hidden && accumulated.current > HIDE_THRESHOLD) {
        // 向下：累计够了才隐藏
        hidden = true
        changed = true
      } else if (delta < 0 && hidden && Math.abs(accumulated.current) > SHOW_THRESHOLD) {
        // 向上：门槛更低，用户往回滚就是想找导航
        hidden = false
        changed = true
      }

      // 状态没变时不要动累计值——它还要继续往阈值上攒
      if (changed) accumulated.current = 0
      hiddenRef.current = hidden

      setState((prev) =>
        prev.hidden === hidden && prev.detached === detached ? prev : { hidden, detached },
      )
    }

    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    update()

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // 交互锁定期间不允许隐藏：搜索面板/输入框聚焦时顶栏突然滑走会中断操作
  return locked ? { hidden: false, detached: state.detached } : state
}