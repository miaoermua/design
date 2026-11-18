import type { Metadata } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { SectionHeading } from '@/components/ui/page-header'
import { HeroSection } from '@/components/home/hero'
import { HomeMore } from '@/components/home/home-more'
import { getThemeConfig } from '@/core/config/theme'
import { isFeatureEnabled } from '@/core/registry/features'
import { ArticleRow } from '@/features/articles'
import { DiaryCard } from '@/features/diaries'
import { readSubscribeOptions } from '@/features/interactions'
import {
  ConfigurationError,
  getSiteLikeCount,
  getSiteTimezone,
  isApiConfigured,
  listArticles,
  listDiaries,
} from '@/lib/api'
import { toContentLang } from '@/lib/i18n/config'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { NOTE_LIST_PATH } from '@/lib/routes'
import { loadSiteContext, siteDescription, siteTitle } from '@/lib/site'
import { toSocialItems } from '@/lib/social'
import { cn } from '@/lib/utils/cn'

/** 首页编辑栅格：左轨放标题/头像，内容列放列表；<lg 单列堆叠 */
const HOME_GRID =
  'grid gap-x-[var(--gap-rail)] gap-y-6 lg:grid-cols-[var(--rail-home)_minmax(0,1fr)]'
/** 区块分隔：统一「5rem 留白 + 虚线 + 2rem 内边距」，首区块除外 */
const SECTION_RULE =
  'mt-[var(--spacing-section)] border-t border-dashed border-[var(--edge-strong)] pt-[var(--spacing-stack)]'
const SECTION_FIRST = 'pt-[var(--spacing-stack)]'
/** 左轨里的区块标题：竖排、贴顶（justify-between 在拉伸高度下会把 action 推到底） */
const RAIL_HEADING = 'lg:flex-col lg:items-start lg:justify-start lg:gap-2.5'

export async function generateMetadata(): Promise<Metadata> {
  const { identity } = await loadSiteContext()
  return {
    title: { absolute: siteTitle(identity) },
    description: siteDescription(identity),
  }
}

/**
 * 首页
 *
 * 结构是纵向的个人数字空间，而不是编辑杂志封面：
 *
 *   Personal Brand → Latest Blogs → Latest Notes → Footer
 *
 * 每一段都只回答一个问题：「这是谁」「最近写了什么」「最近在想什么」。
 *
 * 全页共用一套编辑栅格：≥lg 时 `--rail-home` 左轨 + 自适应内容列
 * （轨距 `--gap-rail`）。Hero 头像、区块标题落在左轨；身份名、文章索引、
 * 日记栅格、More 按钮行落在内容列——一条对齐线贯穿全页。
 * <lg 退化为单列：标题行在上、内容在下。
 *
 * 文章区是**单列索引**：一行一篇，标题左、日期贴右缘同基线（≥sm），
 * 不做双列卡片阵；行距与日记栅格同族（gap-y-8）。
 * 日记区 <xl 单列、≥xl 三列，同样不经过双列阶段。
 *
 * Personal Brand 区块有两种布局，由 theme config 的 `homepage.hero` 决定：
 *   - 不配置（默认）：经典横排「头像 + 文字」，刻意不做整屏 Hero
 *   - 配置了 hero：兼容 Shiro 的 `config.hero` 格式，整屏居中模板化标题
 *
 * 刻意不做的事情：没有首篇「头条」大卡片、没有封面图强制位、
 * 没有把所有内容都堆在首页——归档、标签、页面各有自己的入口。
 */
