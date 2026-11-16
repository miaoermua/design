import Link from 'next/link'
import type { Tag } from '@/lib/api'
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/dictionary'
import { tagPath } from '@/lib/routes'
import { cn } from '@/lib/utils/cn'

/**
 * 标签索引签
 *
 * 形状是一张从书页边缘伸出来的纸签：左边一个朝左的尖角，右边是圆角矩形，
 * 两者由同一块纸（同一个元素）裁出来，不是「箭头按钮 + 卡片」两件东西。
 * 具体形状在 tag-note.css 里用 clip-path 实现，这里只负责结构。
 *
 * 纸色由标签名的稳定哈希映射到五档固定序列：同名恒同色，标签增删、排序变化
 * 都不会影响其它标签的颜色。不用随机数，也不依赖调用方的排序。
 */

const TONES = ['sage', 'blue', 'clay', 'ochre', 'cream'] as const

/**
 * FNV-1a 32 位哈希（就地实现，不跨 feature 复用以免 taxonomy 依赖 friends）。
 * 只吃标签名本身：服务端与浏览器都按 UTF-16 code unit 计算，结果一致。
 */
function hashTagName(name: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < name.length; index += 1) {
    hash ^= name.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * 标签名 → 纸色档位。
 *
 * 单独导出是为了可测：颜色跟着名字走这件事（同名恒同色、与列表顺序无关）
 * 只能靠纯函数断言，渲染层看不出来。组件内部也走这个函数，避免两套规则。
 */
export function tagTone(name: string): (typeof TONES)[number] {
  return TONES[hashTagName(name) % TONES.length]
}

interface TagNoteListProps {
  tags: Tag[]
  className?: string
  locale?: Locale
}

export function TagNoteList({ tags, className, locale = DEFAULT_LOCALE }: TagNoteListProps) {
  return (
    <ul className={cn('tag-notes', className)}>
      {tags.map((tag) => {
        const tone = tagTone(tag.name)
        return (
          <li key={tag.name} className="tag-notes__item">
            <Link href={tagPath(tag.name)} className="tag-note">
              <span className={cn('tag-note__body', `tag-note__body--${tone}`)}>
                <span className="tag-note__label">#{tag.name}</span>
                {tag.count !== null ? (
                  <span className="tag-note__count">
                    · {tag.count}
                    <span className="sr-only">{t(locale, 'tags.articleSuffix')}</span>
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
