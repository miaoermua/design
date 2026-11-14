import { isFeatureEnabled } from '@/core/registry/features'
import { getCommentOptions, getSiteTimezone, listComments } from '@/lib/api'
import { CommentsThread } from './comments-thread'

interface CommentsSectionProps {
  /** 内容 id：文章 / 笔记 / 页面都能用同一个入口 */
  refId: string
  timeZone?: string
}

/**
 * 评论区（Blog / Note / Page 共用）
 *
 * 服务端职责只有三件：读站点开关、取第一页、把结果交给客户端容器。
 * 这样首屏就有评论，不产生「先空白再闪现」的客户端请求。
 *
 * 开关语义必须说清楚：
 *   - `disable_comment` 是**站点级**。core v12 没有单篇关闭评论，
 *     `posts` / `notes` / `pages` 表都没有 `allow_comment` 列，
 *     `allowComment()` 对这三类恒为 true。所以这里不做「本文关闭了评论」的判断。
 *   - 关闭时给一行说明而不是整块消失：读者至少知道「不是坏了」。
 *
 * 评论是附加内容：取数失败只让这一块降级，绝不影响正文。
 */
export async function CommentsSection({ refId, timeZone }: CommentsSectionProps) {
  if (!isFeatureEnabled('comments')) return null

  const options = await getCommentOptions()
  const zone = timeZone ?? getSiteTimezone()

  if (options.disabled) {
    return (
      <section aria-labelledby="comments-heading" className="comments">
        <header className="comments__head">
          <h2 id="comments-heading" className="comments__title">
            评论
          </h2>
        </header>
        <p className="comments__notice">
          本站已关闭评论，暂时不能在这里留言。此前留下的评论也不再展示。
        </p>
      </section>
    )
  }

  // 先把取数做完，再决定渲染哪个分支：
  // 在 try/catch 里构造 JSX 会把异常边界变成「可能吞掉渲染期错误」的形态，
  // react-hooks/error-boundaries 也会直接报错。这里的降级只针对取数失败。
  const initial = await listComments(refId, { page: 1, size: 20 }).catch(() => null)

  if (!initial) {
    return (
      <section aria-labelledby="comments-heading" className="comments">
        <header className="comments__head">
          <h2 id="comments-heading" className="comments__title">
            评论
          </h2>
        </header>
        <p className="comments__notice">评论加载失败，稍后刷新可重试。</p>
      </section>
    )
  }

  return (
    <CommentsThread
      refId={refId}
      timeZone={zone}
      allowGuest={options.allowGuest}
      initial={initial}
    />
  )
}
