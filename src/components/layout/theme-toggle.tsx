'use client'

import { useSyncExternalStore } from 'react'
import { ToolbarButton } from './toolbar-button'

type Theme = 'light' | 'dark'

/** 与 layout.tsx 里的防闪脚本共用同一个存储键 */
const STORAGE_KEY = 'folio-theme'

/** 切换后由本组件派发，用来让 `useSyncExternalStore` 重新读取 <html data-theme> */
const THEME_EVENT = 'folio:themechange'

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/**
 * 服务端与首帧一律返回 `null`：那时还没有 `data-theme`，
 * 猜一个值只会在暗色用户那里先画错图标再改。`null` = 还不知道。
 */
function readServerTheme(): Theme | null {
  return null
}

function subscribeTheme(onChange: () => void): () => void {
  window.addEventListener(THEME_EVENT, onChange)
  return () => window.removeEventListener(THEME_EVENT, onChange)
}

interface ThemeToggleProps {
  /** 无障碍名称与 Tooltip 文本（随语言变化） */
  label: string
}

/**
 * 主题切换：只改 <html data-theme>，配色全部由 token 承担。
 * 首次访问跟随系统（防闪脚本已处理），手动切换后写入 localStorage。
 *
 * 生效的基准永远是 DOM 上的 `data-theme`，不是 React state：
 * 这样防闪脚本、跨标签页、以及任何直接改 `data-theme` 的地方都不会和按钮状态打架。
 *
 * 外观交给 ToolbarButton：它与搜索/语言/置顶是同一组工具，
 * 尺寸与交互反馈必须一致，不能四套各自维护。
 */
export function ThemeToggle({ label }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, readServerTheme)

  const toggle = () => {
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 隐私模式下写入失败：本次会话仍然生效
    }
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  return (
    <ToolbarButton label={label} onClick={toggle}>
      {theme === null ? (
        // 占位同尺寸，避免水合前后按钮宽度跳动
        <span aria-hidden="true" className="size-[1.05rem]" />
      ) : theme === 'dark' ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-[1.05rem]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-[1.05rem]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
        </svg>
      )}
    </ToolbarButton>
  )
}
