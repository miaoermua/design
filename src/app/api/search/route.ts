import { NextResponse } from 'next/server'
import { searchArticles } from '@/lib/api'
import { toContentLang } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/server'

/**
 * GET /api/search?q= —— 搜索面板的数据源
 *
 * 这一层存在的唯一理由是**复用**：搜索面板在客户端，不能直接调服务端的
 * repositories；而它又必须走与 `/search` 页完全相同的接口、adapter 与语言参数。
 * 所以这里只做转接，不新增任何检索逻辑。
 *
 * 不缓存（revalidate: 0 在 repository 里）：搜索词是动态的，
 * 缓存只会让用户看到上一秒的结果。
 */
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const keyword = (searchParams.get('q') ?? '').trim()

  if (!keyword) {
    return NextResponse.json({ hits: [], total: 0 })
  }

  const locale = await getLocale()

  try {
    const result = await searchArticles(keyword, {
      page: 1,
      size: 5,
      lang: toContentLang(locale),
    })

    return NextResponse.json({
      hits: result.items,
      total: result.pagination.total,
    })
  } catch {
    // 面板只需要知道「失败了」，不需要堆栈；状态码交给客户端展示
    return NextResponse.json({ hits: [], total: 0, failed: true }, { status: 200 })
  }
}