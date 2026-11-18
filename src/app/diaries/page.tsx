import { permanentRedirect } from 'next/navigation'
import { requireFeature } from '@/core/registry/guard'
import { NOTE_LIST_PATH } from '@/lib/routes'

/**
 * 旧列表路由的兼容层：`/diaries` → `/notes/list`。
 *
 * 主题早期用 `/diaries` 承载列表，改成 `/notes` 体系后旧地址会被收藏、被外部
 * 引用，也可能还躺在搜索结果里。这里保留一条**重定向**而不是删掉：失效的
 * 收藏链接比多一个文件更糟。
 *
 * 用 308（`permanentRedirect`）：这是一次**永久**的路由迁移，旧地址永远对应
 * 时间线，让搜索引擎替换索引并传递权重；307 只会被当成临时跳转。
 *
 * 指向 `/notes/list` 而不是 `/notes`：旧地址的语义是「全部日记」，
 * 指到 `/notes` 会变成「只剩最新一篇」，等于把列表入口悄悄改了。
 */
export default function LegacyDiariesIndex() {
  requireFeature('diaries')
  permanentRedirect(NOTE_LIST_PATH)
}
