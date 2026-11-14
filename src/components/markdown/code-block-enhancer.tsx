'use client'

/**
 * 代码块增强器
 *
 * 服务端已经把卡片骨架（标题栏 / 行号槽 / 滚动区）和 Shiki 高亮一起产出，
 * 这里只补三件必须跑在浏览器里的事：
 *
 *   1. 复制按钮 —— 放进标题栏右侧，始终可见（不依赖 hover，手机也能点到）
 *   2. 复制行为 —— 从 `.line` 逐个取文本再拼行，因此**不含行号、语言标识与装饰**
 *   3. 折叠 —— 内容高于视口一半时才出现「展开」，短代码块不留多余控件
 *
 * 不重新解析 Shiki 的 HTML：DOM 只被读取文本与测量高度，`<pre>` 一棵子树原样保留。
 * 写法沿用 `media-enhancer` / `spoiler-enhancer` 的既有约定：定位当前正文容器、
 * 挂 `data-*` 状态、卸载时全部还原。
 */

import { useEffect, useRef, type ReactElement } from 'react'
import { locateProseScope } from './content-scope'

const BLOCK_SELECTOR = '.code-block'
/** mermaid 块自带 `<pre>`，但不属于普通代码块，必须跳过 */
const MERMAID_SELECTOR = '.mermaid-block'
const SCOPE_FLAG = 'codeEnhanced'

const COPY_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M5.5 5.5V3.25A1.25 1.25 0 0 1 6.75 2h6A1.25 1.25 0 0 1 14 3.25v6A1.25 1.25 0 0 1 12.75 10.5H10.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><rect x="2" y="5.5" width="8.5" height="8.5" rx="1.25" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
const CHECK_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const WARN_ICON =
  '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 4.5v4.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.4" r="1" fill="currentColor"/></svg>'

/** 折叠阈值：视口一半，与 Shiro 的 `max-h-[50vh]` 同口径 */
const COLLAPSE_RATIO = 0.5

/** 从代码块里取出可复制的纯文本 */
function readCode(block: HTMLElement): string {
  const lines = block.querySelectorAll<HTMLElement>('.code-block__content .line')

  // Shiki 输出：一行一个 `.line`，直接拼文本即不含任何装饰
  if (lines.length > 0) {
    return Array.from(lines, (line) => line.textContent ?? '').join('\n')
  }

  // 纯文本降级（未知语言 / 高亮失败）：整个 `<code>` 原样取
  const code = block.querySelector('.code-block__content code')
  return code?.textContent ?? ''
}

/** 兜底复制：剪贴板 API 不可用时（非安全上下文 / 权限被拒）走选区 + 命令 */
function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0'
  document.body.appendChild(area)

  try {
    area.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    area.remove()
  }
}

/** 复制按钮：图标两层叠放，状态只切 `data-state`，不在 JS 里改内容 */
function createCopyButton(): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'code-block__copy'
  button.setAttribute('aria-label', '复制代码')
  button.innerHTML = [
    `<span class="code-block__copy-icon">${COPY_ICON}</span>`,
    `<span class="code-block__copy-done">${CHECK_ICON}</span>`,
    `<span class="code-block__copy-fail">${WARN_ICON}</span>`,
  ].join('')
  return button
}

