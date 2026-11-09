import { describe, expect, it } from 'vitest'
import { toArticle, toArticleDetail } from '@/lib/api/adapters/article'
import { toDiary } from '@/lib/api/adapters/diary'
import { toFriendLink, toTag } from '@/lib/api/adapters/taxonomy'
import type { V2PostRow } from '@/lib/api/contracts/v2'

/** 线上实测的 snake_case 行（core 源码里是 camelCase，两种都要能吃） */
const row: V2PostRow = {
  id: '147657505029767168',
  title: 'CatWrt 智能网关',
  slug: 'catwrt',
  summary: '一个基于 lean 的固件',
  created_at: '2023-01-03T04:00:00.000Z',
  modified_at: '2023-02-01T04:00:00.000Z',
  read_count: 42,
  like_count: 3,
  tags: ['Openwrt', '软路由'],
  category: { id: '1', name: '博客', slug: 'blog' },
  meta: { cover: 'https://cdn.example.com/cover.webp' },
}

describe('toArticle', () => {
  it('读取 snake_case 字段', () => {
    const article = toArticle(row)
    expect(article.createdAt).toBe('2023-01-03T04:00:00.000Z')
    expect(article.readCount).toBe(42)
    expect(article.tags).toEqual(['Openwrt', '软路由'])
    expect(article.category?.slug).toBe('blog')
  })

  it('封面优先取 meta.cover', () => {
    expect(toArticle(row).cover?.src).toBe('https://cdn.example.com/cover.webp')
  })

  it('没有 meta.cover 时退回 images[0]', () => {
    const article = toArticle({
      ...row,
      meta: {},
      images: [{ src: 'https://cdn.example.com/a.png', width: 800, height: 600 }],
    })
    expect(article.cover?.src).toBe('https://cdn.example.com/a.png')
  })

  it('列表不返回评论数时不造假', () => {
    expect(toArticle(row).commentCount).toBeNull()
  })

  it('按 content_format 选正文来源', () => {
    const detail = toArticleDetail({
      ...row,
      content_format: 'lexical',
      text: 'markdown 版',
      content: '{"root":{}}',
    })
    expect(detail.content).toBe('{"root":{}}')
    expect(detail.contentFormat).toBe('lexical')
  })
})

describe('toDiary', () => {
  it('优先用 public_at 作为发布时间', () => {
    const diary = toDiary({
      id: '188522778012422144',
      nid: 13,
      created_at: '2026-10-04T05:22:00.000Z',
      public_at: '2026-10-05T05:22:00.000Z',
      title: '一次奇怪问题的运维经历',
    })
    expect(diary.publishedAt).toBe('2026-10-05T05:22:00.000Z')
  })
})

describe('taxonomy 适配', () => {
  it('标签只有 name/count', () => {
    expect(toTag({ name: 'Openwrt', count: 44 })).toEqual({ name: 'Openwrt', count: 44 })
  })

  it('友链 state=0 视为已通过', () => {
    const link = toFriendLink({
      id: '1',
      name: 'kyliancc',
      url: 'https://kyliancc.site/',
      avatar: 'https://kyliancc.site/avatar.png',
      description: '无论如何，注视前方吧。',
      state: 0,
      hide: false,
    })
    expect(link.state).toBe(0)
    expect(link.hidden).toBe(false)
  })
})