export default async function HomePage() {
  const locale = await getLocale()

  if (!isApiConfigured()) {
    return (
      <Container>
        <div className="py-20">
          <ErrorState
            title={t(locale, 'state.backendMissingTitle')}
            error={new ConfigurationError('缺少环境变量 MX_SERVER_URL')}
            hint={t(locale, 'state.backendMissingHint')}
            locale={locale}
          />
        </div>
      </Container>
    )
  }

  const lang = toContentLang(locale)
  const timeZone = getSiteTimezone()
  const [{ identity }, theme] = await Promise.all([loadSiteContext(), getThemeConfig()])

  // 区块开关与条数都来自 Theme Snippet。
  // 关键点：**请求数量必须与最终生效的配置一致**——区块关闭时不发请求，
  // 条数改了请求 size 也要跟着改，否则会多取数据或显示条数对不上。
  const showArticles = isFeatureEnabled('articles') && theme.homepage.articles.enabled
  const showNotes = isFeatureEnabled('diaries') && theme.homepage.notes.enabled
  const showProfile = theme.homepage.profile.enabled

  const [articles, diaries] = await Promise.all([
    // 「最近写的」必须按发布时间倒序：v2 的 /posts 默认会把置顶文章排在最前
    // （实测线上第 1 条是 2023 年的置顶文），不显式传排序会让首页看起来错乱。
    showArticles
      ? listArticles({
          size: theme.homepage.articles.limit,
          lang,
          sortBy: 'createdAt',
          sortOrder: -1,
        })
      : null,
    showNotes
      ? listDiaries({
          size: theme.homepage.notes.limit,
          lang,
          sortBy: 'createdAt',
          sortOrder: -1,
        })
      : null,
  ])

  const owner = identity?.owner
  const socials = theme.social.enabled
    ? toSocialItems(owner?.socialIds, { theme: theme.social })
    : []
  const name = owner?.name ?? siteTitle(identity)

  // 「更多」区块里只要出现 `like` 入口，才去读站点总赞数：
  // 入口被配置删掉时这次请求就是白花的，而首页每条请求都在首屏关键路径上。
  const showMore = theme.homepage.more.enabled && theme.homepage.more.items.length > 0
  const needsLikeCount =
    showMore &&
    isFeatureEnabled('interactions') &&
    theme.homepage.more.items.some((item) => item.type === 'like')
  const siteLikeCount = needsLikeCount ? await getSiteLikeCount() : null

  // 订阅弹窗需要完整的订阅选项（邮件类型 + 频道），与 More 区块的 subscribe 入口共享
  const needsSubscribe =
    showMore &&
    isFeatureEnabled('interactions') &&
    theme.homepage.more.items.some((item) => item.type === 'subscribe')
  const subscribeOptions = needsSubscribe ? await readSubscribeOptions(theme.social) : null

  return (
    <Container>
      {/* ── Personal Brand ─────────────────────────────────────── */}
      {showProfile ? (
        <HeroSection
          name={name}
          avatar={owner?.avatar ?? null}
          introduce={owner?.introduce ?? identity?.description ?? null}
          socials={socials}
          stats={{
            articles: articles
              ? {
                  total: articles.pagination.total,
                  href: '/articles',
                  label: tf(locale, 'home.countArticles', { count: articles.pagination.total }),
                }
              : null,
            diaries: diaries
              ? {
                  total: diaries.pagination.total,
                  // 计数入口的语义是「全部日记」，所以去时间线（不是最新一篇）
                  href: NOTE_LIST_PATH,
                  label: tf(locale, 'home.countDiaries', { count: diaries.pagination.total }),
                }
              : null,
            showArticlesSep: !!articles,
          }}
          hero={theme.homepage.hero}
        />
      ) : null}

      {/* ── Latest Blogs ───────────────────────────────────────── */}
      {articles ? (
        <section
          className={cn(
            'motion-fade-in',
            showProfile && 'motion-delay-1',
            showProfile ? SECTION_RULE : SECTION_FIRST,
          )}
        >
          <div className={HOME_GRID}>
            <SectionHeading
              title={t(locale, 'home.latestBlogs')}
              className={RAIL_HEADING}
              action={
                <Link href="/articles" className="link-quiet meta">
                  {t(locale, 'home.allArticles')} →
                </Link>
              }
            />

            {articles.items.length > 0 ? (
              <div className="flex flex-col gap-y-8">
                {articles.items.map((article) => (
                  <ArticleRow
                    key={article.id}
                    article={article}
                    timeZone={timeZone}
                    locale={locale}
                    minimal
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title={t(locale, 'home.emptyArticles')}
                description={t(locale, 'home.emptyArticlesHint')}
              />
            )}
          </div>
        </section>
      ) : null}

      {/* ── Latest Notes ───────────────────────────────────────── */}
      {diaries ? (
        <section
          className={cn(
            'motion-fade-in',
            showProfile && articles
              ? 'motion-delay-2'
              : (showProfile || articles) && 'motion-delay-1',
            showProfile || articles ? SECTION_RULE : SECTION_FIRST,
          )}
        >
          <div className={HOME_GRID}>
            <SectionHeading
              title={t(locale, 'home.latestNotes')}
              className={RAIL_HEADING}
              action={
                <Link href={NOTE_LIST_PATH} className="link-quiet meta">
                  {t(locale, 'home.allDiaries')} →
                </Link>
              }
            />

            {diaries.items.length > 0 ? (
              <div className="grid gap-y-8 xl:grid-cols-3 xl:gap-x-10">
                {diaries.items.map((diary) => (
                  <DiaryCard key={diary.id} diary={diary} timeZone={timeZone} />
                ))}
              </div>
            ) : (
              <EmptyState
                title={t(locale, 'home.emptyNotes')}
                description={t(locale, 'home.emptyNotesHint')}
              />
            )}
          </div>
        </section>
      ) : null}

      {/* ── More ───────────────────────────────────────────────── */}
      {showMore ? (
        <section
          className={cn(
            'motion-fade-in pb-4',
            // 延迟：根据前面有几个区块递增
            showProfile && articles && diaries
              ? 'motion-delay-3'
              : (showProfile && articles) || (showProfile && diaries) || (articles && diaries)
                ? 'motion-delay-2'
                : (showProfile || articles || diaries) && 'motion-delay-1',
            showProfile || articles || diaries ? SECTION_RULE : SECTION_FIRST,
          )}
        >
          <div className={HOME_GRID}>
            <SectionHeading title={t(locale, 'home.more')} className={RAIL_HEADING} />
            <HomeMore
              items={theme.homepage.more.items}
              siteLikeCount={siteLikeCount}
              subscribeOptions={subscribeOptions}
            />
          </div>
        </section>
      ) : null}
    </Container>
  )
}
