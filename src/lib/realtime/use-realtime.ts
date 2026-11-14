'use client'

/**
 * 实时状态 / 事件的 React 绑定
 *
 * 全部用 `useSyncExternalStore`：服务端渲染时返回固定快照，
 * 客户端首帧与之一致，不会出现 hydration mismatch。
 *
 * `useRealtimeSnapshot()` 同时给出连接状态、在线人数和按 `type:id` 关联的阅读数；
 * 这些是总线快照里的既有状态，不需要再挂一层 Provider。
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { realtimeBus, type RealtimeSnapshot } from './bus'
import type { RealtimeArticleType, RealtimeEvent } from './protocol'
import { readCountKey } from './protocol'

export function useRealtimeSnapshot(): RealtimeSnapshot {
  return useSyncExternalStore(
    realtimeBus.subscribe,
    realtimeBus.getSnapshot,
    realtimeBus.getServerSnapshot,
  )
}

/** 在线人数；未收到 VISITOR_ONLINE / VISITOR_OFFLINE 时为 null */
export function useRealtimeOnline(): number | null {
  return useRealtimeSnapshot().online
}

/** 指定类型 + id 的阅读数；没有该文章的更新时为 null */
export function useRealtimeReadCount(articleType: RealtimeArticleType, id: string): number | null {
  const counts = useRealtimeSnapshot().readCounts
  return counts[readCountKey(articleType, id)] ?? null
}

/** 订阅类型化业务事件；回调放进 ref，避免每次重渲染都重订阅 */
export function useRealtimeEvent(handler: (event: RealtimeEvent) => void): void {
  const ref = useRef(handler)

  // 在 effect 里同步 ref：渲染期写 ref 会被 react-hooks/refs 判为访问渲染期副作用
  useEffect(() => {
    ref.current = handler
  }, [handler])

  useEffect(() => realtimeBus.onEvent((event) => ref.current(event)), [])
}
