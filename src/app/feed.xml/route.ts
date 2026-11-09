import { listArticles } from '@/lib/api'
import { describeError } from '@/lib/api/errors'
import { articlePath } from '@/lib/routes'
import { absoluteUrl, loadSiteContext, siteBaseUrl, siteDescription, siteTitle } from '@/lib/site'

export const dynamic = 'force-dynamic'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function errorResponse(message: string): Response {
  return new Response(message, {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * RSS 2.0
 *
 * 只输出真实存在的字段：没有 summary 的条目就没有 description。
 * 站点绝对地址来自 NEXT_PUBLIC_SITE_URL 或 aggregate.url.webUrl，
 * 两者都没有时无法生成合法 RSS，直接返回 503 说明原因。
 */
export async function GET(): Promise<Response> {
  const { identity, error: siteError } = await loadSiteContext()
  const base = siteBaseUrl(identity)
  if (!base) {
    return errorResponse(
      `无法生成 RSS：缺少站点地址。请设置 NEXT_PUBLIC_SITE_URL。${siteError ? `（${describeError(siteError)}）` : ''}`,
    )
  }

  const title = siteTitle(identity)
  const description = siteDescription(identity)

  let items: Awaited<ReturnType<typeof listArticles>>['items']
  try {
    const result = await listArticles({ page: 1, size: 20, sortBy: 'createdAt', sortOrder: -1 })
    items = result.items
  } catch (error) {
    return errorResponse(`RSS 暂时不可用：${describeError(error)}`)
  }

  const entries = items
    .map((article) => {
      const path = articlePath(article.category?.slug, article.slug)
      if (!path) return null

      const link = absoluteUrl(identity, path)
      if (!link) return null

      const published = new Date(article.createdAt)
      return [
        '    <item>',
        `      <title>${escapeXml(article.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${published.toUTCString()}</pubDate>`,
        article.summary ? `      <description>${escapeXml(article.summary)}</description>` : null,
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
    .filter((entry): entry is string => Boolean(entry))

  const lastBuild = items[0]?.createdAt ? new Date(items[0].createdAt).toUTCString() : new Date().toUTCString()

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0">',
    '  <channel>',
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${escapeXml(base.toString())}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    '    <language>zh-CN</language>',
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    `    <generator>Folio (Mix Space API v2)</generator>`,
    ...entries,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')

  return new Response(xml, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=1200',
    },
  })
}
