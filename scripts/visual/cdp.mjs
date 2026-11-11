/**
 * 极简 CDP 客户端（Phase 4D 视觉验收用）
 *
 * 为什么不装 Playwright / Puppeteer：项目没有这两条依赖，本阶段只需要
 * 「导航 → 等字体 → 截图 / 取计算样式 / 看网络请求」四件事，用系统 Chrome 的
 * 调试协议加 Node 内置 WebSocket 足够，不引入任何 npm 包。
 *
 * 用法见 scripts/visual/*.mjs；每个脚本启动自己的 Chrome 实例与临时 profile，
 * 互不干扰，结束后关掉进程并删除 profile。
 */

import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** macOS 默认安装路径；可用 FOLIO_CHROME 覆盖 */
const CHROME =
  process.env.FOLIO_CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export { sleep }

/** 轮询直到 predicate 返回 true 或超时 */
export async function waitUntil(predicate, timeoutMs, label, intervalMs = 120) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await predicate()) return
    if (Date.now() > deadline) throw new Error(`timeout: ${label}`)
    await sleep(intervalMs)
  }
}

/**
 * 启动 Chrome。
 * `profile` 传入已有目录即为热缓存场景；不传则每次新建临时目录（冷缓存）。
 */
export async function launchChrome({ port = 9333, profile, headless = true } = {}) {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found: ${CHROME}`)

  const userDataDir = profile ?? mkdtempSync(join(tmpdir(), 'folio-visual-'))
  const args = [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-features=Translate,MediaRouter,OptimizationHints',
    '--hide-scrollbars',
    '--force-color-profile=srgb',
    '--window-size=1440,960',
    ...(headless ? ['--headless=new'] : []),
    'about:blank',
  ]

  const proc = spawn(CHROME, args, { stdio: 'ignore' })
  proc.on('error', (error) => {
    console.error('chrome spawn error:', error.message)
  })

  await waitUntil(
    async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/json/version`)
        return response.ok
      } catch {
        return false
      }
    },
    20000,
    'chrome devtools endpoint',
  )

  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()

  return {
    proc,
    port,
    userDataDir,
    version: {
      browser: version.Browser,
      protocolVersion: version['Protocol-Version'],
      userAgent: version['User-Agent'],
    },
    async close() {
      try {
        proc.kill('SIGKILL')
      } catch {
        /* 已经退出 */
      }
      await sleep(300)
      // profile 是调用方给的（热缓存场景）就保留
      if (!profile) {
        try {
          rmSync(userDataDir, { recursive: true, force: true })
        } catch {
          /* 文件句柄可能还没释放，忽略 */
        }
      }
    },
  }
}

/** 新建一个标签页并连上它的 WebSocket */
export async function openPage(port) {
  const response = await fetch(`http://127.0.0.1:${port}/json/new?url=about:blank`, {
    method: 'PUT',
  })
  if (!response.ok) throw new Error(`cannot create target: ${response.status}`)
  const target = await response.json()
  const client = await connect(target.webSocketDebuggerUrl)
  client.targetId = target.id
  return client
}

/** 把 CDP 的 message/event 模式包成 send / on */
function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl)
    let nextId = 1
    const pending = new Map()
    const handlers = new Map()
    const events = []

    const onMessage = (event) => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }

      if (message.id) {
        const entry = pending.get(message.id)
        if (!entry) return
        pending.delete(message.id)
        if (message.error) entry.reject(new Error(`${entry.method}: ${message.error.message}`))
        else entry.resolve(message.result)
        return
      }

      if (message.method) {
        events.push({ method: message.method, params: message.params, at: Date.now() })
        const list = handlers.get(message.method)
        if (list) for (const fn of [...list]) fn(message.params)
      }
    }

    ws.addEventListener('message', onMessage)
    ws.addEventListener('error', () => reject(new Error(`websocket error: ${wsUrl}`)))
    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const id = nextId++
          const promise = new Promise((res, rej) =>
            pending.set(id, { resolve: res, reject: rej, method }),
          )
          ws.send(JSON.stringify({ id, method, params }))
          return promise
        },
        on(method, fn) {
          const list = handlers.get(method) ?? []
          list.push(fn)
          handlers.set(method, list)
        },
        off(method, fn) {
          const list = handlers.get(method)
          if (!list) return
          handlers.set(
            method,
            list.filter((item) => item !== fn),
          )
        },
        once(method, timeoutMs = 15000) {
          return new Promise((res, rej) => {
            const timer = setTimeout(() => {
              this.off(method, handler)
              rej(new Error(`timeout waiting for ${method}`))
            }, timeoutMs)
            const handler = (params) => {
              clearTimeout(timer)
              this.off(method, handler)
              res(params)
            }
            this.on(method, handler)
          })
        },
        events,
        clearEvents() {
          events.length = 0
        },
        async evaluate(expression, { awaitPromise = true } = {}) {
          const result = await this.send('Runtime.evaluate', {
            expression,
            awaitPromise,
            returnByValue: true,
            userGesture: true,
          })
          if (result.exceptionDetails) {
            throw new Error(
              `evaluate failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`,
            )
          }
          return result.result.value
        },
        close() {
          try {
            ws.close()
          } catch {
            /* ignore */
          }
        },
      })
    })
  })
}

