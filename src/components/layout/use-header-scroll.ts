'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * 导航状态：三种，不是两种。
 *
 *   top      页面顶部 —— Editorial Bar（通栏、透明）
 *   hidden   向下滚动 —— 整块滑出视口
 *   floating 向上滚动 —— Floating Dock（居中、玻璃）
 */
export type HeaderMode = 'top' | 'hidden' | 'floating'

/**
 * 顶部迟滞：离开与回来看的是两个不同的值。
 *
 * 单一阈值会在临界位置反复切换（72 / 71 / 72……），而导航在这种抖动下
 * 会闪成一片。中间那段 40–72px 保持上一个判断，等于给状态机加了一段
 * 死区；阈值只在本文件里存在，组件与 CSS 都不再各自判断「到顶没有」。
 */
const LEAVE_TOP = 72
/** 回到顶部的阈值。与 SHOW_THRESHOLD 同为 40 只是巧合：一个判位置，一个判位移 */
const ENTER_TOP = 40
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
 * 若按滚动处理，就会出现「点一下目录顶栏就往上窜」或「刷新后闪一下悬浮栏」。
 * 跳转的处理刻意不看方向：离开顶部一律落到 `hidden`，回顶部由上面的迟滞负责。
 */
const JUMP_THRESHOLD = 240

/** 服务端没有 layout 阶段；用 useEffect 占位，客户端才真的在绘制前同步 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

interface HeaderScrollState {
  /** 当前形态；CSS 用它切 `data-mode` */
  mode: HeaderMode
  /**
   * 丢掉方向历史、只按当前位置重新落定：在顶部 → `top`，否则 → `hidden`。
   *
   * 两个调用方：浏览器的 `pageshow` / `popstate`（恢复位置时没有方向可言），
   * 以及「下拉悬停冻结」的解除——冻结期间滚过的距离得补算，否则导航会
   * 停在冻结前的形态上。刻意**不**落成 `floating`：没有方向就没有理由
   * 猜测用户是「往回滚想找导航」。
   */
  resync: () => void
}

/**
 * 导航滚动行为
 *
 * 判据不是「最后一次滚动方向」，而是**同方向上的累计距离**：
 *
 *   - 离开顶部（scrollY > 72）：立刻进 `hidden`。顶部状态是通栏透明条，
 *     正文一旦滑到它下面就会从字缝里穿过去，所以这里不给累计余量。
 *   - 回来（scrollY < 40）：立刻回 `top`，同样不攒距离——40px 以内已经是
 *     「在页面顶部」。
 *   - 离开顶部之后向下：累计超过 96px 收成 `hidden`，触控板惯性不会触发。
 *   - 离开顶部之后向上：累计超过 40px 就显示 `floating`，因为往回滚通常
 *     意味着「我想找导航」；显示比隐藏更积极，两者用不同阈值是有意的。
 *   - 反向时累计值归零并重新计数，方向改变本身不立刻改变可见性。
 *
 * 性能：滚动回调只做算术，不读布局（不碰 getBoundingClientRect），
 * 不写 DOM；状态变化才触发一次 React 更新。rAF 合帧，passive 监听。
 *
 * 首次加载与浏览器恢复：
 *   - 初始 `top` 是服务端能给出的唯一答案，但客户端会在**绘制之前**
 *     （layout effect）读一次真实 `scrollY` 并纠正，所以恢复到的中段页面
 *     不会先画一帧顶部导航；
 *   - `pageshow`（bfcache 后退）与 `popstate` 各自再同步一次，因为这两条路径
 *     恢复滚动位置时不一定伴随一次 `scroll` 事件。
 *
 * 两种「按位置落定」的区别（这是本文件最容易改错的一处）：
 *   - `settle()`：没有方向可言，中段一律落成 `hidden`。用于首次挂载、`pageshow`、
 *     `popstate`——浏览器把页面放到某个位置，不是用户想找导航。
 *   - `restore()`：交互刚结束（菜单 / 搜索关闭、下拉解除），中段落成 `floating`。
 *     用户刚刚还在操作导航，这时把整块收走、连焦点一起丢掉，是最差的收尾。
 *     这正是「菜单打开时滚动、按 Escape 关闭」的路径：若落成 `hidden`，
 *     `visibility: hidden` 会让刚回到触发按钮的焦点立刻被浏览器丢弃。
 *
 * @param locked 交互锁定（菜单 / 搜索面板打开、指针停在下拉上）：
 *   为 true 时**冻结**当前状态——既不隐藏也不换形态。菜单是卡片的子节点，
 *   卡片先走掉，菜单就跟着一起没了。
 * @param hold   更细粒度的冻结（下拉悬停）。放在 ref 里而不是 state：
 *   指针每次进出下拉都 setState 会把整棵导航（含菜单子树）重渲染一遍。
 */
