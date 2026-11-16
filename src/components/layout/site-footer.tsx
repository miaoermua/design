import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { footerSinceYear, getThemeConfig } from '@/core/config/theme'
import type { SiteIdentity } from '@/lib/api'
import { siteDescription, siteTitle } from '@/lib/site'
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

/**
 * 页脚
 *
 * 结构是**两个平级区域**，不是一列堆叠：
 *   - `.site-footer__info`：两行信息
 *       第一行 `© 年份区间  名字 ｜ 个性签名`
 *       第二行 `Powered by Mix-Space. Design. ｜ ICP ｜ footer.links…`
 *   - `.site-footer__settings`：语言选择器 + 三态主题（全站唯一设置入口）
 *
 * 桌面端左右并排（信息在左、设置在右），手机端上下排列。
 * 布局全部由 `.site-footer__inner` 的 grid 负责，这里不写断点类名——
 * 断点与右侧避让的推导都在 `globals.css` 那一节里，改一处就够。
 *
 * 三处内容全部来自真实接口，不写死：
 *   - 名字 / 个性签名 → `identity.owner.name` / `identity.owner.introduce`
 *   - 起始年份 → Theme Snippet 的 `footer.since`
 * 年份区间用起始年与当前年拼出；两者相同时只显示一个年份，避免「2026–2026」。
 *
 * `footer.links` 是**追加**的：接在第二行末尾，不替换版权行、Powered by、ICP。
 * 这样「加两个友链」不会意外抹掉版权信息。
 *
 * 刻意不再放：页脚导航（与顶栏重复）、社交图标（正文已有 Social 组件）、
 * RSS（走 /feed，由站点元信息暴露）。
 */
export async function SiteFooter({ identity }: { identity: SiteIdentity | null }) {
  const theme = await getThemeConfig()

  const title = siteTitle(identity)
  const authorName = identity?.owner.name ?? title
  const authorSign = identity?.owner.introduce ?? siteDescription(identity)
  // 年份来自 Theme Snippet；未配置时退回当前年，不编造站龄
  const currentYear = new Date().getFullYear()
  const sinceYear = footerSinceYear(theme.footer.since, currentYear)
  const yearRange = sinceYear === currentYear ? `${currentYear}` : `${sinceYear}–${currentYear}`

  const { icp, links } = theme.footer

  return (
    <footer className="mt-[var(--spacing-section)] border-t border-[var(--edge)]">
      <Container width="wide">
        <div className="site-footer__inner">
          {/* 信息区：两行。第二行是一条可换行的流，链接不拆成独立段落。 */}
          <div className="site-footer__info">
            <p className="site-footer__line text-meta">
              <span className="meta">© {yearRange}</span>{' '}
              <span className="text-body font-serif font-medium text-[var(--text-heading)]">
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
             * 第二行：出处、备案与自定义链接共用同一条流。
             * 用 flex-wrap 而不是若干 <p>：宽度不足时换行，但每个 `.meta-unit`
             * 是**不可拆**的整体（分隔符跟着它后面的链接走，`nowrap`），
             * 所以换行只发生在链接之间，不会出现「行尾一个孤零零的｜」。
             */}
            <p className="site-footer__meta text-meta">
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

              {links.map((link) => (
                <span key={link.url} className="site-footer__meta-unit">
                  <span aria-hidden="true" className="footer-sep">
                    ｜
                  </span>
                  {link.url.startsWith('/') && !link.url.startsWith('//') ? (
                    // 站内路径走客户端路由：页脚里的 /about 不该整页刷新
                    <Link href={link.url} className="link-quiet">
                      {link.title}
                    </Link>
                  ) : (
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="link-quiet"
                    >
                      {link.title}
                    </a>
                  )}
                </span>
              ))}
            </p>
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
