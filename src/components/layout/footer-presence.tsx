'use client'

/**
 * 页脚在线状态 + 悬停预览
 *
 * 两个数字，两个口径，刻意分开显示：
 * - 状态点旁边的数字来自 `VISITOR_ONLINE` / `VISITOR_OFFLINE`（全站、按会话去重，
 *   由 `useRealtimeOnline()` 提供），它是**页脚的主角**；
 * - 浮层里每行的人数是 `/api/presence` 读到的房间连接数（按 socket 计），
 *   只描述「这一篇正在被几个人打开」，不要和上面那个数字对账。
 *
 * 交互是「悬停 + 键盘聚焦」：桌面 hover 展开，Tab 聚焦触发器也展开；
 * 焦点进入浮层后保持，离开整块区域才关闭。触屏仍不做点击展开（页面底部
 * 一个只能点开的浮层对读者没有价值），Tap 聚焦不算键盘聚焦。
 * 因此数据也是**惰性**的——没人打开就不请求，打开后每 15s 刷新一次，
 * 关闭即停。
 *
 * 不渲染的条件只有一个：`online === null`，也就是还没收到过任何
 * `VISITOR_ONLINE`（首帧 SSR、连接中、服务端不支持实时能力）。
 * 此时页脚不出现任何占位，不存在「先显示 0 再跳成 3」的闪烁。
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { PresenceEntry } from '@/lib/api'
import { useLocale } from '@/lib/i18n/client'
import { t, tf } from '@/lib/i18n/dictionary'
import { useRealtimeOnline, useRealtimeSnapshot } from '@/lib/realtime/use-realtime'
import { cn } from '@/lib/utils/cn'

const ENDPOINT = '/api/presence'
const PANEL_ID = 'footer-presence-panel'

/** 浮层打开时的刷新间隔：房间人数没有推送通道，只能读快照 */
const REFRESH_MS = 15_000

/** 标题只是预览，过长的标题会把浮层撑成一段正文 */
const MAX_TITLE = 80

/**
 * 校验 BFF 返回的条目。
 *
 * 同源响应仍然按不可信输入处理：只接受站内绝对路径（`/` 开头、不含 `//`），
 * 人数只接受正整数。任何一条不合格只丢自己，整份 payload 不合法才返回 null。
 */
function parseEntries(body: unknown): PresenceEntry[] | null {
  if (typeof body !== 'object' || body === null) return null
  const raw = (body as { entries?: unknown }).entries
  if (!Array.isArray(raw)) return null

  const entries: PresenceEntry[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const row = item as Record<string, unknown>
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    const href = typeof row.href === 'string' ? row.href.trim() : ''
    const viewers = row.viewers

    if (!title || title.length > MAX_TITLE) continue
    if (!href.startsWith('/') || href.startsWith('//')) continue
    if (typeof viewers !== 'number' || !Number.isInteger(viewers) || viewers < 1) continue

    entries.push({ title, href, viewers })
  }

  return entries
}

/**
 * 是否由「真的鼠标」触发。
 *
 * 触屏与手写笔不展开：`pointerType` 为 `touch` / `pen` 时直接拒绝，
 * 既满足「移动端不加点击交互」，也避免 tap 之后浮层卡在屏幕上。
 * 没有 `pointerType` 的合成事件按鼠标处理（老浏览器不会派发 pointer 事件）。
 */
function isMouseTrigger(event: { pointerType?: string }): boolean {
  return event.pointerType !== 'touch' && event.pointerType !== 'pen'
}

/** relatedTarget 是否还在「触发器 + 浮层」这块交互区域里 */
function isInside(target: EventTarget | null, root: HTMLElement | null): boolean {
  return target instanceof Node && root !== null && root.contains(target)
}

