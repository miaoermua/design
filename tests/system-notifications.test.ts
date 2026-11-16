import { describe, expect, it } from 'vitest'
import {
  SYSTEM_NOTIFY_STORAGE_KEY,
  createBrowserEnv,
  createSystemNotificationManager,
  type SystemNotificationEnv,
  type SystemNotificationPayload,
  type SystemNotifyPermission,
} from '@/lib/notifications/system'

/**
 * 系统通知管理器
 *
 * 这里钉的都是「什么时候不该发」——权限请求必须由用户动作触发、
 * 前台不重复打扰、浏览器撤销授权后不能继续发。
 */

interface FakeEnv extends SystemNotificationEnv {
  presented: SystemNotificationPayload[]
  flag: string | null
  requestCount: number
  /** 模拟「用户去浏览器设置里改了权限」 */
  setPermission: (next: SystemNotifyPermission) => void
}

function createEnv(
  options: {
    supported?: boolean
    permission?: SystemNotifyPermission
    /** requestPermission() 的返回值；默认 granted */
    answer?: SystemNotifyPermission
    visible?: boolean
    throwOnRequest?: boolean
    present?: (payload: SystemNotificationPayload) => boolean
  } = {},
): FakeEnv {
  let permission = options.permission ?? 'default'

  const env: FakeEnv = {
    supported: options.supported ?? true,
    presented: [],
    flag: null,
    requestCount: 0,

    permission: () => permission,
    requestPermission: async () => {
      env.requestCount += 1
      if (options.throwOnRequest) throw new Error('not a user gesture')
      permission = options.answer ?? 'granted'
      return permission
    },

    present: (payload) => {
      if (options.present) return options.present(payload)
      env.presented.push(payload)
      return true
    },

    isVisible: () => options.visible ?? false,
    readFlag: () => env.flag,
    writeFlag: (value) => {
      env.flag = value
    },

    setPermission: (next) => {
      permission = next
    },
  }

  return env
}

describe('系统通知：能力与开机状态', () => {
  it('浏览器没有 Notification API 时是 unsupported，且永远不发', async () => {
    const env = createEnv({ supported: false })
    const manager = createSystemNotificationManager(env)

    expect(manager.getState()).toBe('unsupported')
    expect(await manager.enable()).toBe('unsupported')
    expect(manager.notify({ title: '新文章' })).toBe(false)
    expect(env.presented).toHaveLength(0)
  })

  it('支持但从未开启时是 off，且不弹系统通知', () => {
    const env = createEnv({ permission: 'granted' })
    const manager = createSystemNotificationManager(env)

    expect(manager.getState()).toBe('off')
    expect(manager.notify({ title: '新文章' })).toBe(false)
    expect(env.presented).toHaveLength(0)
  })

  it('存储键就是文档里写的那一个', () => {
    expect(SYSTEM_NOTIFY_STORAGE_KEY).toBe('folio:system-notify')
  })
})

describe('系统通知：开启与关闭', () => {
  it('default 权限下开启 → 请求一次权限并落标记', async () => {
    const env = createEnv()
    const manager = createSystemNotificationManager(env)

    expect(await manager.enable()).toBe('on')
    expect(env.requestCount).toBe(1)
    expect(env.flag).toBe('on')
    expect(manager.getState()).toBe('on')
  })

  it('已经授权过就不再请求，只落标记', async () => {
    const env = createEnv({ permission: 'granted' })
    const manager = createSystemNotificationManager(env)

    expect(await manager.enable()).toBe('on')
    expect(env.requestCount).toBe(0)
  })

  it('用户点了「阻止」→ blocked，且之后不再重复请求', async () => {
    const env = createEnv({ answer: 'denied' })
    const manager = createSystemNotificationManager(env)

    expect(await manager.enable()).toBe('blocked')
    expect(await manager.enable()).toBe('blocked')
    expect(env.requestCount).toBe(1)
    expect(env.flag).toBeNull()
  })

  it('用户点了「稍后」→ 仍是 off，不是 blocked', async () => {
    const env = createEnv({ answer: 'default' })
    const manager = createSystemNotificationManager(env)

    expect(await manager.enable()).toBe('off')
    expect(manager.getState()).toBe('off')
  })

  it('requestPermission 抛错时按「没开」处理，不当成被拒绝', async () => {
    const env = createEnv({ throwOnRequest: true })
    const manager = createSystemNotificationManager(env)

    expect(await manager.enable()).toBe('off')
    expect(manager.getState()).toBe('off')
  })

  it('关闭只清标记，不碰浏览器授权', () => {
    const env = createEnv({ permission: 'granted' })
    env.flag = 'on'
    const manager = createSystemNotificationManager(env)

    manager.disable()
    expect(env.flag).toBeNull()
    expect(manager.getState()).toBe('off')
  })
})

