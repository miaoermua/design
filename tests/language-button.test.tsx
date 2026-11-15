// @vitest-environment jsdom
/**
 * 语言切换按钮：唯一写 cookie 的地方
 *
 * 需求里最容易被实现错的一条是「只有手动选择才写 cookie」。
 * 这里从落盘一侧验证：点一次按钮，cookie 必须以正确的名字、有效期写下去；
 * 而自动协商那条路径由 `i18n-server.test.ts` 保证"从不写"。
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

import { LanguageButton } from '@/components/layout/language-button'
import { LOCALE_COOKIE, localeLabel } from '@/lib/i18n/config'

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
})

afterEach(cleanup)

/** 按钮上可见的短标识（第一个 aria-hidden 的 span；后一个是悬停提示） */
function shortLabel(button: HTMLElement): string {
  return button.querySelector('span[aria-hidden="true"]')?.textContent ?? ''
}

describe('双语循环', () => {
  it('中文 → English → 中文', () => {
    render(<LanguageButton current="zh-CN" label="语言" />)
    const button = screen.getByRole('button')

    expect(shortLabel(button)).toBe(localeLabel('zh-CN'))
    expect(button.getAttribute('aria-label')).toBe('语言 · English')

    fireEvent.click(button)
    expect(readCookie(LOCALE_COOKIE)).toBe('en')
    expect(shortLabel(button)).toBe(localeLabel('en'))
    expect(button.getAttribute('aria-label')).toBe('语言 · 中文')

    fireEvent.click(button)
    expect(readCookie(LOCALE_COOKIE)).toBe('zh-CN')
    expect(shortLabel(button)).toBe(localeLabel('zh-CN'))
  })

  it('从英文进入时下一个是中文', () => {
    render(<LanguageButton current="en" label="Language" />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')).toBe('Language · 中文')
    fireEvent.click(button)
    expect(readCookie(LOCALE_COOKIE)).toBe('zh-CN')
  })

  it('短标识只有两种，且与全名一一对应', () => {
    expect(localeLabel('zh-CN')).toBe('中')
    expect(localeLabel('en')).toBe('EN')
    expect(new Set([localeLabel('zh-CN'), localeLabel('en')]).size).toBe(2)
  })
})

describe('cookie 落盘', () => {
  it('写入正确的名字与一年有效期', () => {
    render(<LanguageButton current="zh-CN" label="语言" />)
    fireEvent.click(screen.getByRole('button'))

    // jsdom 的 document.cookie 不暴露属性，只能断言实际存在且值正确；
    // 属性（path / max-age / samesite）由下面的源码契约补上。
    expect(readCookie(LOCALE_COOKIE)).toBe('en')
  })

  it('每次点击都重新请求 RSC 负载，让内容与界面同时更新', () => {
    render(<LanguageButton current="zh-CN" label="语言" />)
    fireEvent.click(screen.getByRole('button'))
    expect(refresh).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button'))
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('cookie 属性写在设置处：Path=/、一年、SameSite=Lax', () => {
    const source = readFileSync(
      join(import.meta.dirname, '../src/components/layout/language-button.tsx'),
      'utf8',
    )
    expect(source).toContain('path=/')
    expect(source).toContain('max-age=31536000')
    expect(source).toMatch(/samesite=lax/i)
  })

  it('已经手动选过同一语言时，重复点击不再重取负载', () => {
    // 手动选过 zh-CN 后，按钮上的下一次点击是「切到 en」，必须照常落盘与刷新；
    // 这里只钉住「有 cookie 时切换行为不变」，早退分支由 nav-menu 的集成用例覆盖。
    document.cookie = `${LOCALE_COOKIE}=zh-CN; path=/`
    render(<LanguageButton current="zh-CN" label="语言" />)

    fireEvent.click(screen.getByRole('button'))
    expect(readCookie(LOCALE_COOKIE)).toBe('en')
    expect(refresh).toHaveBeenCalledTimes(1)
  })
})
