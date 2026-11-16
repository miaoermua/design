/**
 * 服务端语言读取：优先级与「协商不落盘」
 *
 * 两条最容易被写错、也最容易被"优化"掉的规则：
 *   1. 手动选择（cookie）永远压过浏览器语言；
 *   2. 自动协商**不写 cookie**——写进去等于把一次猜测固化成一年偏好。
 *
 * 第 2 条在这里用「cookie store 的写方法从未被调用」来钉住，
 * 而不是只看返回值（返回值正确但顺手写了个 cookie 同样是错的）。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface CookieStub {
  value?: string
}

const state = vi.hoisted(() => ({
  cookie: null as CookieStub | null,
  acceptLanguage: null as string | null,
  set: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      state.cookie && name === 'folio-lang' ? { name, value: state.cookie.value } : undefined,
    set: state.set,
    delete: state.remove,
  }),
  headers: async () => ({
    get: (name: string) => (name.toLowerCase() === 'accept-language' ? state.acceptLanguage : null),
  }),
}))

const { getLocale } = await import('@/lib/i18n/server')

beforeEach(() => {
  state.cookie = null
  state.acceptLanguage = null
  state.set.mockClear()
  state.remove.mockClear()
})

describe('getLocale：优先级', () => {
  it('没有 cookie、没有 header 时用英文兜底', async () => {
    await expect(getLocale()).resolves.toBe('en')
  })

  it('无 cookie 时按 Accept-Language 协商', async () => {
    state.acceptLanguage = 'zh-TW,zh;q=0.9,en;q=0.8'
    await expect(getLocale()).resolves.toBe('zh-CN')
  })

  it('所有中文变体都得到简体，不产生第二个中文 locale', async () => {
    for (const header of ['zh-CN,zh;q=0.9', 'zh-HK,zh;q=0.9', 'zh-MO', 'zh-Hant', 'zh-TW']) {
      state.acceptLanguage = header
      await expect(getLocale()).resolves.toBe('zh-CN')
    }
  })

  it('裸 zh 回退简体', async () => {
    state.acceptLanguage = 'zh'
    await expect(getLocale()).resolves.toBe('zh-CN')
  })

  it('日语/韩语/法语统一归入英文，不产生空界面', async () => {
    for (const header of ['ja-JP,ja;q=0.9', 'ko-KR', 'fr-FR,fr;q=0.9', 'de']) {
      state.acceptLanguage = header
      await expect(getLocale()).resolves.toBe('en')
    }
  })

  it('首选日语、第二语言中文时仍然是英文', async () => {
    state.acceptLanguage = 'ja-JP,zh-CN;q=0.9,en;q=0.8'
    await expect(getLocale()).resolves.toBe('en')
  })

  it('cookie 压过 Accept-Language', async () => {
    state.cookie = { value: 'zh-CN' }
    state.acceptLanguage = 'en-US,en;q=0.9'
    await expect(getLocale()).resolves.toBe('zh-CN')

    state.cookie = { value: 'en' }
    state.acceptLanguage = 'zh-CN'
    await expect(getLocale()).resolves.toBe('en')
  })

  it('cookie 非法时退回浏览器协商，而不是直接回兜底语言', async () => {
    state.cookie = { value: 'ja' } // 不是受支持的存储值
    state.acceptLanguage = 'zh-HK'
    await expect(getLocale()).resolves.toBe('zh-CN')
  })

  it('旧版 zh / zh-TW cookie 仍被当作简体（升级不重置用户选择）', async () => {
    for (const legacy of ['zh', 'zh-TW', 'zh-Hant']) {
      state.cookie = { value: legacy }
      state.acceptLanguage = 'en-US'
      await expect(getLocale()).resolves.toBe('zh-CN')
    }
  })
})

describe('getLocale：自动协商不写 cookie', () => {
  it('协商出任何语言都不调用 write / delete', async () => {
    for (const header of ['zh-TW', 'en-US', 'ja-JP', 'zh-CN', '', '*']) {
      state.cookie = null
      state.acceptLanguage = header
      await getLocale()
    }
    expect(state.set).not.toHaveBeenCalled()
    expect(state.remove).not.toHaveBeenCalled()
  })

  it('连读 cookie 本身也不会产生写入', async () => {
    state.cookie = { value: 'zh-CN' }
    state.acceptLanguage = null
    await getLocale()
    expect(state.set).not.toHaveBeenCalled()
    expect(state.remove).not.toHaveBeenCalled()
  })
})

/**
 * 布局契约：`<html lang>` 与 OG locale 必须来自同一个 locale。
 *
 * 这两处一旦分叉，会出现「页面是繁体、分享卡片标成 zh_CN」这种只能靠肉眼发现的错。
 * 在渲染整棵树之前，先用源码级断言把接线钉住。
 */
describe('layout.tsx：html lang 与 OG locale 同源', () => {
  const source = readFileSync(join(import.meta.dirname, '../src/app/layout.tsx'), 'utf8')

  it('html lang 直接取 getLocale 的结果', () => {
    expect(source).toMatch(
      /const\s*\[\{[^}]*\}\s*,\s*locale\s*,\s*theme\]\s*=\s*await\s+Promise\.all\(/,
    )
    expect(source).toContain('getLocale()')
    expect(source).toContain('<html lang={locale}')
  })

  it('OG locale 用 toOgLocale 映射，不直接塞 BCP 47', () => {
    expect(source).toContain('toOgLocale(locale)')
    expect(source).not.toMatch(/locale:\s*locale\b/)
  })

  it('不再残留写死的 lang 值', () => {
    expect(source).not.toMatch(/<html lang="(zh|en)/)
  })

  it('防闪脚本与 ThemeToggle 共用同一个存储键，且三态语义一致', () => {
    expect(source).toContain("localStorage.getItem('folio-theme')")
    // 只有 'dark' / 'light' 两个显式值；其余（含键缺失）走系统偏好
    expect(source).toContain("s==='dark'")
    expect(source).toContain("s!=='light'")
    expect(source).toContain('prefers-color-scheme: dark')
    // 不把 'system' 当存储值
    expect(source).not.toContain("'system'")
  })
})
