'use client'

import { useRef, useState } from 'react'
import type { SubscribeType } from '@/lib/api/contracts/v2/interaction'
import type { SubscribeChannel } from '@/features/interactions'
import { MingCuteIcon } from '@/components/ui/mingcute-icon'
import { SubscribeModal } from '@/components/ui/subscribe-modal'
import { useLocale } from '@/lib/i18n/client'
import { t } from '@/lib/i18n/dictionary'
import { cn } from '@/lib/utils/cn'

interface SubscribePanelProps {
  /** 后端允许的订阅类型；为空时不渲染邮件表单（频道仍可单独存在） */
  types: SubscribeType[]
  /** 频道订阅：来自 `social.items` 里显式标记为频道的项 */
  channels: SubscribeChannel[]
  className?: string
}

/**
 * 订阅入口按钮（阅读侧栏用）
 *
 * 点击后打开公有的 SubscribeModal 弹窗，不再自己管 popover 面板。
 * 保留 action-rail-button 样式，使按钮在侧栏中与其他操作按钮对齐。
 */
export function SubscribePanel({ types, channels, className }: SubscribePanelProps) {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="action-rail-button"
      >
        <MingCuteIcon name="mingcute:mail-line" className="size-[1.05rem]" />
        <span>{t(locale, 'subscribe.button')}</span>
      </button>

      <SubscribeModal
        types={types}
        channels={channels}
        open={open}
        onClose={() => setOpen(false)}
        returnFocusRef={triggerRef}
      />
    </div>
  )
}
