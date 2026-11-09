import type { MetadataRoute } from 'next'

/** 搜索结果页不进索引；sitemap 地址只在配置了站点地址时给出 */
export default function robots(): MetadataRoute.Robots {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  let sitemap: string | undefined
  if (raw) {
    try {
      sitemap = new URL('/sitemap.xml', raw).toString()
    } catch {
      sitemap = undefined
    }
  }

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/search'] }],
    ...(sitemap ? { sitemap } : {}),
  }
}
