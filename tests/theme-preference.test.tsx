// @vitest-environment jsdom
/**
 * 主题三态：跟随系统 / 浅色 / 深色
 *
 * 这一组测试围绕一个容易写错的地方：**`system` 不是存储值**。
 * 「跟随系统」= `localStorage` 里没有这个键。所以选回 system 时
 * 必须是 removeItem 而不是 setItem('system')；判断当前态也必须是「键不存在」。
 *
 * 第二个重点：同一个标签页的用户操作不能依赖 `storage` 事件。
 * `storage` 只在**其他**标签页触发，本标签页必须直接写 DOM + 存储；
 * 反过来，其他标签页的改动必须被 `storage` 事件接住。
 *
 * 控件是页脚的三段单选（Sun → Monitor → Moon），不再是右下角的循环按钮，
 * 但状态机没变：断言仍然只看 `data-theme`、`localStorage` 与勾选项。
 */

import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'folio-theme'

/** 可编程的 matchMedia：分别控制「系统偏好深色」与「减少动效」 */
const media = vi.hoisted(() => ({
  dark: false,
  reducedMotion: false,
  listeners: new Set<() => void>(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
}))

import { FooterSettings } from '@/components/layout/footer-settings'

function installMatchMedia() {
  window.matchMedia = ((query: string) => {
    const isDark = query.includes('prefers-color-scheme: dark')
    const isReduce = query.includes('prefers-reduced-motion: reduce')
    return {
      media: query,
      get matches() {
        return isDark ? media.dark : isReduce ? media.reducedMotion : false
      },
      onchange: null,
      addEventListener: (_type: string, listener: () => void) => {
        if (isDark) media.listeners.add(listener)
      },
      removeEventListener: (_type: string, listener: () => void) => {
        media.listeners.delete(listener)
      },
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    } as unknown as MediaQueryList
  }) as typeof window.matchMedia
}

/** 模拟系统配色变化：改状态后通知所有订阅者 */
function emitSystemChange(dark: boolean) {
  media.dark = dark
  act(() => {
    for (const listener of media.listeners) listener()
  })
}

function currentTheme(): string | undefined {
  return document.documentElement.dataset.theme
}

function storedValue(): string | null {
  return window.localStorage.getItem(KEY)
}

/** 当前勾选的主题项的无障碍名称 —— 用它断言「界面显示是哪一态」 */
function checkedLabel(): string {
  const radios = screen.getAllByRole('radio') as HTMLInputElement[]
  const on = radios.find((radio) => radio.checked)
  return on?.getAttribute('aria-label') ?? ''
}

const lightOption = () => screen.getByRole('radio', { name: '浅色' }) as HTMLInputElement
const darkOption = () => screen.getByRole('radio', { name: '深色' }) as HTMLInputElement
const systemOption = () => screen.getByRole('radio', { name: '跟随系统' }) as HTMLInputElement

beforeEach(() => {
  media.dark = false
  media.reducedMotion = false
  media.listeners.clear()
  installMatchMedia()
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
  document.documentElement.className = ''
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('三态的存储语义', () => {
  it('没有存储键时是「跟随系统」，且不主动写入任何值', () => {
    media.dark = true
    render(<FooterSettings />)

    expect(currentTheme()).toBe('dark')
    expect(storedValue()).toBeNull()
    expect(checkedLabel()).toBe('跟随系统')
  })

  it('系统偏好浅色时跟随浅色', () => {
    media.dark = false
    render(<FooterSettings />)
    expect(currentTheme()).toBe('light')
  })

  it('三个选项各自落盘：浅色 / 深色写值，跟随系统删键', () => {
    render(<FooterSettings />)

    expect(checkedLabel()).toBe('跟随系统')

    fireEvent.click(lightOption())
    expect(storedValue()).toBe('light')
    expect(currentTheme()).toBe('light')
    expect(checkedLabel()).toBe('浅色')

    fireEvent.click(darkOption())
    expect(storedValue()).toBe('dark')
    expect(currentTheme()).toBe('dark')
    expect(checkedLabel()).toBe('深色')

    // 回到 system 时删键，而不是存 'system'
    fireEvent.click(systemOption())
    expect(storedValue()).toBeNull()
    expect(checkedLabel()).toBe('跟随系统')
  })

  it('从不把 "system" 写进 localStorage', () => {
    render(<FooterSettings />)
    const order = [lightOption, darkOption, systemOption]
    for (let i = 0; i < 6; i += 1) {
      fireEvent.click(order[i % order.length]!())
      expect(storedValue()).not.toBe('system')
    }
  })

  it('刷新后保留手动选择（预置存储即等价于刷新后重新挂载）', () => {
    window.localStorage.setItem(KEY, 'dark')
    render(<FooterSettings />)
    expect(currentTheme()).toBe('dark')
    expect(checkedLabel()).toBe('深色')
  })
})

describe('系统偏好变化', () => {
  it('跟随系统时立即同步', () => {
    render(<FooterSettings />)
    expect(currentTheme()).toBe('light')

    emitSystemChange(true)
    expect(currentTheme()).toBe('dark')

    emitSystemChange(false)
    expect(currentTheme()).toBe('light')
  })

  it('手动选浅色后，系统切成深色也不影响页面', () => {
    render(<FooterSettings />)
    fireEvent.click(lightOption())
    expect(currentTheme()).toBe('light')

    emitSystemChange(true)
    expect(currentTheme()).toBe('light')
  })

  it('手动选深色后，系统切成浅色也不影响页面', () => {
    render(<FooterSettings />)
    fireEvent.click(darkOption())
    expect(currentTheme()).toBe('dark')

    emitSystemChange(false)
    expect(currentTheme()).toBe('dark')
  })

  it('删掉键回到跟随系统后，系统变化重新生效', () => {
    window.localStorage.setItem(KEY, 'dark')
    render(<FooterSettings />)
    expect(currentTheme()).toBe('dark')

    fireEvent.click(systemOption())
    expect(storedValue()).toBeNull()

    emitSystemChange(true)
    expect(currentTheme()).toBe('dark')
  })
})

describe('跨标签同步', () => {
  /** 其他标签页写存储时，浏览器派发的事件 */
  function otherTabWrote(value: string | null) {
    if (value === null) window.localStorage.removeItem(KEY)
    else window.localStorage.setItem(KEY, value)
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: KEY,
          newValue: value,
          storageArea: window.localStorage,
        }),
      )
    })
  }

  it('其他标签设成深色，这里跟着变', () => {
    render(<FooterSettings />)
    expect(currentTheme()).toBe('light')

    otherTabWrote('dark')
    expect(currentTheme()).toBe('dark')
    expect(checkedLabel()).toBe('深色')
  })

  it('其他标签设成浅色，这里跟着变', () => {
    window.localStorage.setItem(KEY, 'dark')
    render(<FooterSettings />)
    expect(currentTheme()).toBe('dark')

    otherTabWrote('light')
    expect(currentTheme()).toBe('light')
  })

  it('其他标签删除键，这里回到跟随系统', () => {
    window.localStorage.setItem(KEY, 'dark')
    media.dark = false
    render(<FooterSettings />)
    expect(currentTheme()).toBe('dark')

    otherTabWrote(null)
    expect(currentTheme()).toBe('light') // 系统浅色
    expect(checkedLabel()).toBe('跟随系统')
  })

  it('localStorage.clear()（key 为 null）同样视为回到跟随系统', () => {
    window.localStorage.setItem(KEY, 'dark')
    media.dark = true
    render(<FooterSettings />)

    act(() => {
      window.localStorage.clear()
      window.dispatchEvent(
        new StorageEvent('storage', { key: null, storageArea: window.localStorage }),
      )
    })

    expect(storedValue()).toBeNull()
    expect(checkedLabel()).toBe('跟随系统')
  })

  it('无关的存储键被忽略，不会重置主题', () => {
    window.localStorage.setItem(KEY, 'dark')
    render(<FooterSettings />)
    expect(currentTheme()).toBe('dark')

    act(() => {
      window.localStorage.setItem('unrelated', '1')
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'unrelated',
          newValue: '1',
          storageArea: window.localStorage,
        }),
      )
    })

    expect(currentTheme()).toBe('dark')
    expect(checkedLabel()).toBe('深色')
  })

  it('本标签页的点击不依赖 storage 事件也能立即生效', () => {
    render(<FooterSettings />)
    // jsdom 不会因为同标签页 setItem 派发 storage，这里确认仍已切换
    fireEvent.click(lightOption())
    expect(currentTheme()).toBe('light')
    expect(storedValue()).toBe('light')
  })
})

