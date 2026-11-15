import type { V2Project } from '../contracts/v2/project'
import type { Project } from '../domain/project'

export function adaptProject(raw: V2Project): Project {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    previewUrl: raw.preview_url ?? null,
    docUrl: raw.doc_url ?? null,
    projectUrl: raw.project_url,
    images: raw.images ?? [],
    avatar: raw.avatar ?? null,
    text: raw.text ?? '',
    createdAt: raw.created_at,
  }
}
