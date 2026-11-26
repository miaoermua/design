// @vitest-environment jsdom
/**
 * 通知渲染层的契约（Sonner 原生卡片）
 *
 * 通知已统一到 Sonner：渲染用 `toast.success/warning/error/info`，不再自绘
 * JSX。因此这组测试断言的是「队列 → 画面」的映射，以及几处只有真实浏览器
 * 才看得见、但一漏就坏掉的视觉契约。
 *
 * ## 关于无障碍
 *
 * Sonner 的条目 `<li>` 上没有 role，播报只由容器 `<section>` 上硬编码的
 * `aria-live="polite"` 承担，**各等级统一 polite**。自定义卡片时代的
 * `role="alert"` + `assertive` 分级已不可达，这里不再断言它；能保住且必须
 * 守住的是「容器是可命名 region」「live region 保持开启」「关闭按钮有可访问
 * 名称」。曾经有一段把 section 的 aria-live 置为 off 的逻辑（为了给卡片的
 * 实时区让路），卡片删除后它会导致通知彻底静音，因此也一并移除，这里反向
 * 钉住。
 *
 * Sonner 的 toast 状态是模块级的，测试之间会串，因此每个用例结束时要把
 * 队列清空并等一个退场周期（Sonner 内部 200ms 才把条目从状态里移除）。
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SonnerToaster } from '@/components/ui/sonner-toaster'
import { notificationStore } from '@/lib/notifications/store'

/**
 * `SonnerToaster` 用 `useRouter` 把 action 转成站内跳转。
 *
 * jsdom 里没有 App Router 上下文，直接渲染会抛
 * `invariant expected app router to be mounted`。这里只补一个最小的
 * router 替身：被测的是「点击后有没有按 href 导航」，不是 Next 的路由实现。
 */
const { push } = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

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

/** 等第一条 toast 落到 DOM，返回它的根元素 */
async function findToast(): Promise<HTMLElement> {
  return waitFor(() => {
    const el = document.querySelector<HTMLElement>('[data-sonner-toast]')
    expect(el).not.toBeNull()
    return el!
  })
}

beforeEach(() => {
  notificationStore.clear()
  push.mockClear()
})

afterEach(async () => {
  await settle()
  cleanup()
})

describe('通知：空队列', () => {
  it('不渲染任何节点，也不留空的 live region', () => {
    const { container } = render(<SonnerToaster />)
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('section[aria-live]')).toBeNull()
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

describe('通知：容器语义', () => {
  it('容器是带 aria-label 的 region', async () => {
    notificationStore.notify({ level: 'info', title: '第一条' })
    render(<SonnerToaster />)

    const region = await screen.findByRole('region')
    expect(region.getAttribute('aria-label')).toBe('通知')
  })

  it('live region 保持开启，不再被置为 off', async () => {
    notificationStore.notify({ level: 'info', title: '播报级别检查' })
    render(<SonnerToaster />)
    await findToast()

    /*
     * 卡片时代这里断言的是 `aria-live="off"`：外层 polite 会与卡片的
     * assertive 重复播报。卡片已删除，只剩容器这一条播报通道，
     * 一旦再置 off 就等于通知完全不发声。
     */
    const section = document.querySelector('section[aria-live]')
    expect(section).not.toBeNull()
    expect(section?.getAttribute('aria-live')).toBe('polite')
  })

  it('关闭按钮有中文可访问名称', async () => {
    notificationStore.notify({ level: 'info', title: '可关闭' })
    render(<SonnerToaster />)
    await findToast()

    expect(screen.getByRole('button', { name: '关闭通知' })).toBeDefined()
  })
})

describe('通知：级别映射', () => {
  it.each(['info', 'success', 'warning', 'error'] as const)(
    '%s 保留自己的 data-type',
    async (level) => {
      notificationStore.notify({ level, title: `级别-${level}` })
      render(<SonnerToaster />)

      const toastEl = await findToast()
      expect(toastEl.getAttribute('data-type')).toBe(level)
      expect(toastEl.textContent).toContain(`级别-${level}`)
    },
  )
})

describe('通知：内容与交互', () => {
  it('action 渲染成按钮，点击后按 href 导航', async () => {
    notificationStore.notify({
      level: 'warning',
      title: '文章已失效',
      action: { label: '回到文章列表', href: '/articles' },
    })
    render(<SonnerToaster />)
    await findToast()

    const button = await screen.findByRole('button', { name: '回到文章列表' })
    await act(async () => {
      button.click()
    })
    expect(push).toHaveBeenCalledWith('/articles')
  })

  it('点击关闭按钮后从队列移除', async () => {
    notificationStore.notify({ level: 'info', title: '待关闭' })
    render(<SonnerToaster />)
    await findToast()

    await act(async () => {
      screen.getByRole('button', { name: '关闭通知' }).click()
    })

    await waitFor(() => expect(notificationStore.getSnapshot()).toHaveLength(0))
  })

  it('常驻通知（durationMs: 0）不会自己消失', async () => {
    notificationStore.notify({ level: 'warning', title: '需要你处理', durationMs: 0 })
    render(<SonnerToaster />)

    await findToast()
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
const OFFSET_DESKTOP = new RegExp('bottom:\\s*24 \\+ \\(capsuleVisible')
const OFFSET_MOBILE = new RegExp('bottom:\\s*16 \\+ \\(capsuleVisible')

describe('通知：层级与挂载位置', () => {
  const css = read('src/design-system/styles/sonner.css')
  const layout = read('src/app/layout.tsx')

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
    const globals = read('src/app/globals.css')
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
})

/*
 * ── 单轨守卫 ──────────────────────────────────────────────────────
 *
 * 通知 UI 只允许一套。曾经同时存在「自定义卡片」与「Sonner 原生卡片」，
 * 结果是卡片从未接上、却拖着一组无法通过的测试和一段会静音的 aria-live
 * 补丁。这两条断言用来防止双轨制回潮。
 */

describe('通知：只保留一套渲染', () => {
  const toaster = read('src/components/ui/sonner-toaster.tsx')

  it('渲染层不自绘 JSX', () => {
    // 只盯调用，不盯注释：文件头会说明「曾有一套卡片、没有 toast.custom」
    expect(toaster).not.toMatch(/toast\.custom\s*\(/)
  })

  it('ToastCard 组件已删除', () => {
    expect(() => read('src/components/ui/toast-card.tsx')).toThrow()
  })
})
