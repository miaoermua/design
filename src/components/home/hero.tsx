import { createElement } from 'react'
import Link from 'next/link'
import { CoverImage } from '@/components/ui/cover-image'
import { SocialIcon } from '@/components/ui/social-icon'
import type { ThemeHero, ThemeHeroTitleElement, ThemeSocialIcon } from '@/core/config/theme'
import { cn } from '@/lib/utils/cn'

interface SocialItem {
  id: string
  url: string
  title: string
  icon: ThemeSocialIcon | null
  color: string | null
}

interface HeroSectionProps {
  name: string
  avatar: string | null
  introduce: string | null
  socials: SocialItem[]
  /** 文章/日记统计，用于经典布局的 meta 行 */
  stats: {
    articles: { total: number; href: string; label: string } | null
    diaries: { total: number; href: string; label: string } | null
    showArticlesSep: boolean
  }
  /** Hero 配置；null 时使用经典横排布局 */
  hero: ThemeHero | null
}

/**
 * 首页 Hero 区块
 *
 * 两种布局共存在同一个组件里，由 `hero` 配置决定走哪条路：
 *
 * 1. **经典布局**（hero === null）：横排「头像 + 文字」，刻意不做整屏 Hero，
 *    与 Folio 的编辑排版美学一致。这是默认行为，不填 theme config 时使用。
 *
 * 2. **模板化 Hero**（hero !== null）：兼容 Shiro 的 `config.hero` 格式，
 *    整屏居中布局，左侧文字 + 右侧头像，标题由 `title.template` 数组
 *    动态渲染成对应 HTML 元素。
 */
export function HeroSection({ name, avatar, introduce, socials, stats, hero }: HeroSectionProps) {
  if (hero) {
    return <TemplatedHero name={name} avatar={avatar} socials={socials} hero={hero} />
  }

  return (
    <ClassicHero
      name={name}
      avatar={avatar}
      introduce={introduce}
      socials={socials}
      stats={stats}
    />
  )
}

/* ── Classic Layout ──────────────────────────────────────────── */

/**
 * 经典横排布局：与首页编辑栅格共用左轨（`--rail-home`）。
 *
 * ≥lg：头像落左轨，名字/导语/社交/统计落内容列，与下方区块标题轨对齐；
 * <lg：横排「头像 + 文字」。无头像时文字跨两列，不留空轨。
 */
