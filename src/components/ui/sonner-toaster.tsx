'use client'

/**
 * 通知渲染层（Sonner）
 *
 * ## 分工
 *
 * ```
 * notify(input)                     ← 业务调用，签名不变
 *   └─ notificationStore            ← 唯一事实来源：去重 / 分级时长 / 常驻 /
 *                                      maxVisible 驱逐 / 计时器（可注入时钟）
 *        ├─ useNotifications()  →  本组件：把队列「增量同步」给 Sonner 渲染
 *        └─ getSnapshot()       →  SystemNotificationBridge（零改动，见下）
 * ```
 *
 * 为什么**不**把队列交给 Sonner：Sonner 没有去重、没有 `dedupeKey`、
 * `visibleToasts` 只是把超出的条目隐藏（仍在队列里计时）而**不是驱逐**，
 * 更没有「error 优先保留」。这三条都得留在自己的 store 里才有等价语义。
 * 因此 store 仍是事实来源，Sonner 只承担它真正擅长的事：
 * 定位、堆叠、进出场动画、滑动手势。
 *
 * 因为 store 的 id 与 Sonner 的 id 是同一个（`toast.xxx(title, { id })`），
 * 同步只是「按差集补/删」，不存在两套状态互相追着跑。
 *
 * ## 渲染只用 Sonner 自带卡片
 *
 * 这里调的是 `toast.success / warning / error / info`，**不自绘 JSX**。
 * 曾有一套自定义卡片（级别标签行 + 左侧色条 + `role="alert"`），但它从未
 * 真正接上（全仓没有 `toast.custom` 调用），已作为死代码删除。外观调整一律
 * 改 `src/design-system/styles/sonner.css`，不要在本文件重新引入第二套卡片。
 *
 * 由此带来的无障碍现状：播报完全由 Sonner 容器 `<section>` 上硬编码的
 * `aria-live="polite"` 承担，**所有级别统一 polite**，不再按 error/warning
 * 升级为 assertive。曾经有一段「把 section 的 aria-live 置为 off」的逻辑，
 * 目的是避免与自定义卡片的实时区重复播报；卡片删除后它会让通知彻底不被
 * 播报，因此一并移除。要恢复分级播报，就得重新自绘卡片 —— 那是改版，
 * 不属于清理。
 *
 * ## 时长为什么交给 store 而不是 Sonner
 *
 * 给 Sonner 传 `duration: Infinity`，所有关闭都由 store 的计时器触发。
 * 好处：分级时长与 `durationMs: 0` 常驻都能用注入的假时钟做单测（Sonner
 * 内部计时器不可注入）；坏处是放弃 Sonner 的 hover 暂停 —— Folio 原本也没有，
 * 属持平。
 *
 * ## 空队列
 *
 * Sonner 的 `<section>` 是恒渲染的，且硬编码 `aria-live="polite"`。
 * 队列空时**整棵卸载**（延迟 300ms 让最后一条走完退场动画），
 * 避免长期留一个空的 live region。
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Toaster, toast } from 'sonner'
import { notificationStore } from '@/lib/notifications/store'
import { useNotifications } from '@/lib/notifications/use-notifications'
import { useStatusSnapshot } from '@/lib/status/use-status'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/dictionary'

/**
 * 最后一条关闭后保留挂载的时间。
 *
 * Sonner 自己用 200ms（`TIME_BEFORE_UNMOUNT`）把已移除的条目从状态里清掉，
 * 退场动画依赖这段时间。取 300ms 留一点余量：既让动画走完，
 * 又不至于让空的 live region 长期留在 DOM 里。
 */
const EXIT_GRACE_MS = 300

/** 与状态胶囊的高度 + 间距保持一致，避免两类提示在右下角重叠 */
const CAPSULE_CLEARANCE = 40

export interface SonnerToasterProps {
  locale?: Locale
}

export function SonnerToaster({ locale = DEFAULT_LOCALE }: SonnerToasterProps) {
  const router = useRouter()
  const items = useNotifications()
  const status = useStatusSnapshot()
  const shown = useRef(new Set<string>())
  const [collapsed, setCollapsed] = useState(true)

  const capsuleVisible = status.kind !== null

  /*
   * 队列空时延迟卸载：给最后一条留出走完退场动画的时间。
   *
   * 两个方向都走定时器（0ms / EXIT_GRACE_MS），**不在 effect 里同步 setState**：
   * 同步写会让同一次提交里既渲染又改状态，React 会多跑一轮，也触发
   * `react-hooks/set-state-in-effect`。0ms 只是让挂载落到下一个宏任务，
   * 对观感没有影响（Sonner 自己也要等一次渲染才画出来）。
   */
  useEffect(() => {
    const timer = window.setTimeout(
      () => setCollapsed(items.length === 0),
      items.length === 0 ? EXIT_GRACE_MS : 0,
    )
    return () => window.clearTimeout(timer)
  }, [items.length])

  const present = items.length > 0 || !collapsed

  // 队列 → Sonner：只做差集，不做全量重建（否则每条都会重播进场动画）
  useEffect(() => {
    const live = new Set(items.map((item) => item.id))

    for (const id of [...shown.current]) {
      if (live.has(id)) continue
      toast.dismiss(id)
      shown.current.delete(id)
    }

    for (const item of items) {
      if (shown.current.has(item.id)) continue
      shown.current.add(item.id)
      const options = {
        id: item.id,
        // 关闭由 store 的计时器负责，Sonner 不参与，避免两套计时器打架
        duration: Infinity,
        // 滑动/点击关闭时回流到 store，保证队列与画面一致
        onDismiss: () => notificationStore.dismiss(item.id),
        ...(item.action
          ? {
              action: {
                label: item.action.label,
                onClick: () => router.push(item.action!.href),
              },
            }
          : {}),
      }
      if (item.level === 'success') toast.success(item.title, options)
      else if (item.level === 'warning') toast.warning(item.title, options)
      else if (item.level === 'error') toast.error(item.title, options)
      else toast.info(item.title, options)
    }
  }, [items, router])

  if (!present) return null

  return (
    <Toaster
      className="folio-toaster"
      position="bottom-right"
      // store 已把队列限制在 3 条，这里保持一致；超出时 Sonner 负责堆叠动画
      visibleToasts={3}
      closeButton
      containerAriaLabel={t(locale, 'notify.region')}
      customAriaLabel={t(locale, 'notify.region')}
      // Sonner 默认是英文「Close toast」；这里沿用卡片时代的同一句字典文案，
      // 保证界面上不出现与语言无关的英文可访问名称。
      // 注意它在 ToastOptions 里，不在 ToasterProps 顶层。
      toastOptions={{ closeButtonAriaLabel: t(locale, 'notify.dismiss') }}
      offset={{
        right: 24,
        bottom: 24 + (capsuleVisible ? CAPSULE_CLEARANCE : 0),
      }}
      mobileOffset={{
        right: 16,
        bottom: 16 + (capsuleVisible ? CAPSULE_CLEARANCE : 0),
      }}
    />
  )
}
