'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import type { ThemeHomepageMoreItem, ThemeSocialIcon } from '@/core/config/theme'
import { MingCuteIcon } from '@/components/ui/mingcute-icon'
import { SocialIcon } from '@/components/ui/social-icon'
import { SubscribeModal } from '@/components/ui/subscribe-modal'
import type { SubscribeOptions } from '@/features/interactions'
import { useLocale } from '@/lib/i18n/client'
import { t } from '@/lib/i18n/dictionary'
import { notify } from '@/lib/notifications/store'

interface HomeMoreProps {
  items: ThemeHomepageMoreItem[]
  /** 站点总「喜欢」数；null = 后端没给，界面上不显示计数 */
  siteLikeCount: number | null
  /** 订阅选项；null = 首页不需要订阅入口或交互模块已关闭 */
  subscribeOptions: SubscribeOptions | null
}

/**
 * 首页「更多」快捷入口行
 *
 * 三种入口类型：
 *   - `like`：喜欢本站（core 的 `POST /like_this`，按 IP 一天一次）
 *   - `subscribe`：打开公有订阅弹窗（邮件 + RSS + 频道 + 浏览器通知）
 *   - `link`：自定义链接，站内路径用客户端路由、外部地址新标签打开
 *
 * 图标支持 CSS / builtin 两套体系，与社交图标同源；
 * 图标字体样式表由根布局的 SocialIconStylesheets 统一加载，这里不重复引入。
 */
export function HomeMore({ items, siteLikeCount, subscribeOptions }: HomeMoreProps) {
  return (
    <div className="home-more" role="group">
      {items.map((item, index) => (
        <MoreEntry
          key={`${item.type}-${index}`}
          item={item}
          siteLikeCount={siteLikeCount}
          subscribeOptions={subscribeOptions}
        />
      ))}
    </div>
  )
}

function MoreEntry({
  item,
  siteLikeCount,
  subscribeOptions,
}: {
  item: ThemeHomepageMoreItem
  siteLikeCount: number | null
  subscribeOptions: SubscribeOptions | null
}) {
  if (item.type === 'like') {
    return <LikeEntry item={item} initialCount={siteLikeCount} />
  }

  if (item.type === 'subscribe') {
    return <SubscribeEntry item={item} subscribeOptions={subscribeOptions} />
  }

  if (!item.url) return null

  // 站内路径走客户端路由；外部地址才新开标签
  const internal = item.url.startsWith('/') && !item.url.startsWith('//')
  if (internal) {
    return (
      <Link
        href={item.url}
        style={item.color ? { color: item.color } : undefined}
        className="home-more__entry"
      >
        <MoreIcon icon={item.icon} fallback={<LinkIcon />} />
        <span>{item.title}</span>
      </Link>
    )
  }

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer noopener"
      style={item.color ? { color: item.color } : undefined}
      className="home-more__entry"
    >
      <MoreIcon icon={item.icon} fallback={<LinkIcon />} />
      <span>{item.title}</span>
    </a>
  )
}

/**
 * 订阅入口
 *
 * 点击打开公有的 SubscribeModal 弹窗，合并了邮件表单、RSS、频道和浏览器通知
 * 四种渠道。不再自己管 popover 面板——弹窗内部处理所有订阅交互。
 */
function SubscribeEntry({
  item,
  subscribeOptions,
}: {
  item: ThemeHomepageMoreItem
  subscribeOptions: SubscribeOptions | null
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        style={item.color ? { color: item.color } : undefined}
        className="home-more__entry"
      >
        <MoreIcon icon={item.icon} fallback={<RssIcon />} />
        <span>{item.title}</span>
      </button>

      <SubscribeModal
        types={subscribeOptions?.types ?? []}
        channels={subscribeOptions?.channels ?? []}
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={triggerRef}
      />
    </>
  )
}

type LikeState = 'idle' | 'pending' | 'done'
/**
 * 喜欢本站
 *
 * core 用 Redis 记录 IP + 日期，重复提交返回 400「Once a day is enough」。
 * 服务端路由把这个 400 归一成 `already`：那是**成功过的状态**，
 * 不该弹红色报错，所以这里同样落到「已喜欢」。
 */
function LikeEntry({
  item,
  initialCount,
}: {
  item: ThemeHomepageMoreItem
  initialCount: number | null
}) {
  const locale = useLocale()
  const [state, setState] = useState<LikeState>('idle')
  const [count, setCount] = useState<number | null>(initialCount)

  const handleLike = async () => {
    if (state !== 'idle') return
    setState('pending')

    try {
      const response = await fetch('/api/interactions/like-site', { method: 'POST' })
      if (!response.ok) throw new Error(String(response.status))

      const result = (await response.json()) as { status?: string }

      if (result.status === 'ok') {
        setState('done')
        setCount((prev) => (prev === null ? prev : prev + 1))
        notify({ level: 'success', title: t(locale, 'home.moreLikeThanks') })
        return
      }

      if (result.status === 'already') {
        setState('done')
        notify({ level: 'info', title: t(locale, 'home.moreLikeAlready') })
        return
      }

      setState('idle')
      notify({ level: 'error', title: t(locale, 'notify.likeFailed') })
    } catch {
      setState('idle')
      notify({ level: 'error', title: t(locale, 'notify.likeFailed') })
    }
  }

  return (
    <button
      type="button"
      onClick={handleLike}
      disabled={state === 'pending'}
      aria-pressed={state === 'done'}
      style={item.color ? { color: item.color } : undefined}
      className="home-more__entry"
    >
      <MoreIcon icon={item.icon} fallback={<HeartIcon filled={state === 'done'} />} />
      <span>{state === 'done' ? t(locale, 'home.moreLiked') : item.title}</span>
      {count !== null ? (
        <span className="home-more__count" aria-hidden="true">
          {count.toLocaleString('zh-CN')}
        </span>
      ) : null}
    </button>
  )
}

function MoreIcon({
  icon,
  fallback,
}: {
  icon: ThemeSocialIcon | null
  fallback?: React.ReactNode
}) {
  if (!icon) return <>{fallback ?? null}</>
  return <SocialIcon icon={icon} className="size-[0.95rem]" />
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <MingCuteIcon
      name={filled ? 'mingcute:heart-fill' : 'mingcute:heart-line'}
      className="size-[0.95rem]"
    />
  )
}

function RssIcon() {
  return <MingCuteIcon name="mingcute:rss-line" className="size-[0.95rem]" />
}

function LinkIcon() {
  return <MingCuteIcon name="mingcute:link-line" className="size-[0.95rem]" />
}
