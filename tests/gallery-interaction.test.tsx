// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Gallery } from '@/components/markdown/gallery'
import { MediaEnhancer } from '@/components/markdown/media-enhancer'
import {
  ImageViewer,
  closePreview,
  getPreviewState,
  openPreview,
  stepPreview,
} from '@/components/markdown/image-preview'
import type { GalleryImage } from '@/lib/content/gallery'

const images: GalleryImage[] = [
  { src: '/a.webp', alt: '一' },
  { src: '/b.webp', alt: '二' },
  { src: '/c.webp', alt: '三' },
]

/** jsdom 没有布局：手动给轨道和每一项补上几何信息 */
function stubGeometry(track: HTMLElement, itemWidth = 300): void {
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: itemWidth })
  Array.from(track.children).forEach((child, index) => {
    Object.defineProperty(child, 'offsetLeft', { configurable: true, value: index * itemWidth })
    Object.defineProperty(child, 'offsetWidth', { configurable: true, value: itemWidth })
  })
}

function getTrack(container: HTMLElement): HTMLElement {
  const track = container.querySelector('.md-gallery__track')
  if (!(track instanceof HTMLElement)) throw new Error('track not found')
  return track
}

afterEach(() => {
  cleanup()
  closePreview()
  vi.useRealTimers()
})

describe('相册与轮播的共有行为', () => {
  it('渲染全部图片、计数与圆点', () => {
    const { container } = render(<Gallery images={images} />)

    expect(container.querySelectorAll('.md-gallery__item')).toHaveLength(3)
    expect(container.querySelector('.md-gallery__counter')?.textContent).toBe('1 / 3')
    expect(container.querySelectorAll('.md-gallery__dot')).toHaveLength(3)
  })

  it('相册没有上一张/下一张按钮，轮播有', () => {
    const gallery = render(<Gallery images={images} />)
    expect(gallery.queryByLabelText('上一张')).toBeNull()
    gallery.unmount()

    const carousel = render(<Gallery images={images} variant="carousel" />)
    expect(carousel.getByLabelText('上一张')).toBeTruthy()
    expect(carousel.getByLabelText('下一张')).toBeTruthy()
  })

  it('点击圆点切换索引', () => {
    const { container } = render(<Gallery images={images} />)
    stubGeometry(getTrack(container))

    const dots = container.querySelectorAll('.md-gallery__dot')
    fireEvent.click(dots[2] as HTMLElement)

    expect(container.querySelector('.md-gallery__counter')?.textContent).toBe('3 / 3')
    expect(dots[2]?.getAttribute('aria-current')).toBe('true')
  })

  it('滚动位置决定当前索引', async () => {
    const { container } = render(<Gallery images={images} />)
    const track = getTrack(container)
    stubGeometry(track)

    track.scrollLeft = 300
    fireEvent.scroll(track)
    await act(() => new Promise((resolve) => setTimeout(resolve, 30)))

    expect(container.querySelector('.md-gallery__counter')?.textContent).toBe('2 / 3')
  })

  it('点击图片打开预览并落在对应索引', () => {
    const { container } = render(
      <>
        <Gallery images={images} />
        <ImageViewer />
      </>,
    )

    fireEvent.click(container.querySelectorAll('.md-gallery__link')[1] as HTMLElement)

    expect(getPreviewState()?.index).toBe(1)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('src')).toBe('/b.webp')
  })
})

