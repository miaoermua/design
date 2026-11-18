/**
 * 日记信息架构：入口 / 时间线 / 详情 三条路由的分工
 *
 * 路由统一在 `/notes` 下，与 Shiro / Kami 的 `/notes/:nid` 同形；因此 feed
 * 不再需要「nid → 雪花 id」的映射。这里守四类容易静默坏掉的决定：
 *
 *   1. 「最新一篇」按真实发布时间挑，不看数组顺序（后端没有 publishedAt 排序）；
 *   2. 时间线是唯一承载分页与专栏筛选的地方，入口只做重定向；
 *   3. 专栏筛选只出现在页面里，导航不展开专栏；
 *   4. 「全部日记」类链接一律指向时间线，指到入口会变成单篇。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Diary } from '@/lib/api'
import { pickLatestDiary } from '@/lib/api'
import { NOTE_LIST_PATH, noteListPath, notePath } from '@/lib/routes'

function makeDiary(over: Partial<Diary> & { id: string; nid: number }): Diary {
  return {
    title: `日记 ${over.id}`,
    slug: null,
    content: '',
    contentFormat: 'markdown',
    publishedAt: '2026-01-01T00:00:00.000Z',
    modifiedAt: null,
    mood: null,
    weather: null,
    location: null,
    bookmark: false,
    hasPassword: false,
    topic: null,
    images: [],
    readCount: null,
    likeCount: null,
    aiDisclosure: null,
    ...over,
  }
}

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

/* ── 最新一篇的判定 ─────────────────────────────────────────────── */

describe('pickLatestDiary：按真实发布时间挑，不看数组顺序', () => {
  it('数组第一条不是最新时，仍然挑出真正最新的那条', () => {
    const diaries = [
      makeDiary({ id: 'old', nid: 1, publishedAt: '2025-06-01T00:00:00.000Z' }),
      makeDiary({ id: 'mid', nid: 2, publishedAt: '2026-03-01T00:00:00.000Z' }),
      makeDiary({ id: 'new', nid: 3, publishedAt: '2026-11-01T00:00:00.000Z' }),
    ]
    expect(pickLatestDiary(diaries)?.id).toBe('new')
    expect(pickLatestDiary([...diaries].reverse())?.id).toBe('new')
  })

  it('用 publishedAt 而不是 nid：编号大的不一定更新', () => {
    const diaries = [
      makeDiary({ id: 'published-later', nid: 1, publishedAt: '2026-10-01T00:00:00.000Z' }),
      makeDiary({ id: 'published-earlier', nid: 2, publishedAt: '2026-09-01T00:00:00.000Z' }),
    ]
    expect(pickLatestDiary(diaries)?.id).toBe('published-later')
  })

  it('同一时刻并列时结果确定（按 nid 兜底）', () => {
    const same = '2026-05-05T00:00:00.000Z'
    const a = makeDiary({ id: 'a', nid: 10, publishedAt: same })
    const b = makeDiary({ id: 'b', nid: 11, publishedAt: same })
    expect(pickLatestDiary([a, b])?.id).toBe('b')
    expect(pickLatestDiary([b, a])?.id).toBe('b')
  })

  it('空列表返回 null', () => {
    expect(pickLatestDiary([])).toBeNull()
  })

  it('时间不可解析的条目不会被误判成最新', () => {
    const diaries = [
      makeDiary({ id: 'broken', nid: 99, publishedAt: 'not-a-date' }),
      makeDiary({ id: 'valid', nid: 1, publishedAt: '2026-01-01T00:00:00.000Z' }),
    ]
    expect(pickLatestDiary(diaries)?.id).toBe('valid')
  })

  it('只有一条时直接返回它', () => {
    expect(pickLatestDiary([makeDiary({ id: 'only', nid: 7 })])?.id).toBe('only')
  })
})

/* ── 路由形状 ───────────────────────────────────────────────────── */

