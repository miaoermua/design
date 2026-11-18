import { notFound, permanentRedirect } from 'next/navigation'
import { requireFeature } from '@/core/registry/guard'
import { PasswordGate } from '@/features/diaries/components/password-gate'
import { getDiary, isNotFound, isPasswordRequired } from '@/lib/api'
import { readLegacyNotePassword } from '@/features/diaries/note-password'
import { getLocale } from '@/lib/i18n/server'
import { notePath } from '@/lib/routes'

/**
 * 旧详情路由的兼容层：`/diaries/:雪花id` → `/notes/:nid`。
 *
 * 站点详情地址改成 nid 之后，历史上分享出去的 `/diaries/<雪花id>` 会 404。
 * 这里保留一跳：按雪花 id 取到日记，再用它自己的 nid 转过去。
 *
 * **用 308（`permanentRedirect`）而不是 307**：路由迁移是永久性的，同一个旧地址
 * 永远对应同一个新地址（nid 是自增主键，不会变）。307 会让搜索引擎保留旧 URL、
 * 不传递权重；308 则等价于 301 且保留请求方法，是这类迁移的正确语义。
 *
 * 与 `/notes` 入口的区别：那里必须用 307，因为「最新一篇」指向的目标会随时间
 * 变化，持久缓存会把读者钉死在同一篇。
 *
 * 密码保护的日记：取正文前就被上游拦下（403 / code 14000），此时**拿不到 nid**，
 * 无法算出去处。因此就地渲染密码门，表单回提交本路由——解锁后自然走到下面的
 * 308。这样既不会抛未处理异常（500），也不会来回重定向（循环）。
 *
 * 非法 id（`/diaries/0`）由 `getDiary` 抛 NotFoundError：上游对实体 id 的 422
 * 已在错误映射层转为 404（见 `client/http.ts` 的 `INVALID_ENTITY_ID`），
 * 所以这里只判 `isNotFound` 就够，不会漏成 500。
 */
interface LegacyDiaryPageProps {
  params: Promise<{ id: string }>
  /** 只有 `wrong`（密码错过的标记）；密码本身绝不从 URL 读 */
  searchParams: Promise<{ wrong?: string }>
}

export default async function LegacyDiaryPage({ params, searchParams }: LegacyDiaryPageProps) {
  requireFeature('diaries')

  const { id } = await params
  const { wrong } = await searchParams

  // 雪花 id 是纯数字；其余形态直接 404，别把后端 422 变成 500
  if (!/^\d+$/.test(id)) notFound()

  /*
   * 密码来自 httpOnly cookie，**不从 URL 读**。
   * 未解锁时 cookie 不存在，上游 403，照常渲染密码门；解锁由
   * POST /api/notes/unlock 完成（那里会同时种下 nid 与雪花 id 两个键），
   * 成功后 303 到 `/notes/:nid`，这条路由不必再转发密码。
   */
  const password = await readLegacyNotePassword(id)

  let diary
  try {
    diary = await getDiary(id, password ?? undefined)
  } catch (error) {
    if (isNotFound(error)) notFound()
    if (isPasswordRequired(error)) {
      const locale = await getLocale()
      return (
        <PasswordGate
          target={{ field: 'id', value: id }}
          wrong={Boolean(wrong) || password !== null}
          locale={locale}
        />
      )
    }
    throw error
  }

  /*
   * 308 的目标**只有干净地址**：密码不再拼进查询串。
   * 读者已经解锁时 cookie 会跟着 308 之后的 GET 一起过去（同为本站、path=/），
   * `/notes/:nid` 直接读得到，不需要在 URL 里再带一次。
   */
  permanentRedirect(notePath(diary.nid))
}
