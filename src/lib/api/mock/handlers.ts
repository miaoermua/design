/**
 * Mock 路由（仅 MX_MOCK=1）
 *
 * 在 HTTP 客户端的 fetch 之前拦截，用与线上完全相同的响应形状返回，
 * 因此 adapters / repositories / 页面 / 测试走的是同一条代码路径。
 */

import type { V2Pagination } from '../contracts/v2/common'
import type { V2CategoryDetail } from '../contracts/v2/taxonomy'
import {
  mockAboutPage,
  mockAggregate,
  mockCategories,
  mockLinks,
  mockNoteDetail,
  mockNotes,
  mockPostDetail,
  mockPosts,
  mockTagSums,
} from './fixtures'

interface MockResponse {
  status: number
  body: unknown
}

function toPositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function paginate<T>(rows: T[], page: number, size: number): { data: T[]; pagination: V2Pagination } {
  const safeSize = Math.min(50, Math.max(1, size))
  const total = rows.length
  const total_page = Math.max(1, Math.ceil(total / safeSize))
  const current_page = Math.min(Math.max(1, page), total_page)
  const start = (current_page - 1) * safeSize
  return {
    data: rows.slice(start, start + safeSize),
    pagination: {
      current_page,
      total_page,
      total,
      size: safeSize,
      has_next_page: current_page < total_page,
      has_prev_page: current_page > 1,
    },
  }
}

function notFound(path: string): MockResponse {
  return { status: 404, body: { ok: 0, message: `Mock 未覆盖：${path}` } }
}

function filterByYear<T extends { created_at: string }>(rows: T[], year: string | null): T[] {
  if (!year) return rows
  return rows.filter((row) => row.created_at.slice(0, 4) === year)
}

export function getMockResponse(path: string, params: URLSearchParams): MockResponse | null {
  const page = toPositiveInt(params.get('page'), 1)
  const size = toPositiveInt(params.get('size'), 10)
  const year = params.get('year')

  if (path === '/aggregate') return { status: 200, body: mockAggregate }

  if (path === '/aggregate/timeline') {
    const type = params.get('type')
    return {
      status: 200,
      body: {
        data: {
          posts: type === '1' ? [] : filterByYear(mockPosts, year),
          notes: type === '0' ? [] : filterByYear(mockNotes, year),
        },
      },
    }
  }

  if (path === '/posts') {
    // 线上 v2 只认 year / categoryIds（tag 会被忽略），mock 保持一致
    const categoryIds = (params.get('categoryIds') ?? '').split(',').filter(Boolean)
    const rows = filterByYear(mockPosts, year).filter(
      (row) => categoryIds.length === 0 || (row.category ? categoryIds.includes(row.category.id) : false),
    )
    return { status: 200, body: paginate(rows, page, size) }
  }

  const postMatch = /^\/posts\/([^/]+)\/([^/]+)$/.exec(path)
  if (postMatch) {
    const row = mockPostDetail(
      decodeURIComponent(postMatch[1] ?? ''),
      decodeURIComponent(postMatch[2] ?? ''),
    )
    return row ? { status: 200, body: row } : { status: 404, body: { ok: 0, message: '文章不存在' } }
  }

  if (path === '/notes') {
    const rows = filterByYear(mockNotes, year).map((row) => ({
      ...row,
      text: row.has_password ? '' : row.text,
    }))
    return { status: 200, body: paginate(rows, page, size) }
  }

  const nidMatch = /^\/notes\/nid\/(\d+)$/.exec(path)
  if (nidMatch) return mockNoteDetail(String(nidMatch[1])) ?? notFound(path)

  const noteMatch = /^\/notes\/([^/]+)$/.exec(path)
  if (noteMatch) return mockNoteDetail(String(noteMatch[1])) ?? notFound(path)

  if (path === '/categories') {
    if (params.get('type') === '1') return { status: 200, body: { data: mockTagSums } }
    return { status: 200, body: { data: mockCategories } }
  }

  const categoryMatch = /^\/categories\/([^/]+)$/.exec(path)
  if (categoryMatch) {
    const key = decodeURIComponent(categoryMatch[1] ?? '')

    if (params.get('tag') === 'true') {
      const rows = mockPosts.filter((row) => (row.tags ?? []).includes(key))
      return { status: 200, body: { tag: key, data: rows } }
    }

    const category = mockCategories.find((item) => item.slug === key || item.id === key)
    if (!category) return { status: 404, body: { ok: 0, message: '分类不存在' } }

    const children = mockPosts.filter((row) => row.category?.slug === category.slug)
    const detail: V2CategoryDetail = {
      ...category,
      count: children.length,
      children,
    }
    return { status: 200, body: { data: detail } }
  }

  if (path === '/search') {
    const keyword = (params.get('keyword') ?? '').trim()
    if (!keyword) return { status: 200, body: paginate([], page, size) }

    const hits = mockPosts
      .filter((row) => row.title.includes(keyword) || (row.text ?? '').includes(keyword))
      .map((row) => ({
        id: row.id,
        type: 'post' as const,
        slug: row.slug,
        title: row.title,
        category: row.category ? { slug: row.category.slug, name: row.category.name } : null,
        created_at: row.created_at,
        highlight: {
          snippet: buildSnippet(toPlainText(row.text ?? ''), keyword),
          title: row.title,
        },
      }))
    return { status: 200, body: paginate(hits, page, size) }
  }

  if (path === '/links/all') return { status: 200, body: { data: mockLinks } }

  if (path === `/pages/slug/${mockAboutPage.slug}`) return { status: 200, body: mockAboutPage }

  return null
}

/** 与后端一致：命中片段用 <mark> 包裹 */
function buildSnippet(text: string, keyword: string): string | undefined {
  const index = text.indexOf(keyword)
  if (index < 0) return undefined
  const start = Math.max(0, index - 40)
  const end = Math.min(text.length, index + keyword.length + 60)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${escapeHtml(text.slice(start, index))}<mark>${escapeHtml(keyword)}</mark>${escapeHtml(text.slice(index + keyword.length, end))}${suffix}`
}

/**
 * 搜索片段用的纯文本：真实后端返回的是正文切片，mock 的正文是 Markdown，
 * 直接切会把 `##`、`**`、图片语法一起带进结果里。先在纯文本副本上定位，
 * 再回原文切片，保留可读的上下文。
 */
function toPlainText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', ' ')
}
