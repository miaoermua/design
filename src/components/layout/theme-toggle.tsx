'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

/** 与 layout.tsx 里的防闪脚本共用同一个存储键 */
const STORAGE_KEY = 'folio-theme'

function readTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/**
 * 主题切换：只改 <html data-theme>，配色全部由 token 承担。
 * 首次访问跟随系统（防闪脚本已处理），手动切换后写入 localStorage。
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setTheme(readTheme())
    setReady(true)
  }, [])

  const toggle = () => {
    const next: Theme = readTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // 隐私模式下写入失败：本次会话仍然生效
    }
    setTheme(next)
  }

  const label = theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:border-[var(--edge)] hover:text-[var(--text-heading)]"
    >
      {ready ? (
        theme === 'dark' ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-[1.05rem]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
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
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
          </svg>
        )
      ) : (
        <span aria-hidden="true" className="size-[1.05rem]" />
      )}
    </button>
  )
}
