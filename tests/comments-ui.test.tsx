// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommentItem, CommentPage } from '@/lib/api/domain/comment'

/**
 * 评论区（服务端块 + 客户端容器）
 *
 * 服务端块的职责只有「读开关 + 取第一页 + 失败降级」，
 * 客户端容器的职责是「表单 / 分页 / 排序 / 长线程补页」。
 * 两边都不负责渲染整页，因此这里可以直接挂载，不需要完整 App Router 环境。
 */

const api = vi.hoisted(() => ({
  comments: true,
  options: { disabled: false, allowGuest: true },
  firstPageError: null as Error | null,
  firstPage: null as unknown,
  listCalls: 0,
}))

vi.mock('@/core/registry/features', () => ({
  isFeatureEnabled: (key: string) => (key === 'comments' ? api.comments : true),
}))

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    getCommentOptions: async () => api.options,
    getSiteTimezone: () => 'Asia/Shanghai',
    listComments: async () => {
      api.listCalls += 1
      if (api.firstPageError) throw api.firstPageError
      return api.firstPage
    },
  }
})

const { CommentsSection } = await import('@/features/comments')
const { CommentsThread } = await import('@/features/comments/components/comments-thread')

function item(over: Partial<CommentItem> = {}): CommentItem {
  return {
    id: '1',
    text: '第一条评论',
    createdAt: '2026-01-02T03:04:05.000Z',
    author: { name: '喵二', avatar: null, url: null },
    pinned: false,
    parentId: null,
    replyCount: 0,
    hiddenCount: 0,
    nextCursor: null,
    replies: [],
    ...over,
  }
}

function page(over: Partial<CommentPage> = {}): CommentPage {
  return { items: [], total: 0, page: 1, totalPages: 1, hasNext: false, ...over }
}

/** 记录请求（含方法/请求体），按 URL 决定返回体；返回 `ok:false` 表示 HTTP 层失败 */
function stubFetch(handler: (url: string, init?: RequestInit) => unknown | null) {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, init })
    const body = handler(url, init)
    if (body === null) return { ok: false, json: async () => ({}) } as Response
    return { ok: true, json: async () => body } as Response
  })
  vi.stubGlobal('fetch', fn)
  return calls
}

function fillForm(value = { author: '喵二', mail: 'a@b.co', text: '写得不错' }) {
  fireEvent.change(screen.getByLabelText('昵称'), { target: { value: value.author } })
  fireEvent.change(screen.getByLabelText('邮箱（不公开）'), { target: { value: value.mail } })
  fireEvent.change(screen.getByLabelText('评论', { selector: 'textarea' }), {
    target: { value: value.text },
  })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  api.comments = true
  api.options = { disabled: false, allowGuest: true }
  api.firstPageError = null
  api.firstPage = page()
  api.listCalls = 0
  window.localStorage.clear()
})

async function renderSection(refId = '42') {
  const ui = await CommentsSection({ refId })
  return render(ui)
}

describe('CommentsSection（服务端块）', () => {
  it('站点关闭评论时给一条说明，且不去取评论列表', async () => {
    api.options = { disabled: true, allowGuest: false }
    await renderSection()

    expect(screen.getByText(/本站已关闭评论/)).toBeTruthy()
    expect(api.listCalls).toBe(0)
    // 关闭时不展示任何可提交入口
    expect(screen.queryByRole('button', { name: '发表评论' })).toBeNull()
  })

  it('取数失败只降级这一块，不抛到页面', async () => {
    api.firstPageError = new Error('core 502')
    await renderSection()

    expect(screen.getByText('评论加载失败，稍后刷新可重试。')).toBeTruthy()
  })

  it('功能开关关闭时整块不渲染', async () => {
    api.comments = false
    const ui = await CommentsSection({ refId: '42' })
    expect(ui).toBeNull()
  })

  it('有评论时首屏直接带出标题、总数与列表', async () => {
    api.firstPage = page({ items: [item()], total: 1 })
    await renderSection()

    expect(screen.getByRole('heading', { name: /评论/ })).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('第一条评论')).toBeTruthy()
    expect(screen.getByText('喵二')).toBeTruthy()
  })

  it('空评论区不显示排序控件，只留一句邀请，输入区仍然在', async () => {
    await renderSection()

    expect(screen.getByText('还没有评论，留下第一条。')).toBeTruthy()
    expect(screen.queryByRole('group', { name: '评论排序' })).toBeNull()
    expect(screen.getByRole('button', { name: '发表评论' })).toBeTruthy()
  })

  it('站点不接受匿名时不给表单，只给一句说明', async () => {
    api.options = { disabled: false, allowGuest: false }
    api.firstPage = page({ items: [item()], total: 1 })
    await renderSection()

    expect(screen.getByText(/本站当前不接受匿名评论/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '发表评论' })).toBeNull()
    expect(screen.queryByRole('button', { name: '回复' })).toBeNull()
  })
})