describe('轮播交互', () => {
  it('上一张 / 下一张循环切换', () => {
    const { container } = render(<Gallery images={images} variant="carousel" />)
    stubGeometry(getTrack(container))

    fireEvent.click(screen.getByLabelText('下一张'))
    expect(container.querySelector('.md-gallery__counter')?.textContent).toBe('2 / 3')

    fireEvent.click(screen.getByLabelText('上一张'))
    fireEvent.click(screen.getByLabelText('上一张'))
    expect(container.querySelector('.md-gallery__counter')?.textContent).toBe('3 / 3')
  })

  it('键盘 ← → Home End 可用', () => {
    const { container } = render(<Gallery images={images} variant="carousel" />)
    stubGeometry(getTrack(container))
    const root = container.querySelector('.md-gallery__root') as HTMLElement

    fireEvent.keyDown(root, { key: 'ArrowRight' })
    expect(container.querySelector('.md-gallery__counter')?.textContent).toBe('2 / 3')

    fireEvent.keyDown(root, { key: 'End' })
    expect(container.querySelector('.md-gallery__counter')?.textContent).toBe('3 / 3')

    fireEvent.keyDown(root, { key: 'Home' })
    expect(container.querySelector('.md-gallery__counter')?.textContent).toBe('1 / 3')

    fireEvent.keyDown(root, { key: 'ArrowLeft' })
    expect(container.querySelector('.md-gallery__counter')?.textContent).toBe('3 / 3')
  })

  it('关闭自动播放时不会自行切换', () => {
    const { container } = render(<Gallery images={images} variant="carousel" />)

    fireEvent.click(screen.getByLabelText('下一张'))
    expect(container.querySelector('.md-gallery__counter')?.textContent).toBe('2 / 3')
  })

  it('开启自动播放后按间隔前进，手动操作即停止', () => {
    vi.useFakeTimers()
    const { container } = render(<Gallery images={images} variant="carousel" autoplay />)
    const counter = (): string | null | undefined =>
      container.querySelector('.md-gallery__counter')?.textContent

    expect(counter()).toBe('1 / 3')

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(counter()).toBe('2 / 3')

    // 用户滚动一次后，自动播放永久让位
    fireEvent.pointerDown(container.querySelector('.md-gallery__root') as HTMLElement)

    act(() => {
      vi.advanceTimersByTime(20000)
    })
    expect(counter()).toBe('2 / 3')
  })

  it('卸载时清掉自动播放定时器与帧回调', () => {
    vi.useFakeTimers()
    const { unmount } = render(<Gallery images={images} variant="carousel" autoplay />)

    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('图片预览', () => {
  it('Escape 关闭', () => {
    render(<ImageViewer />)
    act(() => openPreview(images, 0))

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(getPreviewState()).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('关闭按钮与背景点击都能关闭', () => {
    render(<ImageViewer />)
    act(() => openPreview(images, 0))
    fireEvent.click(screen.getByLabelText('关闭预览'))
    expect(getPreviewState()).toBeNull()

    act(() => openPreview(images, 0))
    fireEvent.click(screen.getByRole('presentation'))
    expect(getPreviewState()).toBeNull()
  })

  it('左右切换在集合内循环', () => {
    render(<ImageViewer />)
    act(() => openPreview(images, 0))

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('src')).toBe('/b.webp')

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('src')).toBe('/c.webp')
  })

  it('单张图片不显示切换按钮与计数', () => {
    render(<ImageViewer />)
    act(() => openPreview([images[0] as GalleryImage], 0))

    expect(screen.queryByLabelText('上一张')).toBeNull()
    expect(screen.queryByLabelText('下一张')).toBeNull()
    expect(screen.queryByText('1 / 1')).toBeNull()
  })

  it('打开时锁滚动、聚焦关闭按钮；关闭后恢复', () => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()

    render(<ImageViewer />)
    act(() => openPreview(images, 0))

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).toBe(screen.getByLabelText('关闭预览'))

    act(() => closePreview())

    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(trigger)
  })

  it('卸载后不再响应键盘', () => {
    const { unmount } = render(<ImageViewer />)
    act(() => openPreview(images, 0))

    unmount()
    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(getPreviewState()?.index).toBe(0)
  })

  it('集合切换由 store 驱动，不依赖触发元素', () => {
    render(<ImageViewer />)
    act(() => {
      openPreview(images, 2)
      stepPreview(1)
    })

    expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('src')).toBe('/a.webp')
  })
})

describe('静态 HTML 增强', () => {
  const shell = `
    <div class="prose">
      <div class="md-gallery md-gallery--gallery" data-gallery-id="g1">
        <ul class="md-gallery__track">
          <li class="md-gallery__item"><a class="md-gallery__link" href="/a.webp"><img src="/a.webp" alt="一" /></a></li>
          <li class="md-gallery__item"><a class="md-gallery__link" href="/b.webp"><img src="/b.webp" alt="二" /></a></li>
        </ul>
      </div>
      <figure><img src="/plain.webp" alt="普通图片" /></figure>
    </div>
  `

  it('相册容器被 React 接管，索引与预览可用', () => {
    document.body.innerHTML = shell
    const { unmount } = render(
      <>
        <MediaEnhancer />
        <ImageViewer />
      </>,
    )

    const gallery = document.querySelector('.md-gallery') as HTMLElement
    expect(gallery.querySelector('.md-gallery__root')).toBeTruthy()
    expect(gallery.querySelector('.md-gallery__counter')?.textContent).toBe('1 / 2')

    fireEvent.click(gallery.querySelector('.md-gallery__link') as HTMLElement)
    expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('src')).toBe('/a.webp')

    unmount()
  })

  it('普通图片取得预览语义，点击打开预览', () => {
    document.body.innerHTML = shell
    render(
      <>
        <MediaEnhancer />
        <ImageViewer />
      </>,
    )

    const image = document.querySelector('img[src="/plain.webp"]') as HTMLImageElement
    expect(image.classList.contains('md-image')).toBe(true)
    expect(image.getAttribute('role')).toBe('button')

    fireEvent.click(image)
    expect(screen.getByRole('dialog').querySelector('img')?.getAttribute('src')).toBe('/plain.webp')
  })

  it('普通图片支持键盘打开预览', () => {
    document.body.innerHTML = shell
    render(
      <>
        <MediaEnhancer />
        <ImageViewer />
      </>,
    )

    const image = document.querySelector('img[src="/plain.webp"]') as HTMLImageElement
    fireEvent.keyDown(image, { key: 'Enter' })

    expect(getPreviewState()?.images[0]?.src).toBe('/plain.webp')
  })

  it('加载失败的图片被标记为占位状态', () => {
    document.body.innerHTML = shell
    render(<MediaEnhancer />)

    const image = document.querySelector('img[src="/plain.webp"]') as HTMLImageElement
    fireEvent.error(image)

    expect(image.classList.contains('md-image--broken')).toBe(true)
  })

  it('StrictMode 重复执行 effect 不会叠出第二份相册', () => {
    document.body.innerHTML = shell
    const { unmount } = render(
      <StrictMode>
        <MediaEnhancer />
        <ImageViewer />
      </StrictMode>,
    )

    const gallery = document.querySelector('.md-gallery') as HTMLElement
    expect(gallery.querySelectorAll('.md-gallery__root')).toHaveLength(1)
    expect(gallery.querySelectorAll('.md-gallery__mount')).toHaveLength(1)

    unmount()

    expect(gallery.querySelector('.md-gallery__mount')).toBeNull()
    expect(gallery.getAttribute('data-enhanced')).toBeNull()
  })

  it('卸载后恢复服务端结构并移除监听', () => {
    document.body.innerHTML = shell
    const { unmount } = render(
      <>
        <MediaEnhancer />
        <ImageViewer />
      </>,
    )

    const gallery = document.querySelector('.md-gallery') as HTMLElement
    unmount()

    expect(gallery.querySelector('.md-gallery__root')).toBeNull()
    expect(gallery.querySelector('.md-gallery__track')).toBeTruthy()
    expect(gallery.getAttribute('data-enhanced')).toBeNull()

    fireEvent.click(document.querySelector('img[src="/plain.webp"]') as HTMLImageElement)
    expect(getPreviewState()).toBeNull()
  })
})
