'use client'

import { useSyncExternalStore } from 'react'
import { notificationStore, type NotificationItem } from './store'

export function useNotifications(): readonly NotificationItem[] {
  return useSyncExternalStore(
    notificationStore.subscribe,
    notificationStore.getSnapshot,
    notificationStore.getServerSnapshot,
  )
}