describe('CommentsThread（客户端容器）', () => {
  function mount(initial: CommentPage, allowGuest = true) {
    return render(
      <CommentsThread
        refId="42"
        timeZone="Asia/Shanghai"
        allowGuest={allowGuest}
        initial={initial}
      />,
    )
  }

  it('版面顺序：标题 → 输入区 → 列表（输入区不被长列表推到屏幕外）', () => {
    const { container } = mount(page({ items: [item()], total: 1 }))

    const composer = container.querySelector('.comment-composer')
    const list = container.querySelector('.comments__list')
    expect(composer).not.toBeNull()
    expect(list).not.toBeNull()

    // Node.DOCUMENT_POSITION_FOLLOWING = 4
    expect(composer!.compareDocumentPosition(list!) & 4).toBe(4)
  })

  it('分页：点「加载更多评论」取下一页并追加，不清掉已有内容', async () => {
    const calls = stubFetch((url) =>
      url.includes('page=2')
        ? page({ items: [item({ id: '2', text: '第二条' })], total: 2 })
        : page(),
    )

    mount(page({ items: [item()], total: 2, hasNext: true }))
    fireEvent.click(screen.getByRole('button', { name: '加载更多评论' }))

    await waitFor(() => expect(screen.getByText('第二条')).toBeTruthy())
    expect(screen.getByText('第一条评论')).toBeTruthy()
    expect(calls[0].url).toContain('/api/comments?')
    expect(calls[0].url).toContain('page=2')
    expect(calls[0].url).toContain('sort=pinned')
    // 取完最后一页后按钮消失
    expect(screen.queryByRole('button', { name: '加载更多评论' })).toBeNull()
  })

  it('分页失败时保留旧内容并给出可重试提示', async () => {
    stubFetch(() => null)

    mount(page({ items: [item()], total: 2, hasNext: true }))
    fireEvent.click(screen.getByRole('button', { name: '加载更多评论' }))

    await waitFor(() => expect(screen.getByText('加载失败，请稍后再试')).toBeTruthy())
    expect(screen.getByText('第一条评论')).toBeTruthy()
  })

  it('长线程：按根评论游标补回中间回复，补完不再提示还有多少条', async () => {
    const calls = stubFetch((url) => {
      if (url.includes('/api/comments/thread')) {
        return {
          items: [item({ id: '9', parentId: '1', text: '补回来的中间回复' })],
          remaining: 0,
          nextCursor: null,
        }
      }
      return page()
    })

    mount(page({ items: [item({ replyCount: 5, hiddenCount: 3, nextCursor: 'c1' })], total: 1 }))
    fireEvent.click(screen.getByRole('button', { name: '还有 3 条回复' }))

    await waitFor(() => expect(screen.getByText('补回来的中间回复')).toBeTruthy())
    expect(calls[0].url).toContain('rootId=1')
    expect(calls[0].url).toContain('cursor=c1')
    expect(screen.queryByRole('button', { name: /还有 \d+ 条回复/ })).toBeNull()
  })

  it('长线程补页没有进展时收掉入口，不留下无限请求的死循环', async () => {
    const calls = stubFetch((url) => {
      if (url.includes('/api/comments/thread')) {
        return { items: [], remaining: 3, nextCursor: 'c1' }
      }
      return page()
    })

    mount(page({ items: [item({ hiddenCount: 3, nextCursor: 'c1' })], total: 1 }))
    fireEvent.click(screen.getByRole('button', { name: '还有 3 条回复' }))

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /还有 \d+ 条回复/ })).toBeNull(),
    )
    expect(calls).toHaveLength(1)
  })

  it('长线程补页失败只提示，不影响已显示的回复', async () => {
    stubFetch(() => null)

    mount(page({ items: [item({ hiddenCount: 2, nextCursor: 'c1' })], total: 1 }))
    fireEvent.click(screen.getByRole('button', { name: '还有 2 条回复' }))

    await waitFor(() => expect(screen.getByText('回复加载失败，请稍后再试')).toBeTruthy())
    expect(screen.getByText('第一条评论')).toBeTruthy()
  })

  it('排序：切换后重新取第一页，按钮状态跟随', async () => {
    const calls = stubFetch(() =>
      page({ items: [item({ id: '3', text: '最早的评论' })], total: 1 }),
    )

    mount(page({ items: [item()], total: 3 }))
    fireEvent.click(screen.getByRole('button', { name: '最早' }))

    await waitFor(() => expect(screen.getByText('最早的评论')).toBeTruthy())
    expect(calls[0].url).toContain('sort=oldest')
    expect(calls[0].url).toContain('page=1')
    expect(screen.getByRole('button', { name: '最早' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('切换排序失败时给出提示，不把列表清空', async () => {
    stubFetch(() => null)

    mount(page({ items: [item()], total: 3 }))
    fireEvent.click(screen.getByRole('button', { name: '最新' }))

    await waitFor(() => expect(screen.getByText('切换排序失败，请稍后再试')).toBeTruthy())
    expect(screen.getByText('第一条评论')).toBeTruthy()
  })
})

describe('评论表单', () => {
  function mount() {
    return render(
      <CommentsThread refId="42" timeZone="Asia/Shanghai" allowGuest initial={page()} />,
    )
  }

  it('输入不合法时就地拦下，不发请求', async () => {
    const calls = stubFetch(() => ({ status: 'ok' }))

    mount()
    fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '喵二' } })
    fireEvent.change(screen.getByLabelText('邮箱（不公开）'), { target: { value: 'a@b.co' } })
    fireEvent.submit(screen.getByRole('button', { name: '发表评论' }).closest('form')!)

    expect(screen.getByRole('status').textContent).toBe('请写点什么')
    expect(calls).toHaveLength(0)
  })

  it('提交成功统一提示「评论已提交」，不顺带推断审核状态', async () => {
    const calls = stubFetch((_url, init) =>
      init?.method === 'POST' ? { status: 'ok' } : page({ items: [item()], total: 1 }),
    )

    mount()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '发表评论' }))

    await waitFor(() => expect(screen.getByText('评论已提交')).toBeTruthy())
    expect(document.body.textContent).not.toContain('审核')

    const post = calls.find((call) => call.init?.method === 'POST')
    expect(post).toBeTruthy()
    const body = JSON.parse(String(post?.init?.body)) as Record<string, string>
    expect(body).toMatchObject({ refId: '42', author: '喵二', mail: 'a@b.co', text: '写得不错' })
  })

  it('提交中禁用按钮：连点两次也只发一条', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const calls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          calls.push('POST')
          await gate
          return { ok: true, json: async () => ({ status: 'ok' }) } as Response
        }
        return { ok: true, json: async () => page() } as Response
      }),
    )

    mount()
    fillForm()
    const submit = screen.getByRole('button', { name: /发表评论|提交中/ })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(submit.hasAttribute('disabled')).toBe(true)
    release()
    await waitFor(() => expect(screen.getByText('评论已提交')).toBeTruthy())
    expect(calls).toHaveLength(1)
  })

  it('服务端拒绝时用映射后的文案，不暴露上游响应', async () => {
    stubFetch((_url, init) =>
      init?.method === 'POST' ? { status: 'error', reason: 'guest-blocked' } : page(),
    )

    mount()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '发表评论' }))

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('不接受匿名评论'))
    expect(screen.queryByText(/upstream/)).toBeNull()
  })

  it('只记昵称与网址：邮箱不写进 localStorage', async () => {
    stubFetch((_url, init) => (init?.method === 'POST' ? { status: 'ok' } : page()))

    mount()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '发表评论' }))
    await waitFor(() => expect(screen.getByText('评论已提交')).toBeTruthy())

    const stored = window.localStorage.getItem('folio-comment-identity') ?? ''
    expect(stored).toContain('喵二')
    expect(stored).not.toContain('a@b.co')
  })
})