function ClassicHero({ name, avatar, introduce, socials, stats }: Omit<HeroSectionProps, 'hero'>) {
  return (
    <section className="motion-fade-in pt-[calc(var(--spacing-section)*1.5)]">
      <div className="flex items-start gap-5 sm:gap-7 lg:grid lg:grid-cols-[var(--rail-home)_minmax(0,1fr)] lg:gap-x-[var(--gap-rail)]">
        {avatar ? (
          <CoverImage
            src={avatar}
            alt={name}
            width={88}
            height={88}
            priority
            // 圆形头像，尺寸克制：它是身份的一部分，不是首屏主视觉
            className="size-16 shrink-0 rounded-full border border-[var(--edge)] sm:size-[5.5rem]"
          />
        ) : null}

        <div className={cn('min-w-0 flex-1', !avatar && 'lg:col-span-2')}>
          {/* 作者名是首页最大的字：它是这个空间的身份标识，
              用 display 级而不是把每一段都做大——只有一处需要这个重量。 */}
          <h1 className="text-display max-w-[22ch] font-serif text-balance text-[var(--text-heading)]">
            {name}
          </h1>
          {introduce ? (
            <p className="text-lead mt-2 max-w-[34rem] font-serif text-pretty text-[var(--text-secondary)]">
              {introduce}
            </p>
          ) : null}

          {socials.length > 0 ? (
            <ul className="mt-4 flex flex-wrap items-center gap-1.5">
              {socials.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    rel="me noopener noreferrer"
                    target={item.url.startsWith('mailto:') ? undefined : '_blank'}
                    title={item.title}
                    aria-label={item.title}
                    // 品牌色作为前景色：图标行本身是安静的，
                    // 用大块背景色会把这行变成按钮墙
                    style={item.color ? { color: item.color } : undefined}
                    className="flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-wash)] hover:text-[var(--accent-strong)]"
                  >
                    <SocialIcon icon={item.icon} className="size-[1.05rem]" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="meta mt-7 flex flex-wrap items-center gap-x-1 gap-y-2">
            {stats.articles ? (
              <Link href={stats.articles.href} className="link-quiet">
                {stats.articles.label}
              </Link>
            ) : null}
            {stats.diaries ? (
              <Link href={stats.diaries.href} className="link-quiet">
                <span className={stats.showArticlesSep ? 'meta-sep' : undefined}>
                  {stats.diaries.label}
                </span>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ── Templated Hero (Shiro-compatible) ───────────────────────── */

/**
 * 安全的 HTML 标签白名单：只允许模板渲染这些标签。
 * 与 parser.ts 的 VALID_HERO_ELEMENT_TYPES 保持一致。
 */
const SAFE_ELEMENT_TYPES = new Set(['h1', 'h2', 'span', 'code', 'br'])

/**
 * 把文字拆成单个字符，每个字符包裹在带 CSS 动画延迟的 span 里。
 *
 * 与 Shiro 的 TextUpTransitionView 同理：每个字符从 10px 下方透明
 * 上浮到正常位置，每个字符之间有 50ms 的错峰延迟。
 *
 * Shiro 用 motion/react 的 m.span + JS 弹簧动画实现；
 * Folio 用纯 CSS animation + CSS 自定义属性 --char-index 实现同样效果，
 * 不引入额外的 JS 动画运行时。
 *
 * @param text 要动画化的文字
 * @param startIndex 全局字符索引偏移量——用于跨元素的连续延迟
 */
function animatedChars(text: string, startIndex: number) {
  return Array.from(text).map((char, i) => (
    <span
      key={startIndex + i}
      className="hero-char"
      style={{ '--char-index': startIndex + i } as React.CSSProperties}
    >
      {char}
    </span>
  ))
}

/**
 * 渲染单个模板元素，标题文字带逐字上浮动画。
 *
 * @param charOffset 该元素之前所有元素的文字总长度，用于计算动画延迟
 */
function HeroTitleElement({
  element,
  charOffset,
}: {
  element: ThemeHeroTitleElement
  charOffset: number
}) {
  if (!SAFE_ELEMENT_TYPES.has(element.type)) return null

  if (element.type === 'br') {
    return <br />
  }

  const text = element.text ?? ''

  return createElement(
    element.type,
    {
      className: cn(
        // 基础样式：与 Folio 设计系统保持一致
        element.type === 'h1' && 'font-serif text-[var(--text-heading)]',
        element.type === 'h2' && 'font-serif text-[var(--text-heading)]',
        element.type === 'code' &&
          'rounded-[var(--radius-sm)] bg-[var(--surface-sunk)] px-2 py-0.5 font-mono text-[0.9em] text-[var(--accent-strong)]',
        element.type === 'span' && 'text-[var(--text-secondary)]',
        // 用户自定义类名追加在后面，可以覆盖基础样式
        element.class,
      ),
    },
    animatedChars(text, charOffset),
  )
}

/**
 * 计算所有模板元素的文字总长度，用于后续区块的动画延迟。
 */
function totalCharCount(template: ThemeHeroTitleElement[]): number {
  return template.reduce((acc, el) => acc + (el.text?.length ?? 0), 0)
}

/**
 * 模板化 Hero：兼容 Shiro 的 `config.hero` 格式。
 *
 * 布局参考 Shiro 的 TwoColumnLayout：
 *   - 大屏（lg+）：左侧文字（标题 + 描述 + 社交图标）+ 右侧头像
 *   - 移动端：堆叠，头像在上、文字在下
 *
 * 动画系统（纯 CSS，对标 Shiro 的 motion/react 效果）：
 *   - 标题文字：逐字上浮（char-rise），每字 50ms 错峰，与 Shiro 的 TextUpTransitionView 对应
 *   - 描述/社交/头像：整块上浮（block-rise），延迟跟在标题动画之后
 *   - prefers-reduced-motion 时全部跳过动画，直接显示
 *
 * 与 Shiro 的差异（Folio 的设计立场）：
 *   - 不引入 motion/react：用 CSS animation 实现，零 JS 运行时开销
 *   - 不做整屏高（dvh），用自然高度 + 充足留白
 *   - ≥lg 整体缩进内容列（与下方区块同一条对齐线），头像贴版心右缘；
 *     竖向节奏与经典布局一致：顶 1.5×section，底部留白交给区块分隔
 *   - 颜色和字体走 Folio 的 token 体系
 *   - Emoji 和特殊字符（👋 ✦ 等）直接写在 text 字段里，正常渲染
 */
function TemplatedHero({
  name,
  avatar,
  socials,
  hero,
}: {
  name: string
  avatar: string | null
  socials: SocialItem[]
  hero: ThemeHero
}) {
  // 标题总字符数 × 50ms = 标题动画总时长，后续区块的延迟从这里开始
  const titleChars = totalCharCount(hero.title.template)
  const titleDurationMs = titleChars * 50 + 300 // 额外 300ms 缓冲

  // 各区块的错峰延迟
  const descDelay = `${titleDurationMs}ms`
  const socialsDelay = `${titleDurationMs + 200}ms`
  const avatarDelay = `${titleDurationMs + 100}ms`

  return (
    <section className="pt-[calc(var(--spacing-section)*1.5)] lg:pl-[calc(var(--rail-home)+var(--gap-rail))]">
      <div className="flex flex-col-reverse items-center gap-10 lg:flex-row lg:items-start lg:justify-between lg:gap-16">
        {/* ── 左侧：文字内容 ────────────────────────── */}
        <div className="min-w-0 flex-1 text-center lg:text-left">
          {/* 模板化标题：逐字上浮动画 */}
          <div className="text-display leading-[1.3] [&_*]:inline-block [&_br]:block [&_br]:h-2">
            {hero.title.template.map((element, index) => {
              // 计算该元素之前所有元素的文字总长度，作为动画延迟的偏移
              const charOffset = hero.title.template
                .slice(0, index)
                .reduce((acc, el) => acc + (el.text?.length ?? 0), 0)
              return <HeroTitleElement key={index} element={element} charOffset={charOffset} />
            })}
          </div>

          {hero.description ? (
            <p
              className="hero-block-rise text-lead mt-6 max-w-[38rem] font-serif text-pretty text-[var(--text-secondary)] max-lg:mx-auto"
              style={{ '--block-delay': descDelay } as React.CSSProperties}
            >
              {hero.description}
            </p>
          ) : null}

          {socials.length > 0 ? (
            <ul
              className="hero-block-rise mt-8 flex flex-wrap items-center gap-2 max-lg:justify-center"
              style={{ '--block-delay': socialsDelay } as React.CSSProperties}
            >
              {socials.map((item) => (
                <li key={item.id}>
                  <a
                    href={item.url}
                    rel="me noopener noreferrer"
                    target={item.url.startsWith('mailto:') ? undefined : '_blank'}
                    title={item.title}
                    aria-label={item.title}
                    style={item.color ? { color: item.color } : undefined}
                    className="flex size-10 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-wash)] hover:text-[var(--accent-strong)]"
                  >
                    <SocialIcon icon={item.icon} className="size-[1.15rem]" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* ── 右侧：头像 ──────────────────────────── */}
        {avatar ? (
          <div
            className="hero-block-rise shrink-0"
            style={{ '--block-delay': avatarDelay } as React.CSSProperties}
          >
            <CoverImage
              src={avatar}
              alt={name}
              width={200}
              height={200}
              priority
              className={cn(
                'rounded-full border border-[var(--edge)]',
                // 移动端 160px，桌面 200px
                'size-40 lg:size-[12.5rem]',
              )}
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}
