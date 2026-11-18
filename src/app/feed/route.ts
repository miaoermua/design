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
 *   - 日记：`/notes/:nid`            → 本主题 `/notes/:nid`（**同形，不改**）
 *
 * 日记这一条曾经需要改写：早期本主题的详情路由用雪花 id
 * （`/diaries/188522778012422144`），而 core 用自增 `nid`，只换前缀会 404，
 * 于是这里维护过一张 `nid → 雪花 id` 的映射表（JSON feed + `<guid>` 两个来源）。
 *
 * 站点路由改成 `/notes/:nid` 之后，两者同形，那张表和它的补查机制一起删掉了：
 * 少一次上游请求、少一条失败路径，也不再可能出现「映射查不到 → 链接保持 404」。
 *
 * ## 本站链接怎么认（本轮核心）
 *
 * 上一版要求 `NEXT_PUBLIC_SITE_URL` 与上游 feed 的 host **逐字符相同**才执行
 * 改写，否则整段静默跳过。结果是：env 没配、或配成 `127.0.0.1` 时，RSS 里
 * 会留下 `/notes/13`、`/posts/...` 这些本主题不存在的路径——订阅者点开就是 404。
 *
 * 现在改成两级识别，都不依赖「env 恰好等于上游」：
 *
 *   1. **上游站点基准**取自 feed 自己：`<channel>` 里的 `<link>`（站点首页），
 *      退化到 `<atom:link rel="self">`。据此得到 origin 与可选子路径前缀。
 *   2. **公开地址**复用 `siteBaseUrl(identity)`（与 canonical / sitemap 同一套
 *      解析：env 优先，缺失时回退后端 `aggregate.url.webUrl`）。
 *
 * 逐条 URL 判定：只有 origin 命中上游基准或公开地址的链接才算本站链接；
 * 第三方外链一个字节都不动。命中之后按路径决定动作：
 *
 *   - `/posts/...`      → 改写成 `/articles/...`，origin 归一为公开地址；
 *   - `/notes/:nid`     → 路径不动（已是本主题路由），只归一 origin；
 *   - 其余本站页面路径   → 只把 origin 归一为公开地址（首页、`/feed`、`/about`）；
 *   - 媒体路径          → 完全不动（见下）。
 *
 * **媒体为什么不动**：图片 / 视频来自作者自己的对象存储或 CDN，路径与站点
 * 部署路径没有必然关系。把 `https://x.com/uploads/a.jpg` 改写成
 * `https://y.com/blog/uploads/a.jpg` 只会在「公开站挂在子路径」时把能用的图改坏。
 * 无法确认归属时保留原值，是这里唯一安全的做法。
 *
 * ## 已知限制
 *
 * 若上游把站点地址配成了 `localhost` / 内网地址，且**公开地址也缺失**，本站
 * 链接会被归一到一个不可用的主机。这种情况无法靠推断修复，因此：
 *   - 响应保留原值（不伪造域名）；
 *   - 输出一行服务端告警，并带上 `x-folio-feed-warnings` 响应头；
 *   - RSS 内容本身仍是合法 XML，不因为一条链接变成 500。
 *
 * ## 关于路径穿越
 *
 * 这里**不做**路径校验，因为这条路走不通，不是省事：
 *
 * 1. 这个 handler 不接受 request，上游路径是常量 `UPSTREAM_PATH`。
 *    请求侧没有任何字符串能流进 URL，也就没有可穿越的位置。
 * 2. core 是静态路由 `@Get(['/feed', '/atom.xml'])`，没有 `${param}` 可以塞
 *    `../`；Next 的路由匹配是精确的，`/feed/../x` 到不了这里。
 *
 * Kami 与 Shiro 的 feed 路由同样不读 request、不做校验。
 */

import {
  THEME_USER_AGENT,
  getServerUrl,
  getTimeoutMs,
  isMockMode,
} from '@/lib/api/config'
import type { SiteIdentity } from '@/lib/api'
import { loadSiteContext, siteBaseUrl } from '@/lib/site'

/** 上游固定路径；与 core 的 `FeedController` 对齐，运行时不拼接任何输入 */
const UPSTREAM_PATH = '/feed'
const ALLOWED_CONTENT_TYPE = /^(application|text)\/(rss\+xml|atom\+xml|xml)\b/i

/** 绝对 URL 的粗切分：停在空白与标签 / 属性引号处，本身不做语义判断 */
const URL_CANDIDATE = /https?:\/\/[^\s"'<>]+/g

/** 媒体扩展名：命中即视为「不是页面链接」，一律不参与改写 */
const MEDIA_PATH =
  /\.(?:jpe?g|png|gif|webp|avif|svg|bmp|ico|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|flac|pdf|zip|7z|rar)$/i

/** 媒体目录：Mix Space 与常见对象存储的落点，同样不碰 */
const MEDIA_DIR = /^\/(?:uploads|objects|files|assets)\//i

/** 开发 / 内网主机：出现在公开 RSS 里就是不可订阅的地址 */
const DEV_HOST =
  /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[?::1\]?|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})$/i

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

