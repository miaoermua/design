'use client'

/**
 * 实时连接的唯一宿主
 *
 * 挂在根布局里，整个站点只建立一条 Socket.IO 连接：
 * - 不渲染任何可见内容，因此不会影响 SSR 输出；
 * - 连接实例通过 `acquireRealtimeClient()` 的 globalThis 共享宿主 + 引用计数获取，
 *   StrictMode / HMR / 重复挂载都复用同一个，不会重复注册监听器；
 * - 只在 effect 里 `connect()`，服务端不会触碰浏览器 API；
 * - 断网/恢复时切换 `pause` / `resume`，不自己造重连定时器；
 * - 页面重新可见时，若会话已被服务端关掉（`server-closed`，Manager 不会自动重连），
 *   复用同一个实例 `resume()` 一次；其余状态不碰；
 * - 卸载时释放引用，最后一个引用归零才 `stop()`。
 *
 * 语言变化只改握手 query（`client.setLang()`），**不换连接实例**：换实例会
 * `stop()` 掉旧连接并清空房间订阅，而文章页的 `LiveArticleUpdater` 只订阅一次
 * 房间、不会因为 `lang` 变化重新挂载（语言切换走 cookie + `router.refresh()`，
 * 不是路由跳转），那样正文实时更新会在切换语言后静默失效。
 */

import { useEffect, useRef } from 'react'
import { acquireRealtimeClient, type RealtimeClient } from '@/lib/realtime/client'
import { realtimeBus } from '@/lib/realtime/bus'
import { statusStore } from '@/lib/status/store'
import type { Locale } from '@/lib/i18n/config'

export interface RealtimeRuntimeProps {
  /** API origin；null 表示当前环境不启用实时能力（mock / 未配置 / 显式关闭） */
  origin: string | null
  lang: Locale
}

export function RealtimeRuntime({ origin, lang }: RealtimeRuntimeProps) {
  const clientRef = useRef<RealtimeClient | null>(null)
  // 建立连接时用的语言；后续变化由下面的 effect 通过 setLang 生效
  const langRef = useRef(lang)

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
      lang: langRef.current,
      onEvent: (event) => realtimeBus.emit(event),
      onState: (state) => {
        realtimeBus.updateState(state)
        statusStore.syncRealtime(state)
      },
    })

    clientRef.current = client
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

    /**
     * 页面重新可见时补一次恢复机会。
     *
     * 只处理一种状态：`offline` + `server-closed` —— 服务端关掉 namespace 后
     * Manager 不会自动重连，`resume()` 是这个状态的唯一出口（它内部对
     * connecting / online / reconnecting 本身就是空操作，这里再显式判一次状态，
     * 避免对正常连接「顺手」调用）。
     */
    const handleVisible = () => {
      if (document.visibilityState !== 'visible') return
      const state = client.getState()
      if (state.status !== 'offline' || state.reason !== 'server-closed') return
      client.resume()
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisible)

    const online = navigator.onLine !== false
    statusStore.setNetworkOnline(online)
    if (!online) client.pause()

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisible)
      clientRef.current = null
      const stopped = release()
      if (stopped) realtimeBus.attachSession(null)
    }
  }, [origin])

  // 语言变化：只重建 namespace 会话（握手 query 变了），房间订阅保留在 client 里，
  // 连接成功后自动补发 join。
  useEffect(() => {
    langRef.current = lang
    clientRef.current?.setLang(lang)
  }, [lang])

  return null
}
