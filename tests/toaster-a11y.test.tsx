// @vitest-environment jsdom
/**
 * 通知渲染层的无障碍契约（Sonner 适配后）
 *
 * 迁移前这组测试直接断言 `<Toaster>` 的输出；迁移后被测对象变成
 * `<SonnerToaster>`，但**断言的行为一条都没少**：
 *   1. 空队列不留活动的 live region；
 *   2. 非紧急（info/success）走 `role="status"` + `aria-live="polite"`；
 *   3. 紧急（warning/error）走 `role="alert"` + `aria-live="assertive"`；
 *   4. 容器是可命名的 region；
 *   5. 多条并存时各自带自己的 role。
 *
 * 另外新增两条只有 Sonner 化之后才存在的问题：
 *   6. 外层 <section> 的 `aria-live` 必须被关掉（否则与卡片自身的实时区
 *      叠加，一条通知被播报两次，warning/error 的紧急度还会被 polite 稀释）；
 *   7. 队列清空后整棵组件要卸载，不长期保留那个空的 section。
 *
 * Sonner 的 toast 状态是模块级的，测试之间会串，因此每个用例结束时要把
 * 队列清空并等一个退场周期（Sonner 内部 200ms 才把条目从状态里移除）。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SonnerToaster } from '@/components/ui/sonner-toaster'
import { notificationStore } from '@/lib/notifications/store'

/** 比 Sonner 的 200ms 清场稍长，确保下个用例不会看到上一条残留 */
const SETTLE_MS = 350

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

async function settle() {
  notificationStore.clear()
  await act(async () => {
    await sleep(SETTLE_MS)
  })
}

beforeEach(() => {
  notificationStore.clear()
})

afterEach(async () => {
  await settle()
  cleanup()
})

