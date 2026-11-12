import { describe, expect, it } from 'vitest'
import {
  buildReplyTree,
  flattenCommentTree,
  mergeThreadReplies,
  type CommentItem,
} from '@/lib/api/domain/comment'

/**
 * 评论树重建
 *
 * Core 返回的是「根 + 平铺后代」，层级完全靠 `parent_comment_id` 表达。
 * 这些用例覆盖实际会遇到的脏数据：父级缺失、自引用、环。
 */

function node(id: string, parentId: string | null = null, overrides: Partial<CommentItem> = {}) {
  return {
    id,
    text: `评论 ${id}`,
    createdAt: '2026-11-01T00:00:00.000Z',
    author: { name: '访客', avatar: null, url: null },
    pinned: false,
    parentId,
    replyCount: 0,
    hiddenCount: 0,
    nextCursor: null,
    replies: [],
    ...overrides,
  } satisfies CommentItem
}

describe('buildReplyTree', () => {
  it('按 parentId 组装两层结构，顺序保持不变', () => {
    const tree = buildReplyTree([node('a'), node('b', 'a'), node('c', 'a')])

    expect(tree).toHaveLength(1)
    expect(tree[0]?.id).toBe('a')
    expect(tree[0]?.replies.map((item) => item.id)).toEqual(['b', 'c'])
  })

  it('父级缺失的评论提为根，而不是丢掉', () => {
    const tree = buildReplyTree([node('a'), node('orphan', 'deleted-parent')])

    expect(tree.map((item) => item.id)).toEqual(['a', 'orphan'])
  })

  it('自引用不会造成自我嵌套', () => {
    const tree = buildReplyTree([node('self', 'self')])

    expect(tree).toHaveLength(1)
    expect(tree[0]?.replies).toHaveLength(0)
  })

  it('环状引用被断开，每个节点只出现一次', () => {
    // a → b，b → a：无论从哪条边挂都会成环
    const tree = buildReplyTree([node('a', 'b'), node('b', 'a')])

    const flat = flattenCommentTree(tree)
    expect(flat.map((item) => item.id).sort()).toEqual(['a', 'b'])
    expect(flat).toHaveLength(2)
  })

  it('三层结构保留完整层级', () => {
    const tree = buildReplyTree([node('a'), node('b', 'a'), node('c', 'b')])

    expect(tree[0]?.replies[0]?.id).toBe('b')
    expect(tree[0]?.replies[0]?.replies[0]?.id).toBe('c')
  })
})

describe('mergeThreadReplies', () => {
  const root = () =>
    buildReplyTree([
      node('root', null, { hiddenCount: 4, nextCursor: 'c1' }),
      node('early', 'root'),
      node('late', 'root'),
    ])[0]!

  it('把补回来的中段回复挂到对应父级下', () => {
    const merged = mergeThreadReplies(root(), [node('middle', 'root')], {
      hiddenCount: 0,
      nextCursor: null,
    })

    expect(merged.replies.map((item) => item.id)).toEqual(['early', 'late', 'middle'])
    expect(merged.hiddenCount).toBe(0)
    expect(merged.nextCursor).toBeNull()
  })

  it('重复的回复按 id 去重，不会出现两次', () => {
    const merged = mergeThreadReplies(root(), [node('early', 'root'), node('middle', 'root')], {
      hiddenCount: 0,
    })

    const ids = flattenCommentTree([merged]).map((item) => item.id)
    expect(ids.filter((id) => id === 'early')).toHaveLength(1)
    expect(ids).toContain('middle')
  })

  it('新回复挂在更深一层时，层级也跟着重建', () => {
    const merged = mergeThreadReplies(root(), [node('deep', 'early')], { hiddenCount: 0 })

    expect(merged.replies[0]?.replies[0]?.id).toBe('deep')
  })

  it('根节点不因合并而改变 id', () => {
    expect(mergeThreadReplies(root(), [], {}).id).toBe('root')
  })
})
