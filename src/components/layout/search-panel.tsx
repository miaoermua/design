'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import type { SearchHit } from '@/lib/api/domain/taxonomy'
import { searchPath } from '@/lib/routes'
import { statusStore } from '@/lib/status/store'
import { cn } from '@/lib/utils/cn'

interface SearchPanelProps {
  open: boolean
  onClose: () => void
  labels: {
    title: string
    placeholder: string
    empty: string
    emptyHint: string
    loading: string
    failed: string
    hint: string
    openFull: string
  }
}

interface SearchResponse {
  hits: SearchHit[]
  total: number
  failed: boolean
}

/**
 * 搜索面板
 *
 * 复用的是**同一份搜索能力**：面板只是 `/search` 页面的预览入口，
 * 结果来自同一个后端 `/search` 接口、同一个 adapter。
 * 这里不重新实现检索逻辑，也不在前端做模糊匹配。
 *
 * 交互约定：
 *   - 只做「输入 → 预览前 5 条」；回车进入 /search?q= 查看完整结果与分页。
 *   - 用 ⌘K / Ctrl+K 打开，Esc 关闭；两者都不拦截输入框内的普通按键。
 *   - 焦点管理：打开时焦点进输入框，关闭时还原到打开前的元素。
 *   - 请求去抖 220ms；用请求序号丢弃过期响应，避免快速输入时旧结果覆盖新结果。
 */
export function SearchPanel({ open, onClose, labels }: SearchPanelProps) {
  const router = useRouter()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const requestId = useRef(0)

  const [keyword, setKeyword] = useState('')
  const [state, setState] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)

  // 打开时记录来源元素，关闭后还原焦点（键盘用户不会「丢位置」）
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30)
    return () => {
      window.clearTimeout(timer)
      restoreFocusRef.current?.focus?.()
    }
  }, [open])

  // Esc 关闭 + 焦点陷阱（面板内 Tab 循环）
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panelRef.current) return

      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  // 搜索：去抖 + 序号丢弃过期响应
  const runSearch = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
      setState(null)
      setLoading(false)
      return
    }

    const current = ++requestId.current
    setLoading(true)
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
        headers: { accept: 'application/json' },
      })
      if (current !== requestId.current) return
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as {
        hits: SearchHit[]
        total: number
        failed?: boolean
      }
      // BFF 用 200 + failed 表达「后端取数失败」，面板只需知道失败与否
      if (data.failed) {
        statusStore.reportApiFailure()
        setState({ hits: [], total: 0, failed: true })
        return
      }
      statusStore.reportApiSuccess()
      setState({ hits: data.hits ?? [], total: data.total ?? 0, failed: false })
    } catch {
      if (current !== requestId.current) return
      statusStore.reportApiFailure()
      setState({ hits: [], total: 0, failed: true })
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => void runSearch(keyword), 220)
    return () => window.clearTimeout(timer)
  }, [keyword, open, runSearch])

  // 关闭时不清空关键词：再次打开通常是想接着找上次的东西
  if (!open) return null

  const submit = () => {
    const trimmed = keyword.trim()
    if (!trimmed) return
    onClose()
    router.push(searchPath(trimmed))
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* 遮罩：点击关闭；不使用黑色蒙版，用纸面 + 轻模糊，保持「纸上浮起」的层次 */}
      <button
        type="button"
        aria-label={labels.title}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[var(--surface)]/60 backdrop-blur-[2px] animate-[fade-in_var(--duration-fast)_var(--ease-out-soft)]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
        className={cn(
          'relative mx-auto mt-[12vh] w-[calc(100%-1.5rem)] max-w-[36rem]',
          'glass-panel overflow-hidden rounded-[var(--radius-md)]',
          'animate-[panel-in_var(--duration-base)_var(--ease-out-soft)]',
        )}
      >
        <div className="flex items-center gap-3 border-b border-[var(--edge)] px-4 py-3">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-[1.05rem] shrink-0 text-[var(--text-tertiary)]"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <label htmlFor={inputId} className="sr-only">
            {labels.title}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              // 只在回车时跳转；Esc 交给全局处理器
              if (event.key === 'Enter') {
                event.preventDefault()
                submit()
              }
            }}
            placeholder={labels.placeholder}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-1 font-serif text-lead text-[var(--text-heading)] outline-none placeholder:font-sans placeholder:text-small placeholder:text-[var(--text-tertiary)]"
          />
          <kbd className="meta hidden shrink-0 rounded-[var(--radius-xs)] border border-[var(--edge)] px-1.5 py-0.5 text-[var(--text-tertiary)] sm:block">
            Esc
          </kbd>
        </div>

        <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
          {loading ? (
            <p className="meta px-4 py-6">{labels.loading}</p>
          ) : state?.failed ? (
            <p className="px-4 py-6 text-small text-[var(--text-secondary)]">{labels.failed}</p>
          ) : state && state.hits.length > 0 ? (
            <ul className="divide-y divide-[var(--edge)]">
              {state.hits.map((hit) => (
                <li key={`${hit.kind}-${hit.id}`}>
                  <a
                    href={
                      hit.kind === 'post' && hit.categorySlug
                        ? `/articles/${encodeURIComponent(hit.categorySlug)}/${encodeURIComponent(hit.slug ?? '')}`
                        : `/diaries/${encodeURIComponent(hit.id)}`
                    }
                    onClick={onClose}
                    className="group flex flex-col gap-1 px-4 py-3 transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-wash)]"
                  >
                    <span className="flex items-center gap-2 text-meta text-[var(--text-tertiary)]">
                      <span>{hit.kind === 'post' ? '文章' : '日记'}</span>
                      {hit.categoryName ? <span>· {hit.categoryName}</span> : null}
                    </span>
                    <span className="font-serif text-body leading-[1.5] text-[var(--text-heading)]">
                      {hit.title}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          ) : keyword.trim() ? (
            <div className="px-4 py-6">
              <p className="text-small text-[var(--text-heading)]">{labels.empty}</p>
              <p className="mt-1 text-caption text-[var(--text-secondary)]">{labels.emptyHint}</p>
            </div>
          ) : (
            <p className="meta px-4 py-6">{labels.hint}</p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[var(--edge)] px-4 py-2.5">
          <p className="meta text-[var(--text-tertiary)]">{labels.hint}</p>
          <button
            type="button"
            onClick={submit}
            disabled={!keyword.trim()}
            className="meta text-[var(--accent-strong)] transition-opacity duration-[var(--duration-fast)] disabled:opacity-40"
          >
            {labels.openFull} →
          </button>
        </div>
      </div>
    </div>
  )
}