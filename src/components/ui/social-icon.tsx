import type { SocialIconType, ThemeSocialIcon } from '@/core/config/theme'
import { IMPLEMENTED_ICON_TYPES, safeCssIconClass } from '@/core/config/theme/social'

/**
 * 社交图标
 *
 * 三种图标来源，能力不同，这里逐条说明：
 *
 *   - `builtin`：**唯一完全可用的默认路径**。纯内联 SVG，不走任何外部
 *     请求，随组件进 RSC payload，不需要处理字体未加载时的 FOUC。
 *   - `css`：渲染一个 `<i class="...">`，靠 `iconStylesheets` 里的样式表
 *     把 class 变成字形。这是唯一会额外加载外部资源的类型，所以它的
 *     前提条件也最硬——没有声明样式表时，class 只是一个没有意义的字符串，
 *     这里直接降级，避免页面上出现看不见的空位。
 *   - `iconify`：**尚未实现**。本主题没有 Iconify 运行时（那是要额外拉
 *     `@iconify/*` 与按需 CSS 的客户端能力），因此这里只做降级。
 *     配置层仍会解析并保留这个名称，方便将来接入；但不会假装它已经生效。
 *
 * 关键约束：**配置只能提供图标名，永远不能提供标记**。`builtin` 走 switch
 * 查表，`css` 只接受白名单字符的 class 串，两者都不可能注入 SVG/HTML。
 */

const BRAND_LABEL: Record<string, string> = {
  github: 'GitHub',
  x: 'X',
  twitter: 'X',
  telegram: 'Telegram',
  bilibili: '哔哩哔哩',
  zhihu: '知乎',
  email: 'Email',
  mail: 'Email',
  netease: '网易云音乐',
  rss: 'RSS 订阅',
}

/** 平台键 → 可读标题；未收录的平台直接用键名，不猜品牌 */
export function socialLabel(platform: string): string {
  return BRAND_LABEL[platform.toLowerCase()] ?? platform
}

interface BuiltinIconProps {
  /** 图标键，例如 github；未知键退回首字母方块 */
  name: string
  className?: string
}

/** 内置 SVG 图标集合：只用几何图形，不内嵌第三方品牌字标 */
export function BuiltinSocialIcon({ name, className }: BuiltinIconProps) {
  const key = name.toLowerCase()
  const common = {
    'aria-hidden': true as const,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
  }

  switch (key) {
    case 'github':
      return (
        <svg {...common}>
          <path d="M9 19c-4 1.5-4-2.5-6-3m12 5v-3.5a3 3 0 0 0-.8-2.3c2.7-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.6 11.6 0 0 0-6 0C6.5 2.5 5.5 2.8 5.5 2.8a4.3 4.3 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.2c0 4.6 2.8 5.7 5.5 6a3 3 0 0 0-.8 2.3V21" />
        </svg>
      )
    case 'x':
    case 'twitter':
      return (
        <svg {...common}>
          <path d="M4 4l16 16M20 4L4 20" />
        </svg>
      )
    case 'telegram':
      return (
        <svg {...common}>
          <path d="M21 4L3 11l5 2 2 6 3-4 5 3z" />
        </svg>
      )
    case 'bilibili':
      return (
        <svg {...common}>
          <rect x="3" y="7" width="18" height="13" rx="3" />
          <path d="M7 4l3 3M17 4l-3 3M8 12v2M16 12v2" />
        </svg>
      )
    case 'zhihu':
      return (
        <svg {...common}>
          <path d="M5 5h6v9a3 3 0 0 1-3 3H6M14 5h5v14M14 11h5" />
        </svg>
      )
    case 'email':
    case 'mail':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      )
    case 'netease':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M9.5 9v6l5-3z" />
        </svg>
      )
    case 'rss':
      // RSS 的通用符号：左下角的发射点 + 两道同心弧
      return (
        <svg {...common}>
          <circle cx="5.5" cy="18.5" r="1.2" />
          <path d="M5.5 11.5a7 7 0 0 1 7 7M5.5 5a13.5 13.5 0 0 1 13.5 13.5" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8.5v7M8.5 12h7" />
        </svg>
      )
  }
}

/** 渲染时再校验一次 class：解析层校验过，但组件可能被别处直接调用 */
function cssIconClass(icon: ThemeSocialIcon): string | null {
  return safeCssIconClass(icon.name)
}

export function isIconTypeImplemented(type: SocialIconType): boolean {
  return IMPLEMENTED_ICON_TYPES.includes(type)
}

interface SocialIconProps {
  /** 图标描述；null / 未声明时渲染兜底图形 */
  icon: ThemeSocialIcon | null
  className?: string
}

export function SocialIcon({ icon, className }: SocialIconProps) {
  if (!icon) return <BuiltinSocialIcon name="unknown" className={className} />

  if (icon.type === 'css') {
    const safe = cssIconClass(icon)
    // 样式表缺失时 class 无法解析，这里不输出一个「看不见的 <i>」
    return safe ? <i aria-hidden="true" className={safe} /> : (
      <BuiltinSocialIcon name="unknown" className={className} />
    )
  }

  if (icon.type === 'iconify') {
    // 未实现：明确降级，而不是留白
    return <BuiltinSocialIcon name="unknown" className={className} />
  }

  return <BuiltinSocialIcon name={icon.name} className={className} />
}
