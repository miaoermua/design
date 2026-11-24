import { permanentRedirect } from 'next/navigation'
import { requireFeature } from '@/core/registry/guard'

/**
 * /archives —— 永久重定向到 /explore
 *
 * 「归档」已经并入 `/explore`。这个路由保留，是因为旧链接可能已经流出去了，
 * 直接 404 会让外部引用与书签失效。
 *
 * 之前这里是**把归档页再渲染一遍**：同一份 timeline、另一套页头、另一个 title。
 * 后果是 `/archives` 与 `/explore` 两份内容同时可访问，都进了 sitemap，
 * 搜索结果里出现两个入口指向同一批文章。
 *
 * 现在只做 308：保留地址、收敛内容。`/explore` 是唯一的时间线落地页，
 * 归档的取数、分组、筛选都只在那边维护一份。
 */
export default function ArchivesPage() {
  requireFeature('archives')
  permanentRedirect('/explore')
}
