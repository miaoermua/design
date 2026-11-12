import { cache } from 'react'
import { cloneDefaultThemeConfig } from './defaults'
import { parseThemeConfig } from './parser'
import { fetchThemeSnippet, type ThemeFetchStatus } from './repository'
import type { ThemeConfig } from './types'

/**
 * Theme Loader
 *
 * 页面只需要 `loadThemeConfig()` 一个入口：它把 repository 的状态
 * 与 parser 的结果合成「一定能用的配置」。
 *
 * 缓存：用 React `cache()` 做**单次请求内的去重**。同一页面里 Footer、
 * 首页、自定义 CSS 都会读配置，没有这层就会在一次渲染中发起多次相同请求
 * （虽然 Next 的 fetch 缓存会兜住，但多一次 Promise 链也是浪费）。
 * 跨请求的缓存交给 `requestV2` 的 `revalidate: 600` 与 `theme-config` tag。
 */

export interface LoadedTheme {
  config: ThemeConfig
  status: ThemeFetchStatus
  /** 远端是否提供了可用配置（用于决定某些「仅在配置后出现」的 UI） */
  remote: boolean
}

async function load(): Promise<LoadedTheme> {
  const result = await fetchThemeSnippet()

  if (result.status !== 'ok' || !result.data) {
    return { config: cloneDefaultThemeConfig(), status: result.status, remote: false }
  }

  const config = parseThemeConfig(result.data)
  return { config, status: 'ok', remote: true }
}

/**
 * 读取当前站点的主题配置。
 *
 * 永不抛错：Snippet 缺失、网络失败、格式不符都返回默认配置。
 * 页面不需要 try/catch，也不需要区分「没配」与「配错了」——
 * 这两者对读者而言都是「按默认样式显示」。
 */
export const loadThemeConfig = cache(load)

/**
 * 只取配置对象。
 *
 * 绝大多数组件只关心配置值，不关心 status；单独导出避免到处解构。
 */
export async function getThemeConfig(): Promise<ThemeConfig> {
  const { config } = await loadThemeConfig()
  return config
}