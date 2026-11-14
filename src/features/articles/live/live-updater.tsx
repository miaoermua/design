'use client'

/**
 * 文章页的实时更新接线
 *
 * 分工：
 * - **决定要不要更新**在 `controller.ts`（纯逻辑，可单测）；
 * - **怎么更新**在这里：只让 Next 重新渲染当前路由，不自己拼 HTML。
 *   这样正文、目录、阅读时长、上下篇、`modifiedAt` 全都走同一条渲染管线，
 *   也天然满足「不信任事件 payload 里的正文」。
 *
 * 为什么用 `router.refresh()` 而不是自己 fetch 正文：
 * 1. 服务端组件重新执行时仍走 `src/lib/api` 与 Markdown 渲染管线，没有第二套实现；
 * 2. 客户端状态（图片预览、主题等）不会被重置；
 * 3. 配合 BFF 里的 `revalidateTag('posts')`，拿到的确实是新数据。
 *
 * 滚动位置：`router.refresh()` 本身不跳转，但内容高度变化时浏览器可能挪动
 * 视口；这里在刷新前后各记一次位置，必要时用 `scrollTo` 复位。
 */

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { notify } from '@/lib/notifications/store'
import { realtimeBus } from '@/lib/realtime/bus'
import { useRealtimeEvent, useRealtimeSnapshot } from '@/lib/realtime/use-realtime'
import { statusStore } from '@/lib/status/store'
import {
  createLiveArticleController,
  toArticleSignal,
  type ArticleIdentity,
  type RefreshOutcome,
  type RefreshRequest,
} from './controller'
import { requestArticleRefresh } from './refresh'

/** 降级轮询间隔：只在实时连接不可用、且页面可见时才发请求 */
const POLL_INTERVAL_MS = 60_000

/**
 * 恢复核对与「页面可见 / 轮询」核对的最小间隔。
 *
 * 页面重新可见会先触发降级核对（此时状态还是 offline），紧接着连接恢复成功又会
 * 触发恢复核对；两者落在同一个瞬间时只保留一次请求。不同时刻的核对不受影响。
 */
const RECOVERY_CHECK_DEDUPE_MS = 3_000

export interface LiveArticleUpdaterProps {
  identity: ArticleIdentity
  /** 服务端判定是否启用了实时能力（未配置 / mock / MX_REALTIME=off 时为 false） */
  enabled: boolean
}

function refreshKeepingScroll(refresh: () => void): void {
  if (typeof window === 'undefined') return
  const y = window.scrollY
  const restore = () => {
    // 只在用户没有主动滚动时复位，避免和读者抢滚动条
    if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y)
  }
  refresh()
  window.requestAnimationFrame(restore)
  window.setTimeout(restore, 280)
}

