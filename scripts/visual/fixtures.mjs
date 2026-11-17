/**
 * 视觉测试素材的运行时生命周期
 *
 * 两件事，分开做清楚：
 *   1. `materializeFixtures()` —— 把 `fixture-assets.mjs` 里的五张 SVG 写进一个
 *      **独立临时目录**（`mkdtempSync`，每个脚本一份，互不覆盖），返回句柄。
 *   2. `attachFixtureInterception()` —— 在该页面的 CDP 会话上开启 `Fetch` 域，
 *      只拦截 `/visual-tests/*.svg`，从上面那个临时目录读文件原样返回。
 *
 * 为什么用拦截而不是「放回 public/」或「起一个静态服务」：
 *   - 放回 public/ 就是要解决的问题（会进 Git、会进生产构建）；
 *   - 起静态服务要额外占端口、还要改样张里的图片地址（等于改测试内容）；
 *   - 用请求拦截则 Markdown 里的写法一个字节都不用动，图仍然是同源的
 *     `/visual-tests/gallery-01.svg`，Gallery、Carousel、figure、图片预览
 *     走的是和以前完全一样的加载路径。
 *
 * 清理：`dispose()` 幂等；除了调用方显式调用，还有两条兜底——
 * `process.once('exit')` 管「脚本抛错 / `process.exitCode = 1` 后自然退出」，
 * `SIGINT` / `SIGTERM` / `SIGHUP` 管「Ctrl-C 打断」（信号退出不触发 'exit' 事件）。
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { VISUAL_FIXTURES } from './fixture-assets.mjs'

/** 只有这五张图会被拦截；站点其它图片一律放行 */
const INTERCEPT_PATTERN = '*visual-tests/*.svg'

/** 被这些信号打断时用 128+n 的惯例退出码，和 shell 的预期一致 */
const SIGNAL_EXIT_CODES = [
  ['SIGINT', 130],
  ['SIGTERM', 143],
  ['SIGHUP', 129],
]

/**
 * 把素材释放到独立临时目录。
 *
 * 返回的 `files` 是 `Map<请求路径, 磁盘绝对路径>`，拦截时按 URL 的 pathname 查表。
 */
export function materializeFixtures() {
  const dir = mkdtempSync(join(tmpdir(), 'folio-visual-fixtures-'))

  const files = new Map()
  for (const fixture of VISUAL_FIXTURES) {
    const target = join(dir, fixture.name)
    writeFileSync(target, fixture.svg, 'utf8')
    files.set(fixture.route, target)
  }

  let disposed = false
  const signalHandlers = []
  const dispose = () => {
    if (disposed) return
    disposed = true
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* Chrome 可能还握着句柄；exit 兜底会再试一次不算，这里只求尽力 */
    }
  }

  // 兜底一：正常退出、未捕获异常、`process.exitCode = 1` 之后退出都会触发
  process.once('exit', dispose)

  // 兜底二：被信号打断时 Node 不会触发 'exit'（capture 要跑一分钟，Ctrl-C 很常见），
  // 所以要单独接管信号——清理完再按惯例以 128+signal 退出，不吞掉中断语义。
  for (const [signal, code] of SIGNAL_EXIT_CODES) {
    const handler = () => {
      dispose()
      process.exit(code)
    }
    process.once(signal, handler)
    signalHandlers.push([signal, handler])
  }

  return {
    dir,
    files,
    dispose: () => {
      dispose()
      for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler)
    },
    /** 便于日志与断言：本次释放了哪些文件 */
    list: () =>
      VISUAL_FIXTURES.map((fixture) => `${fixture.name} (${fixture.width}×${fixture.height})`),
  }
}

/** 同一个 client 只挂一次监听，避免重复 enable 造成重复 fulfill */
const attached = new WeakSet()

/**
 * 在 CDP 会话上开启素材拦截。
 *
 * `Fetch.enable` 只把匹配 `urlPattern` 的请求暂停；其余请求不受影响。
 * 每个被暂停的请求都必须有结局，所以「不是我们管的 URL」也要显式
 * `continueRequest`，否则页面会卡在 pending 上。
 */
export async function attachFixtureInterception(client, fixtures) {
  if (attached.has(client)) return
  attached.add(client)

  client.on('Fetch.requestPaused', async (params) => {
    const { requestId, request } = params
    try {
      const pathname = new URL(request.url).pathname
      const file = fixtures.files.get(pathname)

      if (!file) {
        await client.send('Fetch.continueRequest', { requestId })
        return
      }

      const body = readFileSync(file)
      await client.send('Fetch.fulfillRequest', {
        requestId,
        responseCode: 200,
        responsePhrase: 'OK',
        responseHeaders: [
          { name: 'Content-Type', value: 'image/svg+xml; charset=utf-8' },
          // 与 static 资源同一档语义：同一次运行内重复导航不必反复回读磁盘，
          // 但每个脚本都是全新 profile，不存在跨运行拿到旧素材的可能
          { name: 'Cache-Control', value: 'public, max-age=3600' },
          { name: 'Content-Length', value: String(body.length) },
        ],
        body: body.toString('base64'),
      })
    } catch (error) {
      // 拦截失败也要给请求一个结局，否则整页图片会一直挂着
      console.error('visual fixture interception failed:', error.message)
      try {
        await client.send('Fetch.continueRequest', { requestId })
      } catch {
        /* 请求可能已经被取消 */
      }
    }
  })

  await client.send('Fetch.enable', {
    patterns: [{ urlPattern: INTERCEPT_PATTERN, requestStage: 'Request' }],
  })
}

/**
 * 解除拦截（可选）。
 *
 * 脚本一般在关闭标签页/进程时自然结束，不需要显式调用；
 * 但同一 client 上要切到「不要素材」的场景时可以用它。
 */
export async function detachFixtureInterception(client) {
  if (!attached.has(client)) return
  attached.delete(client)
  try {
    await client.send('Fetch.disable')
  } catch {
    /* 会话可能已经断开 */
  }
}