describe('回复', () => {
  it('回复表单写明回复对象，并带上 parentId', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'POST' ? { status: 'ok' } : page()))

    render(
      <CommentsThread
        refId="42"
        timeZone="Asia/Shanghai"
        allowGuest
        initial={page({ items: [item({ replyCount: 1, hiddenCount: 1 })], total: 1 })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '回复' }))

    // 标题写明回给谁，和「取消回复」一起出现
    expect(screen.getByText('回复 喵二', { selector: '.comment-composer__title' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '取消回复' })).toBeTruthy()

    const replyForm = screen.getByRole('form', { name: /^回复/ })
    fireEvent.change(within(replyForm).getByLabelText('昵称'), { target: { value: '喵二' } })
    fireEvent.change(within(replyForm).getByLabelText('邮箱（不公开）'), {
      target: { value: 'a@b.co' },
    })
    fireEvent.change(within(replyForm).getByLabelText('评论', { selector: 'textarea' }), {
      target: { value: '回你一句' },
    })
    fireEvent.click(within(replyForm).getByRole('button', { name: '回复' }))

    const post = calls.find((call) => call.init?.method === 'POST')
    expect(post?.url).toContain('/api/comments/reply')
    expect(JSON.parse(String(post?.init?.body))).toMatchObject({ parentId: '1' })
  })

  it('取消回复后表单收起', () => {
    render(
      <CommentsThread
        refId="42"
        timeZone="Asia/Shanghai"
        allowGuest
        initial={page({ items: [item()], total: 1 })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '回复' }))
    expect(
      within(screen.getByRole('form', { name: /^回复/ })).getByLabelText('评论', {
        selector: 'textarea',
      }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '取消回复' }))
    expect(screen.queryByRole('form', { name: /^回复/ })).toBeNull()
  })
})
