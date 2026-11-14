'use client'

/**
 * 实时连接的唯一宿主
 *
 * 挂在根布局里，整个站点只建立一条 Socket.IO 连接：
 * - 不渲染任何可见内容，因此不会影响 SSR 输出；
 * - 连接实例通过 `acquireRealtimeClient()` 的 globalThis 单例 + 引用计数获取，
 *   StrictMode / HMR / 重复挂载都复用同一个，不会重复注册监听器；
 * - 只在 effect 里 `connect()`，服务端不会触碰浏览器 API；
 * - 断网/恢复时切换 `pause` / `resume`，不自己造重连定时器；
 * - 卸载时释放引用，最后一个引用归零才 `stop()`。
 */

import { useEffect } from 'react'
import { acquireRealtimeClient } from '@/lib/realtime/client'
import { realtimeBus } from '@/lib/realtime/bus'
import { statusStore } from '@/lib/status/store'
import type { Locale } from '@/lib/i18n/config'

export interface RealtimeRuntimeProps {
  /** API origin；null 表示当前环境不启用实时能力（mock / 未配置 / 显式关闭） */
  origin: string | null
  lang: Locale
}

export function RealtimeRuntime({ origin, lang }: RealtimeRuntimeProps) {
  useEffect(() => {
    if (!origin) {
      statusStore.syncRealtime({
        status: 'idle',
        attempts: 0,
        reason: 'stopped',
        error: null,
      })
      return
    }

    const { client, release } = acquireRealtimeClient({
      origin,
      lang,
      onEvent: (event) => realtimeBus.emit(event),
      onState: (state) => {
        realtimeBus.updateState(state)
        statusStore.syncRealtime(state)
      },
    })

    realtimeBus.attachSession({ joinArticle: client.joinArticle })
    client.start()

    const handleOnline = () => {
      statusStore.setNetworkOnline(true)
      client.resume()
    }
    const handleOffline = () => {
      statusStore.setNetworkOnline(false)
      client.pause()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const online = navigator.onLine !== false
    statusStore.setNetworkOnline(online)
    if (!online) client.pause()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      const stopped = release()
      if (stopped) realtimeBus.attachSession(null)
    }
  }, [origin, lang])

  return null
}
