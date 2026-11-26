'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { TocItem } from '@/lib/content/markdown'
import { tocStore } from './toc-store'

export function useTocItems(): TocItem[] {
  return useSyncExternalStore(tocStore.subscribe, tocStore.getSnapshot, tocStore.getServerSnapshot)
}

/**
 * 挂载时把当前阅读页的目录同步到全局 store，卸载时只清掉自己那一份。
 *
 * 令牌在挂载时生成一次（存 ref，重渲染不换）：页面 A 卸载晚于页面 B 挂载时，
 * A 的清理会因为令牌不匹配而跳过，不会抹掉 B 已经写进去的目录。
 */
export function TocSync({ items }: { items: TocItem[] }) {
  const tokenRef = useRef<symbol | null>(null)
  if (tokenRef.current === null) tokenRef.current = Symbol('toc')
  const token = tokenRef.current

  useEffect(() => {
    tocStore.setItems(items, token)
  }, [items, token])

  useEffect(() => () => tocStore.clear(token), [token])

  return null
}