export function CodeBlockEnhancer(): ReactElement {
  const markerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const scope = locateProseScope(markerRef.current, SCOPE_FLAG)
    if (!scope) return
    scope.dataset[SCOPE_FLAG] = 'true'

    const timers = new Set<number>()
    const blocks = Array.from(scope.querySelectorAll<HTMLElement>(BLOCK_SELECTOR)).filter(
      (block) => !block.closest(MERMAID_SELECTOR),
    )

    /** 复制成功后短暂展示状态 */
    const flash = (button: HTMLButtonElement, state: 'copied' | 'failed'): void => {
      button.dataset.state = state
      const timer = window.setTimeout(() => {
        delete button.dataset.state
        button.setAttribute('aria-label', '复制代码')
        timers.delete(timer)
      }, 1800)
      timers.add(timer)
    }

    const handleCopy = (event: MouseEvent): void => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
        '.code-block__copy',
      )
      if (!button) return

      const block = button.closest<HTMLElement>(BLOCK_SELECTOR)
      if (!block) return

      event.preventDefault()
      const text = readCode(block)

      const done = (): void => {
        button.setAttribute('aria-label', '已复制')
        flash(button, 'copied')
      }
      const fail = (): void => {
        if (legacyCopy(text)) done()
        else {
          button.setAttribute('aria-label', '复制失败，请手动选择代码')
          flash(button, 'failed')
        }
      }

      // 剪贴板写入是异步的，且在没有权限的环境里会 reject
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done, fail)
      } else {
        fail()
      }
    }

    const handleExpand = (event: MouseEvent): void => {
      const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
        '.code-block__expand',
      )
      if (!button) return

      const block = button.closest<HTMLElement>(BLOCK_SELECTOR)
      if (!block) return

      event.preventDefault()
      // 用户主动展开后不再自动收回：窗口变窄时重新折叠会打断阅读
      block.dataset.collapsed = 'false'
      block.dataset.expanded = 'user'
      button.hidden = true
    }

    /**
     * 折叠判定：只在内容高于视口一半时生效。
     *
     * 用 `scrollHeight` 读真实高度，因此不受上一次 `max-height` 影响 ——
     * 展开状态也能正确算回「要不要折叠」。
     */
    const measure = (block: HTMLElement): void => {
      if (block.classList.contains('code-block--expand')) return
      if (block.dataset.expanded === 'user') return

      const body = block.querySelector<HTMLElement>('.code-block__body')
      const expand = block.querySelector<HTMLButtonElement>('.code-block__expand')
      if (!body || !expand) return

      // 隐藏元素（折叠的 details、切走的 tab）测不出高度，先不判定
      if (body.clientHeight === 0) return

      const limit = window.innerHeight * COLLAPSE_RATIO
      const overflow = body.scrollHeight > limit
      block.dataset.collapsed = overflow ? 'true' : 'false'
      expand.hidden = !overflow
    }

    const mounted: HTMLElement[] = []

    for (const block of blocks) {
      if (block.dataset.codeReady === 'true') continue
      block.dataset.codeReady = 'true'
      mounted.push(block)

      const header = block.querySelector<HTMLElement>('.code-block__header')
      if (header) header.appendChild(createCopyButton())

      // 行号只是给眼睛的刻度：读屏念出「1 2 3 …」是纯噪声。
      // 属性在这里补而不是服务端写死 —— 安全边界不放行 `aria-*`，
      // 作者手写的 aria-hidden 会被清洗掉（见 `lib/content/sanitize.ts`）。
      block.querySelector('.code-block__gutter')?.setAttribute('aria-hidden', 'true')

      // 「展开」按钮放在卡片尾部，样式用渐变把代码压暗过渡到它
      const expand = document.createElement('button')
      expand.type = 'button'
      expand.className = 'code-block__expand'
      expand.hidden = true
      expand.innerHTML = '<span>展开</span>'
      block.appendChild(expand)

      measure(block)
    }

    // 视口变化会改变「一半」的高度，重新判定一次；已手动展开的块跳过
    let frame = 0
    const handleResize = (): void => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        for (const block of mounted) measure(block)
      })
    }

    scope.addEventListener('click', handleCopy)
    scope.addEventListener('click', handleExpand)
    window.addEventListener('resize', handleResize)

    return () => {
      scope.removeEventListener('click', handleCopy)
      scope.removeEventListener('click', handleExpand)
      window.removeEventListener('resize', handleResize)
      if (frame) window.cancelAnimationFrame(frame)
      for (const timer of timers) window.clearTimeout(timer)
      timers.clear()

      // 还原成服务端产出的样子：摘掉增强节点与状态属性
      for (const block of mounted) {
        block.querySelector('.code-block__copy')?.remove()
        block.querySelector('.code-block__expand')?.remove()
        delete block.dataset.codeReady
        delete block.dataset.collapsed
        delete block.dataset.expanded
      }
      delete scope.dataset[SCOPE_FLAG]
    }
  }, [])

  return <span ref={markerRef} hidden />
}
