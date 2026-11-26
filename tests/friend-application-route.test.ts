import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCapability: vi.fn(),
  apply: vi.fn(),
  isFeatureEnabled: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  getFriendLinkApplicationCapability: mocks.getCapability,
  applyForFriendLink: mocks.apply,
}))

vi.mock('@/core/registry/features', () => ({
  isFeatureEnabled: mocks.isFeatureEnabled,
}))

import { GET, POST } from '@/app/api/friends/apply/route'
import { ApiError } from '@/lib/api/errors'
import { getMockMutation, getMockResponse } from '@/lib/api/mock/handlers'

const validApplication = {
  author: 'Miao',
  name: 'Folio',
  url: 'https://example.com',
  avatar: 'https://example.com/avatar.png',
  email: 'miao@example.com',
  description: 'A personal site',
}

function requestWithBody(body: unknown): Request {
  return new Request('http://localhost/api/friends/apply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  mocks.getCapability.mockReset().mockResolvedValue({ canApply: true })
  mocks.apply.mockReset().mockResolvedValue(undefined)
  mocks.isFeatureEnabled.mockReset().mockReturnValue(true)
})

describe('/api/friends/apply', () => {
  it('returns the upstream application capability', async () => {
    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', canApply: true })
    expect(mocks.getCapability).toHaveBeenCalledOnce()
  })

  it('does not call Core when the friends feature is disabled', async () => {
    mocks.isFeatureEnabled.mockReturnValue(false)

    const response = await GET()

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ status: 'error', reason: 'closed' })
    expect(mocks.getCapability).not.toHaveBeenCalled()
  })

  it('rejects non-HTTPS URLs before proxying the application', async () => {
    const response = await POST(requestWithBody({ ...validApplication, url: 'http://example.com' }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'error', reason: 'invalid' })
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it('trims and proxies validated fields', async () => {
    const response = await POST(
      requestWithBody({
        ...validApplication,
        author: '  Miao  ',
        name: '  Folio  ',
        url: '  https://example.com  ',
        avatar: '  https://example.com/avatar.png  ',
        email: '  miao@example.com  ',
        description: '  A personal site  ',
      }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })
    expect(mocks.apply).toHaveBeenCalledWith({
      author: 'Miao',
      name: 'Folio',
      url: 'https://example.com',
      avatar: 'https://example.com/avatar.png',
      email: 'miao@example.com',
      description: 'A personal site',
    })
  })

  it('accepts the Core schema maximum lengths', async () => {
    const applicationAtLimits = {
      author: 'a'.repeat(20),
      name: 'n'.repeat(20),
      url: 'https://example.com',
      avatar: `https://example.com/${'a'.repeat(180)}`,
      email: `${'a'.repeat(38)}@example.com`,
      description: 'd'.repeat(50),
    }

    const response = await POST(requestWithBody(applicationAtLimits))

    expect(response.status).toBe(200)
    expect(mocks.apply).toHaveBeenCalledWith(applicationAtLimits)
  })

  it.each([
    ['applicant name', { author: 'a'.repeat(21) }],
    ['site name', { name: 'n'.repeat(21) }],
    ['empty avatar URL', { avatar: '' }],
    ['email', { email: `${'a'.repeat(39)}@example.com` }],
    ['avatar URL', { avatar: `https://example.com/${'a'.repeat(181)}` }],
    ['description', { description: 'd'.repeat(51) }],
  ])('rejects a %s beyond the Core schema limit', async (_field, patch) => {
    const response = await POST(requestWithBody({ ...validApplication, ...patch }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ status: 'error', reason: 'invalid' })
    expect(mocks.apply).not.toHaveBeenCalled()
  })

  it('reports an upstream closed application as a closed state', async () => {
    mocks.apply.mockRejectedValue(
      new ApiError('application closed', { status: 403, path: '/links/audit' }),
    )

    const response = await POST(requestWithBody(validApplication))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ status: 'error', reason: 'closed' })
  })

  it('supports capability checks and valid submissions in mock mode', () => {
    expect(getMockResponse('/links/audit', new URLSearchParams())).toEqual({
      status: 200,
      body: { can: true },
    })
    expect(getMockMutation('/links/audit', validApplication)).toEqual({
      status: 200,
      body: { ok: 1, data: null },
    })
  })
})
