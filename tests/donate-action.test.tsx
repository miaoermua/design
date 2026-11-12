// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DonateAction } from '@/features/donate/components/donate-action'
import { DonateSlot } from '@/features/donate/components/donate-slot'

const QRCODES = [
  { name: '微信', url: 'https://static.example.com/wechat.webp' },
  { name: '支付宝', url: 'https://static.example.com/alipay.webp' },
]

/** jsdom 没有 matchMedia：按用例切换「是否具备 hover 能力」 */
function stubHover(capable: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: capable,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

function renderAction() {
  const view = render(<DonateAction label="赞赏" qrcodes={QRCODES} />)
  const root = view.container.firstElementChild as HTMLElement
  const trigger = screen.getByRole('button', { name: '赞赏' })
  return { ...view, root, trigger }
}

afterEach(() => {
  cleanup()
  stubHover(false)
})

describe('DonateAction 基础渲染', () => {
  it('默认渲染入口，不渲染二维码浮层', () => {
    renderAction()
    expect(screen.getByRole('button', { name: '赞赏' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryAllByRole('img')).toHaveLength(0)
  })
})

describe('点击交互（触摸 / 无 hover 环境）', () => {
  it('点击打开，再次点击关闭', () => {
    const { trigger } = renderAction()

    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(trigger)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('多张二维码按配置顺序渲染，并带对应名称', () => {
    const { trigger } = renderAction()
    fireEvent.click(trigger)

    const images = screen.getAllByRole('img')
    expect(images.map((image) => image.getAttribute('alt'))).toEqual([
      '微信赞赏二维码',
      '支付宝赞赏二维码',
    ])
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      QRCODES[0]?.url,
      QRCODES[1]?.url,
    ])
    expect(screen.getByText('微信')).toBeTruthy()
    expect(screen.getByText('支付宝')).toBeTruthy()
  })

  it('点击外部关闭', () => {
    const { trigger } = renderAction()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Escape 关闭并把焦点还给入口', () => {
    const { trigger } = renderAction()
    fireEvent.click(trigger)
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })
})

describe('hover 交互（桌面指针设备）', () => {
  it('移入展开、移出关闭', () => {
    stubHover(true)
    const { root, trigger } = renderAction()

    fireEvent.pointerEnter(root, { pointerType: 'mouse' })
    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.pointerLeave(root, { pointerType: 'mouse' })
    expect(screen.queryByRole('dialog')).toBeNull()
    // hover 仅展开，不改变 aria 语义之外的其它状态
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('hover 展开后点击会钉住浮层，移出鼠标不关闭', () => {
    stubHover(true)
    const { root, trigger } = renderAction()

    fireEvent.pointerEnter(root, { pointerType: 'mouse' })
    fireEvent.click(trigger)
    fireEvent.pointerLeave(root, { pointerType: 'mouse' })

    expect(screen.getByRole('dialog')).toBeTruthy()

    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('触摸设备不会因为合成 pointerEnter 而展开', () => {
    stubHover(false)
    const { root } = renderAction()

    fireEvent.pointerEnter(root, { pointerType: 'touch' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('图片加载失败降级', () => {
  it('失败的那一张替换为文字占位，其余不受影响', () => {
    const { trigger } = renderAction()
    fireEvent.click(trigger)

    const first = screen.getByRole('img', { name: '微信赞赏二维码' })
    fireEvent.error(first)

    expect(screen.queryByRole('img', { name: '微信赞赏二维码' })).toBeNull()
    expect(screen.getByText('二维码加载失败')).toBeTruthy()
    expect(screen.getByRole('img', { name: '支付宝赞赏二维码' })).toBeTruthy()
  })
})

describe('DonateSlot 可见性开关', () => {
  it('enabled=false 时什么都不渲染', () => {
    const { container } = render(
      <DonateSlot theme={{ donate: { enabled: false, qrcode: QRCODES.map((q) => ({ ...q })) } }} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('没有二维码时不渲染', () => {
    const { container } = render(<DonateSlot theme={{ donate: { enabled: true } }} />)
    expect(container.innerHTML).toBe('')
  })

  it('二维码全部非法时不渲染', () => {
    const { container } = render(
      <DonateSlot
        theme={{ donate: { enabled: true, qrcode: [{ name: 'x', url: 'javascript:alert(1)' }] } }}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('开启且有合法二维码时渲染入口，名称缺省用配置文案', () => {
    render(
      <DonateSlot
        theme={{
          donate: { enabled: true, qrcode: [{ name: '微信', url: 'https://a.example/q.png' }] },
        }}
      />,
    )
    expect(screen.getByRole('button', { name: '赞赏' })).toBeTruthy()
  })
})

describe('文章与日记共用同一个 Donate 组件', () => {
  const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

  it('文章页与日记条目都复用 Donate 实现，没有第二份浮层', () => {
    const articlePage = read('src/app/articles/[category]/[slug]/page.tsx')
    const actionRail = read('src/components/reading/action-rail.tsx')
    const diaryEntry = read('src/features/diaries/components/diary-entry.tsx')

    // 文章页只决定「是否可见 + 用哪份配置」，浮层仍由 donate 模块提供
    expect(articlePage).toContain("from '@/features/donate'")
    expect(articlePage).not.toContain('role="dialog"')

    expect(actionRail).toContain("from '@/features/donate'")
    expect(actionRail).toContain('<DonateAction')
    expect(actionRail).not.toContain('role="dialog"')

    expect(diaryEntry).toContain("from '@/features/donate'")
    expect(diaryEntry).toContain('<DonateSlot')
    expect(diaryEntry).not.toContain('role="dialog"')
  })
})