export function useHeaderScroll(
  locked = false,
  hold?: RefObject<boolean>,
): HeaderScrollState {
  const [mode, setMode] = useState<HeaderMode>('top')
  const modeRef = useRef<HeaderMode>('top')
  /** 迟滞之后的「是否在页面顶部」，与 mode 分开：40–72px 区间里两者可以不一致 */
  const atTop = useRef(true)
  const accumulated = useRef(0)
  const lastY = useRef(0)
  const ticking = useRef(false)
  const lockedRef = useRef(locked)
  /** effect 里定义的两个落定函数，交给 `resync()` 与解锁逻辑调用 */
  const restoreRef = useRef<() => void>(() => {})

  /**
   * 主 effect **只挂载一次**。
   *
   * 它刻意不依赖 `locked` / `hold`：那两项一变化就重跑 effect，会在挂载路径上
   * 再执行一次「按位置落定」，把菜单刚关闭时的可见形态强行改成 `hidden`。
   * 冻结标志走 ref，解锁的处理在下面那个独立 effect 里。
   */
  useIsomorphicLayoutEffect(() => {
    lastY.current = window.scrollY
    accumulated.current = 0
    // 首次（含恢复滚动位置）没有方向历史：40px 以内才算「在顶部」
    atTop.current = window.scrollY < ENTER_TOP
    /** 待执行的合帧回调：卸载时取消，避免在已卸载的组件上 setState */
    let frame = 0

    /**
     * 写状态。冻结期间直接丢弃：锁定不是「显示」，而是「不要动」。
     * @returns 是否真的提交了一次状态变化
     */
    const commit = (next: HeaderMode): boolean => {
      if (lockedRef.current || hold?.current) return false
      if (modeRef.current === next) return false
      modeRef.current = next
      setMode(next)
      return true
    }

    /**
     * 按位置落定，不带方向。
     * @param awayFromTop 离开顶部时落在哪个形态：恢复场景 `hidden`，交互解除 `floating`
     */
    const settleAt = (awayFromTop: HeaderMode) => {
      lastY.current = window.scrollY
      accumulated.current = 0
      if (window.scrollY < ENTER_TOP) {
        atTop.current = true
        commit('top')
        return
      }
      atTop.current = false
      commit(awayFromTop)
    }

    const settle = () => settleAt('hidden')
    const restore = () => settleAt('floating')
    restoreRef.current = restore

    const update = () => {
      ticking.current = false

      const y = window.scrollY
      const delta = y - lastY.current
      lastY.current = y

      // 迟滞：只有越过外侧阈值才翻转；中间区间保持上一个判断
      if (atTop.current) {
        if (y > LEAVE_TOP) atTop.current = false
      } else if (y < ENTER_TOP) {
        atTop.current = true
      }

      if (atTop.current) {
        accumulated.current = 0
        commit('top')
        return
      }

      // 一次性超大位移不是「用户在滚」，而是跳转（锚点、恢复位置、程序滚动）
      if (Math.abs(delta) > JUMP_THRESHOLD) {
        accumulated.current = 0
        commit('hidden')
        return
      }

      if (Math.abs(delta) < 1) {
        // 位置没变：这是挂载 / 解锁之后的同步。只纠正「已经离开顶部却还停在
        // top」这一种不一致，其余状态原样保留（冻结期间滚过的距离由 resync 补算）。
        if (modeRef.current === 'top') commit('hidden')
        return
      }

      // 方向反转：只有位移达到 epsilon 才算真的换向，避免同一帧内来回翻
      if (
        Math.abs(delta) >= DIRECTION_EPSILON &&
        ((delta > 0 && accumulated.current < 0) || (delta < 0 && accumulated.current > 0))
      ) {
        accumulated.current = 0
      }
      accumulated.current += delta

      if (delta > 0 && accumulated.current > HIDE_THRESHOLD) {
        if (commit('hidden')) accumulated.current = 0
        return
      }
      if (delta < 0 && accumulated.current < -SHOW_THRESHOLD) {
        if (commit('floating')) accumulated.current = 0
      }
    }

    const onScroll = () => {
      if (ticking.current) return
      ticking.current = true
      frame = requestAnimationFrame(update)
    }

    /**
     * 前进/后退、bfcache 恢复：滚动位置由浏览器直接放到目标值，
     * 不保证有一次 scroll 事件。这里丢掉方向历史后按位置落定，
     * 避免把恢复误判成「用户猛滚了一下」。
     */
    const onRestore = () => settle()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pageshow', onRestore)
    window.addEventListener('popstate', onRestore)
    settle()

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pageshow', onRestore)
      window.removeEventListener('popstate', onRestore)
    }
    // `hold` 是 ref：引用稳定，读 `.current` 不构成依赖
  }, [])

  /**
   * 冻结标志的同步（与主 effect 分离）。
   *
   * 解锁（true → false）时按位置**恢复成可见形态**：菜单刚关掉、焦点刚回到
   * 触发按钮，此时把整块滑走会让浏览器因为 `visibility: hidden` 丢弃焦点。
   * 恢复成 `floating` 而不是 `hidden`，也是因为用户此刻正在用导航。
   */
  useIsomorphicLayoutEffect(() => {
    const wasLocked = lockedRef.current
    lockedRef.current = locked
    if (wasLocked && !locked) restoreRef.current()
  }, [locked])

  const resync = useCallback(() => restoreRef.current(), [])

  return { mode, resync }
}
