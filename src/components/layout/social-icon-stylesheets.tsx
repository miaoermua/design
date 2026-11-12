import type { ThemeSocial } from '@/core/config/theme'
import { needsIconStylesheets } from '@/lib/social'
import { StylesheetLinks } from './stylesheet-links'

/**
 * 社交图标的样式表
 *
 * 只有当配置里真的存在 `css` 类型图标时才输出 link：
 * 配了样式表却没有图标用它，就是一次白送的阻塞请求。
 *
 * precedence 与 `folio-custom` 分开，因为两者是不同层级的东西：
 * 图标字体是「让某个 class 长出字形」，自定义样式是「覆盖站点外观」。
 * 分组之后，即使配置顺序写反，覆盖关系仍然是对的。
 */
export function SocialIconStylesheets({ social }: { social: ThemeSocial }) {
  if (!needsIconStylesheets(social)) return null
  return <StylesheetLinks urls={social.iconStylesheets} precedence="folio-social-icons" />
}
