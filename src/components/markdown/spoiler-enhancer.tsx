'use client'

/**
 * Spoiler 增强器
 *
 * 服务端只产出 `<span class="md-spoiler">内容</span>`：没有 JS 时内容照常可读，
 * 只是「不能折叠」。这里做的是渐进增强：
 *
 *   - 给每个 spoiler 补 `role="button"` / `tabindex="0"` / `aria-expanded`
 *   - 委托 click 与 Enter / Space 切换 `data-revealed`
 *   - 状态挂在 `data-revealed` 上，样式负责模糊与还原，不在 JS 里改内联样式
 *
 * 只监听当前正文容器，卸载时全部摘掉；已在别的增强器里处理过的节点会跳过。
 */

import { useEffect, useRef, type ReactElement } from 'react'
import { locateProseScope } from './content-scope'

const SPOILER_SELECTOR = '.md-spoiler'
const SCOPE_FLAG = 'spoilerEnhanced'

function resolveSpoiler(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  return target.closest<HTMLElement>(SPOILER_SELECTOR)
}

function toggle(node: HTMLElement): void {
  const revealed = node.dataset.revealed === 'true'
  if (revealed) delete node.dataset.revealed
  else node.dataset.revealed = 'true'
  node.setAttribute('aria-expanded', revealed ? 'false' : 'true')
}

export function SpoilerEnhancer(): ReactElement {
  const markerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const scope = locateProseScope(markerRef.current, SCOPE_FLAG)
    if (!scope) return
    scope.dataset[SCOPE_FLAG] = 'true'

    for (const node of Array.from(scope.querySelectorAll<HTMLElement>(SPOILER_SELECTOR))) {
      if (node.dataset.spoilerReady === 'true') continue
      node.dataset.spoilerReady = 'true'
      node.tabIndex = 0
      node.setAttribute('role', 'button')
      node.setAttribute('aria-expanded', 'false')
    }

    const handleClick = (event: MouseEvent): void => {
      const node = resolveSpoiler(event.target)
      if (!node) return

      // 已展开的内容里点了链接：让它跳转，不要把点击吞成折叠
      if (
        node.dataset.revealed === 'true' &&
        event.target instanceof Element &&
        event.target.closest('a')
      ) {
        return
      }

      toggle(node)
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' && event.key !== ' ') return

      const node = resolveSpoiler(event.target)
      if (!node || event.target !== node) return

      event.preventDefault()
      toggle(node)
    }

    scope.addEventListener('click', handleClick)
    scope.addEventListener('keydown', handleKeyDown)

    return () => {
      scope.removeEventListener('click', handleClick)
      scope.removeEventListener('keydown', handleKeyDown)
      delete scope.dataset[SCOPE_FLAG]
    }
  }, [])

  return <span ref={markerRef} hidden />
}
