import { Container } from '@/components/ui/container'
import { footerSinceYear, getThemeConfig } from '@/core/config/theme'
import type { SiteIdentity } from '@/lib/api'
import { siteDescription, siteTitle } from '@/lib/site'

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
 * 只回答两个问题：这里是谁、这套东西是谁做的。
 *   - 第一栏：`Since 2021  名字 ｜ 个性签名`
 *   - 第二栏：`Powered by Mix-Space. Design.` + ICP
 *
 * 刻意不再放：页脚导航（与顶栏重复）、社交图标（正文已有 Social 组件）、
 * RSS（走 /feed，由站点元信息暴露）、项目宣传链接列表。
 * 页脚是收束，不是第二个导航。
 */
export async function SiteFooter({ identity }: { identity: SiteIdentity | null }) {
  const theme = await getThemeConfig()

  const title = siteTitle(identity)
  const authorName = identity?.owner.name ?? title
  const authorSign = identity?.owner.introduce ?? siteDescription(identity)
  // 年份来自 Theme Snippet；未配置时退回当前年，不编造站龄
  const sinceYear = footerSinceYear(theme.footer.since, new Date().getFullYear())

  const { icp } = theme.footer

  return (
    <footer className="mt-[var(--spacing-section)] border-t border-[var(--edge)]">
      <Container width="wide">
        {/* 左侧两栏、右侧留白：两列宽度固定，宽屏下不撑满版心，
            给将来的第三块内容留出位置，也不靠「右对齐」制造距离 */}
        <div className="grid gap-8 py-10 md:grid-cols-[minmax(0,24rem)_minmax(0,24rem)] md:gap-16">
          <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="meta tabular-nums">Since {sinceYear}</span>
            <span className="text-body font-serif text-[var(--text-heading)]">{authorName}</span>
            {authorSign ? (
              <>
                <span aria-hidden="true" className="text-[var(--text-tertiary)]">
                  ｜
                </span>
                <span className="text-small text-[var(--text-secondary)]">{authorSign}</span>
              </>
            ) : null}
          </p>

          <p className="text-meta text-[var(--text-secondary)]">
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
            {icp.enabled && icp.label ? (
              <>
                <span aria-hidden="true" className="meta-sep" />
                <a
                  href={icp.url ?? ICP_QUERY_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="link-quiet whitespace-nowrap"
                >
                  {icp.label}
                </a>
              </>
            ) : null}
          </p>
        </div>
      </Container>
    </footer>
  )
}
