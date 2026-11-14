/**
 * 真实传输层握手验证（不 mock socket.io-client，也不 mock WebSocket）
 *
 * 断言的是「客户端真的发出了什么」：本文件起一个本地 WebSocket 服务端（`ws`，
 * 由 socket.io-client 的依赖树解析，不新增依赖），只实现握手所需的最小
 * Engine.IO v4 / Socket.IO 帧：
 *
 *   0{...}           服务端 → 客户端：Engine.IO open
 *   40/web,          客户端 → 服务端：namespace CONNECT
 *   40/web,{"sid"}   服务端 → 客户端：CONNECT ack（客户端这时才 `connect`）
 *   42/web,[...]     双向业务事件；join / leave 走这里
 *
 * 因此可以从服务端侧看到**真实的握手 request.url**（`lang` query 是否更新）与
 * **真实的 join 帧**（每次会话是否只发一次），而不是只看 mock 调用。
 */
import { once } from 'node:events'
import { createRequire } from 'node:module'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRealtimeClient, type RealtimeClient } from '@/lib/realtime/client'

interface WsServerSocket {
  send(data: string): void
  close(): void
  on(event: 'message', handler: (data: { toString(): string }) => void): void
}

interface HandshakeRecord {
  /** 服务端实际收到的 upgrade 请求 URL */
  url: string
  /** 该连接上收到的业务帧 `42/web,[event, payload]` */
  messages: Array<[string, unknown]>
}

interface WsServer {
  on(event: 'connection', handler: (socket: WsServerSocket, req: { url?: string }) => void): void
  on(event: 'listening', handler: () => void): void
  address(): { port: number }
  close(callback: () => void): void
  clients: Set<WsServerSocket>
}

// `ws` 不是本仓库的直接依赖，从 socket.io-client 的依赖树里解析它，避免新增依赖
const requireFromClient = createRequire(createRequire(import.meta.url).resolve('socket.io-client'))
const { WebSocketServer } = requireFromClient('ws') as { WebSocketServer: new (opts: object) => WsServer }

const ENGINE_OPEN =
  '0{"sid":"engine-test","upgrades":[],"pingInterval":60000,"pingTimeout":60000,"maxPayload":1000000}'

let server: WsServer | null = null
let handshakes: HandshakeRecord[] = []
let baseUrl = ''
let client: RealtimeClient | null = null

