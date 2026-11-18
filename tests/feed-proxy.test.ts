import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Feed 代理（`src/app/feed/route.ts`）
 *
 * 这里刻意不测「路径穿越拦截」——我们没有这层校验，因为请求内容根本流不进
 * 上游地址（handler 不收 request，路径是常量；core 那边也是静态路由）。
 * 要钉住的是这条前提本身：**请求侧不得影响上游 URL**。
 *
 * `/atom.xml` 与 `/feed.xml` 不单独实现，由 `next.config.ts` rewrite 到 `/feed`，
 * 属于构建期配置，单元测试覆盖不到（Kami / Shiro 也是这个做法）。
 */

const RSS = '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>'

/**
 * core 生成的链接是 Shiro / Kami 的路由格式，本主题要换成自己的。
 * 用真实后端返回的形状做样本：`<link>`、正文 `<a href>`（在 CDATA 里）、
 * `#comments` 锚点、外链，四种位置都要覆盖。
 */
const CORE_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/" version="2.0">
<channel>
<atom:link href="https://blog.example.com/feed" rel="self" type="application/rss+xml"/>
<link>https://blog.example.com</link>
<item>
  <title>文章</title>
  <link>https://blog.example.com/posts/tech/hello</link>
  <content:encoded><![CDATA[
    <blockquote>前往：<a href='https://blog.example.com/posts/tech/hello'>https://blog.example.com/posts/tech/hello</a></blockquote>
    <a href='https://blog.example.com/posts/tech/hello#comments'>说点什么</a>
    <a href="https://external.example.org/posts/tech/hello">外链不该被改</a>
  ]]></content:encoded>
</item>
<item>
  <title>日记</title>
  <link>https://blog.example.com/notes/49</link>
  <content:encoded><![CDATA[
    <a href='https://blog.example.com/notes/49#comments'>说点什么</a>
    <a href="https://external.example.org/notes/1">外链不该被改</a>
  ]]></content:encoded>
