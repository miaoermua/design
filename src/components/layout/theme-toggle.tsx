'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { MingCuteIcon } from '@/components/ui/mingcute-icon'

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

/**
 * 主题切换的过渡交给**浏览器原生的 View Transition**。
 *
 * 上一版是「给 `<html>` 临时加 `.theme-transition`，再用
 * `html.theme-transition *` 给全站每个元素挂 240ms 颜色过渡」。代价实测：
 * 文章页（664 个节点）一次切换触发 **52ms** 同步样式计算 + 一个 55ms 长任务，
 * 而接下来 240ms 里上千个元素各自补间 background/color/box-shadow/fill/stroke——
 * 颜色属性走的是重绘，等于把整屏重绘十几遍。友链页 65 张卡片直接掉到个位数帧率，
 * 当时只能在 `friend-postcard.css` 里给那一页单独打「瞬切」补丁。
 *
 * View Transition 只对**新旧两帧快照**做一次合成层交叉淡入：主线程只做一次
 * 真实的样式重算（约 4ms），补间在合成器上跑，与节点数量无关。
 * 不支持该 API 或用户要求减弱动效时直接瞬切——那才是这条路径的默认形态，
 * 淡入只是增强。时长（240ms）写在 `globals.css` 的 `::view-transition-*` 规则里。
 */
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

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
 * 页脚的三段单选消费这个 hook：「跟随系统 = 删除键」「切换走一次 View Transition」
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
    /**
     * 三件事必须成对发生在这个闭包里：写存储 → 写 `data-theme` → 通知订阅者。
     *
     * **通知不能放到 `startViewTransition()` 之后**：浏览器的更新回调是
     * **异步**执行的（要先拍下旧帧快照，实测约 16ms 后才跑）。放在外面派发时，
     * React 被叫醒去读 `localStorage`，读到的还是旧值，于是页面变暗了、
     * 页脚三段单选的勾却停在上一态，而且之后再没有任何事件让它重新读。
     */
    const commit = () => {
      try {
        if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
        else window.localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // 隐私模式下写入失败：本次会话仍然生效，只是刷新后不保留
      }
      applyPreference(next)
      window.dispatchEvent(new Event(THEME_EVENT))
    }

    const doc = document as ViewTransitionDocument
    if (prefersReducedMotion() || typeof doc.startViewTransition !== 'function') {
      commit()
    } else {
      try {
        doc.startViewTransition(commit)
      } catch {
        // 连续点击时可能已有一次过渡在跑：退回瞬切，不能把这次切换丢掉
        commit()
      }
    }
  }, [])

  return { preference, setPreference }
}

/** 主题三态的图标：页脚三段单选与文档示例共用，避免各画一套 */
export function ThemeGlyph({ value }: { value: ThemePreference }) {
  if (value === 'light') {
    return <MingCuteIcon name="mingcute:sun-line" className="size-[1.05rem]" />
  }
  if (value === 'dark') {
    return <MingCuteIcon name="mingcute:moon-line" className="size-[1.05rem]" />
  }
  return <MingCuteIcon name="mingcute:monitor-line" className="size-[1.05rem]" />
}
