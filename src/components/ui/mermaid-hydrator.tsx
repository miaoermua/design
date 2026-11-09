'use client'

import { useEffect } from 'react'

/**
 * Mermaid 补水组件
 *
 * 服务端只输出容器 + 源码（base64）。这里在浏览器按需动态加载 mermaid，
 * 逐个替换为 SVG。没有图表时不会加载 mermaid（首屏零成本）。
 * 渲染失败则保留源码可见，并标记状态。
 */
export function MermaidHydrator() {
  useEffect(() => {
    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>('.mermaid-block[data-mermaid-src]'),
    ).filter((node) => node.dataset.rendered !== 'true')

    if (nodes.length === 0) return

    let cancelled = false

    void (async () => {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({
          startOnLoad: false,
          theme: 'neutral',
          securityLevel: 'strict',
          fontFamily: 'var(--font-sans)',
        })

        for (const [index, node] of nodes.entries()) {
          if (cancelled) return
          const encoded = node.dataset.mermaidSrc
          if (!encoded) continue
          try {
            const code = new TextDecoder().decode(
              Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0)),
            )
            const { svg } = await mermaid.render(`folio-mermaid-${index}`, code)
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
      } catch {
        // mermaid 自身加载失败：保留源码，不做静默清除
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
