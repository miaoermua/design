/** 项目展示 — 前端领域模型 */
export interface Project {
  id: string
  name: string
  description: string
  previewUrl: string | null
  docUrl: string | null
  projectUrl: string
  images: string[]
  avatar: string | null
  text: string
  createdAt: string
}
