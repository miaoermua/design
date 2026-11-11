import type { SocialLink } from '@/lib/social'

/**
 * 社交图标
 *
 * 只画几何图形（不用品牌字标），原因有两个：
 *   - 品牌标志有各自的商标与使用规范，主题不该内嵌别人的 logo；
 *   - 描边图形在所有尺寸下都清晰，也不需要额外授权。
 *
 * 已知平台的图形由这里给出；未收录的平台退回首字母方块——
 * 比画一个猜错的图标诚实，也不会因为缺 icon 就不显示链接。
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
}

export function socialLabel(link: SocialLink): string {
  return BRAND_LABEL[link.label.toLowerCase()] ?? link.label
}

interface SocialIconProps {
  /** 小写平台键，例如 github */
  name: string
  className?: string
}

export function SocialIcon({ name, className }: SocialIconProps) {
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
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 8.5v7M8.5 12h7" />
        </svg>
      )
  }
}