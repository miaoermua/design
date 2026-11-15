'use client'

import { LOCALES, localeLabel, localeName, type Locale } from '@/lib/i18n/config'
import type { MessageKey } from '@/lib/i18n/dictionary'
import { useLocaleSwitcher } from './language-button'
import { ThemeGlyph, useThemePreference, type ThemePreference } from './theme-toggle'

/** 主题顺序与工具按钮的循环顺序一致：跟随系统 → 浅色 → 深色 */
const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark']

const THEME_LABEL: Record<ThemePreference, MessageKey> = {
  system: 'action.modeSystem',
  light: 'action.modeLight',
  dark: 'action.modeDark',
}

interface NavSettingsProps {
  locale: Locale
  messages: Record<MessageKey, string>
}

/**
 * 菜单底部的 Settings：主题 + 语言，两块都是图标化（语言用短标识）的单行选择器。
 *
 * 仍然是**原生单选**（fieldset + radio），只是把可见文字换成了图形：
 *   - 方向键在组内移动、Tab 只停在当前项、屏幕阅读器读出「3 个选项中的第 2 个」，
 *     这些行为由浏览器提供，换成图标后一条都没丢，不需要自绘 roving tabindex；
 *   - 选中态由 `:checked` 驱动（`.nav-seg__option[data-active]`），
 *     不额外维护一份「哪个被选中」的 React 状态；
 *   - 可见文字去掉后，名字改由 `aria-label` 提供，`title` 同时补上悬停提示，
 *     图标本身 `aria-hidden`，不会出现「图标 + 文字」重复朗读。
 *   - 选中态不止靠颜色：`[data-active]::after` 还画一个底部圆点（形状线索）。
 *
 * 状态与持久化完全复用既有实现：
 *   - 主题 → `useThemePreference`（`folio-theme` 的三态语义，system = 删除键）；
 *   - 语言 → `useLocaleSwitcher`（`folio-lang` cookie + `router.refresh()`）。
 * 这里既不新增存储键，也不自己改 `data-theme` 或 cookie。
 *
 * 改完立即生效；菜单保持打开——两个 hook 都不同步整页导航，
 * 语言切换走的是 RSC refresh，不会重挂载这棵客户端子树。
 */
export function NavSettings({ locale, messages }: NavSettingsProps) {
  const { preference, setPreference } = useThemePreference()
  const { value, pending, setLocale } = useLocaleSwitcher(locale)

  return (
    <div className="nav-settings">
      <fieldset className="nav-setting">
        <legend className="nav-setting__label">{messages['nav.theme']}</legend>
        <div className="nav-seg">
          {THEME_OPTIONS.map((option) => {
            const checked = preference === option
            const name = messages[THEME_LABEL[option]]
            return (
              <label
                key={option}
                className="nav-seg__option"
                data-active={checked ? 'true' : undefined}
                title={name}
              >
                <input
                  type="radio"
                  name="folio-nav-theme"
                  value={option}
                  checked={checked}
                  onChange={() => setPreference(option)}
                  aria-label={name}
                  className="sr-only"
                />
                <ThemeGlyph value={option} />
              </label>
            )
          })}
        </div>
      </fieldset>

      <fieldset className="nav-setting">
        <legend className="nav-setting__label">{messages['nav.language']}</legend>
        <div className="nav-seg">
          {LOCALES.map((option) => {
            const checked = value === option
            const name = localeName(option)
            return (
              <label
                key={option}
                className="nav-seg__option"
                data-active={checked ? 'true' : undefined}
                aria-busy={checked && pending ? 'true' : undefined}
                title={name}
              >
                <input
                  type="radio"
                  name="folio-nav-locale"
                  value={option}
                  checked={checked}
                  onChange={() => setLocale(option)}
                  aria-label={name}
                  className="sr-only"
                />
                {/* 只显示「中」/「EN」：全名留给 aria-label 与 title */}
                <span aria-hidden="true" className="nav-seg__text">
                  {localeLabel(option)}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
