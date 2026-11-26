'use client'

/**
 * 加入「当前内容」的 Socket.IO 房间（只订阅，不消费事件）
 *
 * 为什么需要它：core 只在客户端 `join` 之后才把这篇文章算进
 * `article-<id>` 房间，而房间人数是页脚预览的唯一数据来源。文章详情页
 * 早就有 `LiveArticleUpdater` 顺带 join，日记与独立页面没有——于是它们
 * 永远不会出现在「谁在读」里。
 *
 * 为什么不直接 `useEffect(() => joinArticle(id))`：连接宿主是在根布局的
 * `RealtimeRuntime` 里挂上去的，而页面自己的 effect 可能在它之前执行；
 * 那一下 `realtimeBus.joinArticle()` 会因为「还没有 session」被静默丢弃，
 * 之后再也没人补发（实测：日记页就是这样一直不进房间）。
 * 所以这里等总线真正连上过（`everConnected`）再订阅——那一刻 session 一定
 * 已经注册，且重连补发由 client 自己负责，不需要在这里重试。
 *
 * 刻意不复用 `LiveArticleUpdater`：那个组件会订阅 `POST_UPDATE` 并
 * `router.refresh()`，把它挂到日记/页面上等于**新增**一套实时刷新行为，
 * 超出本次范围。只 join 不监听，除了让房间有人，不改变任何渲染结果。
 */

import { useEffect } from 'react'
import { realtimeBus } from '@/lib/realtime/bus'
import { useRealtimeSnapshot } from '@/lib/realtime/use-realtime'

export function ArticleRoomJoin({ articleId }: { articleId: string }) {
  const { everConnected } = useRealtimeSnapshot()

  useEffect(() => {
    if (!everConnected) return
    return realtimeBus.joinArticle(articleId)
  }, [articleId, everConnected])

  return null
}