export function LiveArticleUpdater({ identity, enabled }: LiveArticleUpdaterProps) {
  const router = useRouter()
  const snapshot = useRealtimeSnapshot()

  // identity 的最新值：刷新成功后 props 会变，但 controller 要在整个生命周期里
  // 读到新的 modifiedAt，否则同一版本的事件会被反复当成「新变化」。
  const identityRef = useRef<ArticleIdentity>({
    id: identity.id,
    category: identity.category,
    slug: identity.slug,
    modifiedAt: identity.modifiedAt,
  })

  useEffect(() => {
    identityRef.current.id = identity.id
    identityRef.current.category = identity.category
    identityRef.current.slug = identity.slug
    identityRef.current.modifiedAt = identity.modifiedAt
  }, [identity.id, identity.category, identity.slug, identity.modifiedAt])

  const controllerRef = useRef<ReturnType<typeof createLiveArticleController> | null>(null)

  useEffect(() => {
    if (!enabled) return

    const refresh = async (request: RefreshRequest): Promise<RefreshOutcome> => {
      const outcome = await requestArticleRefresh(request)
      // 一次失败只影响胶囊，不影响阅读；成功后胶囊自动退回
      if (outcome.status === 'error') statusStore.reportApiFailure()
      else statusStore.reportApiSuccess()
      return outcome
    }

    const controller = createLiveArticleController({
      identity: identityRef.current,
      refresh,

      onUpdated() {
        notify({
          level: 'info',
          title: '文章已更新',
          description: '正文与目录已同步为最新版本',
          dedupeKey: `article-updated:${identity.id}`,
          durationMs: 4_000,
        })
        refreshKeepingScroll(() => router.refresh())
      },

      onMoved(path) {
        notify({
          level: 'info',
          title: '文章地址已更新',
          description: '正在前往新的地址',
          dedupeKey: `article-moved:${identity.id}`,
          durationMs: 4_000,
        })
        router.replace(path)
      },

      onGone() {
        notify({
          level: 'warning',
          title: '这篇文章已被删除或取消发布',
          description: '页面将不再显示旧内容',
          dedupeKey: `article-gone:${identity.id}`,
          // 不自动消失：读者需要知道「内容消失」不是自己点错了
          durationMs: 0,
          action: { label: '返回文章列表', href: '/articles' },
        })
        // 重新渲染会走 404 边界，旧正文不会继续留在屏幕上
        router.refresh()
      },

      onError() {
        // 文案由状态胶囊统一表达，不再弹第二条重复提示
        statusStore.reportApiFailure()
      },
    })

    controllerRef.current = controller
    const release = realtimeBus.joinArticle(identity.id)

    return () => {
      controller.dispose()
      controllerRef.current = null
      release()
    }
  }, [enabled, identity.id, router])

  useRealtimeEvent((envelope) => {
    const signal = toArticleSignal(envelope)
    if (signal) controllerRef.current?.handleSignal(signal)
  })

  /**
   * 恢复语义（不是「previous 状态在某个集合里」这种近似判断）：
   * - `wasOnlineRef`：本次挂载里已经真正连上过，用来区分**首次连接**与**恢复**；
   * - `recoveryPendingRef`：连上之后进入过中断态，等下一次 online 补一次核对。
   *
   * 首次连接（connecting → online）不核对：页面刚由服务端渲染，数据本来就是新的。
   * 同一次恢复只会消耗一次 pending，重复的 online 不会重复核对。
   */
  const statusRef = useRef(snapshot.state.status)
  const wasOnlineRef = useRef(false)
  const recoveryPendingRef = useRef(false)
  /** 最近一次 HTTP 核对的时间，用于恢复核对去重（0 表示本次挂载还没核对过） */
  const lastCheckAtRef = useRef(0)

  useEffect(() => {
    const status = snapshot.state.status
    statusRef.current = status
    if (!enabled) return

    if (status === 'online') {
      const recovering = wasOnlineRef.current && recoveryPendingRef.current
      wasOnlineRef.current = true
      recoveryPendingRef.current = false
      if (!recovering) return
      // 同一次恢复里，页面可见性可能刚触发过一次核对（见下面的 tick），
      // 关掉这条请求，避免背靠背打两次同样的接口
      const now = Date.now()
      if (now - lastCheckAtRef.current < RECOVERY_CHECK_DEDUPE_MS) return
      lastCheckAtRef.current = now
      controllerRef.current?.check()
      return
    }

    if (status === 'reconnecting' || status === 'offline' || status === 'error') {
      if (wasOnlineRef.current) recoveryPendingRef.current = true
    }
  }, [enabled, snapshot.state.status])

  // 降级：实时连接不可用时，用可见性感知的低频轮询兜底；
  // 连接正常时不轮询，避免「实时连接 + 高频轮询」同时打后端。
  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      if (document.visibilityState !== 'visible') return
      if (statusRef.current === 'online') return
      lastCheckAtRef.current = Date.now()
      controllerRef.current?.check()
    }

    const interval = window.setInterval(tick, POLL_INTERVAL_MS)
    const handleVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }

    document.addEventListener('visibilitychange', handleVisible)
    window.addEventListener('online', handleVisible)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisible)
      window.removeEventListener('online', handleVisible)
    }
  }, [enabled])

  return null
}
