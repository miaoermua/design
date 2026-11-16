import type { V2ProjectList } from '../contracts/v2/project'
import type { Project } from '../domain/project'
import type { PageResult } from '../domain/common'
import { adaptProject } from '../adapters/project'
import { requestV2 } from '../client/http'

function adaptPagination(raw: V2ProjectList['pagination']): PageResult<Project>['pagination'] {
  return {
    page: raw.current_page,
    size: raw.size,
    total: raw.total,
    totalPages: raw.total_page,
    hasNext: raw.has_next_page,
    hasPrev: raw.has_prev_page,
  }
}

export async function listProjects(): Promise<PageResult<Project>> {
  const raw = await requestV2<V2ProjectList>('/projects', {
    tags: ['projects'],
  })
  return {
    items: raw.data.map(adaptProject),
    pagination: adaptPagination(raw.pagination),
  }
}
