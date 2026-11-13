import { CoverImage } from '@/components/ui/cover-image'
import type { FriendLink } from '@/lib/api'
import { cn } from '@/lib/utils/cn'
import { Postmark } from './postmark'

/** 只接受 http(s)：友链 URL 来自后端，主题不替它承担 javascript: 之类的风险 */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

/**
 * 友链明信片卡
 *
 * 整张卡片是一张横向的暖纸明信片（桌面 312 × 174 ≈ 1.79:1）：右上角贴一枚
 * 独立的小邮票（细齿孔 + 纸边 + 轻投影），邮票里是「同源模糊底 + 清晰圆头像」
 * 的双层头像；圆形日戳直径略大于邮票，压在邮票左下角与纸面的交界处形成骑缝。
 *
 * 版式是两列：左列整块文字垂直居中（名称在上、简介紧随其下，各最多两行），
 * 右列只有邮票；日戳只压邮票与两者之间的列间隙，不吃文字的宽度。
 * 层级由样式表固定：纸面 0 < 文字 1 < 邮票 2 < 日戳 3。
 */
export function FriendCard({ link }: { link: FriendLink }) {
  const clickable = isHttpUrl(link.url)

  const stampFace = link.avatar ? (
    <CoverImage
      src={link.avatar}
      alt=""
      width={128}
      height={128}
      className="size-full object-cover"
    />
  ) : (
    <span aria-hidden="true" className="friend-postcard__initial">
      {link.name.slice(0, 1)}
    </span>
  )

  const body = (
    <>
      <span aria-hidden="true" className="friend-postcard__paper" />

      <span aria-hidden="true" className="friend-postcard__stamp">
        <span className="friend-postcard__stamp-paper" />
        <span className="friend-postcard__stamp-inner">
          {link.avatar ? (
            <CoverImage
              src={link.avatar}
              alt=""
              width={320}
              height={320}
              className="friend-postcard__glow"
            />
          ) : (
            <span className="friend-postcard__glow-fallback" />
          )}
          <span className="friend-postcard__portrait">
            {link.avatar ? (
              <CoverImage
                src={link.avatar}
                alt=""
                width={96}
                height={96}
                className={cn('size-full object-cover', 'friend-postcard__face')}
              />
            ) : (
              stampFace
            )}
          </span>
        </span>
      </span>

      <span aria-hidden="true" className="friend-postcard__mark">
        <Postmark seed={`${link.id}|${link.url}`} />
      </span>

      <div className="friend-postcard__body">
        <h2 className="friend-postcard__title line-clamp-2">{link.name}</h2>
        {link.description ? (
          <p className="friend-postcard__desc line-clamp-2">{link.description}</p>
        ) : null}
      </div>
    </>
  )

  const className = cn(
    'friend-postcard',
    clickable ? 'friend-postcard--link' : 'friend-postcard--static',
  )

  return clickable ? (
    <a href={link.url} target="_blank" rel="noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  )
}