/** 组合初始化：页面域、运行时、网络、稳定的设备指标 */
export async function preparePage(client, { width, height, deviceScaleFactor = 1, theme }) {
  await client.send('Page.enable')
  await client.send('Runtime.enable')
  await client.send('Network.enable')
  await client.send('Network.setCacheDisabled', { cacheDisabled: false })
  await client.send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor,
    mobile: false,
    screenWidth: width,
    screenHeight: height,
  })
  await client.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-color-scheme', value: theme }],
  })
}

/** 导航并等待 load，返回主文档状态码 */
export async function navigate(client, url, timeoutMs = 30000) {
  const loaded = client.once('Page.loadEventFired', timeoutMs)
  const result = await client.send('Page.navigate', { url })
  await loaded
  return result
}

/**
 * 切换到指定主题。
 * 与站点自身的 ThemeToggle 做同一件事：写 localStorage + 改 <html data-theme>，
 * 这样截图反映的就是切换按钮按下后的真实状态，而不是另造一套渲染条件。
 */
export async function applyTheme(client, theme) {
  await client.evaluate(`(() => {
    try { localStorage.setItem('folio-theme', ${JSON.stringify(theme)}) } catch (e) {}
    const root = document.documentElement
    if (${JSON.stringify(theme)} === 'dark') root.dataset.theme = 'dark'
    else delete root.dataset.theme
    return root.dataset.theme ?? 'light'
  })()`)
  await sleep(220)
}

/**
 * 等字体、等图片、等一帧稳定。
 * 返回可写进 manifest 的证据（字体状态、图片数量、破图数量）。
 *
 * 注意：`.prose` 里的图片是 `loading="lazy"`，不在视口内时永远不会触发 load，
 * 所以这里只等待「已经进入视口」的图片，并整体加 4s 上限，避免把截图卡死。
 */
export async function settle(client, { extraDelay = 350 } = {}) {
  const probe = await client.evaluate(`(async () => {
    const timeout = (ms) => new Promise((r) => setTimeout(r, ms))
    await document.fonts.ready
    await timeout(${extraDelay})

    const inViewport = (img) => {
      const rect = img.getBoundingClientRect()
      return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0
    }
    const pending = Array.from(document.images).filter((img) => !img.complete && inViewport(img))
    await Promise.race([
      Promise.all(pending.map((img) => new Promise((r) => {
        img.addEventListener('load', r, { once: true })
        img.addEventListener('error', r, { once: true })
      }))),
      timeout(4000),
    ])
    await timeout(120)

    return {
      fontStatus: document.fonts.status,
      fontFaceCount: document.fonts.size,
      imageCount: document.images.length,
      loadedImages: Array.from(document.images).filter((img) => img.complete && img.naturalWidth > 0).length,
      brokenImages: Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).length,
      theme: document.documentElement.dataset.theme ?? 'light',
      title: document.title,
      scrollHeight: document.documentElement.scrollHeight,
    }
  })()`)
  return probe
}

/** 截当前视口，返回 PNG Buffer */
export async function screenshot(client) {
  const { data } = await client.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  })
  return Buffer.from(data, 'base64')
}

/** 取单个元素的盒模型（视口坐标），用于滚到某一节再截图 */
export async function scrollTo(client, selector) {
  const found = await client.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return false
    el.scrollIntoView({ block: 'start', behavior: 'instant' })
    window.scrollBy(0, -96)
    return true
  })()`)
  await sleep(260)
  return found
}