/** 尾部斜杠归一：`/blog/` → `/blog`，`/` → `` */
function trimSlash(path: string): string {
  return path.replace(/\/+$/, '')
}

/**
 * 站点基准：origin + 可选子路径前缀。
 *
 * `basePath` 为空串表示站点挂在根上。上游 feed 里的站内链接就是
 * `origin + basePath + /posts/...` 这种形状。
 */
interface SiteBase {
  origin: string
  basePath: string
}

/**
 * 从 feed 自身读出站点基准。
 *
 * 优先 `<channel>` 里的第一个 `<link>`（它就是站点首页），退化到
 * `<atom:link rel="self">`（feed 自身地址，与站点同源）。
 * 两者都读不到就返回 null——这时**不做任何改写**，因为无法区分本站与外链。
 */
function detectFeedSite(xml: string): SiteBase | null {
  // channel 头部：到第一个 <item> 为止，避免误取条目的 <link>
  const channel = /<channel\b[^>]*>([\s\S]*?)(?:<item\b|<\/channel>)/i.exec(xml)?.[1] ?? ''
  const candidates = [
    /<link>([\s\S]*?)<\/link>/i.exec(channel)?.[1],
    /<atom:link\b[^>]*\bhref="([^"]+)"/i.exec(xml)?.[1],
  ]

  for (const candidate of candidates) {
    const raw = candidate?.trim()
    if (!raw) continue
    try {
      const url = new URL(raw)
      if (!/^https?:$/.test(url.protocol)) continue
      return { origin: url.origin, basePath: trimSlash(url.pathname) }
    } catch {
      // 不是合法 URL：换下一个候选
    }
  }

  return null
}

/** 去掉站点子路径前缀后的站内路径；不含前缀时原样返回（容忍上游写法不一致） */
function relativePath(pathname: string, basePath: string): string {
  if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
    return pathname.slice(basePath.length) || '/'
  }
  return pathname
}

/**
 * 句末标点常紧贴 URL（`见 https://x.com/a.`）。它们不属于地址，替换时要留在原地。
 * 右括号只在「比左括号多」时才算句子的一部分，避免切坏维基那种带括号的路径。
 */
function splitTrailing(raw: string): { url: string; tail: string } {
  let end = raw.length
  while (end > 0 && /[.,;:!?]/.test(raw[end - 1] ?? '')) end -= 1
  if (end > 0 && raw[end - 1] === ')') {
    const text = raw.slice(0, end)
    const opens = (text.match(/\(/g) ?? []).length
    const closes = (text.match(/\)/g) ?? []).length
    if (closes > opens) end -= 1
  }
  return { url: raw.slice(0, end), tail: raw.slice(end) }
}

interface UrlHit {
  raw: string
  url: URL
}

/** 遍历 XML 里所有绝对 URL（已解析）。解析失败的直接跳过。 */
function* urlHits(xml: string): Generator<UrlHit> {
  for (const match of xml.matchAll(URL_CANDIDATE)) {
    const raw = match[0]
    try {
      yield { raw, url: new URL(raw) }
    } catch {
      // XML 里偶尔会有被截断的地址（例如被手工编辑过的正文），跳过即可
    }
  }
}


interface RewriteStats {
  /** 改写过的文章链接数 */
  articles: number
  /** 归一过 origin 的日记链接数（`/notes/:nid` 已是本主题路由，无需改路径） */
  diaries: number
  /** 只归一了 origin 的本站页面链接数 */
  origins: number
  /** 自检：改写后仍残留的站内 `/posts/` 路径数 */
  leftovers: number
  /** 自检：改写后仍指向开发 / 内网主机的链接数 */
  devHosts: number
  /** 公开地址本身就被配成了开发 / 内网主机（enforce 了，但订阅者拿不到） */
  publicSiteIsLocal: boolean
  /** 读不出上游站点基准，因此整份 feed 未改写 */
  unidentified: boolean
}

/**
 * 把 core 生成的路由替换成本主题的，并把本站 origin 归一为公开地址。
 *
 * 判定顺序（每一条都先解析成 URL，不做字符串层面的猜测）：
 *   1. origin 既不是上游站点、也不是公开地址 → 外链，原样返回；
 *   2. 媒体路径 → 原样返回（见文件头「媒体为什么不动」）；
 *   3. `/posts/…` → `/articles/…`；`/notes/:nid` → `/diaries/:id`（查不到则原样）；
 *   4. 其余本站路径 → 只换 origin。
 *
 * 匹配与替换都在 `URL_CANDIDATE` 的单个匹配上完成：替换进去的地址不会被
 * 二次扫描，不存在「改写结果又被改写一遍」的可能。
 */
