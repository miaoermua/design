'use client'

import { useState } from 'react'
import type { ThemeHomepageMoreItem, ThemeSocialIcon } from '@/core/config/theme'
import { SocialIcon } from '@/components/ui/social-icon'
import { useLocale } from '@/lib/i18n/client'
import { t } from '@/lib/i18n/dictionary'

interface HomeMoreProps {
  items: ThemeHomepageMoreItem[]
}

/**
 * 首页「更多」快捷入口行
 *
 * 三种入口类型：
 *   - `like`：本地「喜欢本站」表达（纯视觉反馈，不发请求）
 *   - `subscribe`：跳转到 /feed.xml 订阅
 *   - `link`：自定义链接跳转，支持 CSS / builtin 图标
 *
 * 图标样式表由根布局的 SocialIconStylesheets 统一加载，这里不重复加载。
 */
export function HomeMore({ items }: HomeMoreProps) {
  return (
    <div className="flex flex-wrap items-center gap-2.5" role="group">
      {items.map((item, index) => (
        <MoreEntry key={`${item.type}-${index}`} item={item} />
      ))}
    </div>
  )
}

function MoreEntry({ item }: { item: ThemeHomepageMoreItem }) {
  if (item.type === 'like') return <LikeEntry item={item} />
  if (item.type === 'subscribe') {
    return (
      <a
        href="/feed.xml"
        target="_blank"
        rel="noopener noreferrer"
        style={item.color ? { color: item.color } : undefined}
        className="home-more__entry"
      >
        <MoreIcon icon={item.icon} fallback={<RssIcon />} />
        <span>{item.title}</span>
      </a>
    )
  }

  // link
  if (!item.url) return null
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

/** 喜欢本站：纯本地视觉反馈，点击后变成填充爱心 */
function LikeEntry({ item }: { item: ThemeHomepageMoreItem }) {
  const locale = useLocale()
  const [liked, setLiked] = useState(false)

  return (
    <button
      type="button"
      onClick={() => setLiked(true)}
      aria-pressed={liked}
      style={item.color ? { color: item.color } : undefined}
      className="home-more__entry"
    >
      <MoreIcon icon={item.icon} fallback={<HeartIcon filled={liked} />} />
      <span>{liked ? t(locale, 'home.moreLiked') : item.title}</span>
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
