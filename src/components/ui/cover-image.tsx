import { cn } from '@/lib/utils/cn'

interface CoverImageProps {
  src: string
  alt: string
  width?: number | null
  height?: number | null
  className?: string
  /** 首屏大图使用 eager，其余一律 lazy */
  priority?: boolean
}

/**
 * 封面图
 *
 * 不使用 next/image：用户的对象存储域名不可预知，主题无法替部署者维护
 * remotePatterns。这里用原生 <img>，保留原始比例与尺寸提示，避免布局跳动。
 *
 * 宽度由调用方决定（封面传 aspect-* + w-full，头像传 size-*）：这里不写
 * w-full，否则 class 冲突只能靠样式表顺序裁决，头像会被撑成整行宽。
 */
export function CoverImage({ src, alt, width, height, className, priority }: CoverImageProps) {
  return (
    <img
      src={src}
      alt={alt}
      width={width ?? undefined}
      height={height ?? undefined}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('block bg-[var(--surface-sunk)] object-cover', className)}
    />
  )
}
