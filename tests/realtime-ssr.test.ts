import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('SSR 安全', () => {
  it('在没有 window 的环境里可以安全 import（含 socket.io-client）', async () => {
    expect(typeof window).toBe('undefined')

    const [protocol, client, bus, useRealtime, notifications, status] = await Promise.all([
      import('@/lib/realtime/protocol'),
      import('@/lib/realtime/client'),
      import('@/lib/realtime/bus'),
      import('@/lib/realtime/use-realtime'),
      import('@/lib/notifications/store'),
      import('@/lib/status/store'),
    ])

    expect(typeof protocol.dispatchMessage).toBe('function')
    expect(typeof client.createRealtimeClient).toBe('function')
    expect(typeof client.acquireRealtimeClient).toBe('function')
    expect(typeof bus.createRealtimeBus).toBe('function')
    expect(typeof useRealtime.useRealtimeSnapshot).toBe('function')
    expect(typeof notifications.createNotificationStore).toBe('function')
    expect(typeof status.createStatusStore).toBe('function')
  })

  it('服务端快照在任何模块里都不会读浏览器状态', async () => {
    const { createRealtimeBus } = await import('@/lib/realtime/bus')
    const { createNotificationStore } = await import('@/lib/notifications/store')
    const { createStatusStore } = await import('@/lib/status/store')

    expect(createRealtimeBus().getServerSnapshot().state.status).toBe('idle')
    expect(createRealtimeBus().getServerSnapshot().online).toBeNull()
    expect(createNotificationStore().getServerSnapshot()).toHaveLength(0)
    expect(createStatusStore().getServerSnapshot().kind).toBeNull()
  })

  it('环境里没有浏览器 WebSocket 时，import 与注入式连接都不抛错', async () => {
    vi.stubGlobal('WebSocket', undefined)
    const { createRealtimeClient } = await import('@/lib/realtime/client')

    let connects = 0
    const client = createRealtimeClient({
      origin: 'https://api.example.com',
      lang: 'zh',
      onEvent: () => {},
      createTransport: () => ({
        connect: () => {
          connects += 1
        },
        disconnect: () => {},
        emitMessage: () => {},
        setLang: () => {},
        bind: () => {},
        unbind: () => {},
        destroy: () => {},
      }),
    })

    expect(() => client.start()).not.toThrow()
    expect(connects).toBe(1)
    expect(client.getState().status).toBe('connecting')
    client.stop()
  })
})

describe('实时 Origin 解析（服务端）', () => {
  async function load() {
    return import('@/lib/realtime/config')
  }

  function baseEnv() {
    vi.stubEnv('MX_MOCK', '0')
    vi.stubEnv('MX_REALTIME_URL', '')
    vi.stubEnv('MX_REALTIME', '')
  }

  it('从 MX_SERVER_URL 取 origin，并剥掉 /api/v2 前缀', async () => {
    baseEnv()
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com/api/v2')

    const { resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('zh')).toEqual({
      origin: 'https://api.example.com',
      lang: 'zh',
    })
  })

  it('http 后端保持 http origin（Socket.IO 客户端自己决定 ws/wss）', async () => {
    baseEnv()
    vi.stubEnv('MX_SERVER_URL', 'http://localhost:3000')

    const { resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('en')).toEqual({
      origin: 'http://localhost:3000',
      lang: 'en',
    })
  })

  it('MX_REALTIME_URL 覆盖推导值', async () => {
    baseEnv()
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com')
    vi.stubEnv('MX_REALTIME_URL', 'https://gateway.example.com')

    const { resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('zh').origin).toBe('https://gateway.example.com')
  })

  it('带路径的覆盖地址一律拒绝，不让环境变量拼出旧的 /ws/web', async () => {
    baseEnv()
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com')
    vi.stubEnv('MX_REALTIME_URL', 'https://example.com/ws/web')

    const { resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('zh').origin).toBeNull()
  })

  it('旧协议的 ws:// / wss:// 一律拒绝，不猜一个地址', async () => {
    baseEnv()
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com')

    const first = await load()
    vi.stubEnv('MX_REALTIME_URL', 'wss://example.com/ws/web')
    expect(first.resolveRealtimeConfig('zh').origin).toBeNull()

    vi.stubEnv('MX_REALTIME_URL', 'https://example.com/ws/web')
    expect(first.resolveRealtimeConfig('zh').origin).toBeNull()
  })

  it('MX_REALTIME=off 整体关闭', async () => {
    baseEnv()
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com')
    vi.stubEnv('MX_REALTIME', 'off')

    const { isRealtimeEnabled, resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('zh').origin).toBeNull()
    expect(isRealtimeEnabled()).toBe(false)
  })

  it('mock 模式默认不连网关', async () => {
    baseEnv()
    vi.stubEnv('MX_MOCK', '1')
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com')

    const { isRealtimeEnabled } = await load()
    expect(isRealtimeEnabled()).toBe(false)
  })

  it('没有任何配置时返回 null 而不是抛错', async () => {
    baseEnv()
    vi.stubEnv('MX_SERVER_URL', '')

    const { resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('zh').origin).toBeNull()
  })
})
