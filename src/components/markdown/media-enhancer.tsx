'use client'

/**
 * 图片增强器
 *
 * 正文来自服务端产出的 HTML 字符串（`dangerouslySetInnerHTML`），React 不拥有这些节点。
 * 这里沿用 Mermaid 补水的同一套做法：**服务端先产出可用的静态结构，客户端再增强**。
 *
 *   - 相册：给 `.md-gallery` 追加一个挂载点，用 portal 把 `<Gallery>` 挂进去；
 *     服务端产出的静态轨道原样保留，只靠 `data-enhanced` 在样式里隐藏，
 *     这样卸载后自动回到「一排可横向滚动的图片」，不需要手工回写 innerHTML
 *   - 普通图片：加可聚焦语义，点击 / 回车打开统一预览
 *   - 加载失败：打上 `md-image--broken`，样式里退化成占位块
 *
 * 作用范围限定在单个 Prose 容器内，定位逻辑见 `./content-scope`。
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'
import type { GalleryImage, GalleryVariant } from '@/lib/content/gallery'
import { locateProseScope } from './content-scope'
import { Gallery } from './gallery'
import { openPreview } from './image-preview'

const GALLERY_SELECTOR = '.md-gallery[data-gallery-id]'
/** 容器属性：样式据此隐藏服务端静态轨道 */
const ENHANCED_FLAG = 'enhanced'
/** Prose 容器属性：表示已被某个增强器认领 */
const SCOPE_FLAG = 'mediaEnhanced'
const MOUNT_CLASS = 'md-gallery__mount'

interface GalleryHost {
  /** 服务端生成的相册 id，用作 portal 的稳定 key */
  id: string
  node: HTMLElement
  images: GalleryImage[]
  variant: GalleryVariant
}

interface MountedGallery {
  container: HTMLElement
  mount: HTMLElement
}

function readGalleryImages(node: HTMLElement): GalleryImage[] {
  const images: GalleryImage[] = []

  for (const img of Array.from(node.querySelectorAll<HTMLImageElement>('.md-gallery__item img'))) {
    const src = img.getAttribute('src')
    if (!src) continue

    const title = img.getAttribute('title')
    const image: GalleryImage = { src, alt: img.getAttribute('alt') ?? '' }
    if (title) image.title = title
    images.push(image)
  }

  return images
}

/** 从事件目标回溯到「可预览的普通图片」；相册与链接内的图片不参与 */
function resolvePlainImage(target: EventTarget | null): { src: string; alt: string } | null {
  if (!(target instanceof Element)) return null

  const img = target.closest('img')
  if (!(img instanceof HTMLImageElement)) return null
  if (!img.classList.contains('md-image')) return null
  if (!img.closest('.prose')) return null
  if (img.closest('.md-gallery') || img.closest('a')) return null

  const src = img.getAttribute('src')
  if (!src) return null
  return { src, alt: img.getAttribute('alt') ?? '' }
}

function markBroken(img: HTMLImageElement): void {
  if (!img.classList.contains('md-image')) return
  img.classList.add('md-image--broken')
}

export function MediaEnhancer(): ReactElement {
  const markerRef = useRef<HTMLSpanElement>(null)
  const [hosts, setHosts] = useState<GalleryHost[]>([])

  useEffect(() => {
    const scope = locateProseScope(markerRef.current, SCOPE_FLAG)
    if (!scope) return
    scope.dataset[SCOPE_FLAG] = 'true'

    const found: GalleryHost[] = []
    const mounted: MountedGallery[] = []
    for (const node of Array.from(scope.querySelectorAll<HTMLElement>(GALLERY_SELECTOR))) {
      if (node.dataset[ENHANCED_FLAG] === 'true') continue

      const images = readGalleryImages(node)
      if (images.length === 0) continue

      // 挂载点放在静态轨道前面：查询 `.md-gallery__link` 时先命中增强后的结构
      const mount = document.createElement('div')
      mount.className = MOUNT_CLASS
      node.dataset[ENHANCED_FLAG] = 'true'
      node.prepend(mount)
      mounted.push({ container: node, mount })

      found.push({
        id: node.dataset.galleryId ?? `gallery-${mounted.length}`,
        node: mount,
        images,
        variant: node.classList.contains('md-gallery--carousel') ? 'carousel' : 'gallery',
      })
    }

    // 一个实例只接管一个正文容器，因此整体覆盖而不是追加：
    // StrictMode 下 effect 会「挂载 → 清理 → 再挂载」，追加会留下指向已摘除节点的 portal
    setHosts(found)

    // 普通图片：可聚焦 + 预览语义；SSR 阶段就 404 的图片直接标记
    for (const img of Array.from(scope.querySelectorAll<HTMLImageElement>('.prose img'))) {
      if (img.classList.contains('md-image')) continue
      if (img.closest('.md-gallery') || img.closest('a')) continue

      img.classList.add('md-image')
      img.tabIndex = 0
      img.setAttribute('role', 'button')
      img.setAttribute('aria-label', img.alt ? `预览图片：${img.alt}` : '预览图片')

      if (img.complete && img.naturalWidth === 0) markBroken(img)
    }

    const handleClick = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const image = resolvePlainImage(event.target)
      if (!image) return

      event.preventDefault()
      openPreview([image], 0)
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' && event.key !== ' ') return

      const image = resolvePlainImage(event.target)
      if (!image) return

      event.preventDefault()
      openPreview([image], 0)
    }

    const handleError = (event: Event): void => {
      if (event.target instanceof HTMLImageElement) markBroken(event.target)
    }

    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    // img 的 error 事件不冒泡，用捕获阶段统一接住
    document.addEventListener('error', handleError, true)

    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('error', handleError, true)

      // 拆掉挂载点、摘掉标记：静态轨道随之恢复可见（服务端结构从未被改写）
      for (const { container, mount } of mounted) {
        mount.remove()
        delete container.dataset[ENHANCED_FLAG]
      }
      delete scope.dataset[SCOPE_FLAG]
      setHosts([])
    }
  }, [])

  return (
    <>
      {/* 只用来定位本实例的正文容器，不进布局、不进可访问性树 */}
      <span ref={markerRef} hidden />
      {hosts.map((host) =>
        createPortal(<Gallery images={host.images} variant={host.variant} />, host.node, host.id),
      )}
    </>
  )
}
