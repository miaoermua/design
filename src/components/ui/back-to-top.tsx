'use client'

import { useEffect, useState } from 'react'

export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 800)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!visible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed right-5 bottom-5 z-40 border border-[var(--edge)] bg-[var(--surface-raised)] px-3 py-2 font-mono text-meta tracking-wide text-[var(--text-secondary)] hover:border-[var(--edge-strong)] sm:right-8 sm:bottom-8"
      aria-label="返回页面顶部"
    >
      回到顶部
    </button>
  )
}
