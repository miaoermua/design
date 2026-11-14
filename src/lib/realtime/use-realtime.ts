'use client'

/**
 * 实时状态 / 事件的 React 绑定
 *
 * 全部用 `useSyncExternalStore`：服务端渲染时返回固定快照，
 * 客户端首帧与之一致，不会出现 hydration mismatch。
 */

import { useEffect, useRef, useSyncExternalStore } from 'react'
import { realtimeBus, type RealtimeSnapshot } from './bus'
import type { RealtimeEnvelope } from './protocol'

export function useRealtimeSnapshot(): RealtimeSnapshot {
  return useSyncExternalStore(
    realtimeBus.subscribe,
    realtimeBus.getSnapshot,
    realtimeBus.getServerSnapshot,
  )
}

/** 订阅业务事件；回调放进 ref，避免每次重渲染都重订阅 */
export function useRealtimeEvent(handler: (envelope: RealtimeEnvelope) => void): void {
  const ref = useRef(handler)

  // 在 effect 里同步 ref：渲染期写 ref 会被 react-hooks/refs 判为访问渲染期副作用
  useEffect(() => {
    ref.current = handler
  }, [handler])

  useEffect(() => realtimeBus.onEvent((envelope) => ref.current(envelope)), [])
}
