import Link from 'next/link'
import type { Diary } from '@/lib/api'
import { CoverImage } from '@/components/ui/cover-image'
import { firstImageSource } from '@/lib/content/inline-media'
import { t, tf } from '@/lib/i18n/dictionary'
import { getLocale } from '@/lib/i18n/server'
import { notePath } from '@/lib/routes'
import { formatCompact, formatTime, formatWeekday } from '@/lib/utils/date'
import { excerpt } from '@/lib/utils/text'

/** 摘要字数：中文在 `--text-small` 下约 3.5 行，配合下面的 line-clamp 兜底 */
const EXCERPT_LENGTH = 140

/**
 * 代表图宽度上限（320 / 340px）。
 *
 * 参考稿给的范围是 300–340px：小于手机端正文栏，大于缩略图。再宽就会把
 * 「标题 + 摘要 + 图」读成一张卡片，而这里的图只是正文预览。
 */
const COVER_BOX = 'max-w-[20rem] sm:max-w-[21.25rem]'

/** 竖图与长截图的高度上限：宽高都受限时图片仍按原比例缩放，只是不再无边界拉长 */
const COVER_SIZING = 'h-auto max-h-[22rem] w-auto max-w-full'

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
 *
 * 排版上不再给时刻留独立左栏（那要吃掉 52px 横向空间，而 `HH:mm` 只有 32px）：
 * 时刻、当日状态、专栏合成标题上方一条 12px 元信息行，日期刻度由上层的
 * 日期分组提供。层级因此是「日期 → 标题 → 摘要」，与参考稿一致。
 */
export async function DiaryEntry({ diary, timeZone }: DiaryEntryProps) {
  const locale = await getLocale()
  const chips = [diary.mood, diary.weather, diary.location, diary.topic?.name].filter(
    (chip): chip is string => Boolean(chip),
  )

  // 受密码保护时后端返回空正文；这里再显式挡一次，避免将来漏掉后从摘要泄出内容
  const readable = !diary.hasPassword
  const preview = readable ? excerpt(diary.content, EXCERPT_LENGTH) : ''
  const cover = readable ? pickCover(diary) : null
  // 附件带真实宽高时按原比例铺开；取不到尺寸才退回 4:3 比例盒占位
  const coverHasSize = Boolean(cover?.width && cover?.height)

  return (
    <article className="diary-entry">
      {/*
        元信息行：日期 → 星期 → 时刻 → 心情/天气/地点/专栏 → 书签。
        日期在行首并用标题色 + 600 字重，是参考稿里「June 11, 2026  Strategy」
        那一档；其余项保持 meta 的次级灰度。全部 12px，一行放不下才换行，
        不为了整齐去拆成两行小字——两行同灰度的 meta 堆在一起会读成噪声。
      */}
      <div className="meta flex flex-wrap items-baseline gap-x-1 gap-y-1">
        <time dateTime={diary.publishedAt} className="font-semibold text-[var(--text-heading)]">
          {formatCompact(diary.publishedAt, timeZone)}
        </time>
        <span className="meta-sep">{formatWeekday(diary.publishedAt, timeZone)}</span>
        <span className="meta-sep">{formatTime(diary.publishedAt, timeZone)}</span>
        {chips.length > 0 ? <span className="meta-sep">{chips.join(' · ')}</span> : null}
        {diary.bookmark ? <span className="meta-sep">{t(locale, 'diary.bookmark')}</span> : null}
      </div>

      {/* 标题与摘要同吃一个 measure：宽栏下长标题不会拉成一整行，
          标题 / 摘要 / 图共用同一条左基线 */}
      <h3 className="text-rowtitle mt-2 max-w-[var(--measure-note)] font-serif text-[var(--text-heading)]">
        <Link href={notePath(diary.nid)} className="diary-entry__title-link link-quiet">
          {diary.title}
        </Link>
      </h3>

      {diary.hasPassword ? (
        <p className="text-small mt-2.5 text-[var(--text-secondary)]">
          {t(locale, 'diary.protected')}
          <Link
            href={notePath(diary.nid)}
            className="link-quiet underline decoration-[var(--accent-soft)] decoration-1 underline-offset-[0.25em]"
          >
            {t(locale, 'diary.unlock')}
          </Link>
        </p>
      ) : preview ? (
        /*
         * 纯文本，不是渲染后的 HTML：`line-clamp` 只负责「不同字号下都收在
         * 3 行」，真正的长度上限由 `EXCERPT_LENGTH` 决定。只靠 CSS 裁切
         * 会让完整正文仍然进 DOM——那正是要避免的。
         */
        <p
          data-diary-excerpt="true"
          className="text-small mt-2.5 line-clamp-3 max-w-[var(--measure-note)] text-[var(--text-secondary)]"
        >
          {preview}
        </p>
      ) : null}

      {cover ? (
        /*
         * 图在摘要之后，宽度只到 320/340px，不加边框、不加卡片底：
         * 它是「这段文字配了什么图」的预览，不是条目的封面头图。
         *
         * 有原始尺寸时吃 `width`/`height` 属性走原比例（浏览器据此预留高度，
         * 截图与风景图都按各自比例显示，不做 4:3 裁切）；只有取不到尺寸时
         * 才退回比例盒 + 裁切填充，用一点裁切换掉加载后的布局跳动。
         */
        <figure className={`mt-4 ${COVER_BOX}`}>
          <CoverImage
            src={cover.src}
            alt={tf(locale, 'diary.coverAlt', { title: diary.title })}
            width={cover.width}
            height={cover.height}
            className={coverHasSize ? COVER_SIZING : 'aspect-[4/3] w-full'}
          />
        </figure>
      ) : null}

      {/* 阅读次数保留为信息；整条日记条目已由标题链接扩展为详情入口。 */}
      {diary.readCount !== null ? (
        <div className="meta mt-3">
          <span>
            {tf(locale, 'meta.readCount', { count: diary.readCount.toLocaleString(locale) })}
          </span>
        </div>
      ) : null}
    </article>
  )
}