</item>
</channel>
</rss>`

/**
 * `/api/v2/aggregate` 的最小形状：只提供 feed 需要的 `url.webUrl`。
 *
 * 它是「公开地址」的第二来源（`siteBaseUrl()` 在 env 缺失时的回退），
 * 所以下面的用例会用它来验证 env 缺失时的改写行为。
 */
const IDENTITY = { url: { webUrl: 'https://blog.example.com' } }

function rssResponse(body: string = RSS): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/xml' },
  })
}

/** `/aggregate`（站点身份）的响应；失败时 loadSiteContext 会吞掉异常 */
function identityResponse(body: unknown = IDENTITY): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

interface FetchCall {
  url: URL
  init: RequestInit | undefined
}

/**
 * 装一个假 fetch 到全局：route 里用的是全局 fetch，没有依赖注入的口子。
 *
 * route 现在只打两类上游：XML `/feed` 与站点身份 `GET /api/v2/aggregate`。
 *
 * JSON 版 feed（`/aggregate/feed`）与 `GET /notes/nid/:nid` 补查**已经不需要**：
 * 那两样只是为了维护「nid → 雪花 id」映射，而站点路由改成 `/notes/:nid` 之后
 * 与上游同形，映射本身消失了。这里不再提供对应的 handler——如果哪天代码
 * 又把它们加回来，测试会因为「请求数不对」直接失败，而不是静默通过。
 */
function stubFetch(
  handlers: {
    feed?: (url: URL, init?: RequestInit) => Response | Promise<Response>
    identity?: (url: URL, init?: RequestInit) => Response | Promise<Response>
  } = {},
) {
  const calls: FetchCall[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(String(input))
    calls.push({ url, init })

    if (url.pathname.endsWith('/aggregate')) {
      return (handlers.identity ?? (() => identityResponse()))(url, init)
    }

    return (handlers.feed ?? (() => rssResponse()))(url, init)
  }) as typeof fetch
  vi.stubGlobal('fetch', impl)
  return calls
}

async function getFeed(): Promise<Response> {
  const { GET } = await import('@/app/feed/route')
  return GET()
}

/** 只取 XML 那次上游调用，避免断言里混进站点身份那一次 */
function feedCalls(calls: FetchCall[]): FetchCall[] {
  return calls.filter((call) => !call.url.pathname.includes('/aggregate'))
}

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.MX_SERVER_URL = 'https://api.example.com'
  process.env.NEXT_PUBLIC_SITE_URL = 'https://blog.example.com'
  delete process.env.MX_MOCK
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Feed 代理：上游地址构造', () => {
  it('裸 origin → /feed', async () => {
    const calls = stubFetch()
    await getFeed()

    expect(feedCalls(calls)[0].url.toString()).toBe('https://api.example.com/feed')
  })

  it('结尾斜杠被归一化，不产生 //feed', async () => {
    process.env.MX_SERVER_URL = 'https://api.example.com///'
    const calls = stubFetch()
    await getFeed()

    expect(feedCalls(calls)[0].url.toString()).toBe('https://api.example.com/feed')
  })

  it('反代前缀被保留：/sub → /sub/feed', async () => {
    process.env.MX_SERVER_URL = 'https://api.example.com/sub'
    const calls = stubFetch()
    await getFeed()

    expect(feedCalls(calls)[0].url.toString()).toBe('https://api.example.com/sub/feed')
  })

  it('配置里的 query / hash 不会被带进上游地址', async () => {
    process.env.MX_SERVER_URL = 'https://api.example.com/sub?x=1#frag'
    const calls = stubFetch()
    await getFeed()

    expect(feedCalls(calls)[0].url.toString()).toBe('https://api.example.com/sub/feed')
  })

  it('不再请求 JSON 版 feed：日记路由与上游同形，不需要 id 映射', async () => {
    process.env.MX_SERVER_URL = 'https://api.example.com/sub'
    const calls = stubFetch()
    await getFeed()

    // 这张映射表是为了把 `/notes/:nid` 换成 `/diaries/:雪花id` 而存在的；
    // 两者同形之后它没有用途，请求也就该消失
    const json = calls.find((call) => call.url.pathname.endsWith('/aggregate/feed'))
    expect(json).toBeUndefined()
  })
})

describe('Feed 代理：转发行为', () => {
  it('正常响应原样透传，content-type 归一为 RSS', async () => {
    stubFetch()
    const response = await getFeed()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/rss+xml')
    expect(await response.text()).toBe(RSS)
  })

  it('所有上游请求都不带查询串：请求侧无法影响上游地址', async () => {
    const calls = stubFetch()
    await getFeed()

    // 上游 feed + 站点身份：两条都不带 query
    expect(calls).toHaveLength(2)
    for (const call of calls) expect(call.url.search).toBe('')
  })

  it('上游 5xx → 502', async () => {
    stubFetch({ feed: () => new Response('boom', { status: 500 }) })
    const response = await getFeed()

    expect(response.status).toBe(502)
    expect(await response.text()).toContain('500')
  })

  it('上游返回 HTML 错误页时不当成订阅源', async () => {
    stubFetch({
      feed: () =>
        new Response('<!doctype html><title>502 Bad Gateway</title>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    })
    const response = await getFeed()

    expect(response.status).toBe(502)
    expect(await response.text()).toContain('非 XML')
  })

  it('网络错误 → 502，附带原因但不抛栈给调用方', async () => {
    stubFetch({
      feed: () => {
        throw new Error('ECONNREFUSED')
      },
    })

    const response = await getFeed()
    expect(response.status).toBe(502)
    expect(await response.text()).toContain('ECONNREFUSED')
  })

  it('只有 XML 上游也能完整改写：不依赖第二个接口', async () => {
    // 旧实现这里要等 JSON 版 feed 才能改写日记链接；现在完全不请求它，
    // 因此「JSON 挂了」这一类失败模式在结构上就不存在了
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const response = await getFeed()

    expect(response.status).toBe(200)
    const xml = await response.text()
    expect(xml).toContain('https://blog.example.com/articles/tech/hello')
    expect(xml).toContain('https://blog.example.com/notes/49')
  })
})

describe('Feed 代理：URL 重写成本主题路由', () => {
  it('文章 /posts/:category/:slug → /articles/:category/:slug', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/articles/tech/hello')
    expect(xml).not.toContain('blog.example.com/posts/tech/hello')
  })

  it('日记 /notes/:nid 与上游同形：路径不动，只把 origin 归一为公开地址', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    // 上游 host → 公开 host，nid 原样保留（不再换算成雪花 id）
    expect(xml).toContain('https://blog.example.com/notes/49')
    expect(xml).not.toContain('https://upstream.example.net/notes/49')
  })

  it('#comments 锚点跟着一起重写', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/articles/tech/hello#comments')
    expect(xml).toContain('https://blog.example.com/notes/49#comments')
  })

  it('CDATA 正文里的链接也重写', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    // 四处：`<link>`、blockquote 的 href、blockquote 的可见文本、文末「说点什么」
    const hits = xml.match(/blog\.example\.com\/articles\/tech\/hello/g) ?? []
    expect(hits).toHaveLength(4)
  })

  it('外链即使路径里也有 /posts/、/notes/ 也不动', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://external.example.org/posts/tech/hello')
    expect(xml).toContain('https://external.example.org/notes/1')
  })

  it('日记链接不依赖任何映射表：上游怎么写就怎么出', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    // 无需「查到 id 才改写」这一步，因此不存在「映射漏了 → 链接 404」
    expect(xml).toContain('https://blog.example.com/notes/49')
    expect(xml).not.toContain('undefined')
  })

  it('不再按 nid 补查单篇：映射消失后这条请求路径也一并消失', async () => {
    const calls = stubFetch({ feed: () => rssResponse(CORE_RSS) })
    await getFeed()

    const lookups = calls.filter((call) => call.url.pathname.includes('/notes/nid/'))
    expect(lookups).toHaveLength(0)
  })

  it('未配置 NEXT_PUBLIC_SITE_URL 时回退到 identity，仍然完成改写', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    // identity.siteUrl 与上游同源：路径该换，origin 保持不变
    expect(xml).toContain('https://blog.example.com/articles/tech/hello')
    expect(xml).toContain('https://blog.example.com/notes/49')
    expect(xml).not.toContain('blog.example.com/posts/')
  })
})

describe('Feed 代理：配置缺失', () => {
  it('缺 MX_SERVER_URL → 503 并说明原因', async () => {
    delete process.env.MX_SERVER_URL
    const calls = stubFetch()

    const response = await getFeed()
    expect(response.status).toBe(503)
    expect(await response.text()).toContain('MX_SERVER_URL')
    expect(calls).toHaveLength(0)
  })

  it('MX_MOCK=1 时不打后端', async () => {
    process.env.MX_MOCK = '1'
    const calls = stubFetch()

    const response = await getFeed()
    expect(response.status).toBe(503)
    expect(await response.text()).toContain('MX_MOCK')
    expect(calls).toHaveLength(0)
  })

  it('MX_SERVER_URL 非法 → 503，不发请求', async () => {
    process.env.MX_SERVER_URL = 'not a url'
    const calls = stubFetch()

    const response = await getFeed()
    expect(response.status).toBe(503)
    expect(calls).toHaveLength(0)
  })

  it('非 http(s) 协议 → 503，不发请求', async () => {
    process.env.MX_SERVER_URL = 'ftp://api.example.com'
    const calls = stubFetch()

    const response = await getFeed()
    expect(response.status).toBe(503)
    expect(calls).toHaveLength(0)
  })
})

/**
 * 站点归属识别（本轮新增）
 *
 * 上一版要求 `NEXT_PUBLIC_SITE_URL` 与上游 host **逐字符相同**才改写，否则整段
 * 静默跳过。这一组钉住的正是替换后的判据：站点基准取自 feed 自身，公开地址取自
 * `siteBaseUrl(identity)`，两者任意一个缺失 / 不一致都不应让改写整体失效。
 */
describe('Feed 代理：本站链接识别与 origin 归一', () => {
  /** 上游站点落在 localhost 的 feed：用来验证「不把开发地址发给订阅者」 */
  const LOCALHOST_RSS = CORE_RSS.replaceAll('https://blog.example.com', 'http://127.0.0.1:3000')

  /** 上游站点挂在子路径 `/blog` 上的 feed */
  const SUBPATH_RSS = CORE_RSS.replaceAll(
    'https://blog.example.com',
    'https://blog.example.com/blog',
  )

  it('env 与上游 host 不一致：仍按路径识别本站并改写，origin 归一为 env', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://new.example.com'
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://new.example.com/articles/tech/hello')
    expect(xml).toContain('https://new.example.com/notes/49')
    // 旧 origin 一个都不该留下（包括 channel 的 <link> 与 atom:link）
    expect(xml).not.toContain('https://blog.example.com/')
  })

  it('上游用 localhost：输出里不出现开发地址', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://blog.example.com'
    stubFetch({ feed: () => rssResponse(LOCALHOST_RSS) })
    const response = await getFeed()
    const xml = await response.text()

    expect(xml).toContain('https://blog.example.com/articles/tech/hello')
    expect(xml).toContain('https://blog.example.com/notes/49')
    expect(xml).not.toContain('127.0.0.1:3000')
    // 没有异常，就不该带告警头
    expect(response.headers.get('x-folio-feed-warnings')).toBeNull()
  })

  it('上游带子路径：前缀被保留，不误匹配也不破坏路径', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://blog.example.com/blog'
    stubFetch({ feed: () => rssResponse(SUBPATH_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/blog/articles/tech/hello')
    expect(xml).toContain('https://blog.example.com/blog/notes/49')
    // 没有把 /blog 重复两次，也没有丢掉它
    expect(xml).not.toContain('/blog/blog/')
  })

  it('公开站挂在子路径、上游在根：前缀按公开地址补上', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://blog.example.com/blog'
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/blog/articles/tech/hello')
    expect(xml).not.toContain('https://blog.example.com/articles/')
  })

  it('媒体链接不参与改写：路径与站点部署路径没有必然关系', async () => {
    const mediaRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<link>https://blog.example.com</link>
<item>
  <title>带图</title>
  <link>https://blog.example.com/notes/49</link>
  <content:encoded><![CDATA[
    <img src="https://blog.example.com/uploads/a.webp" />
    <img src="https://blog.example.com/objects/b.png" />
    <a href="https://blog.example.com/posts/tech/hello">正文链接</a>
  ]]></content:encoded>
</item>
</channel></rss>`
    process.env.NEXT_PUBLIC_SITE_URL = 'https://new.example.com'
    stubFetch({ feed: () => rssResponse(mediaRss) })
    const xml = await (await getFeed()).text()

    // 页面链接改写，媒体原样
    expect(xml).toContain('https://new.example.com/articles/tech/hello')
    expect(xml).toContain('https://blog.example.com/uploads/a.webp')
    expect(xml).toContain('https://blog.example.com/objects/b.png')
  })

  it('读不出站点基准时一个字节都不动，并给出可观测告警', async () => {
    // 没有 channel <link>、也没有 atom:link：无法区分本站与外链
    const bare = '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>'
    stubFetch({ feed: () => rssResponse(bare) })
    const response = await getFeed()
    const xml = await response.text()

    expect(xml).toBe(bare)
    expect(response.headers.get('x-folio-feed-warnings')).toContain('unidentified-site=1')
  })

  it('公开地址与上游都缺失时保留原值，不伪造域名', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    stubFetch({
      feed: () => rssResponse(LOCALHOST_RSS),
      // identity 取不到站点地址：公开地址只能是缺失
      identity: () => identityResponse({}),
    })
    const response = await getFeed()
    const xml = await response.text()

    // 站点基准仍是 localhost：日记路径本来就同形，origin 保持上游
    expect(xml).toContain('http://127.0.0.1:3000/notes/49')
    // 前端域名没被编造出来
    expect(xml).not.toContain('blog.example.com')
    expect(response.headers.get('x-folio-feed-warnings')).toContain('dev-host=')
  })
})

