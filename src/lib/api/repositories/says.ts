import type { V2SayList } from '../contracts/v2/say'
import type { Say } from '../domain/say'
import type { PageResult } from '../domain/common'
import { adaptSay } from '../adapters/say'
import { requestV2 } from '../client/http'

function adaptPagination(raw: V2SayList['pagination']): PageResult<Say>['pagination'] {
  return {
    page: raw.current_page,
    size: raw.size,
    total: raw.total,
    totalPages: raw.total_page,
    hasNext: raw.has_next_page,
    hasPrev: raw.has_prev_page,
  }
}

export async function listSays(page = 1, size = 50): Promise<PageResult<Say>> {
  const raw = await requestV2<V2SayList>('/says', {
    query: { page, size },
    tags: ['says'],
  })
  return {
    items: raw.data.map(adaptSay),
    pagination: adaptPagination(raw.pagination),
  }
}
