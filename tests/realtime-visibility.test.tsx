// @vitest-environment jsdom
/**
 * 页面重新可见时的恢复入口（真实 WebSocket 传输层）
 *
 * 不 mock Socket.IO / Engine.IO：本文件起一个本地 WebSocket 服务端（`ws` 从
 * socket.io-client 的依赖树解析，不新增依赖），只实现握手所需的最小
 * Engine.IO v4 帧（`0{...}` / `40/web,` / `40/web,{"sid"}` / `42/web,[...]`），
 * 因此断言的是「真实连接是否被建立、真实 join 帧是否到达」。
 *
 * `document.visibilityState` 在 jsdom 里是只读的，这里用可配置的 getter 覆盖并
 * 派发 `visibilitychange` —— 只模拟这一个浏览器事实，不触碰传输层。
 */
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RealtimeRuntime } from '@/components/realtime/realtime-runtime'
import { realtimeBus } from '@/lib/realtime/bus'
import type { RealtimeClient, RealtimeState } from '@/lib/realtime/client'
import { statusStore } from '@/lib/status/store'

interface WsServerSocket {
  send(data: string): void
  close(): void
  on(event: 'message', handler: (data: { toString(): string }) => void): void
}

interface HandshakeRecord {
  url: string
  messages: Array<[string, unknown]>
}

interface WsServer {
  on(event: 'connection', handler: (socket: WsServerSocket, req: { url?: string }) => void): void
  on(event: 'listening', handler: () => void): void
  address(): { port: number }
  close(callback: () => void): void
  clients: Set<WsServerSocket>
}

const requireFromClient = createRequire(createRequire(import.meta.url).resolve('socket.io-client'))
const { WebSocketServer } = requireFromClient('ws') as {
  WebSocketServer: new (opts: object) => WsServer
}

const ENGINE_OPEN =
  '0{"sid":"engine-test","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":1000000}'

let server: WsServer | null = null
let handshakes: HandshakeRecord[] = []
let baseUrl = ''

function registerConnection(socket: WsServerSocket, req: { url?: string }): void {
  const record: HandshakeRecord = { url: req.url ?? '', messages: [] }
  handshakes.push(record)
  socket.send(ENGINE_OPEN)
  socket.on('message', (raw) => {
    const frame = raw.toString()
    if (frame.startsWith('40/web,')) {
      socket.send(`40/web,{"sid":"nsp-${handshakes.length}"}`)
      return
    }
    if (frame.startsWith('42/web,')) {
      record.messages.push(JSON.parse(frame.slice('42/web,'.length)) as [string, unknown])
    }
  })
}

async function startServer(): Promise<void> {
  handshakes = []
  server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  server.on('connection', registerConnection)
  await once(server as unknown as NodeJS.EventEmitter, 'listening')
  baseUrl = `http://127.0.0.1:${server.address().port}`
}

function joinsOf(record: HandshakeRecord): string[] {
  return record.messages
    .filter(([event, payload]) => {
      const message = payload as { type?: string }
      return event === 'message' && message.type === 'join'
    })
    .map(([, payload]) => (payload as { payload: { roomName: string } }).payload.roomName)
}

/** 覆盖 jsdom 的只读 visibilityState，并派发真实事件 */
function setVisibility(value: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => value,
  })
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
}

function heldClient(): RealtimeClient {
  const held = (globalThis as { __folioRealtimeClient?: { client: RealtimeClient } })
    .__folioRealtimeClient
  if (!held) throw new Error('运行时没有建立共享连接宿主')
  return held.client
}

function state(): RealtimeState {
  return heldClient().getState()
}

async function waitFor(assertion: () => void): Promise<void> {
  const deadline = Date.now() + 8_000
  let lastError: unknown = null
  while (Date.now() < deadline) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 20))
      })
    }
  }
  throw lastError
}

async function waitForStatus(status: RealtimeState['status']): Promise<void> {
  await waitFor(() => expect(state().status).toBe(status))
}

/** 服务端对 /web 调 socket.disconnect()：Engine.IO(4) + Socket.IO DISCONNECT(1) */
function serverDisconnectNamespace(): void {
  for (const socket of server!.clients) socket.send('41/web,')
}

