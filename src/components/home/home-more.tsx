'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import type { ThemeHomepageMoreItem, ThemeSocialIcon } from '@/core/config/theme'
import { SocialIcon } from '@/components/ui/social-icon'
import { useLocale } from '@/lib/i18n/client'
import { t } from '@/lib/i18n/dictionary'
import { notify } from '@/lib/notifications/store'
import { systemNotifications, type SystemNotifyState } from '@/lib/notifications/system'

interface HomeMoreProps {
  items: ThemeHomepageMoreItem[]
  /** 站点总「喜欢」数；null = 后端没给，界面上不显示计数 */
  siteLikeCount: number | null
}

/**
 * 首页「更多」快捷入口行
 *
 * 三种入口类型：
 *   - `like`：喜欢本站（core 的 `POST /like_this`，按 IP 一天一次）
 *   - `subscribe`：展开订阅渠道（RSS 走 /feed，或浏览器通知）
 *   - `link`：自定义链接，站内路径用客户端路由、外部地址新标签打开
 *
 * 图标支持 CSS / builtin 两套体系，与社交图标同源；
 * 图标字体样式表由根布局的 SocialIconStylesheets 统一加载，这里不重复引入。
 */
export function HomeMore({ items, siteLikeCount }: HomeMoreProps) {
  return (
    <div className="home-more" role="group">
      {items.map((item, index) => (
        <MoreEntry key={`${item.type}-${index}`} item={item} siteLikeCount={siteLikeCount} />
      ))}
    </div>
  )
}

function MoreEntry({
  item,
  siteLikeCount,
}: {
  item: ThemeHomepageMoreItem
  siteLikeCount: number | null
}) {
  if (item.type === 'like') {
    return <LikeEntry item={item} initialCount={siteLikeCount} />
  }

  if (item.type === 'subscribe') {
    return <SubscribeEntry item={item} />
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
 * 点开是两条并列的渠道，而不是直接跳 `/feed`：
 *   - RSS：唯一的「真订阅」，不依赖任何权限；
 *   - 浏览器通知：**权限只在这里、且只在用户点了这一行之后才申请**。
 *     页面加载时不去问，是为了不在读者第一次进来就弹一个他还没决定要的框。
 *
 * 面板用 `absolute` 展开、不占布局；开着时点外部或 `Escape` 关闭，关闭后焦点
 * 仍留在触发按钮上（不用 dialog，这是一个轻量 popover，不是模态）。
 */
function SubscribeEntry({ item }: { item: ThemeHomepageMoreItem }) {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  /** 权限状态只有浏览器知道，挂载前一律按「未开启」渲染，避免 SSR 与首帧不一致 */
  const [notifyState, setNotifyState] = useState<SystemNotifyState>('off')
  const wrapperRef = useRef<HTMLSpanElement | null>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return
    setNotifyState(systemNotifications.getState())
  }, [open])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const handleToggleNotify = async () => {
    if (notifyState === 'on') {
      systemNotifications.disable()
      setNotifyState('off')
      notify({ level: 'info', title: t(locale, 'home.moreNotifyDisabled') })
      return
    }

    // enable() 内部才会调用 requestPermission()，且必须落在这次点击的调用栈上
    const next = await systemNotifications.enable()
    setNotifyState(next)

    if (next === 'on') {
      notify({ level: 'success', title: t(locale, 'home.moreNotifyEnabled') })
    } else if (next === 'blocked') {
      notify({ level: 'warning', title: t(locale, 'home.moreNotifyDenied'), durationMs: 0 })
    } else if (next === 'unsupported') {
      notify({ level: 'info', title: t(locale, 'home.moreNotifyUnsupported') })
    }
  }

  const stateLabel =
    notifyState === 'on'
      ? t(locale, 'home.moreNotifyOn')
      : notifyState === 'blocked'
        ? t(locale, 'home.moreNotifyBlocked')
        : notifyState === 'unsupported'
          ? t(locale, 'home.moreNotifyUnsupported')
          : t(locale, 'home.moreNotifyOff')

  const notifyDisabled = notifyState === 'blocked' || notifyState === 'unsupported'

  return (
    <span ref={wrapperRef} className="home-more__subscribe">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((previous) => !previous)}
        style={item.color ? { color: item.color } : undefined}
        className="home-more__entry"
      >
        <MoreIcon icon={item.icon} fallback={<RssIcon />} />
        <span>{item.title}</span>
      </button>

      {open ? (
        <div
          id={panelId}
          className="home-more__panel"
          role="group"
          aria-label={t(locale, 'home.moreSubscribeTitle')}
        >
          <Link href="/feed" className="home-more__panel-row">
            <span className="home-more__panel-title">
              <RssIcon />
              <span>{t(locale, 'home.moreSubscribeRss')}</span>
            </span>
            <span className="home-more__panel-hint">{t(locale, 'home.moreSubscribeRssHint')}</span>
          </Link>

          <button
            type="button"
            onClick={handleToggleNotify}
            disabled={notifyDisabled}
            aria-pressed={notifyState === 'on'}
            className="home-more__panel-row"
          >
            <span className="home-more__panel-title">
              <span>{t(locale, 'home.moreSubscribeNotify')}</span>
              <span className="home-more__notify-state">{stateLabel}</span>
            </span>
            <span className="home-more__panel-hint">
              {t(locale, 'home.moreSubscribeNotifyHint')}
            </span>
          </button>
        </div>
      ) : null}
    </span>
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
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[0.95rem]"
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

function RssIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[0.95rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5.5" cy="18.5" r="1.2" />
      <path d="M5.5 11.5a7 7 0 0 1 7 7M5.5 5a13.5 13.5 0 0 1 13.5 13.5" />
    </svg>
  )
}

function LinkIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-[0.95rem]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 14a3.5 3.5 0 0 0 5 0l4-4a3.5 3.5 0 0 0-5-5l-.5.5" />
      <path d="M14 10a3.5 3.5 0 0 0-5 0l-4 4a3.5 3.5 0 0 0 5 5l.5-.5" />
    </svg>
  )
}