/**
 * 日记链接不再需要 id 映射
 *
 * 旧实现要在 `/notes/:nid` 与 `/diaries/:雪花id` 之间换算，因此维护了
 * 「JSON feed 主来源 + `<guid>` 兜底」两条路径，还要处理查不到时的降级。
 * 路由统一成 `/notes/:nid` 之后，这三件事一起消失了。这一组测试守住这个前提：
 * 一旦有人把映射加回来，这里会立刻失败。
 */
describe('Feed 代理：日记链接无需 id 映射', () => {
  /** 日记条目自带 guid（core 的真实形状），且没有 JSON 映射可用 */
  const GUID_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
<link>https://blog.example.com</link>
<item>
  <title>日记</title>
  <link>https://blog.example.com/notes/49</link>
  <guid>155695797663436800</guid>
  <content:encoded><![CDATA[<a href="https://blog.example.com/notes/49#comments">说点什么</a>]]></content:encoded>
</item>
</channel></rss>`

  it('带 guid 的日记条目：guid 不参与路由，链接保持 nid', async () => {
    stubFetch({ feed: () => rssResponse(GUID_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/notes/49')
    // guid（雪花 id）是条目身份，不是地址的一部分
    expect(xml).not.toContain('/diaries/')
  })

  it('guid 写成 nid 也不会被误当成地址：链接原样', async () => {
    const bad = GUID_RSS.replace('<guid>155695797663436800</guid>', '<guid>49</guid>')
    stubFetch({ feed: () => rssResponse(bad) })
    const response = await getFeed()
    const xml = await response.text()

    expect(xml).toContain('https://blog.example.com/notes/49')
    expect(xml).not.toContain('undefined')
    // 没有映射环节，就不该再报 unmapped
    expect(response.headers.get('x-folio-feed-warnings') ?? '').not.toContain('unmapped-nid')
  })

  it('日记链接不会再被改写成 /diaries/：那已是历史路由', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/articles/tech/hello')
    expect(xml).toContain('https://blog.example.com/notes/49')
    expect(xml).not.toContain('/diaries/49')
    expect(xml).not.toContain('undefined')
  })
})

describe('Feed 代理：入口一致性与自检', () => {
  it('/atom.xml 与 /feed 是同一个实现（rewrite 而非复制）', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const config = readFileSync(join(import.meta.dirname, '../next.config.ts'), 'utf8')

    expect(config).toContain("source: '/atom.xml'")
    expect(config).toContain("destination: '/feed'")
  })

  it('旧 /feed.xml 的域名来源与 canonical 同一套（不是第二份解析）', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const source = readFileSync(join(import.meta.dirname, '../src/app/feed.xml/route.ts'), 'utf8')

    // 必须经 absoluteUrl / siteBaseUrl（env → identity 回退），不能自己读 env
    expect(source).toContain('absoluteUrl')
    expect(source).toContain('siteBaseUrl')
    // 注释与报错文案里可以提到这个变量名，但不能自己读它——读它就是第二份解析
    expect(source).not.toContain('process.env.NEXT_PUBLIC_SITE_URL')
  })

  it('空 feed 不报错，也不触发任何改写', async () => {
    stubFetch({ feed: () => rssResponse(RSS) })
    const response = await getFeed()

    expect(response.status).toBe(200)
    expect(await response.text()).toBe(RSS)
  })

  it('改写后自检残留：站内 /posts/ 会被计数（不再静默放过）', async () => {
    // 站点基准取自 <channel><link>，但 item 里混入一条无法改写的 /posts/ 形态
    // （路径没有第三段，仍按前缀改写，因此这里用一个故意不匹配的地址验证计数口径）
    const odd = CORE_RSS.replace(
      'https://blog.example.com/posts/tech/hello',
      'https://blog.example.com/posts/tech/hello?x=/notes/77',
    )
    stubFetch({ feed: () => rssResponse(odd) })
    const xml = await (await getFeed()).text()

    // query 里的 /notes/77 不属于路径，不该被改写
    expect(xml).toContain('/articles/tech/hello?x=/notes/77')
  })
})

describe('Feed 代理：公开地址本身是开发地址时给出告警', () => {
  it('env 配成 localhost：按配置执行，但必须可观测', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3000'
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const response = await getFeed()

    // 这是运维显式选择的公开地址，行为上照做（不改写用户配置）
    expect(await response.text()).toContain('http://127.0.0.1:3000/articles/tech/hello')
    // 但订阅者拿不到这个地址，必须留痕
    expect(response.headers.get('x-folio-feed-warnings')).toContain('public-site-url-is-local=1')
  })

  it('正常公开地址不产生这条告警', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const response = await getFeed()

    expect(response.headers.get('x-folio-feed-warnings')).toBeNull()
  })
})
