'use client'

import { useCallback, useState } from 'react'
import { mergeThreadReplies } from '@/lib/api/domain/comment'
import type { CommentItem, CommentPage } from '@/lib/api/domain/comment'
import { CommentCard } from './comment-card'
import { CommentComposer } from './comment-composer'

interface CommentsThreadProps {
  refId: string
  timeZone: string
  allowGuest: boolean
  /** 服务端渲染好的第一页，首帧就有内容，不依赖客户端请求 */
  initial: CommentPage
}

type Sort = 'pinned' | 'newest' | 'oldest'

const SORTS: Array<{ value: Sort; label: string }> = [
  { value: 'pinned', label: '置顶优先' },
  { value: 'newest', label: '最新' },
  { value: 'oldest', label: '最早' },
]

/**
 * 评论区容器（客户端）
 *
 * 版面顺序按「先看见别人说什么，再决定自己说什么」还是「先写再说」权衡过：
 * 这里选**输入区在列表之上**——评论数通常只有个位数，压到底部会让读者
 * 以为没有入口；置顶之后表单在首屏可见，长列表也不会把入口推到很远。
 *
 * 第一页由服务端给出，之后的动作都在浏览器里完成：
 *   - 加载更多根评论 → `GET /api/comments`（page/size，游标无关）
 *   - 展开长线程中段 → `GET /api/comments/thread`（next_cursor，独立分页模型）
 *   - 切换排序 → 重新取第一页
 *
 * 树重建与合并用的是领域层的纯函数（`@/lib/api/domain/comment`），
 * 不从 `@/lib/api` 入口导入——那里带着请求层，不该进客户端包。
 */
export function CommentsThread({ refId, timeZone, allowGuest, initial }: CommentsThreadProps) {
  const [page, setPage] = useState<CommentPage>(initial)
  const [sort, setSort] = useState<Sort>('pinned')
  const [busy, setBusy] = useState<'more' | 'sort' | string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(
    async (nextPage: number, nextSort: Sort): Promise<CommentPage | null> => {
      try {
        const params = new URLSearchParams({
          refId,
          page: String(nextPage),
          size: '20',
          sort: nextSort,
        })
        const response = await fetch(`/api/comments?${params.toString()}`)
        if (!response.ok) return null
        return (await response.json()) as CommentPage
      } catch {
        return null
      }
    },
    [refId],
  )

  /** 重新取第一页：提交成功、切换排序后都用它，保证顺序与置顶标记是最新的 */
  const reload = useCallback(async () => {
    setBusy('sort')
    setError(null)
    const fresh = await fetchPage(1, sort)
    setBusy(null)
    if (!fresh) {
      setError('评论刷新失败，请稍后再试')
      return
    }
    setPage(fresh)
  }, [fetchPage, sort])

  async function loadMore() {
    if (busy) return
    setBusy('more')
    setError(null)
    const next = await fetchPage(page.page + 1, sort)
    setBusy(null)
    if (!next) {
      setError('加载失败，请稍后再试')
      return
    }
    setPage((prev) => ({
      ...next,
      items: [...prev.items, ...next.items],
      total: next.total,
    }))
  }

  function changeSort(next: Sort) {
    if (next === sort || busy) return
    setSort(next)
    setBusy('sort')
    void fetchPage(1, next).then((fresh) => {
      setBusy(null)
      if (!fresh) {
        setError('切换排序失败，请稍后再试')
        return
      }
      setPage(fresh)
    })
  }

  /** 长线程补页：把新回复合进对应根评论的子树 */
  async function loadThread(rootId: string) {
    const root = page.items.find((item) => item.id === rootId)
    if (!root?.nextCursor || busy) return

    setBusy(rootId)
    setError(null)

    try {
      const params = new URLSearchParams({ rootId, cursor: root.nextCursor })
      const response = await fetch(`/api/comments/thread?${params.toString()}`)
      if (!response.ok) throw new Error('thread failed')
      const result = (await response.json()) as {
        items: CommentItem[]
        remaining: number
        nextCursor: string | null
      }

      setPage((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          if (item.id !== rootId) return item

          // 没有任何进展就不能再留一个「继续加载」的按钮：
          // 否则点一次请求一次、永远回到同一处，等于用网络换一个死循环。
          if (result.items.length === 0) {
            return mergeThreadReplies(item, [], { hiddenCount: 0, nextCursor: null })
          }

          return mergeThreadReplies(item, result.items, {
            hiddenCount: result.remaining,
            nextCursor: result.nextCursor,
          })
        }),
      }))
    } catch {
      setError('回复加载失败，请稍后再试')
    } finally {
      setBusy(null)
    }
  }

  const sorting = busy === 'sort'

  return (
    <section aria-labelledby="comments-heading" className="comments">
      <header className="comments__head">
        <h2 id="comments-heading" className="comments__title">
          评论
          {page.total > 0 ? <span className="comments__count">{page.total}</span> : null}
        </h2>

        {page.total > 0 ? (
          <div className="comments__sort" role="group" aria-label="评论排序">
            {SORTS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => changeSort(item.value)}
                aria-pressed={sort === item.value}
                className="comments__sort-button"
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </header>

      {allowGuest ? (
        <CommentComposer refId={refId} onSuccess={reload} />
      ) : (
        <p className="comments__notice">本站当前不接受匿名评论，暂时不能在这里留言。</p>
      )}

      <div aria-busy={sorting || undefined}>
        {page.items.length === 0 ? (
          <p className="comments__empty">
            {page.total > 0 ? '这一页没有评论。' : '还没有评论，留下第一条。'}
          </p>
        ) : (
          <ul className="comments__list">
            {page.items.map((item) => (
              <CommentCard
                key={item.id}
                comment={item}
                rootId={item.id}
                timeZone={timeZone}
                allowGuest={allowGuest}
                onChanged={reload}
                onLoadThread={loadThread}
              />
            ))}
          </ul>
        )}

        {page.hasNext ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={busy === 'more'}
            className="comments__more"
          >
            {busy === 'more' ? '加载中…' : '加载更多评论'}
          </button>
        ) : null}

        {error ? (
          <p role="status" className="comments__error">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  )
}
