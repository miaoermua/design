import Link from 'next/link'
import type { Diary } from '@/lib/api'
import { CoverImage } from '@/components/ui/cover-image'
import { getThemeConfig } from '@/core/config/theme'
import { DonateSlot } from '@/features/donate'
import { firstImageSource } from '@/lib/content/inline-media'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { diaryPath } from '@/lib/routes'
import { formatTime } from '@/lib/utils/date'
import { excerpt } from '@/lib/utils/text'

/** 摘要字数：中文在 `--text-small` 下约 3.5 行，配合下面的 line-clamp 兜底 */
const EXCERPT_LENGTH = 140

interface DiaryEntryProps {
  diary: Diary
  timeZone: string
}

/** 列表里的代表图：地址 + 可能已知的原始尺寸 */
interface Cover {
  src: string
  width?: number
  height?: number
}

/**
 * 选一张代表图。
 *
 * 顺序：正文第一张有效图 → 第一张图片型附件。两个来源都只看**源码**，
 * 不跑 Markdown 渲染——列表页不该为了一张图付出 Shiki / KaTeX 的开销。
 *
 * 去重不是额外一步，而是「先取正文图」这个顺序的副产品：正文里已经有的图
 * 不会再从附件里挑一次（core 的 `images` 本来就是从正文抽出来的全集）。
 * 命中附件时顺手取回它带的宽高，图片加载前就能占好位。
 */
function pickCover(diary: Diary): Cover | null {
  const bodySrc = firstImageSource(diary.content)
  if (bodySrc) {
    const attachment = diary.images.find((image) => image.src === bodySrc)
    return { src: bodySrc, width: attachment?.width, height: attachment?.height }
  }

  // 视频附件不进列表：没有封面图可用，塞一个 <video> 会把索引页变成播放器
  const first = diary.images.find((image) => image.kind !== 'video')
  return first ? { src: first.src, width: first.width, height: first.height } : null
}

/**
 * 日记列表条目（**摘要**，不是正文）
 *
 * 这一版之前，列表把每条日记的完整 Markdown 渲染进来：实测一页 10 条里有
 * 一条 711 张图，整页 48 屏、DOM 里 804 个 `<img>`。列表页的职责是「让人快速
 * 判断这条要不要读」，不是让人在索引页里读完正文。
 *
 * 因此这里只做三件事：**纯文本摘要** + **一张代表图** + **一个进入详情的入口**。
 * 完整正文、代码高亮、公式与全部附件仍然在 `/diaries/:id`——那里才是阅读的地方。
 *
 * 摘要用 `excerpt()`（与首页 `DiaryCard` 同一个工具），不在组件里另写一套截断
 * 逻辑：两处对同一份数据给出不同文本，才是真正难维护的状态。
 */
export async function DiaryEntry({ diary, timeZone }: DiaryEntryProps) {
  const locale = await getLocale()
  // 与文章页同一个读取入口；getThemeConfig 在单次请求内已去重，列表里逐条调用不会重复取数
  const theme = await getThemeConfig()
  const chips = [diary.mood, diary.weather, diary.location, diary.topic?.name].filter(
    (chip): chip is string => Boolean(chip),
  )

  // 受密码保护时后端返回空正文；这里再显式挡一次，避免将来漏掉后从摘要泄出内容
  const readable = !diary.hasPassword
  const preview = readable ? excerpt(diary.content, EXCERPT_LENGTH) : ''
  const cover = readable ? pickCover(diary) : null

  return (
    <article className="grid gap-2 sm:grid-cols-[3.75rem_1fr] sm:gap-5">
      <time className="meta leading-[1.9]" dateTime={diary.publishedAt}>
        {formatTime(diary.publishedAt, timeZone)}
      </time>

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-serif text-h3 text-[var(--text-heading)]">
            <Link href={diaryPath(diary.id)} className="link-quiet">
              {diary.title}
            </Link>
          </h3>
          {chips.length > 0 ? <p className="meta">{chips.join(' · ')}</p> : null}
          {diary.bookmark ? <p className="meta">{t(locale, 'diary.bookmark')}</p> : null}
        </div>

        {diary.hasPassword ? (
          <p className="mt-2 text-small text-[var(--text-secondary)]">
            {t(locale, 'diary.protected')}
            <Link
              href={diaryPath(diary.id)}
              className="link-quiet underline decoration-[var(--accent-soft)] decoration-1 underline-offset-[0.25em]"
            >
              {t(locale, 'diary.unlock')}
            </Link>
          </p>
        ) : preview ? (
          /*
           * 纯文本，不是渲染后的 HTML：`line-clamp` 只负责「不同字号下都收在
           * 3–4 行」，真正的长度上限由 `EXCERPT_LENGTH` 决定。只靠 CSS 裁切
           * 会让完整正文仍然进 DOM——那正是要避免的。
           */
          <p
            data-diary-excerpt="true"
            className="mt-2 line-clamp-3 text-small text-[var(--text-secondary)] sm:line-clamp-4"
          >
            {preview}
          </p>
        ) : null}

        {cover ? (
          /*
           * 容器自带 `aspect-[4/3]`：图片加载前尺寸就已经确定，不会在滚动中
           * 把后面的日记往下推。`CoverImage` 只在附件带真实宽高时传 `width` /
           * `height`；正文图取不到尺寸就交给比例盒，不伪造原图比例。
           */
          <div className="mt-3 w-full max-w-[26rem] overflow-hidden border border-[var(--edge)] bg-[var(--surface-sunk)]">
            <CoverImage
              src={cover.src}
              alt={tf(locale, 'diary.coverAlt', { title: diary.title })}
              width={cover.width}
              height={cover.height}
              className="aspect-[4/3] h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="meta mt-3 flex flex-wrap items-center gap-x-1">
          <Link href={diaryPath(diary.id)} className="link-quiet">
            {t(locale, 'diary.continueReading')}
          </Link>
          {diary.readCount !== null ? (
            <span className="meta-sep">
              {tf(locale, 'meta.readCount', { count: diary.readCount.toLocaleString(locale) })}
            </span>
          ) : null}
          <DonateSlot theme={theme} className="meta-sep" />
        </div>
      </div>
    </article>
  )
}
