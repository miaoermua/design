import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Feed 代理（`src/app/feed/route.ts`）
 *
 * 这里刻意不测「路径穿越拦截」——我们没有这层校验，因为请求内容根本流不进
 * 上游地址（handler 不收 request，路径是常量；core 那边也是静态路由）。
 * 要钉住的是这条前提本身：**请求侧不得影响上游 URL**，所以每个用例都回头
 * 检查 fake fetch 实际收到的那个 URL。
 *
 * `/atom.xml` 不单独实现，由 `next.config.ts` rewrite 到 `/feed`，属于构建
 * 期配置，单元测试覆盖不到（Kami 也是这个做法）。这里只测唯一那份实现。
 */

const RSS = '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>'

function rssResponse(body: string = RSS): Response {
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/xml' },
  })
}

interface FetchCall {
  url: URL
  init: RequestInit | undefined
}

/** 装一个假 fetch 到全局：route 里用的是全局 fetch，没有依赖注入的口子 */
function stubFetch(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const calls: FetchCall[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof URL ? input : new URL(String(input))
    calls.push({ url, init })
    return handler(url, init)
  }) as typeof fetch
  vi.stubGlobal('fetch', impl)
  return calls
}

/** 每次动态 import 拿同一个模块实例即可，状态都在 env 与全局 fetch 上 */
async function getFeed(): Promise<Response> {
  const { GET } = await import('@/app/feed/route')
  return GET()
}

const originalEnv = { ...process.env }

beforeEach(() => {
  process.env.MX_SERVER_URL = 'https://api.example.com'
  delete process.env.MX_MOCK
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Feed 代理：上游地址构造', () => {
  it('裸 origin → /feed', async () => {
    const calls = stubFetch(() => rssResponse())
    await getFeed()

    expect(calls[0].url.toString()).toBe('https://api.example.com/feed')
  })

  it('结尾斜杠被归一化，不产生 //feed', async () => {
    process.env.MX_SERVER_URL = 'https://api.example.com///'
    const calls = stubFetch(() => rssResponse())
    await getFeed()

    expect(calls[0].url.toString()).toBe('https://api.example.com/feed')
  })

  it('反代前缀被保留：/sub → /sub/feed', async () => {
    process.env.MX_SERVER_URL = 'https://api.example.com/sub'
    const calls = stubFetch(() => rssResponse())
    await getFeed()

    expect(calls[0].url.toString()).toBe('https://api.example.com/sub/feed')
  })

  it('配置里的 query / hash 不会被带进上游地址', async () => {
    process.env.MX_SERVER_URL = 'https://api.example.com/sub?x=1#frag'
    const calls = stubFetch(() => rssResponse())
    await getFeed()

    expect(calls[0].url.toString()).toBe('https://api.example.com/sub/feed')
  })
})

describe('Feed 代理：转发行为', () => {
  it('正常响应原样透传，content-type 归一为 RSS', async () => {
    stubFetch(() => rssResponse())
    const response = await getFeed()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/rss+xml')
    expect(await response.text()).toBe(RSS)
  })

  it('上游请求不带任何查询串：请求侧无法影响上游地址', async () => {
    const calls = stubFetch(() => rssResponse())
    await getFeed()

    expect(calls).toHaveLength(1)
    expect(calls[0].url.search).toBe('')
    expect(calls[0].url.pathname).toBe('/feed')
  })

  it('上游 5xx → 502', async () => {
    stubFetch(() => new Response('boom', { status: 500 }))
    const response = await getFeed()

    expect(response.status).toBe(502)
    expect(await response.text()).toContain('500')
  })

  it('上游返回 HTML 错误页时不当成订阅源', async () => {
    stubFetch(
      () =>
        new Response('<!doctype html><title>502 Bad Gateway</title>', {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        }),
    )
    const response = await getFeed()

    expect(response.status).toBe(502)
    expect(await response.text()).toContain('非 XML')
  })

  it('网络错误 → 502，附带原因但不抛栈给调用方', async () => {
    vi.stubGlobal('fetch', (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch)

    const response = await getFeed()
    expect(response.status).toBe(502)
    expect(await response.text()).toContain('ECONNREFUSED')
  })
})

describe('Feed 代理：配置缺失', () => {
  it('缺 MX_SERVER_URL → 503 并说明原因', async () => {
    delete process.env.MX_SERVER_URL
    const calls = stubFetch(() => rssResponse())

    const response = await getFeed()
    expect(response.status).toBe(503)
    expect(await response.text()).toContain('MX_SERVER_URL')
    expect(calls).toHaveLength(0)
  })

  it('MX_MOCK=1 时不打后端', async () => {
    process.env.MX_MOCK = '1'
    const calls = stubFetch(() => rssResponse())

    const response = await getFeed()
    expect(response.status).toBe(503)
    expect(await response.text()).toContain('MX_MOCK')
    expect(calls).toHaveLength(0)
  })

  it('MX_SERVER_URL 非法 → 503，不发请求', async () => {
    process.env.MX_SERVER_URL = 'not a url'
    const calls = stubFetch(() => rssResponse())

    const response = await getFeed()
    expect(response.status).toBe(503)
    expect(calls).toHaveLength(0)
  })

  it('非 http(s) 协议 → 503，不发请求', async () => {
    process.env.MX_SERVER_URL = 'ftp://api.example.com'
    const calls = stubFetch(() => rssResponse())

    const response = await getFeed()
    expect(response.status).toBe(503)
    expect(calls).toHaveLength(0)
  })
})
