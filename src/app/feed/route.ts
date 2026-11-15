/**
 * `GET /feed`
 *
 * core 的 `FeedController` 用 `@Get(['/feed', '/atom.xml'])` 把两个根路径挂在
 * 同一个 handler 上，返回最近 10 条（文章 + 日记混排）的 RSS 2.0，正文带
 * `<content:encoded>` 全文。这里不重新渲染一遍，直接把后端现成的 XML 透出去：
 * 主题里再写一套 markdown → RSS 的转换，只会和正文渲染规则各走各的。
 *
 * `/atom.xml` 不另写一个 route，而是在 `next.config.ts` 里 rewrite 到 `/feed`——
 * 和 Kami 一样用「一个实现 + 两个入口」，core 那边这两个路径本来就是同一份。
 *
 * ## 关于路径穿越
 *
 * 这里**不做**路径校验，因为这条路走不通，不是省事：
 *
 * 1. 这个 handler 不接受 request，上游路径是常量 `UPSTREAM_PATH`。请求侧没有
 *    任何字符串能流进 URL，也就没有可穿越的位置。
 * 2. core 是静态路由 `@Get(['/feed', '/atom.xml'])`，没有 `${param}` 可以塞
 *    `../`；Next 的路由匹配是精确的，`/feed/../x` 到不了这里。
 *
 * Kami 与 Shiro 的 feed 路由同样不读 request、不做校验。差别只在取数方式：
 * 它们调 `GET /api/v2/aggregate/feed` 拿 JSON 自己渲染 Atom，我们直接代理 XML。
 *
 * 留下的两处处理都跟安全无关，只是「别把错误当内容」：`MX_SERVER_URL` 写错
 * 要报错而不是静默失败；上游 content-type 不是 XML 时拒绝（反代的 HTML
 * 错误页被透传出去，阅读器只会显示「订阅源无效」）。
 */

import { THEME_USER_AGENT, getServerUrl, getTimeoutMs, isMockMode } from '@/lib/api/config'

/** 上游固定路径；与 core 的 `FeedController` 对齐，运行时不拼接任何输入 */
const UPSTREAM_PATH = '/feed'

const ALLOWED_CONTENT_TYPE = /^(application|text)\/(rss\+xml|atom\+xml|xml)\b/i

function unavailable(message: string, status: 502 | 503): Response {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

/**
 * 构造上游地址。
 *
 * 用 origin + pathname 前缀重建，而不是 `new URL('/feed', base)`：后者会丢掉
 * 反代挂在子路径下的前缀（`https://api.example.com/sub` → 打到 `/feed` 而不是
 * `/sub/feed`），属于写错就会 404 的坑。
 */
function upstreamUrl(): URL {
  // getServerUrl 已经校验过合法 URL 与 http(s)，并剥掉了结尾斜杠
  const base = new URL(getServerUrl())
  // 配置里带 query / hash 说明写错了；不清掉会拼出畸形地址
  base.search = ''
  base.hash = ''
  return new URL(`${base.origin}${base.pathname.replace(/\/+$/, '')}${UPSTREAM_PATH}`)
}

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  if (isMockMode()) {
    return unavailable('Feed 代理未启用：当前为 MX_MOCK=1 的离线预览模式，没有后端可转发。', 503)
  }

  let target: URL
  try {
    target = upstreamUrl()
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return unavailable(`Feed 暂时不可用：${reason}`, 503)
  }

  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: 'GET',
      headers: {
        accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8',
        'user-agent': THEME_USER_AGENT,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(getTimeoutMs()),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return unavailable(`Feed 暂时不可用：请求后端失败（${reason}）`, 502)
  }

  if (!upstream.ok) {
    return unavailable(`Feed 暂时不可用：后端返回 ${upstream.status}。`, 502)
  }

  const contentType = upstream.headers.get('content-type') ?? ''
  if (!ALLOWED_CONTENT_TYPE.test(contentType)) {
    return unavailable(
      `Feed 暂时不可用：后端返回了非 XML 内容（${contentType || '缺少 content-type'}）。`,
      502,
    )
  }

  const body = await upstream.text()

  return new Response(body, {
    status: 200,
    headers: {
      // core 用的是 `application/xml`；归一成 RSS 的类型，阅读器对后者更友好
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=1200',
    },
  })
}
