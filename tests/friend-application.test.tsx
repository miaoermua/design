// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FriendApplication } from '@/features/friends/friend-application'
import type { SiteIdentity } from '@/lib/api'

const SITE_IDENTITY: SiteIdentity = {
  title: 'Example Site',
  description: 'A personal site',
  keywords: [],
  icon: 'https://example.com/icon.png',
  siteUrl: 'https://example.com',
  owner: {
    name: 'Example Owner',
    introduce: null,
    avatar: 'https://example.com/avatar.png',
    socialIds: {},
  },
  commentsEnabled: true,
  latestDiaryId: null,
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'clipboard')
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('FriendApplication', () => {
  it('opens an accessible dialog and submits the completed application', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'POST') return jsonResponse({ status: 'ok' })
      return jsonResponse({ status: 'ok', canApply: true })
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<FriendApplication siteIdentity={SITE_IDENTITY} />)
    fireEvent.click(await screen.findByRole('button', { name: '和我做朋友吧!' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe(
      screen.getByRole('heading', { name: '我想和你交朋友!' }).id,
    )

    fireEvent.change(screen.getByLabelText('昵称 *'), { target: { value: 'Miao' } })
    fireEvent.change(screen.getByLabelText('站点标题 *'), { target: { value: 'Folio' } })
    fireEvent.change(screen.getByLabelText('网站 *'), {
      target: { value: 'https://example.com' },
    })
    fireEvent.change(screen.getByLabelText('头像链接 *'), {
      target: { value: 'https://example.com/avatar.png' },
    })
    fireEvent.change(screen.getByLabelText('留下你的邮箱哦 *'), {
      target: { value: 'miao@example.com' },
    })
    fireEvent.change(screen.getByLabelText('一句话描述一下自己吧 *'), {
      target: { value: 'A personal site' },
    })

    const form = dialog.querySelector('form')
    if (!form) throw new Error('friend application form is missing')
    fireEvent.submit(form)

    expect(await screen.findByText('申请已提交，审核结果将由站长处理。')).toBeTruthy()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/friends/apply',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          author: 'Miao',
          name: 'Folio',
          url: 'https://example.com',
          avatar: 'https://example.com/avatar.png',
          email: 'miao@example.com',
          description: 'A personal site',
        }),
      }),
    )
  })

  it('shows the closed state without rendering an application button', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ status: 'ok', canApply: false })),
    )

    render(<FriendApplication siteIdentity={SITE_IDENTITY} />)

    expect(await screen.findByText('当前暂不接受友链申请。')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '和我做朋友吧!' })).toBeNull()
  })

  it('copies this site as an MX friend-link payload', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ status: 'ok', canApply: true })),
    )

    render(<FriendApplication siteIdentity={SITE_IDENTITY} />)

    fireEvent.click(await screen.findByRole('button', { name: '复制本站友链信息' }))

    expect(writeText).toHaveBeenCalledWith(
      JSON.stringify(
        {
          author: 'Example Owner',
          name: 'Example Site',
          url: 'https://example.com',
          avatar: 'https://example.com/avatar.png',
          description: 'A personal site',
        },
        null,
        2,
      ),
    )
    expect(await screen.findByText('已复制 MX 友链数据，可粘贴到你的友链配置中。')).toBeTruthy()
  })

  it('falls back to the MX site icon when the owner avatar is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ status: 'ok', canApply: true })),
    )

    const siteWithoutOwnerAvatar: SiteIdentity = {
      ...SITE_IDENTITY,
      owner: { ...SITE_IDENTITY.owner, avatar: null },
    }
    render(<FriendApplication siteIdentity={siteWithoutOwnerAvatar} />)

    fireEvent.click(await screen.findByRole('button', { name: '复制本站友链信息' }))

    expect(writeText).toHaveBeenCalledWith(
      JSON.stringify(
        {
          author: 'Example Owner',
          name: 'Example Site',
          url: 'https://example.com',
          avatar: 'https://example.com/icon.png',
          description: 'A personal site',
        },
        null,
        2,
      ),
    )
  })
})
