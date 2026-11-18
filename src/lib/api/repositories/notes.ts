import { requestV2 } from '../client/http'
import type { V2NoteDetail, V2NoteRow } from '../contracts/v2/note'
import { expectObject, toPageResult } from '../adapters/common'
import { toDiary } from '../adapters/diary'
import { pickLatestDiary, type Diary, type DiaryListQuery } from '../domain/diary'
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
 * 取「最新一篇」用到的扫描上限（篇数）。
 *
 * 为什么要扫、而不是只看第一条：后端 `sortBy` 只接受 createdAt / modifiedAt /
 * weather / mood，**没有 publishedAt**；而读者看到的公开时间是
 * `publicAt ?? createdAt`。定时发布、事后补 publicAt 都会让两种顺序不一致，
 * 直接取首页第一条就可能跳错。
 *
 * 为什么设上限：`size=50` 一页约 500KB（`truncate` 对日记不生效，实测无效），
 * 无上限扫描在大站点上会把每次进站变成几 MB 的顺序请求。200 篇覆盖了本主题
 * 目标站点的量级；超出时退回「已扫范围内最优」，并在返回值里如实标注是否截断，
 * 调用方可以据此决定是否告警——而不是假装扫完了。
 */
export const NOTE_LATEST_SCAN_PAGE_SIZE = 50
export const NOTE_LATEST_SCAN_MAX_PAGES = 4

export interface LatestDiaryResult {
  diary: Diary | null
  /** 扫描是否因上限而停止（true = 结果只是「已扫范围内最新」，不保证全局最新） */
  truncated: boolean
}

/**
 * 扫描最近若干页，按真实发布时间挑出最新一篇。
 *
 * 分页而不是依赖数组顺序：`hasNext` 说还有就继续，直到扫完或用尽上限。
 */
export async function getLatestDiary(): Promise<LatestDiaryResult> {
  const collected: Diary[] = []
  let page = 1
  let truncated = false

  for (;;) {
    const result = await listDiaries({
      page,
      size: NOTE_LATEST_SCAN_PAGE_SIZE,
      sortBy: 'createdAt',
      sortOrder: -1,
    })
    collected.push(...result.items)

    if (!result.pagination.hasNext) break
    if (page >= NOTE_LATEST_SCAN_MAX_PAGES) {
      truncated = true
      break
    }
    page += 1
  }

  // 比较规则（含 nid 兜底与不可解析时间的处理）只写在领域层一份
  return { diary: pickLatestDiary(collected), truncated }
}

/**
 * GET /notes/topics/:id —— 按专栏取日记。
 *
 * 时间线的专栏筛选指向 `/notes/list?topic=<id>`：列表页换的是查询参数，
 * 路由形状不变，也就不需要为专栏再开一条详情路由。
 */
export async function listDiariesByTopic(
  topicId: string,
  query: DiaryListQuery = {},
): Promise<PageResult<Diary>> {
  const { page = 1, size = 10, sortBy, sortOrder, lang } = query

  const body = await requestV2<{ data?: V2NoteRow[] }>(
    `/notes/topics/${encodeURIComponent(topicId)}`,
    {
      query: { page, size, sortBy, sortOrder, lang },
      revalidate: 60,
      tags: TAG,
    },
  )

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

/**
 * GET /notes/nid/:nid —— 按自增序号取单篇。
 *
 * 站点详情路由用这个（`/notes/:nid`），与 Shiro / Kami 的地址同形。
 *
 * `password` 透传为查询参数，与 `/notes/:id` 走同一个密码校验：受保护的日记
 * 在拿到正文之前就会 403，客户端据此渲染密码表单。当前线上数据没有受密码
 * 保护的日记，因此这条路径**未经真实样本验证**；若上游 `/notes/nid/:nid`
 * 忽略该参数，解锁会一直失败（表现为「密码错误」），届时需要退回到
 * 「先按 nid 查 id，再走 /notes/:id」的两步路径。
 */
export async function getDiaryByNid(nid: number, password?: string): Promise<Diary> {
  const body = await requestV2<unknown>(`/notes/nid/${nid}`, {
    query: { password },
    revalidate: password ? 0 : 120,
    tags: TAG,
  })

  /*
   * ⚠️ 这个端点的响应形状与 `/notes/:id` **不一致**（实测 core 12.x）：
   *   - `/notes/:id`       → 日记对象本身（顶层就是 id / title / created_at）
   *   - `/notes/nid/:nid`  → `{ data: 日记对象, next: … }`
   *
   * 直接把整个 body 交给 `toDiary` 会读不到任何字段：`id` 变成 "undefined"、
   * `created_at` 变成空串，详情页在 `formatDate()` 那里抛
   * `RangeError: Invalid time value`，整页落到错误边界（表现为「这个页面没能
   * 完成渲染」）。所以这里必须显式取 `.data`，并兼容未来某版改回裸对象的情形。
   */
  const row =
    body && typeof body === 'object' && 'data' in body
      ? (body as { data: unknown }).data
      : body

  return toDiary(expectObject<V2NoteDetail>(row, `/notes/nid/${nid}`))
}
