/**
 * `GET /feed`
 *
 * core 的 `FeedController` 用 `@Get(['/feed', '/atom.xml'])` 把两个根路径挂在
 * 同一个 handler 上，返回最近 10 条（文章 + 日记混排）的 RSS 2.0，正文带
 * `<content:encoded>` 全文。这里不重新渲染一遍，直接把后端现成的 XML 改写成
 * 本主题的路由再吐出去：主题里再写一套 markdown → RSS 的转换，只会和正文渲染
 * 规则各走各的。
 *
 * `/atom.xml` 与 `/feed.xml` 不另写 route，而是在 `next.config.ts` 里 rewrite
 * 到 `/feed`——和 Kami / Shiro 一样用「一个实现 + 多个入口」。
 *
 * ## URL 重写
 *
 * core 的 `UrlBuilderService.build()` 生成的是 Shiro / Kami 的路由：
 *   - 文章：`/posts/:category/:slug` → 本主题 `/articles/:category/:slug`
 *   - 日记：`/notes/:nid`            → 本主题 `/diaries/:id`
 *
 * 文章直接换前缀就行。日记不行：core 用的是 `nid`（1、13、49 这种），本主题
 * 的路由用的是雪花 id（`/diaries/188522778012422144`），两者不是一回事，只换
 * 前缀会 404。nid → id 的映射在 JSON 版 feed（`GET /api/v2/aggregate/feed`）
 * 里，它的每一项同时带 `id` 和 `link`，所以并行多取一次就能建表，不必逐条打
 * `GET /notes/nid/:nid`。
 *
 * ## 关于路径穿越
 *
 * 这里**不做**路径校验，因为这条路走不通，不是省事：
 *
 * 1. 这个 handler 不接受 request，上游路径是常量 `UPSTREAM_PATH` /
 *    `UPSTREAM_JSON_PATH`。请求侧没有任何字符串能流进 URL，也就没有可穿越的位置。
 * 2. core 是静态路由 `@Get(['/feed', '/atom.xml'])`，没有 `${param}` 可以塞
 *    `../`；Next 的路由匹配是精确的，`/feed/../x` 到不了这里。
 *
 * Kami 与 Shiro 的 feed 路由同样不读 request、不做校验。
 */

import {
  API_PREFIX,
  THEME_USER_AGENT,
  getServerUrl,
  getSiteUrl,
  getTimeoutMs,
  isMockMode,
} from '@/lib/api/config'

/** 上游固定路径；与 core 的 `FeedController` 对齐，运行时不拼接任何输入 */
const UPSTREAM_PATH = '/feed'
/** JSON 版 feed，只用来取「nid → 雪花 id」的映射 */
const UPSTREAM_JSON_PATH = `${API_PREFIX}/aggregate/feed`

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
 * 用 origin + pathname 前缀重建，而不是 `new URL(path, base)`：后者会丢掉反代
 * 挂在子路径下的前缀（`https://api.example.com/sub` → 打到 `/feed` 而不是
 * `/sub/feed`），属于写错就会 404 的坑。
 */
function upstreamUrl(path: string): URL {
  const base = new URL(getServerUrl())
  base.search = ''
  base.hash = ''
  return new URL(`${base.origin}${base.pathname.replace(/\/+$/, '')}${path}`)
}

function upstreamInit(): RequestInit {
  return {
    method: 'GET',
    headers: { 'user-agent': THEME_USER_AGENT },
    cache: 'no-store',
    signal: AbortSignal.timeout(getTimeoutMs()),
  }
}