function rewriteFeedLinks(
  xml: string,
  upstream: SiteBase | null,
  publicBase: URL | null,
): { xml: string; stats: RewriteStats } {
  const stats: RewriteStats = {
    articles: 0,
    diaries: 0,
    origins: 0,
    leftovers: 0,
    devHosts: 0,
    publicSiteIsLocal: Boolean(publicBase && DEV_HOST.test(publicBase.hostname)),
    unidentified: !upstream,
  }

  // 读不出站点基准就无法区分本站与外链：一个字节都不动，只报未识别
  if (!upstream) return { xml, stats }

  const targetOrigin = publicBase?.origin ?? upstream.origin
  const targetPath = publicBase ? trimSlash(publicBase.pathname) : upstream.basePath

  const result = xml.replace(URL_CANDIDATE, (raw) => {
    const { url: clean, tail } = splitTrailing(raw)

    let parsed: URL
    try {
      parsed = new URL(clean)
    } catch {
      return raw
    }
    if (!/^https?:$/.test(parsed.protocol)) return raw

    const isUpstream = parsed.origin === upstream.origin
    const isPublic = publicBase ? parsed.origin === publicBase.origin : false
    if (!isUpstream && !isPublic) return raw

    const rel = relativePath(parsed.pathname, isUpstream ? upstream.basePath : targetPath)

    // 媒体不参与改写：路径与站点部署路径没有必然关系
    if (MEDIA_PATH.test(rel) || MEDIA_DIR.test(rel)) return raw

    let nextPath = rel
    if (rel.startsWith('/posts/')) {
      nextPath = `/articles/${rel.slice('/posts/'.length)}`
      stats.articles += 1
    } else if (/^\/notes\/\d+\/?$/.test(rel)) {
      // 站点路由已经是 `/notes/:nid`，与上游同形：路径不需要改，
      // 只把 origin 归一为公开地址（下面统一处理）
      stats.diaries += 1
    } else {
      stats.origins += 1
    }

    const isRoot = nextPath === '' || nextPath === '/'
    const path = isRoot ? targetPath : `${targetPath}${nextPath}`
    return `${targetOrigin}${path}${parsed.search}${parsed.hash}${tail}`
  })

  // 自检：只统计「本站 origin 上仍然不是本主题路由」与「本站链接指向开发主机」这两类。
  // 日记的 `/notes/:nid` 现在就是本主题路由，不再是残留；只剩 `/posts/` 需要盯。
  // 正文里作者自己写的 `127.0.0.1`（例如一篇讲本机服务的教程）属于内容，不是配置问题，
  // 不能算进来——否则告警会被正常内容刷成噪音。
  // 具体地址不进日志（可能是内网地址），只给计数。
  for (const { url } of urlHits(result)) {
    const isUpstream = url.origin === upstream.origin
    const isPublic = publicBase ? url.origin === publicBase.origin : false
    if (isUpstream || isPublic) {
      const rel = relativePath(url.pathname, isUpstream ? upstream.basePath : targetPath)
      // `/notes/:nid` 现在就是本主题路由，不再是残留；只剩文章前缀要盯
      if (rel.startsWith('/posts/')) stats.leftovers += 1
      // 公开地址本身就在内网时不算问题（本站就是那样部署的）
      if (DEV_HOST.test(url.hostname) && url.origin !== publicBase?.origin) stats.devHosts += 1
    }
  }

  return { xml: result, stats }
}

/** 把自检结果折成一段可观测信号；没有异常时返回空数组 */
function describeProblems(stats: RewriteStats): string[] {
  const problems: string[] = []
  if (stats.unidentified) {
    problems.push('无法从 feed 读出站点地址，已跳过路径改写')
  }
  if (stats.leftovers > 0) {
    problems.push(`${stats.leftovers} 处站内链接仍是上游 /posts/ 路由`)
  }
  if (stats.devHosts > 0) {
    problems.push(`${stats.devHosts} 处链接指向开发 / 内网地址`)
  }
  if (stats.publicSiteIsLocal) {
    problems.push('NEXT_PUBLIC_SITE_URL 是一个开发 / 内网地址，订阅者拿到的链接无法访问')
  }
  return problems
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

  // 两件事并行：上游 feed、站点身份（公开地址的来源）
  const [feedResult, site] = await Promise.all([
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
    loadSiteContext(),
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

  // 站点基准取自 feed 自身；公开地址走与 canonical / sitemap 同一套解析
  const upstream = detectFeedSite(xml)
  const identity: SiteIdentity | null = site.identity
  const publicBase = siteBaseUrl(identity) ?? null

  const { xml: body, stats } = rewriteFeedLinks(xml, upstream, publicBase)

  const problems = describeProblems(stats)
  if (problems.length > 0) {
    // 只报计数与原因，不打印具体地址：可能是内网地址
    console.warn(`[feed] ${problems.join('；')}`)
  }

  const headers: Record<string, string> = {
    'content-type': 'application/rss+xml; charset=utf-8',
    'cache-control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=1200',
  }
  if (problems.length > 0) {
    // 机读诊断：计数用 ASCII，便于外部监控；不含任何地址
    headers['x-folio-feed-warnings'] = [
      stats.unidentified ? 'unidentified-site=1' : null,
      stats.leftovers > 0 ? `leftover-site-path=${stats.leftovers}` : null,
      stats.devHosts > 0 ? `dev-host=${stats.devHosts}` : null,
      stats.publicSiteIsLocal ? 'public-site-url-is-local=1' : null,
    ]
      .filter(Boolean)
      .join('; ')
  }

  return new Response(body, { status: 200, headers })
}
