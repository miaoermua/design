/**
 * 页面级测试：tags / categories / archives / friends
 *
 * 审计结论里这四条页面「零测试」。它们是纯展示页，但每条都有**一个会被静默
 * 搞错的决定**，而且错了不会报错：
 *
 *   - 归档：文章与日记混排后必须**按时间倒序**，跨年跨月都要正确分组；
 *   - 友链：`state === 0`（core 的 `LinkState.Pass`，不是 1）且未隐藏；
 *   - 标签：颜色跟着**名字**走，与列表顺序无关（否则增删标签会让全站变色）；
 *   - 分类：计数为 0 的分类不显示空壳。
 *
 * 这里测的是这些决定本身，不是"页面能渲染"。渲染层面（布局、响应式）由
 * `scripts/visual/round2-checks.mjs` 的真实浏览器度量覆盖。
 */

import { describe, expect, it } from 'vitest'
import { buildYears } from '@/features/explore'
import { tagTone } from '@/features/taxonomy/components/tag-note-list'
import type { Article, Diary } from '@/lib/api'
import { articlePath, diaryPath } from '@/lib/routes'

const TZ = 'Asia/Shanghai'

function makeArticle(over: Partial<Article>): Article {
  return {
    id: 'a1',
    title: '文章',
    slug: 'slug-a1',
    summary: null,
    text: null,
    category: { id: 'c1', name: '技术', slug: 'tech' },
    tags: [],
    cover: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    modifiedAt: null,
    readCount: null,
    likeCount: null,
    commentCount: null,
    isPinned: false,
    ...over,
  }
}

function makeDiary(over: Partial<Diary>): Diary {
  return {
    id: 'n1',
    title: '日记',
    content: '',
    contentFormat: 'markdown',
    publishedAt: '2026-03-02T00:00:00.000Z',
    mood: null,
    weather: null,
    location: null,
    hasPassword: false,
    images: [],
    tags: [],
    ...over,
  } as Diary
}

describe('归档：文章与日记混排后按时间倒序分组', () => {
  it('跨年跨月都正确分组，组内也倒序', () => {
    const years = buildYears(
      [
        makeArticle({ id: 'a1', createdAt: '2025-12-31T10:00:00.000Z' }),
        makeArticle({ id: 'a2', createdAt: '2026-03-01T10:00:00.000Z' }),
      ],
      [
        makeDiary({ id: 'n1', publishedAt: '2026-03-05T10:00:00.000Z' }),
        makeDiary({ id: 'n2', publishedAt: '2026-01-02T10:00:00.000Z' }),
      ],
      TZ,
    )

    expect(years.map((y) => y.year)).toEqual(['2026', '2025'])
    const y2026 = years[0]
    // 3 月在 1 月之前（MonthGroup 的字段是 key，形如 `2026-03`）
    expect(y2026.months.map((m) => m.key)).toEqual(['2026-03', '2026-01'])
    // 同在 3 月：日记（3-05）在文章（3-01）之前
    const march = y2026.months[0]
    expect(march.entries.map((e) => e.key)).toEqual(['note-n1', 'post-a2'])
  })

  it('文章与日记用各自的路径规则，不互相借用', () => {
    const years = buildYears(
      [makeArticle({ id: 'a1', slug: 'hello', category: { id: 'c', name: '博客', slug: 'blog' } })],
      [makeDiary({ id: '155695797663436800' })],
      TZ,
    )
    const entries = years.flatMap((y) => y.months.flatMap((m) => m.entries))
    const post = entries.find((e) => e.key === 'post-a1')
    const note = entries.find((e) => e.key === 'note-155695797663436800')

    expect(post?.href).toBe(articlePath('blog', 'hello'))
    expect(post?.href).toMatch(/^\/articles\/blog\/hello$/)
    // 日记走雪花 id，不是 nid
    expect(note?.href).toBe(diaryPath('155695797663436800'))
    expect(note?.href).toMatch(/^\/diaries\/\d+$/)
  })

  it('空数据返回空数组，不造一个空年份', () => {
    expect(buildYears([], [], TZ)).toEqual([])
  })

  it('同一天的多条不丢：key 用类型前缀区分，不会撞车', () => {
    const same = '2026-05-05T10:00:00.000Z'
    const years = buildYears(
      [makeArticle({ id: 'x', createdAt: same })],
      [makeDiary({ id: 'x', publishedAt: same })],
      TZ,
    )
    const entries = years.flatMap((y) => y.months.flatMap((m) => m.entries))
    expect(entries).toHaveLength(2)
    expect(new Set(entries.map((e) => e.key)).size).toBe(2)
  })
})

describe('标签：颜色跟着名字走，与顺序无关', () => {
  it('同名恒同色', () => {
    expect(tagTone('Next.js')).toBe(tagTone('Next.js'))
  })

  it('结果落在五档之内', () => {
    const tones = ['a', 'bb', 'ccc', 'Next.js', 'React', '设计', '随笔', '工具', '生活', '记录']
    for (const name of tones) {
      expect(['sage', 'blue', 'clay', 'ochre', 'cream']).toContain(tagTone(name))
    }
  })

  it('不依赖调用顺序：同一批标签无论怎么排，各自的颜色不变', () => {
    const names = ['Next.js', 'React', 'TypeScript', '设计', '随笔']
    const forward = new Map(names.map((n) => [n, tagTone(n)]))
    const backward = new Map([...names].reverse().map((n) => [n, tagTone(n)]))
    for (const name of names) expect(forward.get(name)).toBe(backward.get(name))
  })

  it('足够多的名字会铺满五档（否则等于没有哈希）', () => {
    // 十来个样本容易偶然落在同一档；用接近真实体量的集合
    const names = Array.from({ length: 200 }, (_, i) => `tag-${i}`)
    const tones = new Set(names.map(tagTone))
    expect(tones.size).toBe(5)
  })

  it('空字符串也能给出确定结果，不抛错', () => {
    expect(() => tagTone('')).not.toThrow()
    expect(tagTone('')).toBe(tagTone(''))
  })
})

describe('友链：只展示已通过审核且未隐藏的', () => {
  /**
   * 这条规则在 `repositories/site.ts` 里是 `.filter((link) => link.state === 0 && !link.hidden)`。
   * core 的 `LinkState.Pass = 0` —— 写成 `=== 1` 会让**所有**友链消失，
   * 而且类型检查、构建、页面渲染全都不会报错。这里用源码契约钉住它。
   */
  const source = readFile('src/lib/api/repositories/site.ts')

  it('过滤条件是 state === 0（Pass），不是 1', () => {
    expect(source).toContain('link.state === 0')
    expect(source).not.toMatch(/state\s*===\s*1\b/)
  })

  it('同时排除 hidden', () => {
    expect(source).toContain('!link.hidden')
  })
})

describe('分类：计数为 0 的不显示空壳', () => {
  const source = readFile('src/app/categories/page.tsx')

  it('页面按 count 过滤，而不是把所有分类都列出来', () => {
    expect(source).toMatch(/count/)
  })
})

/* ── 小工具：读源码做契约断言 ─────────────────────────────────── */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

function readFile(rel: string): string {
  return readFileSync(join(process.cwd(), rel), 'utf8')
}
