'use client'

import { useEffect } from 'react'

/**
 * 开发者工具提示（BanDevtool）
 *
 * 关于命名与预期：这个配置项叫 `bandevtool`，但**它做不到「禁用」开发者工具**。
 * 浏览器不允许页面阻止 DevTools —— 任何号称能做到的方案，本质上都是
 * 「检测到就卡住页面」，代价是牺牲正常用户的性能与可访问性。
 *
 * 因此这里采取最克制的实现：
 *   - 默认关闭，只有 `bandevtool.enabled: true` 才挂载；
 *   - 检测方式只有一种：比较窗口内外尺寸差（DevTools 停靠时的典型特征）；
 *   - 命中后只在控制台输出一条提示，**不阻断、不卡顿、不循环、不修改 DOM**；
 *   - 键盘、辅助技术、表单、滚动全部不受影响。
 *
 * 明确不做的事（这些会伤害真实用户）：
 *   - `debugger` 死循环：会冻结标签页，也会被 reduced-motion 之外的策略影响；
 *   - 高频 `setInterval` 检测：白白消耗 CPU，笔记本电池直接受影响；
 *   - 篡改 `console`、重写 `toString`：破坏调试与错误上报；
 *   - 任何持久化（localStorage / Cookie / IndexedDB）或跳转。
 *
 * 结论：这是一个「提示」，不是安全措施。真正的防护是不要在前端放敏感逻辑。
 */
export function DevtoolNotice() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const THRESHOLD = 160
    let warned = false

    const check = () => {
      if (warned) return
      const widthGap = window.outerWidth - window.innerWidth
      const heightGap = window.outerHeight - window.innerHeight
      if (widthGap > THRESHOLD || heightGap > THRESHOLD) {
        warned = true
        // 只提示一次，不重复输出、不影响任何交互
        console.info(
          '[folio] 检测到开发者工具处于打开状态。这个站点没有隐藏任何敏感逻辑，调试请自便。',
        )
      }
    }

    // 只监听 resize：DevTools 停靠/取消停靠必然改变视口尺寸，
    // 比轮询省得多，也不会在用户滚动或输入时反复触发。
    window.addEventListener('resize', check, { passive: true })
    check()

    return () => window.removeEventListener('resize', check)
  }, [])

  return null
}