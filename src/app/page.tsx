import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SectionHeading } from '@/components/ui/page-header'
import { Rule } from '@/components/ui/rule'
import { HOME_RECENT_ARTICLES, HOME_RECENT_DIARIES } from '@/core/config/site'
import { isFeatureEnabled } from '@/core/registry/features'
import { ArticleCard, ArticleRow } from '@/features/articles'
import { DiaryCard } from '@/features/diaries'
import {
  ConfigurationError,
  getSiteTimezone,
  isApiConfigured,
  listArticles,
  listDiaries,
} from '@/lib/api'
import { diaryPath } from '@/lib/routes'
import { loadSiteContext, siteDescription, siteTitle } from '@/lib/site'

export async function generateMetadata(): Promise<Metadata> {
  const { identity } = await loadSiteContext()
  return {
    title: { absolute: siteTitle(identity) },
    description: siteDescription(identity),
  }
}

export default async function HomePage() {
  if (!isApiConfigured()) {
    return (
      <Container>
        <div className="py-20">
          <ErrorState
            title="尚未连接 Mix Space 后端"
            error={new ConfigurationError('缺少环境变量 MX_SERVER_URL')}
            hint="在 .env.local 中设置 MX_SERVER_URL，或设置 MX_MOCK=1 用内置数据离线预览。"
          />
        </div>
      </Container>
    )
  }

  const timeZone = getSiteTimezone()
  const { identity } = await loadSiteContext()

  const [articles, diaries] = await Promise.all([
    isFeatureEnabled('articles') ? listArticles({ size: HOME_RECENT_ARTICLES }) : null,
    isFeatureEnabled('diaries') ? listDiaries({ size: HOME_RECENT_DIARIES }) : null,
  ])

  const lead = articles?.items[0] ?? null
  const rest = articles?.items.slice(1) ?? []

  return (
    <Container>
      <section className="pt-16 pb-12 sm:pt-24">
        <p className="meta">文章 · 日记 · 归档</p>
        <h1 className="mt-4 max-w-[42rem] font-serif text-display leading-[1.14] tracking-[-0.022em] text-[var(--text-primary)]">
          {siteTitle(identity)}
        </h1>
        <p className="mt-5 max-w-[var(--container-prose)] font-serif text-small text-[var(--text-secondary)]">
          {siteDescription(identity)}
        </p>

        <div className="meta mt-8 flex flex-wrap items-center gap-x-1 gap-y-2">
          {articles ? (
            <Link href="/articles" className="link-quiet">
              文章 {articles.pagination.total} 篇
            </Link>
          ) : null}
          {diaries ? (
            <Link href="/diaries" className="link-quiet">
              <span className={articles ? 'meta-sep' : undefined}>
                日记 {diaries.pagination.total} 篇
              </span>
            </Link>
          ) : null}
          {identity?.latestDiaryId ? (
            <Link href={diaryPath(identity.latestDiaryId)} className="link-quiet">
              <span className="meta-sep">最新的日记 →</span>
            </Link>
          ) : null}
        </div>
      </section>

      <Rule />

      {articles ? (
        <section className="py-14">
          <SectionHeading
            title="最近写的"
            action={
              <Link href="/articles" className="link-quiet meta">
                全部文章 →
              </Link>
            }
          />

          {lead ? (
            <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
              <ArticleCard article={lead} timeZone={timeZone} variant="lead" priority />
              {rest.length > 0 ? (
                <div className="divide-y divide-dashed divide-[var(--edge)]">
                  {rest.map((article) => (
                    <ArticleRow key={article.id} article={article} timeZone={timeZone} compact />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState
                title="还没有公开的文章"
                description="后端返回的文章列表为空（不是加载失败）。"
              />
            </div>
          )}
        </section>
      ) : null}

      {diaries ? (
        <section className="border-t border-dashed border-[var(--edge-strong)] py-14">
          <SectionHeading
            title="日记"
            action={
              <Link href="/diaries" className="link-quiet meta">
                全部日记 →
              </Link>
            }
          />
          {diaries.items.length > 0 ? (
            <div className="mt-8 grid gap-x-10 gap-y-9 sm:grid-cols-2">
              {diaries.items.map((diary) => (
                <DiaryCard key={diary.id} diary={diary} timeZone={timeZone} />
              ))}
            </div>
          ) : (
            <div className="mt-8">
              <EmptyState title="还没有公开的日记" description="日记模块已启用，但列表为空。" />
            </div>
          )}
        </section>
      ) : null}

      <section className="border-t border-dashed border-[var(--edge-strong)] py-12">
        <p className="font-serif text-title text-[var(--text-primary)]">按时间翻阅</p>
        <p className="mt-2 max-w-[var(--container-prose)] text-small text-[var(--text-secondary)]">
          归档把文章与日记放进同一条时间轴，从最近的一个月开始往回走。
        </p>
        <Link href="/archives" className="link-quiet meta mt-4 inline-block">
          进入归档 →
        </Link>
      </section>
    </Container>
  )
}
