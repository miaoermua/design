'use client'

import { useEffect } from 'react'

/**
 * 从当前主题的 CSS 变量里取色：图表跟着 token 走，不写死颜色。
 *
 * 自定义属性在 getComputedStyle 里只返回「写进去的那串字」，像
 * `color-mix(in oklab, …)` 原样给出，mermaid 底层的 khroma 解析不了。
 * 因此逐条塞进探针元素再读 computed color，让浏览器把颜色求值成 rgb()。
 */
function readThemeVariables() {
  const styles = getComputedStyle(document.documentElement)
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden'
  document.body.appendChild(probe)

  // 浏览器可能把 color-mix 求值成 oklab()/color()，khroma 同样不认，
  // 最后一步用 canvas 精确落到 sRGB 字节上。
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  const toRgb = (value: string) => {
    if (!ctx) return value
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
    return a === 255 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`
  }

  const SENTINEL = 'rgb(1, 2, 3)'
  /** 取不到或解析不了时返回 null，交给 mermaid 的默认主题，绝不写死颜色 */
  const color = (name: string): string | null => {
    const raw = styles.getPropertyValue(name).trim()
    if (!raw) return null
    probe.style.color = SENTINEL
    probe.style.color = raw
    const resolved = getComputedStyle(probe).color
    return resolved && resolved !== SENTINEL ? toRgb(resolved) : null
  }

  const vars: Record<string, string> = { fontSize: '14px' }

  const fontFamily = styles.getPropertyValue('--font-sans').trim()
  if (fontFamily) vars.fontFamily = fontFamily

  const colorMap: Array<[string, string]> = [
    ['background', '--reading-surface'],
    ['primaryColor', '--color-accent-wash'],
    ['primaryTextColor', '--text-heading'],
    ['primaryBorderColor', '--color-accent-soft'],
    ['secondaryColor', '--surface-sunk'],
    ['tertiaryColor', '--reading-surface'],
    ['mainBkg', '--color-accent-wash'],
    ['nodeBorder', '--color-accent-soft'],
    ['clusterBkg', '--surface'],
    ['clusterBorder', '--edge'],
    ['lineColor', '--text-tertiary'],
    ['textColor', '--text-secondary'],
    ['edgeLabelBackground', '--reading-surface'],
  ]

  for (const [key, name] of colorMap) {
    const value = color(name)
    if (value) vars[key] = value
  }

  probe.remove()
  return vars
}

/**
 * Mermaid 补水组件
 *
 * 服务端只输出容器 + 源码（base64）。这里在浏览器按需动态加载 mermaid，
 * 逐个替换为 SVG。没有图表时不会加载 mermaid（首屏零成本）。
 * 渲染失败则保留源码可见，并标记状态。
 *
 * 换主题时按 dataset.theme 重新渲染：图表的节点色来自 token，
 * 不跟随就会在深色纸面上留下一块浅色图表。
 */
export function MermaidHydrator() {
  useEffect(() => {
    let cancelled = false
    let api: (typeof import('mermaid'))['default'] | null = null

    const nodesWithSource = () =>
      Array.from(document.querySelectorAll<HTMLElement>('.mermaid-block[data-mermaid-src]'))

    const renderAll = async () => {
      const nodes = nodesWithSource().filter((node) => node.dataset.rendered !== 'true')
      if (nodes.length === 0) return

      try {
        if (!api) api = (await import('mermaid')).default
        if (cancelled) return

        api.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: readThemeVariables(),
          securityLevel: 'strict',
          flowchart: { curve: 'linear', padding: 12 },
        })

        for (const [index, node] of nodes.entries()) {
          if (cancelled) return
          const encoded = node.dataset.mermaidSrc
          if (!encoded) continue
          try {
            const code = new TextDecoder().decode(
              Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
            )
            const { svg } = await api.render(`folio-mermaid-${index}-${Date.now()}`, code)
            if (cancelled) return
            node.innerHTML = svg
            node.dataset.rendered = 'true'
          } catch {
            node.dataset.rendered = 'error'
            node.insertAdjacentHTML(
              'beforeend',
              '<p class="text-meta">图表渲染失败，上方为源码。</p>',
            )
          }
        }
      } catch (error) {
        // mermaid 自身加载失败：保留源码，不做静默清除
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[mermaid] 加载或渲染失败', error)
        }
      }
    }

    void renderAll()

    let current = document.documentElement.dataset.theme ?? ''
    const observer = new MutationObserver(() => {
      const next = document.documentElement.dataset.theme ?? ''
      if (next === current) return
      current = next
      for (const node of nodesWithSource()) {
        if (node.dataset.rendered === 'true') node.dataset.rendered = 'false'
      }
      void renderAll()
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [])

  return null
}
