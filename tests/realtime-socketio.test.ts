import { beforeEach, describe, expect, it, vi } from 'vitest'

const { ioMock, socketMock, managerMock } = vi.hoisted(() => {
  const manager = {
    on: vi.fn(),
    off: vi.fn(),
    opts: { query: {} as Record<string, unknown> },
  }
  const socket = {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    io: manager,
  }
  return { ioMock: vi.fn(() => socket), socketMock: socket, managerMock: manager }
})

vi.mock('socket.io-client', () => ({ io: ioMock }))

import { createRealtimeClient } from '@/lib/realtime/client'

function create() {
  return createRealtimeClient({
    origin: 'https://api.example.com',
    lang: 'en',
    onEvent: () => {},
  })
}

beforeEach(() => {
  ioMock.mockClear()
  socketMock.on.mockClear()
  socketMock.off.mockClear()
  socketMock.emit.mockClear()
  socketMock.connect.mockClear()
  socketMock.disconnect.mockClear()
  managerMock.on.mockClear()
  managerMock.off.mockClear()
  managerMock.opts.query = {}
})

describe('默认 Socket.IO transport', () => {
  it('namespace 是 /web，Engine.IO path 是 /socket.io/，transport 只有 websocket', () => {
    create()
    const calls = ioMock.mock.calls as unknown as [string, Record<string, unknown>][]
    const [url, options] = calls[0]!
    expect(url).toBe('https://api.example.com/web')
    expect(options).toMatchObject({
      path: '/socket.io/',
      transports: ['websocket'],
      autoConnect: false,
      reconnection: true,
      forceNew: true,
      query: { lang: 'en' },
    })
    expect(options.transports).not.toContain('polling')
  })

  it('autoConnect=false：创建实例时不连接，start 才 connect', () => {
    const client = create()
    expect(socketMock.connect).not.toHaveBeenCalled()
    client.start()
    expect(socketMock.connect).toHaveBeenCalledTimes(1)
    client.stop()
  })

  it('监听器只注册一次；重复 start 不重复注册', () => {
    const client = create()
    client.start()
    client.start()
    const socketOn = socketMock.on.mock.calls.length
    const managerOn = managerMock.on.mock.calls.length
    expect(socketOn).toBe(4) // connect / disconnect / connect_error / message
    expect(managerOn).toBe(4) // reconnect_attempt / reconnect / reconnect_error / reconnect_failed
    expect(socketMock.on.mock.calls.map(([event]) => event)).toContain('message')
    client.stop()
  })

  it('销毁时按原函数逐个解绑并断开，不留下野监听', () => {
    const client = create()
    client.start()
    client.stop()
    expect(socketMock.off.mock.calls.length).toBe(4)
    expect(managerMock.off.mock.calls.length).toBe(4)
    expect(socketMock.disconnect).toHaveBeenCalled()
  })

  it('房间订阅通过 message 事件发送 join/leave', () => {
    const client = create()
    client.start()
    const handlers = Object.fromEntries(socketMock.on.mock.calls) as Record<string, () => void>
    handlers.connect?.()
    const release = client.joinArticle('p9')
    expect(socketMock.emit).toHaveBeenCalledWith('message', {
      type: 'join',
      payload: { roomName: 'article-p9' },
    })
    release()
    expect(socketMock.emit).toHaveBeenCalledWith('message', {
      type: 'leave',
      payload: { roomName: 'article-p9' },
    })
    client.stop()
  })

  it('改语言更新握手 query，不新建 Socket 实例', () => {
    const client = create()
    client.start()
    // 模拟客户端写入初始 query
    managerMock.opts.query = { lang: 'en' }
    client.setLang('zh')
    expect(managerMock.opts.query).toEqual({ lang: 'zh' })
    expect(ioMock).toHaveBeenCalledTimes(1)
    expect(socketMock.disconnect).toHaveBeenCalled()
    expect(socketMock.connect).toHaveBeenCalledTimes(2)
    client.stop()
  })
})
