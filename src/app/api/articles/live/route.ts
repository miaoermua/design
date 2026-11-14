import { revalidateTag } from 'next/cache'
import { NextResponse } from 'next/server'
import { isNewerThan } from '@/features/articles/live/controller'
import { getArticle, isNotFound, type ArticleDetail } from '@/lib/api'
import { toContentLang } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/server'
import { isSafeId, isSafeSlug } from '@/lib/realtime/protocol'
import { articlePath } from '@/lib/routes'

/**
 * POST /api/articles/live —— 实时事件到达后的「核对一次」
 *
 * 为什么需要这一层：
 * - 事件只能证明「这篇文章变了」，不能证明变的是正文；
 * - 浏览器又不能直接调服务端 repository（后端地址与 UA 只在服务端）。
 *
 * 所以这里做三件事，且只做这三件事：
 * 1. 用**现有数据层**（`getArticle`，`fresh: true` 绕开 300s 缓存）核对
 *    文章是否还在、id 是否还是同一篇、`modifiedAt` 是否真的变了；
 * 2. 只有确实变了才 `revalidateTag('posts', { expire: 0 })`，让随后的 `router.refresh()`
 *    用新数据重渲染（正文、目录、阅读时长、上下篇一起更新）；
 * 3. 把结论压缩成一个小状态返回给客户端，**不返回正文**——
 *    正文永远只从正式渲染管线进入页面。
 *
 * 位置线索（`next`）来自事件 payload，属于不可信输入，先校验字符集，
 * 再用服务端回查确认 id 一致才承认「搬走了」。
 */

export const dynamic = 'force-dynamic'

interface LiveRequest {
  id: string
  category: string
  slug: string
  knownModifiedAt: string | null
  next: { category: string; slug: string } | null
}

type Lookup = { ok: true; article: ArticleDetail } | { ok: false }

async function lookup(
  category: string,
  slug: string,
  lang: string | undefined,
): Promise<Lookup> {
  try {
    const article = await getArticle(category, slug, { lang, fresh: true })
    return { ok: true, article }
  } catch (error) {
    // 404 = 这个地址下确实没有文章；其余错误（超时、5xx）交给调用方报 error。
    // 把 404 当服务器故障上报会让胶囊在文章被删除时一直显示「网络异常」。
    if (isNotFound(error)) return { ok: false }
    throw error
  }
}

function parseBody(value: unknown): LiveRequest | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>

  const id = record.id
  const category = record.category
  const slug = record.slug
  if (!isSafeId(id) || !isSafeSlug(category) || !isSafeSlug(slug)) return null

  const known = record.knownModifiedAt
  if (known !== null && known !== undefined && typeof known !== 'string') return null

  let next: LiveRequest['next'] = null
  const rawNext = record.next
  if (typeof rawNext === 'object' && rawNext !== null) {
    const candidate = rawNext as Record<string, unknown>
    if (isSafeSlug(candidate.category) && isSafeSlug(candidate.slug)) {
      next = { category: candidate.category, slug: candidate.slug }
    }
  }

  return { id, category, slug, knownModifiedAt: (known as string | null) ?? null, next }
}

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ status: 'invalid' }, { status: 400 })
  }

  const input = parseBody(payload)
  if (!input) return NextResponse.json({ status: 'invalid' }, { status: 400 })

  const locale = await getLocale()
  const lang = toContentLang(locale)

  try {
    // 1. 先看事件给的新地址：只有 id 一致才承认这是「同一篇文章换了位置」
    if (input.next && (input.next.category !== input.category || input.next.slug !== input.slug)) {
      const moved = await lookup(input.next.category, input.next.slug, lang)
      if (moved.ok && moved.article.id === input.id) {
        const path = articlePath(moved.article.category?.slug, moved.article.slug)
        if (path) {
          revalidateTag('posts', { expire: 0 })
          return NextResponse.json({ status: 'moved', path })
        }
      }
    }

    // 2. 再看原地址
    const current = await lookup(input.category, input.slug, lang)
    // 地址没了，或者这个地址已经属于另一篇文章：都不能继续展示旧内容。
    // 这里同样要失效缓存，否则紧随其后的 router.refresh() 还会拿到旧缓存。
    if (!current.ok || current.article.id !== input.id) {
      revalidateTag('posts', { expire: 0 })
      return NextResponse.json({ status: 'gone' })
    }

    // 3. 时间没往前走 = 重复投递 / 只改了看不见的字段，不做无谓的重渲染
    const currentModifiedAt = current.article.modifiedAt
    if (
      input.knownModifiedAt &&
      currentModifiedAt &&
      !isNewerThan(currentModifiedAt, input.knownModifiedAt)
    ) {
      return NextResponse.json({ status: 'unchanged' })
    }

    revalidateTag('posts', { expire: 0 })
    return NextResponse.json({ status: 'updated' })
  } catch {
    // 不把上游错误体、URL 或栈返回给浏览器
    return NextResponse.json({ status: 'error' }, { status: 502 })
  }
}
