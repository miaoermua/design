'use client'

import { useSyncExternalStore } from 'react'
import { statusStore, type StatusSnapshot } from './store'

export function useStatusSnapshot(): StatusSnapshot {
  return useSyncExternalStore(
    statusStore.subscribe,
    statusStore.getSnapshot,
    statusStore.getServerSnapshot,
  )
}
