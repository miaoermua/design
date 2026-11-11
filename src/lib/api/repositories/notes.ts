import { requestV2 } from '../client/http'
import type { V2NoteDetail, V2NoteRow } from '../contracts/v2/note'
import { expectObject, toPageResult } from '../adapters/common'
import { toDiary } from '../adapters/diary'
import type { Diary, DiaryListQuery } from '../domain/diary'
import type { PageResult } from '../domain/common'

const TAG = ['notes']

/** GET /notes */
export async function listDiaries(query: DiaryListQuery = {}): Promise<PageResult<Diary>> {
  const { page = 1, size = 10, year, sortBy, sortOrder, lang } = query

  const body = await requestV2<{ data?: V2NoteRow[] }>('/notes', {
    query: { page, size, year, sortBy, sortOrder, lang },
    revalidate: 60,
    tags: TAG,
  })

  return toPageResult(body, toDiary)
}

/**
 * GET /notes/:id?password=
 *
 * 受密码保护时抛 PasswordRequiredError（403 / code 14000），由页面转成「需要密码」状态。
 * 密码通过查询参数透传（core 的 NotePasswordQueryDto.password），主题不保存任何密码。
 */
export async function getDiary(
  id: string,
  password?: string,
  options: { lang?: string } = {},
): Promise<Diary> {
  const body = await requestV2<unknown>(`/notes/${encodeURIComponent(id)}`, {
    query: { password, lang: options.lang },
    revalidate: password ? 0 : 120,
    tags: TAG,
  })
  return toDiary(expectObject<V2NoteDetail>(body, `/notes/${id}`))
}

/** GET /notes/nid/:nid */
export async function getDiaryByNid(nid: number): Promise<Diary> {
  const body = await requestV2<unknown>(`/notes/nid/${nid}`, { revalidate: 120, tags: TAG })
  return toDiary(expectObject<V2NoteDetail>(body, `/notes/nid/${nid}`))
}
