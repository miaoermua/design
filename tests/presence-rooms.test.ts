import { describe, expect, it } from 'vitest'
import { PRESENCE_MAX_ENTRIES, toPresenceEntries } from '@/features/presence/entries'
import { toPresenceRooms } from '@/lib/api/adapters/presence'

/**
 * 房间解析与预览聚合
 *
 * 这里的 fixture 照抄线上实测响应（core v12.10.0，`GET /activity/rooms`）：
 * 房间名在 `rooms` 里是 `article-<id>`，而 `room_count` 的键被整体 snake_case 化，
 * 变成 `article_<id>`。两处必须都能被接受，否则人数永远匹配不上。
 */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    rooms: ['lang:zh-CN', 'article-200512341081591808'],
    room_count: { lang_zh_cn: 2, article_200512341081591808: 1 },
    objects: {
      posts: [
        {
          title: 'AI 把 Adobe 的软件复刻了一遍？',
          slug: 'ai-recreate-adobe-photocraft-review',
          created_at: '2026-11-06T07:24:27.453Z',
          category: { id: '147657505029767168', name: '博客', slug: 'blog', type: 0 },
          category_id: '147657505029767168',
          id: '200512341081591808',
        },
      ],
      notes: [],
      pages: [],
      recentlies: [],
    },
    ...overrides,
  }
}

describe('房间 → 领域', () => {
  it('snake_case 之后的 article_ 键能对上内容 id，lang_ 房间被忽略', () => {
    const rooms = toPresenceRooms(payload())
    expect(rooms).toEqual([
      {
        kind: 'post',
        articleId: '200512341081591808',
        title: 'AI 把 Adobe 的软件复刻了一遍？',
        categorySlug: 'blog',
        slug: 'ai-recreate-adobe-photocraft-review',
        nid: null,
        viewers: 1,
      },
    ])
  })

  it('兼容未做键名转换的 article- 连字符键', () => {
    const rooms = toPresenceRooms(payload({ room_count: { 'article-200512341081591808': 3 } }))
    expect(rooms).toHaveLength(1)
    expect(rooms[0]!.viewers).toBe(3)
  })

  it('日记保留 nid（URL 用它），页面保留 slug', () => {
    const rooms = toPresenceRooms(
      payload({
        room_count: { article_note1: 2, article_page1: 1 },
        objects: {
          posts: [],
          notes: [{ id: 'note1', nid: 13, title: '一次奇怪问题的运维经历' }],
          pages: [{ id: 'page1', title: '关于本站', slug: 'about-site' }],
        },
      }),
    )

    expect(rooms.map((room) => [room.kind, room.nid, room.slug])).toEqual([
      ['note', 13, null],
      ['page', null, 'about-site'],
    ])
  })

  it('0 人、负数、非数字计数都不产出条目', () => {
    const rooms = toPresenceRooms(
      payload({ room_count: { article_200512341081591808: 0, article_x: -1, article_y: '2' } }),
    )
    expect(rooms).toEqual([])
  })

  it('缺标题 / 缺 id 的行只丢自己，不影响其它行', () => {
    const rooms = toPresenceRooms(
      payload({
        room_count: { article_a: 1, article_b: 2 },
        objects: {
          posts: [
            { id: 'a', title: '   ', slug: 'a', category: { slug: 'blog' } },
            { title: '没有 id', slug: 'b', category: { slug: 'blog' } },
            { id: 'b', title: '保留我', slug: 'b', category: { slug: 'blog' } },
          ],
          notes: [],
          pages: [],
        },
      }),
    )
    expect(rooms.map((room) => room.title)).toEqual(['保留我'])
  })

  it('整份返回不是对象时得到空数组，而不是抛错', () => {
    expect(toPresenceRooms(null)).toEqual([])
    expect(toPresenceRooms('nope')).toEqual([])
    expect(toPresenceRooms({})).toEqual([])
  })
})

describe('预览条目', () => {
  it('按内容类型拼站内地址：文章带分类，日记用 nid，about 归固定入口', () => {
    const rooms = toPresenceRooms(
      payload({
        room_count: { article_p: 1, article_n: 1, article_a: 1 },
        objects: {
          posts: [{ id: 'p', title: '文章', slug: 'hello', category: { slug: 'blog' } }],
          notes: [{ id: 'n', nid: 7, title: '日记' }],
          pages: [{ id: 'a', title: '关于', slug: 'about' }],
        },
      }),
    )

    expect(
      toPresenceEntries(rooms)
        .map((entry) => entry.href)
        .sort(),
    ).toEqual(['/about', '/articles/blog/hello', '/notes/7'])
  })

  it('无法构造地址的条目被丢弃，而不是猜一个路径', () => {
    const rooms = toPresenceRooms(
      payload({
        room_count: { article_p: 2, article_n: 1 },
        objects: {
          // 分类缺失 → 文章没有可访问地址
          posts: [{ id: 'p', title: '无分类文章', slug: 'x' }],
          // nid 缺失 → 日记没有地址
          notes: [{ id: 'n', title: '无 nid 日记' }],
          pages: [],
        },
      }),
    )
    expect(toPresenceEntries(rooms)).toEqual([])
  })

  it('人数从多到少排序，同人数按标题', () => {
    const rooms = toPresenceRooms(
      payload({
        room_count: { article_a: 1, article_b: 3, article_c: 2 },
        objects: {
          posts: [
            { id: 'a', title: 'A', slug: 'a', category: { slug: 'blog' } },
            { id: 'b', title: 'B', slug: 'b', category: { slug: 'blog' } },
            { id: 'c', title: 'C', slug: 'c', category: { slug: 'blog' } },
          ],
          notes: [],
          pages: [],
        },
      }),
    )
    expect(toPresenceEntries(rooms).map((entry) => entry.title)).toEqual(['B', 'C', 'A'])
  })

  it(`最多只保留 ${PRESENCE_MAX_ENTRIES} 条`, () => {
    const ids = Array.from({ length: 8 }, (_, index) => `p${index}`)
    const rooms = toPresenceRooms(
      payload({
        room_count: Object.fromEntries(ids.map((id, index) => [`article_${id}`, index + 1])),
        objects: {
          posts: ids.map((id) => ({
            id,
            title: id,
            slug: id,
            category: { slug: 'blog' },
          })),
          notes: [],
          pages: [],
        },
      }),
    )

    const entries = toPresenceEntries(rooms)
    expect(entries).toHaveLength(PRESENCE_MAX_ENTRIES)
    expect(entries[0]!.title).toBe('p7')
  })
})