describe('通知：空队列', () => {
  it('不渲染任何节点，也不留空的 live region', () => {
    const { container } = render(<SonnerToaster />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
    expect(document.querySelector('[aria-live="polite"]')).toBeNull()
    expect(document.querySelector('[aria-live="assertive"]')).toBeNull()
  })

  it('最后一条关闭后整棵卸载（不留 Sonner 的空 section）', async () => {
    notificationStore.notify({ level: 'info', title: '短暂提示' })
    const { container } = render(<SonnerToaster />)
    await waitFor(() => expect(container.querySelector('[data-sonner-toast]')).not.toBeNull())

    notificationStore.clear()
    // 退场动画期间仍挂载，这是有意的（否则最后一条会瞬间消失）
    await waitFor(() => expect(container.firstChild).toBeNull(), { timeout: SETTLE_MS + 400 })
  })
})

describe('通知：非紧急提示', () => {
  it('info 用 role="status" + aria-live="polite"', async () => {
    notificationStore.notify({ level: 'info', title: '已保存' })
    render(<SonnerToaster />)

    const item = await screen.findByRole('status')
    expect(item.getAttribute('aria-live')).toBe('polite')
    expect(item.textContent).toContain('已保存')
  })

  it('success 同样走 polite', async () => {
    notificationStore.notify({ level: 'success', title: '订阅成功' })
    render(<SonnerToaster />)

    const item = await screen.findByRole('status')
    expect(item.getAttribute('aria-live')).toBe('polite')
  })
})

describe('通知：紧急提示', () => {
  it('error 用 role="alert" + aria-live="assertive"', async () => {
    notificationStore.notify({ level: 'error', title: '网络异常' })
    render(<SonnerToaster />)

    const item = await screen.findByRole('alert')
    expect(item.getAttribute('aria-live')).toBe('assertive')
    expect(item.textContent).toContain('网络异常')
  })

  it('warning 同样走 assertive', async () => {
    notificationStore.notify({ level: 'warning', title: '内容未发布' })
    render(<SonnerToaster />)

    const item = await screen.findByRole('alert')
    expect(item.getAttribute('aria-live')).toBe('assertive')
  })

  it('多条并存时各自带自己的 role，不会串味', async () => {
    notificationStore.notify({ level: 'info', title: '普通' })
    notificationStore.notify({ level: 'error', title: '出错' })
    render(<SonnerToaster />)

    await waitFor(() => {
      expect(screen.getAllByRole('status')).toHaveLength(1)
      expect(screen.getAllByRole('alert')).toHaveLength(1)
    })
  })
})

describe('通知：容器语义', () => {
  it('容器是带 aria-label 的 region，逐条提示挂在里面', async () => {
    notificationStore.notify({ level: 'info', title: '第一条' })
    render(<SonnerToaster />)

    const region = await screen.findByRole('region')
    expect(region.getAttribute('aria-label')).toBeTruthy()
    expect(region.contains(await screen.findByRole('status'))).toBe(true)
  })

  it('外层 live region 被关掉，避免与卡片自身的实时区重复播报', async () => {
    // 标题必须与其他用例不同：store 的去重表跨用例保留 5 秒
    notificationStore.notify({ level: 'error', title: '播报级别检查' })
    render(<SonnerToaster />)
    await screen.findByRole('alert')

    /*
     * Sonner 把 aria-live="polite" 硬编码在 <section> 上。若保留，读屏会把
     * 同一条内容播报两次（外层 polite + 内层 alert）。这里断言它已被置为 off。
     */
    const section = document.querySelector('section')
    expect(section).not.toBeNull()
    expect(section?.getAttribute('aria-live')).toBe('off')
    // 卡片自身的断言不受影响
    expect(screen.getByRole('alert').getAttribute('aria-live')).toBe('assertive')
  })
})

describe('通知：内容与交互', () => {
  it('四段内容齐全：级别标签、标题、描述、action 链接', async () => {
    notificationStore.notify({
      level: 'warning',
      title: '文章已失效',
      description: '刚才那篇已经不在列表里了',
      action: { label: '回到文章列表', href: '/articles' },
    })
    render(<SonnerToaster />)

    const card = await screen.findByRole('alert')
    expect(card.textContent).toContain('注意')
    expect(card.textContent).toContain('文章已失效')
    expect(card.textContent).toContain('刚才那篇已经不在列表里了')

    const link = within(card).getByRole('link', { name: '回到文章列表' })
    expect(link.getAttribute('href')).toBe('/articles')
  })

  it('关闭按钮有可访问名称，点击后从队列移除', async () => {
    notificationStore.notify({ level: 'info', title: '可关闭' })
    render(<SonnerToaster />)

    const card = await screen.findByRole('status')
    const close = within(card).getByRole('button', { name: /关闭/ })

    await act(async () => {
      close.click()
    })

    expect(notificationStore.getSnapshot()).toHaveLength(0)
  })

  it('常驻通知（durationMs: 0）不会自己消失', async () => {
    notificationStore.notify({ level: 'warning', title: '需要你处理', durationMs: 0 })
    render(<SonnerToaster />)

    await screen.findByRole('alert')
    await act(async () => {
      await sleep(50)
    })
    expect(notificationStore.getSnapshot()).toHaveLength(1)
  })
})

describe('通知：队列策略在渲染层的体现', () => {
  it('最多同时渲染 3 条（第 4 条挤掉最旧的非 error）', async () => {
    notificationStore.notify({ level: 'info', title: 'a' })
    notificationStore.notify({ level: 'info', title: 'b' })
    notificationStore.notify({ level: 'error', title: 'c' })
    notificationStore.notify({ level: 'info', title: 'd' })

    render(<SonnerToaster />)

    await waitFor(() => {
      expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(3)
    })
    const text = document.body.textContent ?? ''
    expect(text).not.toContain('a')
    expect(text).toContain('b')
    expect(text).toContain('c')
    expect(text).toContain('d')
  })

  it('相同标题在去重窗口内只渲染一条', async () => {
    notificationStore.notify({ level: 'error', title: '连接失败' })
    notificationStore.notify({ level: 'error', title: '连接失败' })

    render(<SonnerToaster />)

    await waitFor(() => {
      expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(1)
    })
  })
})

/*
 * ── 层级与布局 ────────────────────────────────────────────────────
 *
 * 这组不是无障碍，而是「迁移后最容易悄悄坏掉」的视觉契约。
 * Sonner 默认 z-index 是 999999999，而 Folio 的模态分布在 30–90 之间；
 * 一旦漏掉覆盖，通知会压住对话框——而那只有真实浏览器 + 具体交互才看得见。
 * 这里退一步，直接钉住源码里的层级声明、挂载位置与几个必要属性。
 */

const Z_40 = new RegExp('z-index:\\s*40')
const Z_30_TOOLBAR = new RegExp('\\.toolbar-dock[\\s\\S]{0,700}?z-index:\\s*30')
const WIDTH_RULE = new RegExp('\\[data-sonner-toast\\][\\s\\S]{0,240}?width:\\s*min\\(24rem')
const OFFSET_DESKTOP = new RegExp('bottom:\\s*24 \\+ \\(capsuleVisible')
const OFFSET_MOBILE = new RegExp('bottom:\\s*16 \\+ \\(capsuleVisible')

describe('通知：层级与挂载位置', () => {
  const css = read('src/design-system/styles/sonner.css')
  const layout = read('src/app/layout.tsx')
  const globals = read('src/app/globals.css')

  it('通知层被压到 40，低于搜索面板(50)、预览(80)、对话框(90)', () => {
    expect(Z_40.test(css)).toBe(true)
    /*
     * 只断言「没有把它声明成 z-index」，而不是全文不含这个数字：
     * 文件头注释里会解释「Sonner 默认 999999999，必须覆盖」，那是对照说明。
     */
    expect(new RegExp('z-index:////s*999999999').test(css)).toBe(false)
  })

  it('工具浮标降到 30，不与通知抢同一层', () => {
    /*
     * 浮标原本 z=50，与搜索面板同值。通知压到 40 后，浮标会浮在通知之上，
     * 实测三条堆叠时圆圈按钮正好压在中间那条的文字上。
     */
    expect(Z_30_TOOLBAR.test(globals)).toBe(true)
  })

  it('通知与胶囊挂在 .site-shell 内部，而非外部', () => {
    /*
     * `.site-shell` 有 position:relative + z-index:1，自成层叠上下文。
     * 模态都在它内部，其 z-index 只是「内部排名」，对外整体只是 1。
     * 通知若挂在外部（z=40 > 1），会盖住所有模态。
     */
    const shellStart = layout.indexOf('site-shell')
    const sonnerAt = layout.indexOf('<SonnerToaster')
    const imageViewerAt = layout.indexOf('<ImageViewer')

    expect(shellStart).toBeGreaterThan(-1)
    expect(sonnerAt).toBeGreaterThan(shellStart)
    // 通知在 shell 内：位于 <ImageViewer>（shell 之后）之前
    expect(sonnerAt).toBeLessThan(imageViewerAt)
  })

  it('胶囊出现时通知整体上移（两个 offset 都算上）', () => {
    const toaster = read('src/components/ui/sonner-toaster.tsx')
    expect(toaster).toContain('CAPSULE_CLEARANCE')
    expect(toaster).toContain('capsuleVisible')
    expect(OFFSET_DESKTOP.test(toaster)).toBe(true)
    expect(OFFSET_MOBILE.test(toaster)).toBe(true)
  })

  it('自定义 JSX 路径必须自己给宽度', () => {
    /*
     * `width: var(--width)` 写在 Sonner 的 `[data-styled=true]` 规则里，
     * 而自定义 JSX 的条目是 `data-styled="false"`。实测漏掉这条时 li 会
     * shrink-to-fit 到 153px，卡片被挤成窄条。
     */
    expect(WIDTH_RULE.test(css)).toBe(true)
  })
})
