'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { LOCALES, localeName, type Locale } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/dictionary'
import type { MessageKey } from '@/lib/i18n/dictionary'
import { useLocale } from '@/lib/i18n/client'
import { ThemeGlyph, useThemePreference, type ThemePreference } from './theme-toggle'
import { useLocaleSwitcher } from './use-locale-switcher'

/**
 * 主题三段的顺序：浅色 → 跟随系统 → 深色（Sun → Monitor → Moon）。
 *
 * 与旧工具按钮的**循环**顺序不同：那是「点一下转一格」的开关，
 * 这里是一次到位的单选，顺序按「从最亮到最暗、系统居中」排列。
 */
const THEME_ORDER: ThemePreference[] = ['light', 'system', 'dark']

/**
 * 页脚设置区：语言选择器与三态主题紧挨成一组。
 *
 * 两者是同一个「偏好」概念的两个维度（看什么语言、用什么明暗），
 * 中间不插别的东西——但它们整体属于页脚的**右侧**一栏（桌面端靠右对齐），
 * 不再是从信息区上方横过去的一整行。
 *
 * 全站唯一的两处入口都在这里——右下角浮标只剩「回到顶部」，
 * 导航菜单里的 Settings 也已移除，避免同一个人设在三处出现。
 *
 * 两套状态都复用既有实现，本组件只负责呈现：
 *   - 语言 → `useLocaleSwitcher`（`folio-lang` cookie + `router.refresh()`）；
 *   - 主题 → `useThemePreference`（`folio-theme`，`system` = 删除键）。
 * 这里既不新增存储键，也不自己改 `data-theme` 或 cookie。
 *
 * 语言菜单**向上**展开：页脚在文档末尾，向下弹会被视口裁掉。
 */
export function FooterSettings() {
  const locale = useLocale()
  const { preference, setPreference } = useThemePreference()
  const { value, pending, setLocale } = useLocaleSwitcher(locale)

  return (
    <div className="footer-settings">
      <FooterLanguageSelect current={value} pending={pending} onSelect={setLocale} />

      <ThemeSegmented value={preference} onChange={setPreference} label={t(locale, 'nav.theme')} />
    </div>
  )
}

interface FooterLanguageSelectProps {
  current: Locale
  pending: boolean
  onSelect: (next: Locale) => void
}

/**
 * 语言选择器：图标 + 当前语言名 + 向下箭头，点击向上弹出菜单。
 *
 * 用 `menu` / `menuitemradio` 而不是原生 `<select>`：原生下拉在暗色下由
 * 系统绘制，跟纸张体系完全不搭，也无法给选中项画 Lavender Blue 的勾。
 * 键盘行为手工补齐（Esc / 方向键 / Home / End / 点击外部），
 * 选中状态靠 `aria-checked`，不额外维护一份「哪个被选中」的状态。
 */
function FooterLanguageSelect({ current, pending, onSelect }: FooterLanguageSelectProps) {
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const buttonId = useId()
  const menuId = useId()

  const close = useCallback((restoreFocus = false) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }, [])

  // 打开后把焦点放到当前项：键盘用户下一步就能用方向键换语言
  useEffect(() => {
    if (!open) return
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]')
    const active = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')
    ;(active ?? items?.[0])?.focus()
  }, [open])

  // 点击外部关闭：用 pointerdown 而不是 click，避免「按下菜单项 → 菜单先关 →
  // 元素被卸载 → click 落空」导致选项点不动
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault()
      close(true)
      return
    }
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setOpen(true)
      }
      return
    }

    const items = [
      ...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []),
    ]
    if (items.length === 0) return
    const index = items.indexOf(document.activeElement as HTMLElement)

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      const next = (index + step + items.length) % items.length
      items[next]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus()
    } else if (event.key === 'Tab') {
      // Tab 离开菜单：关掉，但把焦点交还给浏览器自己决定下一站
      setOpen(false)
    }
  }

  return (
    <div className="footer-lang" ref={wrapperRef} onKeyDown={onKeyDown}>
      <button
        type="button"
        id={buttonId}
        ref={triggerRef}
        className="footer-lang__trigger"
        aria-haspopup="menu"
        aria-label={`${t(locale, 'action.language')} · ${localeName(current)}`}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-busy={pending || undefined}
        onClick={() => setOpen((v) => !v)}
      >
        <LanguagesIcon />
        <span className="footer-lang__name">{localeName(current)}</span>
        <ChevronDownIcon open={open} />
      </button>

      {open ? (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-labelledby={buttonId}
          className="footer-lang__menu"
        >
          {LOCALES.map((option) => {
            const checked = option === current
            return (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                className="footer-lang__option"
                data-active={checked ? 'true' : undefined}
                onClick={() => {
                  onSelect(option)
                  close(true)
                }}
              >
                <span>{localeName(option)}</span>
                {checked ? <CheckIcon /> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

interface ThemeSegmentedProps {
  value: ThemePreference | null
  onChange: (next: ThemePreference) => void
  label: string
}

/**
 * 三态主题：横向胶囊里三个圆形格子，Sun → Monitor → Moon。
 *
 * 仍然是**原生单选**（同名 radio），方向键在组内移动、Tab 只停在当前项、
 * 屏幕阅读器读出「3 个选项中的第 n 个」都由浏览器提供。
 * 选中态靠 `:checked`（`.footer-theme__option[data-active]`）驱动，
 * 不额外维护一份「哪个被选中」的 React 状态。
 *
 * `value === null` 只出现在首帧（还没读到 localStorage）：此时三个都不勾，
 * 避免暗色用户先看到「浅色」被选中再跳一下。
 */
function ThemeSegmented({ value, onChange, label }: ThemeSegmentedProps) {
  const locale = useLocale()

  return (
    <div className="footer-theme" role="radiogroup" aria-label={label}>
      {THEME_ORDER.map((option) => {
        const checked = value === option
        const name = t(locale, THEME_LABEL[option])
        return (
          <label
            key={option}
            className="footer-theme__option"
            data-active={checked ? 'true' : undefined}
            title={name}
          >
            <input
              type="radio"
              name="folio-footer-theme"
              value={option}
              checked={checked}
              onChange={() => onChange(option)}
              aria-label={name}
              className="sr-only"
            />
            <ThemeGlyph value={option} />
          </label>
        )
      })}
    </div>
  )
}

/** 主题名走既有字典键，不新造文案 */
const THEME_LABEL: Record<ThemePreference, MessageKey> = {
  light: 'action.modeLight',
  system: 'action.modeSystem',
  dark: 'action.modeDark',
}

function LanguagesIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="footer-lang__icon"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 5h12M7 2h1M4 14l6-6 2-3M5 8l6 6" />
      <path d="m22 22-5-10-5 10M14 18h6" />
    </svg>
  )
}

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="footer-lang__chevron"
      data-open={open ? 'true' : undefined}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="footer-lang__check"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