beforeEach(async () => {
  await startServer()
  document.documentElement.lang = 'zh'
})

afterEach(async () => {
  cleanup()
  delete (globalThis as { __folioRealtimeClient?: unknown }).__folioRealtimeClient
  realtimeBus.reset()
  statusStore.reset()
  delete (document as { visibilityState?: unknown }).visibilityState
  server?.clients.forEach((socket) => socket.close())
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()))
  }
  server = null
})

describe('页面重新可见时的恢复', () => {
  it('服务端断开后隐藏再可见：建立新连接并重新 join 原房间', async () => {
    render(<RealtimeRuntime origin={baseUrl} lang="zh" />)
    await waitForStatus('online')

    const release = realtimeBus.joinArticle('p1')
    await waitFor(() => expect(joinsOf(handshakes[0]!)).toEqual(['article-p1']))

    serverDisconnectNamespace()
    await waitForStatus('offline')
    expect(state().reason).toBe('server-closed')
    // 观察窗口内没有自动重连
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
    })
    expect(handshakes).toHaveLength(1)

    setVisibility('hidden')
    setVisibility('visible')

    await waitFor(() => expect(handshakes).toHaveLength(2))
    await waitForStatus('online')
    expect(new URL(handshakes[1]!.url, baseUrl).searchParams.get('lang')).toBe('zh')
    expect(joinsOf(handshakes[1]!)).toEqual(['article-p1'])

    release()
  })

  it('已经 online 时触发 visibilitychange：不调用 resume、不产生连接', async () => {
    render(<RealtimeRuntime origin={baseUrl} lang="zh" />)
    await waitForStatus('online')
    const resume = vi.spyOn(heldClient(), 'resume')

    setVisibility('hidden')
    setVisibility('visible')
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300))
    })

    expect(resume).not.toHaveBeenCalled()
    expect(handshakes).toHaveLength(1)
    expect(state().status).toBe('online')
  })

  it('connecting 时触发 visibilitychange：不并发发起第二次恢复', async () => {
    render(<RealtimeRuntime origin={baseUrl} lang="zh" />)
    // 首次握手还没完成
    expect(state().status).toBe('connecting')
    const resume = vi.spyOn(heldClient(), 'resume')

    setVisibility('visible')
    await waitForStatus('online')

    expect(resume).not.toHaveBeenCalled()
    expect(handshakes).toHaveLength(1)
  })

  it('reconnecting 时触发 visibilitychange：不插手 Manager 的重连', async () => {
    render(<RealtimeRuntime origin={baseUrl} lang="zh" />)
    await waitForStatus('online')
    const resume = vi.spyOn(heldClient(), 'resume')

    // 传输层断开 → Manager 自动进入重连
    server!.clients.forEach((socket) => socket.close())
    await waitForStatus('reconnecting')

    setVisibility('hidden')
    setVisibility('visible')

    expect(resume).not.toHaveBeenCalled()
    await waitForStatus('online')
    expect(handshakes).toHaveLength(2)
  })

  it('卸载后移除 visibilitychange / online / offline 监听，且不再恢复', async () => {
    const add = vi.spyOn(document, 'addEventListener')
    const remove = vi.spyOn(document, 'removeEventListener')
    const winAdd = vi.spyOn(window, 'addEventListener')
    const winRemove = vi.spyOn(window, 'removeEventListener')

    const { unmount } = render(<RealtimeRuntime origin={baseUrl} lang="zh" />)
    await waitForStatus('online')
    const client = heldClient()
    const resume = vi.spyOn(client, 'resume')

    unmount()

    const count = (spy: typeof add, type: string) =>
      spy.mock.calls.filter(([event]) => event === type).length
    expect(count(remove, 'visibilitychange')).toBe(count(add, 'visibilitychange'))
    expect(count(winRemove, 'online')).toBe(count(winAdd, 'online'))
    expect(count(winRemove, 'offline')).toBe(count(winAdd, 'offline'))

    setVisibility('visible')
    expect(resume).not.toHaveBeenCalled()
    expect(handshakes).toHaveLength(1)
  })
})
