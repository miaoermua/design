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

/** JSON 版 feed 的形状：每项同时带雪花 `id` 与带 nid 的 `link` */
const CORE_JSON = {
  title: 't',
  data: [
    {
      id: '201987341420597248',
      link: 'https://blog.example.com/posts/tech/hello',
      title: '文章',
    },
    {
      id: '155695797663436800',
      link: 'https://blog.example.com/notes/49',
      title: '日记',
    },
  ],
}

function rssResponse(body: string = RSS): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/xml' },
  })
}

function jsonResponse(body: unknown = CORE_JSON): Response {
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
 * route 会按需打三类上游：XML `/feed`、JSON `/api/v2/aggregate/feed`、
 * 以及正文引用了陌生 nid 时的 `GET /notes/nid/:nid` 补查。
 * 默认按路径分发，调用方只需要关心自己想要的那一支。
 */
function stubFetch(
  handlers: {
    feed?: (url: URL, init?: RequestInit) => Response | Promise<Response>
    json?: (url: URL, init?: RequestInit) => Response | Promise<Response>
    nid?: (url: URL, init?: RequestInit) => Response | Promise<Response>
  } = {},
) {
  const calls: FetchCall[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(String(input))
    calls.push({ url, init })

    if (url.pathname.includes('/notes/nid/')) {
      // 默认 404：没显式给 handler 就当查不到，链接保持原样
      return (handlers.nid ?? (() => new Response('', { status: 404 })))(url, init)
    }

    const isJson = url.pathname.endsWith('/aggregate/feed')
    const handler = isJson
      ? (handlers.json ?? (() => jsonResponse()))
      : (handlers.feed ?? (() => rssResponse()))
    return handler(url, init)
  }) as typeof fetch
  vi.stubGlobal('fetch', impl)
  return calls
}

async function getFeed(): Promise<Response> {
  const { GET } = await import('@/app/feed/route')
  return GET()
}

/** 只取 XML 那次上游调用，避免断言里混进 JSON / 补查那两次 */
function feedCalls(calls: FetchCall[]): FetchCall[] {
  return calls.filter(
    (call) =>
      !call.url.pathname.endsWith('/aggregate/feed') && !call.url.pathname.includes('/notes/nid/'),
  )
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

  it('JSON 版 feed 走 /api/v2/aggregate/feed，同样保留反代前缀', async () => {
    process.env.MX_SERVER_URL = 'https://api.example.com/sub'
    const calls = stubFetch()
    await getFeed()

    const json = calls.find((call) => call.url.pathname.endsWith('/aggregate/feed'))
    expect(json?.url.toString()).toBe('https://api.example.com/sub/api/v2/aggregate/feed')
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

  it('两次上游请求都不带查询串：请求侧无法影响上游地址', async () => {
    const calls = stubFetch()
    await getFeed()

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

  it('JSON 版 feed 挂了不影响正文：只是日记链接保持原样', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS), json: () => new Response('', { status: 500 }) })
    const response = await getFeed()

    expect(response.status).toBe(200)
    const xml = await response.text()
    expect(xml).toContain('https://blog.example.com/articles/tech/hello')
    expect(xml).toContain('https://blog.example.com/notes/49')
  })

  it('JSON 版 feed 返回非 JSON 也不炸', async () => {
    stubFetch({
      feed: () => rssResponse(CORE_RSS),
      json: () => new Response('<html>', { status: 200 }),
    })
    const response = await getFeed()

    expect(response.status).toBe(200)
    expect(await response.text()).toContain('https://blog.example.com/notes/49')
  })
})

describe('Feed 代理：URL 重写成本主题路由', () => {
  it('文章 /posts/:category/:slug → /articles/:category/:slug', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/articles/tech/hello')
    expect(xml).not.toContain('blog.example.com/posts/tech/hello')
  })

  it('日记 /notes/:nid → /diaries/:雪花id（nid 与详情页 id 不是同一个值）', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/diaries/155695797663436800')
    expect(xml).not.toContain('blog.example.com/notes/49')
  })

  it('#comments 锚点跟着一起重写', async () => {
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/articles/tech/hello#comments')
    expect(xml).toContain('https://blog.example.com/diaries/155695797663436800#comments')
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

  it('映射里没有的 nid 保持原样，不瞎猜', async () => {
    const onlyPosts = {
      data: [{ id: '201987341420597248', link: 'https://blog.example.com/posts/tech/hello' }],
    }
    stubFetch({ feed: () => rssResponse(CORE_RSS), json: () => jsonResponse(onlyPosts) })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/notes/49')
  })

  it('映射里没有、但正文引用了的 nid，按 /notes/nid/:nid 补查后再重写', async () => {
    const onlyPosts = {
      data: [{ id: '201987341420597248', link: 'https://blog.example.com/posts/tech/hello' }],
    }
    stubFetch({
      feed: () => rssResponse(CORE_RSS),
      json: () => jsonResponse(onlyPosts),
      nid: () => jsonResponse({ data: { id: '155695797663436800' } }),
    })
    const xml = await (await getFeed()).text()

    expect(xml).toContain('https://blog.example.com/diaries/155695797663436800')
    expect(xml).not.toContain('blog.example.com/notes/49')
  })

  it('补查只针对正文里真的出现过的 nid，不预先扫全站', async () => {
    const calls = stubFetch({
      feed: () => rssResponse(CORE_RSS),
      json: () => jsonResponse({ data: [] }),
      nid: () => jsonResponse({ data: { id: '155695797663436800' } }),
    })
    await getFeed()

    const lookups = calls.filter((call) => call.url.pathname.includes('/notes/nid/'))
    expect(lookups).toHaveLength(1)
    expect(lookups[0].url.pathname).toBe('/api/v2/notes/nid/49')
  })

  it('未配置 NEXT_PUBLIC_SITE_URL 时原样透传，不做任何替换', async () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    stubFetch({ feed: () => rssResponse(CORE_RSS) })
    const xml = await (await getFeed()).text()

    expect(xml).toBe(CORE_RSS)
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