describe('切换动画', () => {
  it('首次加载不加过渡类', () => {
    render(<FooterSettings />)
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false)
  })

  it('用户主动切换时临时加过渡类，结束后摘掉', () => {
    vi.useFakeTimers()
    render(<FooterSettings />)

    fireEvent.click(lightOption())
    expect(document.documentElement.classList.contains('theme-transition')).toBe(true)

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false)
  })

  it('系统自动切换不播放过渡', () => {
    render(<FooterSettings />)
    emitSystemChange(true)
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false)
  })

  it('其他标签改动不播放过渡（那不是本页的用户操作）', () => {
    render(<FooterSettings />)
    act(() => {
      window.localStorage.setItem(KEY, 'dark')
      window.dispatchEvent(new StorageEvent('storage', { key: KEY, newValue: 'dark' }))
    })
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false)
  })

  it('prefers-reduced-motion: reduce 时完全不用过渡类', () => {
    media.reducedMotion = true
    render(<FooterSettings />)
    fireEvent.click(lightOption())
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false)
    // 但切换本身必须照常生效
    expect(currentTheme()).toBe('light')
  })
})

describe('图标与无障碍名称', () => {
  it('三项都渲染图标，且三种形状互不相同', () => {
    render(<FooterSettings />)
    const glyph = (option: HTMLInputElement) =>
      option.closest('label')?.querySelector('svg')?.innerHTML ?? ''

    // MingCute Line 统一用单条 fill path 画出线条外观；三态的差异体现在
    // path 数据本身。旧的 rect / circle 断言描述的是上一版自绘图标的实现细节。
    for (const option of [systemOption(), lightOption(), darkOption()]) {
      expect(glyph(option)).toContain('<path')
      expect(glyph(option)).not.toContain('<circle')
      expect(glyph(option)).not.toContain('<rect')
    }

    expect(new Set([glyph(systemOption()), glyph(lightOption()), glyph(darkOption())]).size).toBe(3)
  })

  it('组名与每项名称都来自既有字典，不出现图标文字重复朗读', () => {
    render(<FooterSettings />)
    expect(screen.getByRole('radiogroup', { name: '主题' })).toBeTruthy()

    for (const name of ['浅色', '跟随系统', '深色']) {
      const radio = screen.getByRole('radio', { name })
      const label = radio.closest('label')
      // 可见文字为空，名称只在 aria-label / title 上
      expect(label?.textContent?.trim()).toBe('')
      expect(label?.getAttribute('title')).toBe(name)
    }
  })
})
