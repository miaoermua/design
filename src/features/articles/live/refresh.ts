/**
 * 文章详情的「核对一次」客户端实现
 *
 * 只负责把 controller 的请求送到 BFF，并把结果收敛成 `RefreshOutcome`。
 * 这里不解析正文、不缓存结果：即使服务端返回了文章对象，也不进入页面。
 */

import type { RefreshOutcome, RefreshRequest } from './controller'

const ENDPOINT = '/api/articles/live'

function toOutcome(value: unknown): RefreshOutcome {
  if (typeof value !== 'object' || value === null) return { status: 'error' }
  const record = value as Record<string, unknown>

  switch (record.status) {
    case 'updated':
      return { status: 'updated' }
    case 'unchanged':
      return { status: 'unchanged' }
    case 'gone':
      return { status: 'gone' }
    case 'moved':
      // 路径来自服务端，但仍然是网络输入：只接受站内文章路径
      return typeof record.path === 'string' && /^\/articles\/[^/]+\/[^/]+$/.test(record.path)
        ? { status: 'moved', path: record.path }
        : { status: 'error' }
    default:
      return { status: 'error' }
  }
}

export async function requestArticleRefresh(request: RefreshRequest): Promise<RefreshOutcome> {
  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(request),
      cache: 'no-store',
    })

    if (!response.ok) return { status: 'error' }
    return toOutcome(await response.json())
  } catch {
    return { status: 'error' }
  }
}
