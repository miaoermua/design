import type { Attachment } from './common'
import type { AiDisclosure } from './disclosure'

export interface DiaryTopic {
  id: string
  name: string
}

/**
 * 日记模型
 *
 * 与文章刻意区分：日记以「时间 + 片段」为组织方式，
 * 没有 category/tags/summary/related 等结构化内容字段。
 */
export interface Diary {
  id: string
  nid: number
  title: string
  /** 实测可为 null：日记不强制有 slug，链接一律用 id */
  slug: string | null
  /** Markdown 正文；受密码保护时后端返回空字符串 */
  content: string
  contentFormat: string
  /** 公开时间优先用 publicAt，其次 createdAt */
  publishedAt: string
  modifiedAt: string | null
  mood: string | null
  weather: string | null
  location: string | null
  bookmark: boolean
  hasPassword: boolean
  topic: DiaryTopic | null
  images: Attachment[]
  readCount: number | null
  likeCount: number | null
  /** AI 参与声明（`meta.aiGen`）；null 表示作者未声明 */
  aiDisclosure: AiDisclosure | null
}

export interface DiaryListQuery {
  page?: number
  size?: number
  year?: number
  sortBy?: 'createdAt' | 'modifiedAt' | 'weather' | 'mood'
  sortOrder?: 1 | -1
  /** 内容语言（`?lang=`），由后端返回译文 */
  lang?: string
}

/** 时间线分组：按日期（站点时区）分桶 */
export interface DiaryDayGroup {
  /** YYYY-MM-DD */
  date: string
  items: Diary[]
}

/**
 * 按站点时区的日期分桶，保留后端返回顺序。
 *
 * 放在领域层而不是适配器：分组是展示无关的纯函数，
 * 换排序、换分页策略都不影响它；也方便单测。
 */
export function groupDiariesByDay(diaries: Diary[], timeZone: string): DiaryDayGroup[] {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const groups: DiaryDayGroup[] = []
  const index = new Map<string, DiaryDayGroup>()

  for (const diary of diaries) {
    const date = formatter.format(new Date(diary.publishedAt))
    const existing = index.get(date)
    if (existing) {
      existing.items.push(diary)
    } else {
      const group: DiaryDayGroup = { date, items: [diary] }
      index.set(date, group)
      groups.push(group)
    }
  }

  return groups
}

/**
 * 从一批日记里挑出「最新一篇」。
 *
 * 为什么不在页面里 `items[0]`：数组顺序是**后端返回顺序**，不是契约承诺。
 * `/notes` 要跳转到最新一篇，跳错一次就是明显的错误，所以这里显式按发布时间
 * 比较，而不是把正确性押在响应顺序上。
 *
 * 实测后端只按 `createdAt` 排序（`sortBy` 只接受 createdAt / modifiedAt /
 * weather / mood，**没有 publishedAt**），而读者看到的是公开时间
 * （`publicAt ?? createdAt`）。两者可能不一致——定时发布、事后补 publicAt
 * 都会让顺序反过来。因此取一个窗口后在这里重挑，而不是完全相信第一页第一条。
 *
 * 并列时用 `nid` 兜底：结果必须确定，否则两次请求可能跳到不同日记。
 */
export function pickLatestDiary(diaries: readonly Diary[]): Diary | null {
  let latest: Diary | null = null

  for (const diary of diaries) {
    if (!latest) {
      latest = diary
      continue
    }
    const current = Date.parse(diary.publishedAt)
    const best = Date.parse(latest.publishedAt)
    // 时间不可解析时不当成「最新」，避免 NaN 比较把顺序钉死在第一条
    if (Number.isNaN(current)) continue
    if (Number.isNaN(best) || current > best) {
      latest = diary
      continue
    }
    if (current === best && diary.nid > latest.nid) latest = diary
  }

  return latest
}