describe('系统通知：发送条件', () => {
  it('开启且页面在后台才发，标题原样带过去', () => {
    const env = createEnv({ permission: 'granted' })
    env.flag = 'on'
    const manager = createSystemNotificationManager(env)

    expect(manager.notify({ title: '文章有更新', body: '已同步到最新版本', tag: 'p1' })).toBe(true)
    expect(env.presented).toEqual([{ title: '文章有更新', body: '已同步到最新版本', tag: 'p1' }])
  })

  it('页面在前台不发：同一个事件已经有 toast', () => {
    const env = createEnv({ permission: 'granted', visible: true })
    env.flag = 'on'
    const manager = createSystemNotificationManager(env)

    expect(manager.notify({ title: '文章有更新' })).toBe(false)
    expect(env.presented).toHaveLength(0)
  })

  it('浏览器撤销授权后，存储里的 on 不再等于开启', () => {
    const env = createEnv({ permission: 'default' })
    env.flag = 'on'
    const manager = createSystemNotificationManager(env)

    expect(manager.getState()).toBe('off')
    expect(manager.notify({ title: '文章有更新' })).toBe(false)
  })

  it('空标题不发，也不把空白串当通知', () => {
    const env = createEnv({ permission: 'granted' })
    env.flag = 'on'
    const manager = createSystemNotificationManager(env)

    expect(manager.notify({ title: '   ' })).toBe(false)
    expect(env.presented).toHaveLength(0)
  })

  it('present 抛错时返回 false，不把异常抛给调用方', () => {
    const env = createEnv({
      permission: 'granted',
      present: () => {
        throw new Error('blocked')
      },
    })
    env.flag = 'on'
    const manager = createSystemNotificationManager(env)

    expect(manager.notify({ title: '文章有更新' })).toBe(false)
  })

  it('present 返回 false 时如实反映没发出去', () => {
    const env = createEnv({ permission: 'granted', present: () => false })
    env.flag = 'on'
    const manager = createSystemNotificationManager(env)

    expect(manager.notify({ title: '文章有更新' })).toBe(false)
  })
})

describe('系统通知：浏览器适配层', () => {
  it('node 环境（没有 window）时不支持，且读写标记都不抛错', async () => {
    const env = createBrowserEnv()

    expect(env.supported).toBe(false)
    expect(env.permission()).toBe('unsupported')
    expect(await env.requestPermission()).toBe('unsupported')
    expect(env.isVisible()).toBe(true)
    expect(env.readFlag()).toBeNull()
    expect(() => env.writeFlag('on')).not.toThrow()
    expect(env.present({ title: 'x' })).toBe(false)
  })
})

describe('系统通知：状态不缓存', () => {
  it('getState 每次都重新问权限，不缓存旧结果', () => {
    const env = createEnv()
    env.flag = 'on'
    const manager = createSystemNotificationManager(env)

    expect(manager.getState()).toBe('off')

    env.setPermission('granted')
    expect(manager.getState()).toBe('on')

    env.setPermission('denied')
    expect(manager.getState()).toBe('blocked')
  })

  it('enable 之后 notify 直接可用，不依赖任何订阅', async () => {
    const env = createEnv()
    const manager = createSystemNotificationManager(env)

    await manager.enable()
    expect(manager.notify({ title: '订阅成功' })).toBe(true)
    expect(env.presented).toEqual([{ title: '订阅成功' }])
  })
})
