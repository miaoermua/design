'use client'

/**
 * toast → 系统通知的镜像
 *
 * 只做一件事：队列里出现新条目时，按「页面在后台」这个条件转发一次系统通知
 * （条件判断在 `systemNotifications.notify()` 里，这里不重复写）。
 *
 * 为什么不用在 `notify()` 里直接发：store 是框架无关的纯逻辑、也在 node 测试里跑，
 * 让它去碰 `Notification` 会把「队列语义」和「浏览器能力」耦在一起。
 */

import { useEffect, useRef } from 'react'
import { notificationStore } from '@/lib/notifications/store'
import { systemNotifications } from '@/lib/notifications/system'

export function SystemNotificationBridge() {
  /** 已经镜像过的通知 id：队列变化会重复触发回调，靠这个避免同一事件发两次 */
  const mirrored = useRef(new Set<string>())

  useEffect(() => {
    const sync = () => {
      const items = notificationStore.getSnapshot()

      for (const item of items) {
        if (mirrored.current.has(item.id)) continue
        mirrored.current.add(item.id)

        systemNotifications.notify({
          title: item.title,
          body: item.description,
          tag: item.dedupeKey ?? item.id,
          url: item.action?.href,
        })
      }

      // 已经离场的通知不必再记，避免长会话里集合无限增长
      const live = new Set(items.map((item) => item.id))
      for (const id of mirrored.current) {
        if (!live.has(id)) mirrored.current.delete(id)
      }
    }

    return notificationStore.subscribe(sync)
  }, [])

  return null
}
