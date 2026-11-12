import { requestV2 } from '../client/http'
import type { V2TopicRow } from '../contracts/v2/topic'
import { unwrapListBody } from '../adapters/common'

const TAG = ['topics']

/** 顶栏选择器只需要的字段；不把 description / introduce 带进导航 */
export interface Topic {
  id: string
  name: string
  slug: string
}

function toTopic(row: V2TopicRow): Topic {
  return { id: row.id, name: row.name, slug: row.slug }
}

/** GET /topics/all —— 专栏没有分页接口，这个接口一次返回全部 */
export async function listTopics(): Promise<Topic[]> {
  const body = await requestV2<unknown>('/topics/all', {
    revalidate: 300,
    tags: TAG,
  })
  return unwrapListBody<V2TopicRow>(body, '/topics/all').map(toTopic)
}

/** 按 id 找专栏；找不到返回 null（页面转 404，不做兜底标题） */
export async function getTopicById(id: string): Promise<Topic | null> {
  const topics = await listTopics()
  return topics.find((topic) => topic.id === id) ?? null
}
