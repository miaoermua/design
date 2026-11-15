/**
 * 系统通知（Web Notification API）
 *
 * 与 toast 队列是两条通道，共用同一份「事件」：读者在页面上时看 toast，
 * 页面切到后台时才值得打扰系统通知中心。三条硬规则：
 *
 * 1. **页面加载时不请求权限**。`Notification.requestPermission()` 必须由用户手势
 *    触发，因此只有 `enable()` 会调用它，而 `enable()` 只从首页「更多」→「订阅」
 *    里的「浏览器通知」按钮进来。打开站点就弹权限框是这里刻意不做的事。
 * 2. **授权与开关是两条独立条件**。存储里记「用户想开」，浏览器记「能不能开」；
 *    用户在浏览器设置里撤销授权后，`getState()` 会立刻回到 `off`，不会因为
 *    存储里还写着 `on` 就以为还能发。
 * 3. **前台不发系统通知**。同一个事件已经有一条 toast，双通道同时响是骚扰。
 *
 * 环境依赖全部注入，因此这个模块不 import 任何浏览器全局，可在 node 下测试。
 */

export const SYSTEM_NOTIFY_STORAGE_KEY = 'folio:system-notify'

/** 浏览器的授权状态；`unsupported` 是「没有 Notification API」的归并值 */
export type SystemNotifyPermission = 'unsupported' | 'default' | 'granted' | 'denied'

/**
 * 界面要展示的状态：
 * - `on`：用户开启且浏览器已授权
 * - `off`：支持但没开（含「授权了但没开」与「还没问过」）
 * - `blocked`：浏览器已拒绝，只能由用户自己去站点设置里改
 * - `unsupported`：当前浏览器没有这个能力
 */
export type SystemNotifyState = 'unsupported' | 'off' | 'on' | 'blocked'

export interface SystemNotificationPayload {
  title: string
  body?: string
  /** 同一 tag 覆盖上一条，避免同一篇文章的更新堆一屏 */
  tag?: string
  /** 点击通知后打开的地址；缺省只聚焦窗口 */
  url?: string
}

export interface SystemNotificationEnv {
  supported: boolean
  permission: () => SystemNotifyPermission
  requestPermission: () => Promise<SystemNotifyPermission>
  /** 真正弹出系统通知；返回 false 表示浏览器拒绝 */
  present: (payload: SystemNotificationPayload) => boolean
  /** 页面当前是否可见（可见就不发系统通知） */
  isVisible: () => boolean
  readFlag: () => string | null
  writeFlag: (value: string | null) => void
}

export interface SystemNotificationManager {
  getState(): SystemNotifyState
  /** 只有这里会触发浏览器权限请求；非用户手势调用会被浏览器静默拒绝 */
  enable(): Promise<SystemNotifyState>
  disable(): void
  /** 发一条系统通知；返回是否真的发出去了 */
  notify(payload: SystemNotificationPayload): boolean
}

export function createSystemNotificationManager(
  env: SystemNotificationEnv,
): SystemNotificationManager {
  function getState(): SystemNotifyState {
    if (!env.supported) return 'unsupported'

    const permission = env.permission()
    if (permission === 'unsupported') return 'unsupported'
    if (permission === 'denied') return 'blocked'
    if (permission === 'granted' && env.readFlag() === 'on') return 'on'
    return 'off'
  }

  return {
    getState,

    async enable() {
      if (!env.supported) return 'unsupported'

      const current = env.permission()
      if (current === 'unsupported') return 'unsupported'
      if (current === 'denied') return 'blocked'

      if (current === 'granted') {
        env.writeFlag('on')
        return 'on'
      }

      let next: SystemNotifyPermission
      try {
        next = await env.requestPermission()
      } catch {
        // 旧 Safari 会在非手势上下文里直接 reject；当成「没开」而不是「被拒绝」
        return 'off'
      }

      if (next === 'granted') {
        env.writeFlag('on')
        return 'on'
      }
      // 用户点了「阻止」才记成 blocked；点了「稍后」仍是 off
      return next === 'denied' ? 'blocked' : 'off'
    },

    disable() {
      env.writeFlag(null)
    },

    notify(payload) {
      if (getState() !== 'on') return false
      if (env.isVisible()) return false

      const title = payload.title.trim()
      if (!title) return false

      try {
        return env.present({ ...payload, title })
      } catch {
        return false
      }
    },
  }
}

/* ── 浏览器适配层 ────────────────────────────────────────────── */

type NotificationConstructor = typeof Notification

function readNotification(): NotificationConstructor | null {
  if (typeof window === 'undefined') return null
  const ctor = (window as Window & { Notification?: NotificationConstructor }).Notification
  return typeof ctor === 'function' ? ctor : null
}

export function createBrowserEnv(): SystemNotificationEnv {
  return {
    get supported() {
      return readNotification() !== null
    },

    permission() {
      const ctor = readNotification()
      if (!ctor) return 'unsupported'
      const value = ctor.permission
      if (value === 'granted' || value === 'denied') return value
      return 'default'
    },

    async requestPermission() {
      const ctor = readNotification()
      if (!ctor) return 'unsupported'
      return (await ctor.requestPermission()) as SystemNotifyPermission
    },

    present(payload) {
      const ctor = readNotification()
      if (!ctor) return false

      const notification = new ctor(payload.title, {
        body: payload.body,
        tag: payload.tag,
        // 地址不是 Notification 的标准字段，放在 data 里，点击时再取
        data: payload.url ? { url: payload.url } : undefined,
      })

      notification.onclick = () => {
        window.focus()
        if (payload.url) window.open(payload.url, '_blank', 'noopener,noreferrer')
        notification.close()
      }

      return true
    },

    isVisible() {
      if (typeof document === 'undefined') return true
      return document.visibilityState === 'visible'
    },

    readFlag() {
      try {
        return window.localStorage.getItem(SYSTEM_NOTIFY_STORAGE_KEY)
      } catch {
        // 隐私模式下 localStorage 可能直接抛错：当作「没开」
        return null
      }
    },

    writeFlag(value) {
      try {
        if (value === null) window.localStorage.removeItem(SYSTEM_NOTIFY_STORAGE_KEY)
        else window.localStorage.setItem(SYSTEM_NOTIFY_STORAGE_KEY, value)
      } catch {
        // 存不进去就只在本次会话内有效，不阻断功能
      }
    },
  }
}

const globalScope = globalThis as typeof globalThis & {
  __folioSystemNotifications?: SystemNotificationManager
}

/** 全站单例：权限状态是全局的，没必要按组件各存一份 */
export const systemNotifications: SystemNotificationManager =
  (globalScope.__folioSystemNotifications ??= createSystemNotificationManager(createBrowserEnv()))
