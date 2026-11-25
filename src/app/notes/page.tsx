import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { requireFeature } from '@/core/registry/guard'
import { getLatestDiary, NOTE_LATEST_SCAN_MAX_PAGES, NOTE_LATEST_SCAN_PAGE_SIZE } from '@/lib/api'
import { toContentLang } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { notePath } from '@/lib/routes'

/**
 * 日记主入口：进站先看最新一篇。
 *
 * 这是 MX 生态的阅读习惯——日记按时间追加，点「日记」期待看到最近写了什么，
 * 而不是先落在列表页再点一次。列表没有消失，让到 `/notes/list`。
 *
 * 用 `redirect()`（307，临时）而不是永久重定向：最新一篇会随时间变化，
 * 若用 308 会被浏览器与搜索引擎长期缓存，读者可能永远停在同一篇。
 * RSC 里发出 307 也不会先渲染空壳，前进/后退照常留历史记录。
 *
 * 注意：父级不要放 `loading.tsx`。有 Suspense 边界时 Next 会先以 200 流出
 * loading shell，`redirect()` 只能降级成 `<meta refresh>`，既不是 307 也会闪一下。
 * 骨架屏因此挂在 `list/` 与 `[nid]/` 两个叶子段上。
 */

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale()
  return {
    title: t(locale, 'diaries.title'),
    description: t(locale, 'diaries.description'),
  }
}

export default async function NotesEntryPage() {
  // 守卫在取数之前：模块关掉时零请求，而不是先请求再 404
  requireFeature('diaries')

  const locale = await getLocale()
  // 「最新一篇」只用来算 nid，但扫描请求仍按当前语言取：
  // 与详情页共用同一份 `?lang=` 缓存，也避免以后在入口展示标题时漏传。
  const { diary, truncated } = await getLatestDiary({ lang: toContentLang(locale) })

  /*
   * 扫描触顶时必须留下信号。
   *
   * 后端没有按公开时间排序的能力（`sortBy` 只认 createdAt / modifiedAt /
   * weather / mood），「最新」只能靠扫描若干页后在应用层重挑，页数有上限
   * （NOTE_LATEST_SCAN_*）。一旦触顶，结果只是「已扫范围内最新」，不是全站
   * 最新——这是**可能悄悄跳错一篇**的降级，不能沉默。
   *
   * 只打计数、不打内容，与 feed 的告警风格一致。
   */
  if (truncated) {
    const scanned = NOTE_LATEST_SCAN_MAX_PAGES * NOTE_LATEST_SCAN_PAGE_SIZE
    console.warn(
      `[notes] 日记总数超过扫描上限 ${scanned} 篇，` +
        `「最新一篇」只在已扫范围内确定，可能不是全站最新（nid=${diary?.nid ?? 'none'}）`,
    )
  }

  if (diary) redirect(notePath(diary.nid))

  // 一篇都没有：给空状态，不重定向到不存在的详情页
  return (
    <Container>
      <EmptyState
        title={t(locale, 'diaries.emptyNone')}
        description={t(locale, 'diaries.emptyEntryHint')}
        action={
          <Link href="/" className="link-quiet text-meta text-[var(--text-secondary)]">
            {t(locale, 'diaries.emptyEntryBack')}
          </Link>
        }
      />
    </Container>
  )
}