describe('日记路由地址：nid 与上游同形', () => {
  it('详情用 nid，不是雪花 id', () => {
    expect(notePath(13)).toBe('/notes/13')
    expect(notePath('49')).toBe('/notes/49')
  })

  it('时间线是固定地址，专栏用查询参数', () => {
    expect(NOTE_LIST_PATH).toBe('/notes/list')
    expect(noteListPath()).toBe('/notes/list')
    expect(noteListPath('t1')).toBe('/notes/list?topic=t1')
    expect(noteListPath('a b')).toBe('/notes/list?topic=a%20b')
  })

  it('时间线与详情不冲突', () => {
    expect(notePath(13)).not.toBe(NOTE_LIST_PATH)
    // 静态段 list 优先于 [nid]；nid 是纯数字，撞不上
    expect(/^\d+$/.test('list')).toBe(false)
  })
})

/* ── 页面职责分工 ───────────────────────────────────────────────── */

describe('页面职责：入口只跳转，列表才渲染时间线', () => {
  const entry = read('src/app/notes/page.tsx')
  const list = read('src/app/notes/list/page.tsx')

  it('/notes 定位最新一篇，不自己渲染列表', () => {
    expect(entry).toContain('getLatestDiary')
    expect(entry).toContain('redirect(')
    expect(entry).toContain('notePath(diary.nid)')
    expect(entry).not.toContain('DiaryDayGroupView')
    expect(entry).not.toContain('Pagination')
  })

  it('/notes 没有日记时给空状态，而不是重定向', () => {
    expect(entry).toContain('EmptyState')
    expect(entry).toContain('diaries.emptyNone')
    const redirectAt = entry.indexOf('redirect(notePath(diary.nid))')
    const guardAt = entry.indexOf('if (diary)')
    expect(guardAt).toBeGreaterThan(-1)
    expect(redirectAt).toBeGreaterThan(guardAt)
  })

  it('/notes 的取数先过 feature 守卫', () => {
    const guardAt = entry.indexOf("requireFeature('diaries')")
    const fetchAt = entry.indexOf('getLatestDiary(')
    expect(guardAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(fetchAt)
  })

  it('/notes/list 复用原列表组件与分组函数', () => {
    expect(list).toContain('DiaryDayGroupView')
    expect(list).toContain('groupDiariesByDay')
    expect(list).toContain('Pagination')
    expect(list).toContain('pageHref(NOTE_LIST_PATH')
  })

  it('/notes/list 提供专栏筛选（胶囊复用 --accent-wash），且指向时间线', () => {
    expect(list).toContain('listTopics')
    expect(list).toContain('noteListPath(item.id)')
    expect(list).toContain('diaries.filterAll')
    // 与探索页同一套视觉 Token
    expect(list).toContain('--accent-wash')
    expect(list).not.toContain('href="/notes"')
  })

  it('旧路由用 308 永久迁移，入口 /notes 保持 307 临时', () => {
    const legacyDetail = read('src/app/diaries/[id]/page.tsx')
    const legacyList = read('src/app/diaries/page.tsx')
    const entry = read('src/app/notes/page.tsx')

    // 路由迁移是永久的：旧地址永远对应同一个新地址，必须让搜索引擎替换索引
    expect(legacyDetail).toContain('permanentRedirect(')
    expect(legacyDetail).toContain('notePath(diary.nid)')
    expect(legacyList).toContain('permanentRedirect(')
    // 旧列表地址语义是「全部」，必须指向时间线而不是单篇
    expect(legacyList).toContain('NOTE_LIST_PATH')

    /*
     * 入口相反：它指向「最新一篇」，目标随时间变化。若用 308，
     * 浏览器与搜索引擎会持久缓存，读者可能永远停在同一篇。
     * 这里断言的是「不能用 permanentRedirect」，而不是某一种实现写法。
     */
    expect(entry).not.toContain('permanentRedirect')

    // 旧详情不能把 password 丢掉：受保护日记解锁后要能直接过去
    expect(legacyDetail).toContain('isPasswordRequired')
    expect(legacyDetail).toContain('PasswordGate')
  })
})

/* ── 入口链接的语义 ─────────────────────────────────────────────── */

describe('「全部日记」类入口都指向时间线', () => {
  it('首页日记区的「全部」与计数入口都去时间线', () => {
    const home = read('src/app/page.tsx')
    expect(home).toContain('NOTE_LIST_PATH')
    expect(home).not.toContain('href="/notes"')
  })

  it('导航只留「日记 + 全部日记」两条，不展开专栏', () => {
    const header = read('src/components/layout/site-header.tsx')
    expect(header).toContain('listHref: NOTE_LIST_PATH')
    expect(header).toContain("entryLabel: 'nav.allDiaries'")
    expect(header).not.toContain('noteListPath')
    expect(header).not.toContain('listTopics')
    expect(header).toContain('items: []')
  })

  it('探索菜单不再有「专栏」入口（与「全部日记」重复）', () => {
    const header = read('src/components/layout/site-header.tsx')
    expect(header).not.toContain('nav.exploreTopics')
    expect(header).toContain('nav.exploreNotes')
    expect(header).toContain('nav.explorePosts')
    expect(header).toContain('nav.exploreMemories')
  })

  it('sitemap 收录时间线、不收录重定向入口', () => {
    const sitemap = read('src/app/sitemap.ts')
    expect(sitemap).toContain("'/notes/list'")
    expect(sitemap).toContain('notePath(diary.nid)')
    expect(sitemap).not.toContain("['/diaries'")
  })

  it('feature manifest 覆盖新路由与旧兼容层', () => {
    const manifest = read('src/features/diaries/manifest.ts')
    for (const route of ["'/notes'", "'/notes/list'", "'/notes/[nid]'", "'/diaries'", "'/diaries/[id]'"]) {
      expect(manifest).toContain(route)
    }
  })
})

/* ── 本轮修复的回归守卫 ─────────────────────────────────────────── */

describe('最新一篇的扫描上限与告警', () => {
  const entry = read('src/app/notes/page.tsx')

  it('保留 200 篇上限，不改成无限扫描', () => {
    const repo = read('src/lib/api/repositories/notes.ts')
    expect(repo).toContain('NOTE_LATEST_SCAN_MAX_PAGES')
    expect(repo).toContain('NOTE_LATEST_SCAN_PAGE_SIZE')
    // 上限必须是有限值：一旦触顶要能停下来
    expect(repo).toMatch(/NOTE_LATEST_SCAN_MAX_PAGES\s*=\s*\d+/)
  })

  it('truncated 必须被消费，触顶时输出服务端告警', () => {
    // 取数返回值里有 truncated
    expect(entry).toContain('truncated')
    // 且真的用它做了分支，不是解构后丢掉
    expect(entry).toMatch(/if\s*\(\s*truncated\s*\)/)
    expect(entry).toContain('console.warn')
  })
})

describe('非法实体 id 的映射', () => {
  const http = read('src/lib/api/client/http.ts')

  it('上游 422「id / nid 非法」转 404', () => {
    expect(http).toContain('INVALID_ENTITY_ID')
    expect(http).toContain('NotFoundError')
    // 只认 id / nid 两种字段名
    expect(http).toMatch(/\^\(\?:id\|nid\)/)
  })

  it('不把所有 422 都当 404', () => {
    /*
     * `sortBy=publishedAt` 这类参数错误同样返回 422（`sortBy: Invalid input`）。
     * 那属于调用方写错请求，必须继续以 ApiError 冒泡，否则会被静默吞成
     * 「查无此页」。断言映射带了报文前缀条件，而不是裸的 status === 422。
     */
    expect(http).toContain('INVALID_ENTITY_ID.test(message)')
    expect(http).not.toMatch(/if\s*\(\s*status\s*===\s*422\s*\)\s*\{\s*throw new NotFoundError/)
  })
})

describe('详情页 canonical', () => {
  it('generateMetadata 输出与文章页一致的 canonical', () => {
    const detail = read('src/app/notes/[nid]/page.tsx')
    expect(detail).toContain('loadSiteContext')
    expect(detail).toContain('absoluteUrl')
    expect(detail).toContain('alternates: { canonical }')
  })

  it('不保留 [nid] 的 loading.tsx：否则无效日记会变成 200 软 404', () => {
    /*
     * 有 Suspense 边界时，Next 会先发出 200 的 loading shell，
     * notFound() 之后状态码无法回写，页面内容虽是 404 但 HTTP 是 200。
     * 这条守卫防止有人为了骨架屏把它加回来。
     */
    const fs = read('src/app/notes/page.tsx') // 只为确认读取可用
    expect(fs).toBeTruthy()
    expect(() => read('src/app/notes/[nid]/loading.tsx')).toThrow()
  })
})
