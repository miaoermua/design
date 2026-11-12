'use client'

import { useState } from 'react'
import type { CommentItem } from '@/lib/api'
import { formatDate } from '@/lib/utils/date'
import { CommentComposer } from './comment-composer'

interface CommentCardProps {
  comment: CommentItem
  /** 根评论 id：长线程补页按根评论取 */
  rootId: string
  timeZone: string
  allowGuest: boolean
  depth?: number
  /** 被回复者的名字：只在回复上出现，用来区分「回给谁」而不是靠缩进猜 */
  replyTo?: string
  onChanged: () => void
  onLoadThread: (rootId: string) => void
}

/**
 * 单条评论
 *
 * 正文按纯文本渲染（`whitespace-pre-wrap`），不解析 Markdown：
 * Core 的评论字段是文本，把访客输入当 Markdown 渲染会打开一条不必要的注入面。
 *
 * 嵌套是「根 + 后代」树，但缩进只做一层（根评论顶格、后代统一左缩进）：
 * 按真实层级层层缩进会让中文段落在第三层就窄到每行三四个字。
 * 层级关系靠「回复给谁」与排列顺序表达，不靠缩进深度。
 */
export function CommentCard({
  comment,
  rootId,
  timeZone,
  allowGuest,
  depth = 0,
  replyTo,
  onChanged,
  onLoadThread,
}: CommentCardProps) {
  const [replying, setReplying] = useState(false)

  const name = comment.author.url ? (
    <a href={comment.author.url} target="_blank" rel="noreferrer noopener nofollow">
      {comment.author.name}
    </a>
  ) : (
    <>{comment.author.name}</>
  )

  // 头像地址来自访客输入（服务端已校验协议），可能失效；空位用名字首字代替
  const initial = comment.author.name.trim().charAt(0)

  return (
    <li className="comment" data-depth={Math.min(depth, 2)}>
      <article className="comment__row">
        <span className="comment__avatar" aria-hidden="true">
          {comment.author.avatar ? (
            <img
              src={comment.author.avatar}
              alt=""
              width={32}
              height={32}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          ) : (
            initial
          )}
        </span>

        <div className="comment__main">
          <p className="comment__meta">
            <span className="comment__author">{name}</span>
            <time className="comment__time" dateTime={comment.createdAt}>
              {formatDate(comment.createdAt, timeZone)}
            </time>
            {comment.pinned ? <span className="comment__pin">置顶</span> : null}
            {replyTo ? <span className="comment__target">{`回复 ${replyTo}`}</span> : null}
          </p>

          <p className="comment__text">{comment.text}</p>

          <div className="comment__actions">
            {allowGuest ? (
              <button
                type="button"
                onClick={() => setReplying((value) => !value)}
                className="comment__action"
                aria-expanded={replying}
              >
                {replying ? '收起' : '回复'}
              </button>
            ) : null}

            {comment.hiddenCount > 0 && comment.nextCursor ? (
              <button
                type="button"
                onClick={() => onLoadThread(rootId)}
                className="comment__action comment__action--accent"
              >
                还有 {comment.hiddenCount} 条回复
              </button>
            ) : null}
          </div>

          {replying ? (
            <CommentComposer
              variant="reply"
              parentId={comment.id}
              replyTo={comment.author.name}
              onCancel={() => setReplying(false)}
              onSuccess={() => {
                setReplying(false)
                onChanged()
              }}
            />
          ) : null}

          {comment.replies.length > 0 ? (
            <ul className="comment__replies">
              {comment.replies.map((reply) => (
                <CommentCard
                  key={reply.id}
                  comment={reply}
                  rootId={rootId}
                  timeZone={timeZone}
                  allowGuest={allowGuest}
                  depth={depth + 1}
                  replyTo={comment.author.name}
                  onChanged={onChanged}
                  onLoadThread={onLoadThread}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </article>
    </li>
  )
}
