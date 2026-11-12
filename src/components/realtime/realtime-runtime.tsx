'use client'

/**
 * 实时连接的唯一宿主
 *
 * 挂在根布局里，整个站点只建立一条连接：
 * - 不渲染任何可见内容，因此不会影响 SSR 输出；
 * - 只在 effect 里 new WebSocket，服务端不会触碰浏览器 API；
 * - 断网/恢复时切换 `pause` / `resume`，而不是让浏览器无限重连；
 * - 卸载时 `stop()`，避免热更新或路由切换后留下野连接。
 */

import { useEffect } from 'react'
import { createRealtimeClient } from '@/lib/realtime/client'
import { realtimeBus } from '@/lib/realtime/bus'
import { statusStore } from '@/lib/status/store'
import type { Locale } from '@/lib/i18n/config'

export interface RealtimeRuntimeProps {
  /** null 表示当前环境不启用实时能力（mock / 未配置 / 显式关闭） */
  url: string | null
  lang: Locale
}

export function RealtimeRuntime({ url, lang }: RealtimeRuntimeProps) {
  useEffect(() => {
    if (!url) {
      statusStore.syncRealtime({
        status: 'idle',
        attempts: 0,
        retryInMs: null,
        reason: 'stopped',
      })
      return
    }

    const client = createRealtimeClient({
      url,
      onEvent: (envelope) => realtimeBus.emit(envelope),
      onState: (state) => {
        realtimeBus.updateState(state)
        statusStore.syncRealtime(state)
      },
    })

    client.setLang(lang)
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
      realtimeBus.attachSession(null)
      client.stop()
    }
  }, [url, lang])

  return null
}
