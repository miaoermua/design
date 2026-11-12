import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('SSR 安全', () => {
  it('在没有 window 的环境里可以安全 import', async () => {
    expect(typeof window).toBe('undefined')

    const [protocol, client, bus, useRealtime, notifications, status] = await Promise.all([
      import('@/lib/realtime/protocol'),
      import('@/lib/realtime/client'),
      import('@/lib/realtime/bus'),
      import('@/lib/realtime/use-realtime'),
      import('@/lib/notifications/store'),
      import('@/lib/status/store'),
    ])

    expect(typeof protocol.parseEnvelope).toBe('function')
    expect(typeof client.createRealtimeClient).toBe('function')
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
    expect(createNotificationStore().getServerSnapshot()).toHaveLength(0)
    expect(createStatusStore().getServerSnapshot().kind).toBeNull()
  })

  it('环境里没有 WebSocket 时按退避重试而不是抛错', async () => {
    vi.stubGlobal('WebSocket', undefined)
    const { createRealtimeClient } = await import('@/lib/realtime/client')

    vi.useFakeTimers()
    try {
      const client = createRealtimeClient({
        url: 'wss://example.com/ws/web',
        onEvent: () => {},
        maxAttempts: 1,
      })
      expect(() => client.start()).not.toThrow()
      expect(client.getState().status).toBe('reconnecting')
      client.stop()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('实时地址解析（服务端）', () => {
  async function load() {
    return import('@/lib/realtime/config')
  }

  it('从 MX_SERVER_URL 推导 wss 地址，并剥掉 /api/v2 前缀', async () => {
    vi.stubEnv('MX_MOCK', '0')
    vi.stubEnv('MX_REALTIME_URL', '')
    vi.stubEnv('MX_REALTIME', '')
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com/api/v2')

    const { resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('zh')).toEqual({
      url: 'wss://api.example.com/ws/web',
      lang: 'zh',
    })
  })

  it('http 后端推导出 ws', async () => {
    vi.stubEnv('MX_MOCK', '0')
    vi.stubEnv('MX_REALTIME_URL', '')
    vi.stubEnv('MX_REALTIME', '')
    vi.stubEnv('MX_SERVER_URL', 'http://localhost:3000')

    const { resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('en').url).toBe('ws://localhost:3000/ws/web')
  })

  it('MX_REALTIME_URL 覆盖推导值', async () => {
    vi.stubEnv('MX_MOCK', '0')
    vi.stubEnv('MX_REALTIME', '')
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com')
    vi.stubEnv('MX_REALTIME_URL', 'wss://example.com/realtime')

    const { resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('zh').url).toBe('wss://example.com/realtime')
  })

  it('非 ws 协议一律拒绝，不猜一个地址', async () => {
    vi.stubEnv('MX_MOCK', '0')
    vi.stubEnv('MX_REALTIME', '')
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com')
    vi.stubEnv('MX_REALTIME_URL', 'https://example.com/ws/web')

    const { resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('zh').url).toBeNull()
  })

  it('MX_REALTIME=off 整体关闭', async () => {
    vi.stubEnv('MX_MOCK', '0')
    vi.stubEnv('MX_REALTIME_URL', '')
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com')
    vi.stubEnv('MX_REALTIME', 'off')

    const { isRealtimeEnabled, resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('zh').url).toBeNull()
    expect(isRealtimeEnabled()).toBe(false)
  })

  it('mock 模式默认不连网关', async () => {
    vi.stubEnv('MX_MOCK', '1')
    vi.stubEnv('MX_REALTIME_URL', '')
    vi.stubEnv('MX_REALTIME', '')
    vi.stubEnv('MX_SERVER_URL', 'https://api.example.com')

    const { isRealtimeEnabled } = await load()
    expect(isRealtimeEnabled()).toBe(false)
  })

  it('没有任何配置时返回 null 而不是抛错', async () => {
    vi.stubEnv('MX_MOCK', '0')
    vi.stubEnv('MX_REALTIME_URL', '')
    vi.stubEnv('MX_REALTIME', '')
    vi.stubEnv('MX_SERVER_URL', '')

    const { resolveRealtimeConfig } = await load()
    expect(resolveRealtimeConfig('zh').url).toBeNull()
  })
})
