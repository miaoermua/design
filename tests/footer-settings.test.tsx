// @vitest-environment jsdom
/**
 * 页脚设置区：语言选择器 + 三态主题
 *
 * 语言侧最容易被实现错的一条是「只有手动选择才写 cookie」。
 * 这里从落盘一侧验证：选项点一次，cookie 必须以正确的名字、有效期写下去，
 * 并且触发 `router.refresh()`；而自动协商那条路径由 `i18n-server.test.ts`
 * 保证「从不写」。
 *
 * 主题三态的状态机在 `theme-preference.test.tsx`，这里只验证它确实挂在
 * 同一个区块上、且和语言共用一套布局。
 */

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const refresh = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}))

import { FooterSettings } from '@/components/layout/footer-settings'
import { LocaleProvider } from '@/lib/i18n/client'
import { LOCALE_COOKIE } from '@/lib/i18n/config'

function readCookie(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=') || null
  }
  return null
}

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name) document.cookie = `${name}=; path=/; max-age=0`
  }
}

beforeEach(() => {
  clearCookies()
  refresh.mockClear()
  window.localStorage.clear()
})

afterEach(cleanup)

/** 语言触发器：菜单收起时唯一的 button */
function trigger(): HTMLElement {
  return screen.getByRole('button', { name: /语言|Language|中文|English/ })
}

function openMenu() {
  fireEvent.click(trigger())
}

function option(name: string): HTMLElement {
  return screen.getByRole('menuitemradio', { name })
}

describe('语言选择器：默认外观与菜单', () => {
  it('默认显示当前语言名，菜单收起', () => {
    render(<FooterSettings />)
    expect(trigger().textContent).toContain('中文')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('点开后列出全部受支持语言，当前项 aria-checked', () => {
    render(<FooterSettings />)
    openMenu()

    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    const menu = screen.getByRole('menu')
    expect(menu).toBeTruthy()

    const items = screen.getAllByRole('menuitemradio')
    expect(items).toHaveLength(2)
    expect(option('中文').getAttribute('aria-checked')).toBe('true')
    expect(option('English').getAttribute('aria-checked')).toBe('false')
  })

  it('Escape 关闭菜单并把焦点还给触发器', () => {
    render(<FooterSettings />)
    openMenu()
    expect(screen.queryByRole('menu')).not.toBeNull()

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('点击菜单外部关闭', () => {
    render(<FooterSettings />)
    openMenu()
    expect(screen.queryByRole('menu')).not.toBeNull()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('menu')).toBeNull()
  })
})

describe('语言选择：写 cookie 并重取 RSC', () => {
  it('选 English 写入 cookie 并刷新', () => {
    render(<FooterSettings />)
    openMenu()
    fireEvent.click(option('English'))

    // jsdom 的 document.cookie 不暴露属性，只能断言实际存在且值正确；
    // 属性（path / max-age / samesite）由下面的源码契约补上。
    expect(readCookie(LOCALE_COOKIE)).toBe('en')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('选完立即关闭菜单，且触发器显示新语言', () => {
    render(<FooterSettings />)
    openMenu()
    fireEvent.click(option('English'))

    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger().textContent).toContain('English')
  })

  it('从英文进入时选中文同样落盘', () => {
    // 界面语言来自服务端（LocaleProvider），不是 cookie：cookie 只记录手动选择
    render(
      <LocaleProvider locale="en">
        <FooterSettings />
      </LocaleProvider>,
    )
    expect(trigger().textContent).toContain('English')

    openMenu()
    fireEvent.click(option('中文'))
    expect(readCookie(LOCALE_COOKIE)).toBe('zh-CN')
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('cookie 与当前语言一致时，重复选择不再重取负载', () => {
    // 当前显示中文且 cookie 也是 zh-CN → 这次点击是空操作
    document.cookie = `${LOCALE_COOKIE}=zh-CN; path=/`
    render(<FooterSettings />)

    openMenu()
    fireEvent.click(option('中文'))
    expect(readCookie(LOCALE_COOKIE)).toBe('zh-CN')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('cookie 属性写在唯一写入点：Path=/、一年、SameSite=Lax', () => {
    const source = readFileSync(
      join(import.meta.dirname, '../src/components/layout/use-locale-switcher.ts'),
      'utf8',
    )
    expect(source).toContain('path=/')
    expect(source).toContain('max-age=31536000')
    expect(source).toMatch(/samesite=lax/i)
  })
})

describe('设置区结构', () => {
  it('语言在左、主题在右，同一行（DOM 顺序即视觉顺序）', () => {
    const { container } = render(<FooterSettings />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('footer-settings')

    const [first, second] = [...root.children]
    expect(first?.className).toContain('footer-lang')
    expect(second?.getAttribute('role')).toBe('radiogroup')
  })

  it('主题三项顺序是 浅色 → 跟随系统 → 深色', () => {
    render(<FooterSettings />)
    const order = screen.getAllByRole('radio').map((radio) => radio.getAttribute('aria-label'))
    expect(order).toEqual(['浅色', '跟随系统', '深色'])
  })
})
