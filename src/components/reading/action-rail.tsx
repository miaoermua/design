'use client'

import { useState } from 'react'
import type { DonateQrcode } from '@/features/donate'
import type { SubscribeOptions } from '@/features/interactions'
import { DonateAction } from '@/features/donate'
import { notify } from '@/lib/notifications/store'
import { cn } from '@/lib/utils/cn'
import { SubscribePanel } from './subscribe-panel'

export interface ActionRailProps {
  /** 文章 / 日记 id：点赞需要 */
  id: string
  type: 'Post' | 'Note'
  /** canonical 地址；缺失时分享当前页面地址 */
  shareUrl: string | null
  /** 点赞入口开关：来自 Feature Registry 的 `interactions` */
  like: boolean
  /** 订阅能力与频道：两者都没有时入口不渲染 */
  subscribe: SubscribeOptions
  /** 赞赏配置；null 表示不可见 */
  donate: { label: string; qrcodes: DonateQrcode[] } | null
  className?: string
}

type LikeState = 'idle' | 'pending' | 'done'

/**
 * 详情页操作栏（Blog / Note 共用）
 *
 * 只包含 Like / Share / Subscribe / Donate —— 站点是只读的，没有评论、
 * 也没有「收藏到某处」这种后端不存在的能力，因此不做占位按钮。
 *
 * 布局：移动端是正文上方的一行，桌面端变成左侧的竖排。
 * 两处是同一个组件、同一份状态，不做两套实现。
 */
export function ActionRail({
  id,
  type,
  shareUrl,
  like: likeEnabled,
  subscribe,
  donate,
  className,
}: ActionRailProps) {
  const [like, setLike] = useState<LikeState>('idle')

  const handleLike = async () => {
    if (like !== 'idle') return
    setLike('pending')

    try {
      const response = await fetch('/api/interactions/like', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id, type }),
      })
      if (!response.ok) throw new Error(String(response.status))

      setLike('done')
      notify({
        level: 'success',
        title: '喜欢已记录',
        description: '同一地址的重复点赞不会重复计数。',
      })
    } catch {
      setLike('idle')
      notify({
        level: 'error',
        title: '没能记录这次喜欢',
        description: '稍后再试，或检查网络连接。',
      })
    }
  }

  const handleShare = async () => {
    const url = shareUrl ?? window.location.href

    // 系统分享优先：移动端能直接分享到已安装的应用，而不是先进剪贴板
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url })
        return
      } catch (error) {
        // 用户主动取消不是失败，保持安静
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }

    try {
      await navigator.clipboard.writeText(url)
      notify({ level: 'success', title: '链接已复制' })
    } catch {
      notify({ level: 'error', title: '复制失败', description: '可以直接复制浏览器地址栏。' })
    }
  }

  const liked = like === 'done'

  return (
    <div
      className={cn('flex flex-row items-center justify-between gap-1', className)}
      aria-label="文章操作"
      role="group"
    >
      {likeEnabled ? (
        <button
          type="button"
          onClick={handleLike}
          disabled={like === 'pending'}
          aria-pressed={liked}
          className="action-rail-button"
        >
          <HeartIcon filled={liked} />
          <span>{liked ? '已喜欢' : '喜欢'}</span>
        </button>
      ) : null}

      <button type="button" onClick={handleShare} className="action-rail-button">
        <ShareIcon />
        <span>分享</span>
      </button>

      {subscribe.enabled || subscribe.channels.length > 0 ? (
        <SubscribePanel types={subscribe.types} channels={subscribe.channels} />
      ) : null}

      {donate ? (
        <DonateAction label={donate.label} qrcodes={donate.qrcodes} variant="rail" />
      ) : null}
    </div>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[1.05rem]"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20s-7-4.35-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 19 11c0 4.65-7 9-7 9Z" />
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[1.05rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 15v4a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-4" />
    </svg>
  )
}
