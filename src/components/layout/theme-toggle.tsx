'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * 三态主题
 *
 * `system` **不是存储值**，而是「键不存在」这个状态本身：
 *   - 键缺失     → 跟随系统
 *   - `"light"` → 浅色
 *   - `"dark"`  → 深色
 *
 * 之所以不写 `"system"`：删除键就能回到跟随系统，不需要一个与「没有偏好」
 * 语义重复的哨兵值；也让 layout 里那段防闪脚本只判断两种情况。
 */
export type ThemePreference = 'system' | 'light' | 'dark'
type ResolvedTheme = 'light' | 'dark'
/** 与 layout.tsx 里的防闪脚本共用同一个存储键 */
export const THEME_STORAGE_KEY = 'folio-theme'

/** 切换后由本组件派发，用来让 `useSyncExternalStore` 重新读取偏好 */
const THEME_EVENT = 'folio:themechange'

/** 过渡类由 CSS 限定在颜色属性上；这里只负责在切换结束后摘掉它 */
const TRANSITION_CLASS = 'theme-transition'
const TRANSITION_MS = 300

let transitionTimer: number | undefined

function prefersDark(): boolean {
  // jsdom 没有 matchMedia；真实浏览器与预渲染环境都要能安全调用
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'dark' || stored === 'light' ? stored : 'system'
  } catch {
    return 'system'
  }
}

function resolve(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') return prefersDark() ? 'dark' : 'light'
  return preference
}

/** 只写 DOM，不写存储：调用方决定这次是「用户操作」还是「跟随外部变化」 */
function applyPreference(preference: ThemePreference) {
  document.documentElement.dataset.theme = resolve(preference)
}

/**
 * 服务端与首帧一律返回 `null`：那时还没有 `data-theme`，
 * 猜一个值只会在暗色用户那里先画错图标再改。`null` = 还不知道。
 */
function readServerPreference(): null {
  return null
}

function subscribePreference(onChange: () => void): () => void {
  // 挂载时对齐一次：预渲染产物没有 data-theme，防闪脚本在部分环境下也可能没跑
  applyPreference(readPreference())

  window.addEventListener(THEME_EVENT, onChange)

  // 跨标签同步：另一个标签设成 Light / Dark / 删除键，这里都要跟上。
  // `key === null` 是 `localStorage.clear()`，同样视为「回到跟随系统」。
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return
    applyPreference(readPreference())
    onChange()
  }
  window.addEventListener('storage', onStorage)

  // 系统配色变化只影响「跟随系统」，且不播放过渡：那是系统行为，不是用户操作
  const query =
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null
  const onSystemChange = () => {
    if (readPreference() === 'system') applyPreference('system')
  }
  query?.addEventListener('change', onSystemChange)

  return () => {
    window.removeEventListener(THEME_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
    query?.removeEventListener('change', onSystemChange)
  }
}

/**
 * 主题三态的唯一读写入口。
 *
 * 页脚的三段单选消费这个 hook：「跟随系统 = 删除键」「切换时加 300ms 颜色过渡」
 * 「派发事件通知同页其它订阅者」这三条规则只在这里实现一次，
 * 新增入口不可能绕开它们写出第四种行为。
 */
export function useThemePreference() {
  const preference = useSyncExternalStore<ThemePreference | null>(
    subscribePreference,
    readPreference,
    readServerPreference,
  )

  const setPreference = useCallback((next: ThemePreference) => {
    const commit = () => {
      try {
        if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
        else window.localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // 隐私模式下写入失败：本次会话仍然生效，只是刷新后不保留
      }
      applyPreference(next)
    }

    if (prefersReducedMotion()) {
      commit()
    } else {
      // 过渡类只在这 300ms 内存在，且只覆盖颜色属性
      const root = document.documentElement
      root.classList.add(TRANSITION_CLASS)
      commit()
      window.clearTimeout(transitionTimer)
      transitionTimer = window.setTimeout(
        () => root.classList.remove(TRANSITION_CLASS),
        TRANSITION_MS,
      )
    }

    window.dispatchEvent(new Event(THEME_EVENT))
  }, [])

  return { preference, setPreference }
}

/** 主题三态的图标：页脚三段单选与文档示例共用，避免各画一套 */
export function ThemeGlyph({ value }: { value: ThemePreference }) {
  if (value === 'light') return <SunIcon />
  if (value === 'dark') return <MoonIcon />
  return <MonitorIcon />
}

function MonitorIcon() {
  return (
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
      <rect x="3" y="4.5" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16.5V20" />
    </svg>
  )
}

function SunIcon() {
  return (
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
  )
}

function MoonIcon() {
  return (
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
  )
}
