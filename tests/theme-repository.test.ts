import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Theme Repository 的状态映射测试
 *
 * 通过 mock `requestV2` 模拟后端各种响应，验证五种状态都被正确区分。
 * 不测真实网络：那是 4D-2 的职责，这里是契约与降级逻辑。
 */

const requestMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api/client/http', () => ({
  requestV2: requestMock,
}))

const { ApiError, NetworkError, NotFoundError } = await import('@/lib/api/errors')
const { fetchThemeSnippet } = await import('@/core/config/theme/repository')

beforeEach(() => {
  requestMock.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Theme Repository：状态映射', () => {
  it('合法对象 → ok', async () => {
    requestMock.mockResolvedValue({ footer: { since: 2021 } })
    const result = await fetchThemeSnippet()
    expect(result.status).toBe('ok')
    expect(result.data).toEqual({ footer: { since: 2021 } })
  })

  it('请求路径与缓存参数正确', async () => {
    requestMock.mockResolvedValue({})
    await fetchThemeSnippet()
    const [path, options] = requestMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(path).toBe('/snippets/theme/folio')
    expect(options).toMatchObject({ revalidate: 600, tags: ['theme-config'] })
  })

  it('MX_THEME_NAME 覆盖默认名称', async () => {
    vi.stubEnv('MX_THEME_NAME', 'my-theme')
    requestMock.mockResolvedValue({})
    await fetchThemeSnippet()
    expect(requestMock.mock.calls[0]?.[0]).toBe('/snippets/theme/my-theme')
  })

  it('404 → missing（Snippet 不存在是正常状态）', async () => {
    requestMock.mockRejectedValue(new NotFoundError('Snippet 不存在', { path: '/snippets/theme/folio' }))
    const result = await fetchThemeSnippet()
    expect(result.status).toBe('missing')
    expect(result.data).toBeNull()
  })

  it('403 → forbidden（private Snippet）', async () => {
    requestMock.mockRejectedValue(
      new ApiError('snippet is private', { status: 403, path: '/snippets/theme/folio' }),
    )
    expect((await fetchThemeSnippet()).status).toBe('forbidden')
  })

  it('网络错误 → unavailable', async () => {
    requestMock.mockRejectedValue(new NetworkError('timeout', { path: '/snippets/theme/folio' }))
    expect((await fetchThemeSnippet()).status).toBe('unavailable')
  })

  it('5xx → unavailable', async () => {
    requestMock.mockRejectedValue(
      new ApiError('boom', { status: 500, path: '/snippets/theme/folio' }),
    )
    expect((await fetchThemeSnippet()).status).toBe('unavailable')
  })

  it('响应是数组 / 字符串 / null → invalid', async () => {
    for (const body of [[], 'yaml: string', null, 42]) {
      requestMock.mockResolvedValue(body)
      expect((await fetchThemeSnippet()).status).toBe('invalid')
    }
  })

  it('永不抛错', async () => {
    requestMock.mockRejectedValue(new Error('unexpected'))
    await expect(fetchThemeSnippet()).resolves.toMatchObject({ status: 'unavailable' })
  })
})