async function startServer(): Promise<void> {
  handshakes = []
  server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  server.on('connection', (socket, req) => {
    const record: HandshakeRecord = { url: req.url ?? '', messages: [] }
    handshakes.push(record)

    socket.send(ENGINE_OPEN)
    socket.on('message', (raw) => {
      const frame = raw.toString()
      if (frame.startsWith('40/web,')) {
        // 回 CONNECT ack，客户端才会触发 `connect` 并开始补发 join
        socket.send(`40/web,{"sid":"nsp-${handshakes.length}"}`)
        return
      }
      if (frame.startsWith('42/web,')) {
        record.messages.push(JSON.parse(frame.slice('42/web,'.length)) as [string, unknown])
      }
    })
  })

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

async function boot(lang: 'zh' | 'en' = 'en', articleId?: string): Promise<RealtimeClient> {
  client = createRealtimeClient({
    origin: baseUrl,
    lang,
    onEvent: () => {},
  })
  if (articleId) client.joinArticle(articleId)
  client.start()
  await waitForStatus(client, 'online')
  return client
}

async function waitForStatus(target: RealtimeClient, status: string): Promise<void> {
  const deadline = Date.now() + 8_000
  while (Date.now() < deadline) {
    if (target.getState().status === status) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error(`状态没有变成 ${status}，当前 ${target.getState().status}`)
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
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
  }
  throw lastError
}

beforeEach(async () => {
  await startServer()
})

afterEach(async () => {
  client?.stop()
  client = null
  if (!server) return
  for (const socket of server.clients) socket.close()
  await new Promise<void>((resolve) => {
    server!.close(() => resolve())
  })
  server = null
})

describe('真实 Engine.IO / Socket.IO 握手', () => {
  it('握手 URL 是 /socket.io/ + EIO=4 + websocket，并带当前 lang', async () => {
    await boot('en')

    expect(handshakes).toHaveLength(1)
    const url = new URL(handshakes[0]!.url, baseUrl)
    expect(url.pathname).toBe('/socket.io/')
    expect(url.searchParams.get('EIO')).toBe('4')
    expect(url.searchParams.get('transport')).toBe('websocket')
    expect(url.searchParams.get('lang')).toBe('en')
    expect(url.searchParams.has('b64')).toBe(false)
  })

  it('setLang：旧连接关闭、新连接带新 lang、原房间重新 join 且每次会话只 join 一次', async () => {
    const active = await boot('en', 'p1')

    expect(joinsOf(handshakes[0]!)).toEqual(['article-p1'])

    active.setLang('zh')
    await waitFor(() => expect(handshakes).toHaveLength(2))
    await waitForStatus(active, 'online')

    const second = handshakes[1]!
    const url = new URL(second.url, baseUrl)
    expect(url.searchParams.get('lang')).toBe('zh')
    expect(url.searchParams.get('EIO')).toBe('4')
    expect(url.searchParams.get('transport')).toBe('websocket')

    // 每条会话各 join 一次：没有因为「重连 + connect」双触发而重复
    expect(joinsOf(second)).toEqual(['article-p1'])
    expect(joinsOf(handshakes[0]!)).toEqual(['article-p1'])
    expect(handshakes).toHaveLength(2)
  })

  it('传输层断开后重连：新会话只 join 一次，房间不丢', async () => {
    const active = await boot('zh', 'p1')
    expect(joinsOf(handshakes[0]!)).toEqual(['article-p1'])

    // 服务端主动切断传输层（模拟 ping timeout / transport close）
    for (const socket of server!.clients) socket.close()

    await waitFor(() => expect(handshakes.length).toBeGreaterThan(1))
    await waitForStatus(active, 'online')

    const reconnected = handshakes[handshakes.length - 1]!
    expect(new URL(reconnected.url, baseUrl).searchParams.get('lang')).toBe('zh')
    expect(joinsOf(reconnected)).toEqual(['article-p1'])
  })

  it('浏览器离线时 pause：不再重连；恢复后 resume 用同一个 lang 重新握手', async () => {
    const active = await boot('en', 'p1')

    active.pause()
    await new Promise((resolve) => setTimeout(resolve, 300))
    expect(handshakes).toHaveLength(1)
    expect(active.getState()).toMatchObject({ status: 'offline', reason: 'paused' })

    active.resume()
    await waitFor(() => expect(handshakes).toHaveLength(2))
    await waitForStatus(active, 'online')
    expect(new URL(handshakes[1]!.url, baseUrl).searchParams.get('lang')).toBe('en')
    expect(joinsOf(handshakes[1]!)).toEqual(['article-p1'])
  })

  it('服务端主动断开 namespace：进入 server-closed，Manager 不会自动重连，只有 resume 能恢复', async () => {
    const active = await boot('en', 'p1')
    expect(joinsOf(handshakes[0]!)).toEqual(['article-p1'])

    // 服务端对 /web 调用 socket.disconnect()：Engine.IO(4) + Socket.IO DISCONNECT(1)
    for (const socket of server!.clients) socket.send('41/web,')

    await waitForStatus(active, 'offline')
    expect(active.getState()).toMatchObject({ status: 'offline', reason: 'server-closed' })

    // 观察窗口内没有任何新连接：官方行为是客户端不会自动重连
    await new Promise((resolve) => setTimeout(resolve, 800))
    expect(handshakes).toHaveLength(1)

    // 唯一恢复入口是显式 resume（重建会话并补订阅房间）
    active.resume()
    await waitFor(() => expect(handshakes).toHaveLength(2))
    await waitForStatus(active, 'online')
    expect(joinsOf(handshakes[1]!)).toEqual(['article-p1'])
  })
})
