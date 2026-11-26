import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { footerSinceYear, getThemeConfig } from '@/core/config/theme'
import type { ThemeFooterLink } from '@/core/config/theme'
import type { SiteIdentity } from '@/lib/api'
import { getLocale } from '@/lib/i18n/server'
import { t } from '@/lib/i18n/dictionary'
import { siteDescription, siteTitle } from '@/lib/site'
import { cn } from '@/lib/utils/cn'
import { FooterPresence } from './footer-presence'
import { FooterSettings } from './footer-settings'

/**
 * 站点级固定信息
 *
 * 这两个地址都实测可达（HTTP 200），不接受拼接或猜测：
 *   - Mix Space Core：后端仓库本身
 *   - Folio 主题：本项目的仓库
 *
 * 页脚只在这里写一次，正文里不再出现字面量地址。
 */
const PROJECT_LINKS = {
  core: 'https://github.com/mx-space/core',
  theme: 'https://github.com/miaoermua/design',
} as const

/** 备案查询的官方入口：ICP 配了号码但链接非法时退到这里，而不是渲染坏地址 */
const ICP_QUERY_URL = 'https://beian.miit.gov.cn/'

/** Shiro 式页脚：分类导航在上，版权与出处在下，语言/主题贴在右下。 */
export async function SiteFooter({ identity }: { identity: SiteIdentity | null }) {
  const [theme, locale] = await Promise.all([getThemeConfig(), getLocale()])

  const title = siteTitle(identity)
  const authorName = identity?.owner.name ?? title
  const authorSign = identity?.owner.introduce ?? siteDescription(identity)
  // 年份来自 Theme Snippet；未配置时退回当前年，不编造站龄
  const currentYear = new Date().getFullYear()
  const sinceYear = footerSinceYear(theme.footer.since, currentYear)
  const yearRange = sinceYear === currentYear ? `${currentYear}` : `${sinceYear}–${currentYear}`

  const { icp, linkSections } = theme.footer

  return (
    <footer
      className={cn(
        'mt-[var(--spacing-section)] border-t border-[var(--edge)]',
        linkSections.length > 0 && 'site-footer--has-nav',
      )}
    >
      <Container width="wide">
        {linkSections.length > 0 ? (
          <nav className="site-footer__nav" aria-label={t(locale, 'footer.navigation')}>
            <ul className="site-footer__nav-list">
              {linkSections.map((section, index) => (
                <li key={`${section.name}:${index}`} className="site-footer__nav-group">
                  <span className="site-footer__nav-label">
                    {section.name}
                    <ChevronRight />
                  </span>
                  <ul className="site-footer__nav-links">
                    {section.links.map((link) => (
                      <li key={link.href}>
                        <FooterLink link={link} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className="site-footer__inner">
          {/* 信息区：两行。第二行是一条可换行的流，链接不拆成独立段落。 */}
          <div className="site-footer__info">
            <p className="site-footer__line text-meta">
              <span className="meta">© {yearRange}</span>{' '}
              <span className="text-small font-serif font-medium text-[var(--text-heading)]">
                {authorName}
              </span>
              {authorSign ? (
                <>
                  <span aria-hidden="true" className="footer-sep">
                    ｜
                  </span>
                  <span className="text-small text-[var(--text-secondary)]">{authorSign}</span>
                </>
              ) : null}
            </p>

            {/*
             * 第二行：出处、备案、在线状态与自定义链接共用同一条流。
             * 用 flex-wrap 而不是若干 <p>：宽度不足时换行，但每个 `.meta-unit`
             * 是**不可拆**的整体（分隔符跟着它后面的链接走，`nowrap`），
             * 所以换行只发生在链接之间，不会出现「行尾一个孤零零的｜」。
             *
             * 这一行是 <div> 而不是 <p>：在线状态是个客户端组件，内部有浮层
             * （列表 + 段落），放进 <p> 会构成非法的块级嵌套。
             */}
            <div className="site-footer__meta text-meta">
              <span className="site-footer__meta-unit">
                Powered by{' '}
                <a
                  href={PROJECT_LINKS.core}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="link-quiet"
                >
                  Mix-Space
                </a>
                .{' '}
                <a
                  href={PROJECT_LINKS.theme}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="link-quiet"
                >
                  Design
                </a>
                .
              </span>

              {icp.enabled && icp.label ? (
                <span className="site-footer__meta-unit">
                  <span aria-hidden="true" className="footer-sep">
                    ｜
                  </span>
                  <a
                    href={icp.url ?? ICP_QUERY_URL}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="link-quiet"
                  >
                    {icp.label}
                  </a>
                </span>
              ) : null}

              {/*
               * 在线状态固定排在这一行末尾：它属于「站点的运行状态」，
               * 与版权/出处/备案是同一类信息，不干扰上面的署名行。
               * 未连接时组件自己返回 null，这里不会留下空单元或多余分隔符。
               */}
              <FooterPresence />
            </div>
          </div>

          {/* 设置区：全站唯一的语言与主题入口，两个控件紧挨成一组。 */}
          <div className="site-footer__settings">
            <FooterSettings />
          </div>
        </div>
      </Container>
    </footer>
  )
}

function FooterLink({ link }: { link: ThemeFooterLink }) {
  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noreferrer noopener"
        className="link-quiet site-footer__nav-link"
      >
        {link.name}
      </a>
    )
  }

  return (
    <Link href={link.href} className="link-quiet site-footer__nav-link">
      {link.name}
    </Link>
  )
}

function ChevronRight() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="site-footer__nav-chevron">
      <path
        d="m7.5 4.5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