export function FooterPresence() {
  const locale = useLocale()
  const online = useRealtimeOnline()
  const pathname = usePathname()
  const connectionStatus = useRealtimeSnapshot().state.status

  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLSpanElement>(null)

  /*
   * 上一次读到的房间快照只在「同一页面、同一段连接」里有效。
   * key 不匹配时直接当没读过，不需要 effect 去清空（那会产生一次多余的级联渲染）；
   * entries 为 null 表示还没成功读到过，[] 表示读到过且确实没人。
   */
  const cacheKey = `${pathname}|${connectionStatus}`
  const [snapshot, setSnapshot] = useState<{
    key: string
    entries: PresenceEntry[] | null
    failed: boolean
  }>({ key: '', entries: null, failed: false })
  const valid = snapshot.key === cacheKey ? snapshot : null
  const rows = valid?.entries ?? null
  const failed = valid?.failed ?? false

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    let cancelled = false
    // 每次 load 都有自己的序号：15s 刷新遇到慢响应时，只让最新一次落地
    let latestRequest = 0

    // 刷新失败时保留上一次的有效列表；首次失败才落到失败提示
    const markFailed = () =>
      setSnapshot((prev) => ({
        key: cacheKey,
        entries: prev.key === cacheKey ? prev.entries : null,
        failed: true,
      }))

    const load = async () => {
      const requestId = ++latestRequest
      try {
        const response = await fetch(ENDPOINT, { cache: 'no-store', signal: controller.signal })
        if (!response.ok) throw new Error('presence request failed')

        const body: unknown = await response.json()
        if (cancelled || requestId !== latestRequest) return
        // BFF 上游失败时返回 200 + failed:true（静默降级），这里必须认这个标记，
        // 否则会被当成「此刻没人」——失败提示永远不会出现。
        if (
          typeof body === 'object' &&
          body !== null &&
          (body as { failed?: unknown }).failed === true
        ) {
          markFailed()
          return
        }

        const parsed = parseEntries(body)
        if (!parsed) {
          markFailed()
          return
        }
        setSnapshot({ key: cacheKey, entries: parsed, failed: false })
      } catch {
        if (cancelled || requestId !== latestRequest) return
        markFailed()
      }
    }

    void load()
    const timer = window.setInterval(() => {
      void load()
    }, REFRESH_MS)

    return () => {
      cancelled = true
      controller.abort()
      window.clearInterval(timer)
    }
  }, [open, cacheKey])

  if (online === null) return null

  return (
    <div
      ref={rootRef}
      className={cn('footer-presence', open && 'footer-presence--open')}
      onPointerEnter={(event) => {
        // 只有真的鼠标才展开：触屏 tap 会让浮层卡住，也不符合「移动端不加点击交互」
        if (isMouseTrigger(event)) setOpen(true)
      }}
      onPointerLeave={(event) => {
        if (!isMouseTrigger(event)) return
        // 键盘焦点还在区域内时，鼠标移开不代表交互结束，别把浮层收走
        if (isInside(document.activeElement, rootRef.current)) return
        setOpen(false)
      }}
      onBlur={(event) => {
        // 不用裸 onBlur：焦点在触发器与浮层链接之间移动时 relatedTarget 仍在区域内
        if (isInside(event.relatedTarget, rootRef.current)) return
        setOpen(false)
      }}
      onKeyDown={(event) => {
        // Escape 是键盘用户唯一的主动关闭方式；关掉后焦点回到触发器，
        // 不丢到 body 上，下一次 Tab 从原处继续
        if (event.key !== 'Escape' || !open) return
        event.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
      }}
    >
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-expanded={open}
        aria-controls={PANEL_ID}
        className="footer-presence__trigger"
        onFocus={(event) => {
          // 从浮层内部回到触发器（例如 Escape）不算从外部进入
          if (isInside(event.relatedTarget, rootRef.current)) return
          // 只有键盘聚焦才展开：触屏 tap 的聚焦不是 :focus-visible
          if (!event.currentTarget.matches(':focus-visible')) return
          setOpen(true)
        }}
      >
        {/* 分隔符跟着状态一起出现：未连接时整块返回 null，不会留下孤立的「｜」 */}
        <span aria-hidden="true" className="footer-sep">
          ｜
        </span>
        <span className="footer-presence__dot" aria-hidden="true" />
        <span className="footer-presence__count">
          {tf(locale, 'presence.online', { count: online })}
        </span>
      </span>

      {open ? (
        <div id={PANEL_ID} className="footer-presence__panel">
          <div className="footer-presence__card">
            <p className="footer-presence__heading">{t(locale, 'presence.heading')}</p>

            {rows === null ? (
              <p className="footer-presence__hint">
                {failed ? t(locale, 'presence.unavailable') : t(locale, 'presence.loading')}
              </p>
            ) : rows.length === 0 ? (
              <p className="footer-presence__hint">{t(locale, 'presence.empty')}</p>
            ) : (
              <ul className="footer-presence__list">
                {rows.map((entry) => (
                  <li key={entry.href} className="footer-presence__item">
                    <Link href={entry.href} className="footer-presence__link">
                      {entry.title}
                    </Link>
                    <span className="footer-presence__viewers">
                      {tf(locale, 'presence.viewers', { count: entry.viewers })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