/** 从 JSON 版 feed 里读出 `nid → 雪花 id`；取不到就返回空表，日记链接原样保留 */
async function readNidToIdMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>()

  let response: Response
  try {
    response = await fetch(upstreamUrl(UPSTREAM_JSON_PATH), {
      ...upstreamInit(),
      headers: { ...upstreamInit().headers, accept: 'application/json' },
    })
  } catch {
    return map
  }
  if (!response.ok) return map

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    return map
  }

  const items = (payload as { data?: unknown })?.data
  if (!Array.isArray(items)) return map

  for (const item of items) {
    const link = (item as { link?: unknown })?.link
    const id = (item as { id?: unknown })?.id
    if (typeof link !== 'string' || typeof id !== 'string') continue

    // 只认日记（`/notes/:nid`），文章和页面不需要这张表
    const nid = /\/notes\/(\d+)(?:[#?]|$)/.exec(link)?.[1]
    if (nid) map.set(nid, id)
  }

  return map
}

/** 正文里可能引用不在最近 N 条里的日记，按 nid 单独补查；上限防止被长正文拖慢 */
const MAX_NID_LOOKUPS = 8

/** `GET /notes/nid/:nid` 拿单篇日记的雪花 id；失败返回 null，链接保持原样 */
async function readDiaryIdByNid(nid: string): Promise<string | null> {
  try {
    const response = await fetch(upstreamUrl(`${API_PREFIX}/notes/nid/${nid}`), {
      ...upstreamInit(),
      headers: { ...upstreamInit().headers, accept: 'application/json' },
    })
    if (!response.ok) return null

    // v2 的单篇详情包在 `{ data }` 里；兼容一下直接返回的情况
    const payload = (await response.json()) as { data?: { id?: unknown }; id?: unknown }
    const id = payload.data?.id ?? payload.id
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

/**
 * 补齐映射：feed 正文里引用的日记不一定在最近 N 条里，那些 nid 查不到 id 就
 * 会留下 404 的 `/notes/:nid`。这里只补「正文里真的出现过、且表里没有」的，
 * 没出现过的一个请求都不发。
 */
async function fillMissingNids(xml: string, nidToId: Map<string, string>): Promise<void> {
  const siteUrl = getSiteUrl()
  if (!siteUrl) return

  const escaped = siteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const missing = new Set<string>()
  for (const match of xml.matchAll(new RegExp(`${escaped}/notes/(\\d+)`, 'g'))) {
    const nid = match[1]
    if (nid && !nidToId.has(nid)) missing.add(nid)
  }

  const targets = [...missing].slice(0, MAX_NID_LOOKUPS)
  const resolved = await Promise.all(
    targets.map(async (nid) => ({ nid, id: await readDiaryIdByNid(nid) })),
  )
  for (const { nid, id } of resolved) {
    if (id) nidToId.set(nid, id)
  }
}

/**
 * 把 core 生成的路由替换成本主题的。
 *
 * 只替换本站域名下的路径，不动外链。替换发生在纯文本上——XML 里这些链接都在
 * 属性值或 CDATA 内容里，不存在标签被截断的情况。
 */
function rewriteLinks(xml: string, nidToId: Map<string, string>): string {
  const siteUrl = getSiteUrl()
  if (!siteUrl) return xml

  // 转义正则特殊字符（主要是 `.`），构造精确匹配站点 origin 的前缀
  const escaped = siteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const site = `(${escaped})`

  // 文章：/posts/:category/:slug → /articles/:category/:slug
  let result = xml.replace(new RegExp(`${site}/posts/`, 'g'), '$1/articles/')

  // 日记：/notes/:nid → /diaries/:id；映射缺失的保持原样，宁可留旧链接也不瞎猜
  if (nidToId.size > 0) {
    result = result.replace(
      new RegExp(`${site}/notes/(\\d+)`, 'g'),
      (match, origin: string, nid: string) => {
        const id = nidToId.get(nid)
        return id ? `${origin}/diaries/${id}` : match
      },
    )
  }

  return result
}

export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  if (isMockMode()) {
    return unavailable('Feed 代理未启用：当前为 MX_MOCK=1 的离线预览模式，没有后端可转发。', 503)
  }

  let target: URL
  try {
    target = upstreamUrl(UPSTREAM_PATH)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return unavailable(`Feed 暂时不可用：${reason}`, 503)
  }

  // 日记的 nid → id 映射与正文并行取；映射失败不影响 feed 本身
  const [feedResult, nidToId] = await Promise.all([
    (async (): Promise<Response | Error> => {
      try {
        return await fetch(target, {
          ...upstreamInit(),
          headers: {
            ...upstreamInit().headers,
            accept:
              'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8',
          },
        })
      } catch (error) {
        return error instanceof Error ? error : new Error(String(error))
      }
    })(),
    readNidToIdMap(),
  ])

  if (feedResult instanceof Error) {
    return unavailable(`Feed 暂时不可用：请求后端失败（${feedResult.message}）`, 502)
  }
  if (!feedResult.ok) {
    return unavailable(`Feed 暂时不可用：后端返回 ${feedResult.status}。`, 502)
  }

  const contentType = feedResult.headers.get('content-type') ?? ''
  if (!ALLOWED_CONTENT_TYPE.test(contentType)) {
    return unavailable(
      `Feed 暂时不可用：后端返回了非 XML 内容（${contentType || '缺少 content-type'}）。`,
      502,
    )
  }

  const xml = await feedResult.text()
  // 正文里引用了不在最近 10 条里的日记时补查一次，避免留下 404 的 `/notes/:nid`
  await fillMissingNids(xml, nidToId)

  const body = rewriteLinks(xml, nidToId)

  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=1200',
    },
  })
}
