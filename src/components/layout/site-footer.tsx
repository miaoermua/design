import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { SocialIcon } from '@/components/ui/social-icon'
import { footerYearRange } from '@/core/config/theme'
import { getThemeConfig } from '@/core/config/theme'
import { getFooterNav } from '@/core/navigation'
import type { SiteIdentity } from '@/lib/api'
import { t } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { siteDescription, siteTitle } from '@/lib/site'
import { toSocialItems } from '@/lib/social'

/**
 * 站点级固定信息
 *
 * 这三个地址都实测可达（HTTP 200），不接受拼接或猜测：
 *   - Mix Space 社区：组织首页，含全部官方项目
 *   - Mix Space Core：后端仓库本身（与社区首页不是同一个链接）
 *   - Folio 主题：本项目的仓库
 */
const SITE_LINKS = {
  community: 'https://github.com/mx-space',
  core: 'https://github.com/mx-space/core',
  theme: 'https://github.com/miaoermua/design',
} as const

/** 备案查询的官方入口：ICP 配了号码但链接非法时退到这里，而不是渲染坏地址 */
const ICP_QUERY_URL = 'https://beian.miit.gov.cn/'

export async function SiteFooter({ identity }: { identity: SiteIdentity | null }) {
  const [locale, theme] = await Promise.all([getLocale(), getThemeConfig()])
  const items = getFooterNav()
  const title = siteTitle(identity)
  const description = siteDescription(identity)

  // 社交：账号来自 /aggregate，自定义项目与显示控制来自 Theme Snippet
  const socials = theme.social.enabled
    ? toSocialItems(identity?.owner.socialIds, { theme: theme.social })
    : []

  const authorName = identity?.owner.name ?? title
  const authorSign = identity?.owner.introduce ?? description
  const yearLabel = footerYearRange(theme.footer.since, new Date().getFullYear())

  const { links, icp } = theme.footer

  return (
    <footer className="mt-[var(--spacing-section)]">
      {/* ── 自定义链接区：位于页脚正上方，完全由 Theme Snippet 驱动 ─────
          没有配置时不渲染整块——空标题配空列表比不显示更糟。 */}
      {links.length > 0 ? (
        <div className="border-t border-dashed border-[var(--edge-strong)]">
          <Container width="wide">
            <nav aria-label={t(locale, 'footer.links')} className="py-7">
              <p className="meta">{t(locale, 'footer.links')}</p>
              <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
                {links.map((link) => (
                  <li key={`${link.name}-${link.url}`}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-quiet text-small text-[var(--text-secondary)]"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </Container>
        </div>
      ) : null}

      <div className="border-t border-[var(--edge)]">
        <Container width="wide">
          <div className="grid gap-9 py-11 sm:grid-cols-[1.5fr_1fr_1fr] sm:gap-10">
            {/* 作者身份：名称 + 签名 + 社交，与首页的品牌区呼应 */}
            <div>
              <p className="font-serif text-h3 text-[var(--text-heading)]">{authorName}</p>
              {authorSign ? (
                <p className="mt-2 max-w-[24rem] text-small leading-[1.75] text-[var(--text-secondary)]">
                  {authorSign}
                </p>
              ) : null}

              {socials.length > 0 ? (
                <ul className="mt-4 flex flex-wrap items-center gap-1">
                  {socials.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.url}
                        rel="me noopener noreferrer"
                        target={item.url.startsWith('mailto:') ? undefined : '_blank'}
                        title={item.title}
                        aria-label={item.title}
                        style={item.color ? { color: item.color } : undefined}
                        className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-tertiary)] transition-colors duration-[var(--duration-fast)] hover:bg-[var(--accent-wash)] hover:text-[var(--accent-strong)]"
                      >
                        <SocialIcon icon={item.icon} className="size-4" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <nav aria-label={t(locale, 'footer.browse')}>
              <p className="meta">{t(locale, 'footer.browse')}</p>
              <ul className="mt-3 flex flex-col gap-2">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="link-quiet text-small text-[var(--text-secondary)]"
                    >
                      {t(locale, item.label)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div>
              <p className="meta">{t(locale, 'footer.subscribe')}</p>
              <ul className="mt-3 flex flex-col gap-2">
                <li>
                  <a
                    href="/feed.xml"
                    className="link-quiet text-small text-[var(--text-secondary)]"
                  >
                    RSS
                  </a>
                </li>
                <li>
                  <a
                    href={SITE_LINKS.community}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-quiet text-small text-[var(--text-secondary)]"
                  >
                    {t(locale, 'footer.community')}
                  </a>
                </li>
                <li>
                  <a
                    href={SITE_LINKS.core}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-quiet text-small text-[var(--text-secondary)]"
                  >
                    {t(locale, 'footer.coreRepo')}
                  </a>
                </li>
                <li>
                  <a
                    href={SITE_LINKS.theme}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-quiet text-small text-[var(--text-secondary)]"
                  >
                    {t(locale, 'footer.themeRepo')}
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </Container>
      </div>

      {/* 版权与备案：备案关闭或未配置时整项不出现，不留「ICP：」空标签 */}
      <div className="border-t border-[var(--edge)]">
        <Container width="wide">
          <div className="flex flex-col gap-2 py-5 text-meta sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[var(--text-secondary)]">
              © {yearLabel} {authorName}
            </p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {icp.enabled && icp.label ? (
                <a
                  href={icp.url ?? ICP_QUERY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-quiet text-[var(--text-tertiary)]"
                >
                  {icp.label}
                </a>
              ) : null}
              <p className="text-[var(--text-tertiary)]">{t(locale, 'footer.builtWith')}</p>
            </div>
          </div>
        </Container>
      </div>
    </footer>
  )
}