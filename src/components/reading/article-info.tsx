import type { Locale } from '@/lib/i18n/config'
import { t } from '@/lib/i18n/dictionary'
import { formatDate, formatTime } from '@/lib/utils/date'

/** CC BY-NC-SA 4.0 官方许可协议页面（与正文声明严格对应，不指向模糊的「许可」首页） */
const LICENSE_URL = 'https://creativecommons.org/licenses/by-nc-sa/4.0/'

interface ArticleInfoProps {
  title: string
  /** 作者名；站点没有配置 owner 时不渲染这一行，而不是写「佚名」 */
  author: string | null
  /** 规范化后的绝对地址；为 null 时不渲染链接行 */
  url: string | null
  publishedAt: string
  modifiedAt: string | null
  timeZone: string
  locale: Locale
  /**
   * 是否展示版权 / 许可声明。
   *
   * 来自 core 的 `copyright` 布尔值（仅文章有，日记没有这个字段）。
   * 关闭时只保留事实性的「文章信息」，不擅自给作品附加许可条款。
   */
  showLicense?: boolean
}

/**
 * 文章信息
 *
 * 位置：正文结束处、相邻文章之前。它是**收束性的元数据**，
 * 让读者在离开页面前能一眼拿到「这篇是谁写的、原文在哪、什么时候改的」，
 * 以及转载 / 许可的边界。
 *
 * 字号统一用设计系统里最小的一级（`--text-meta`）：这段信息需要可读，
 * 但不该和正文争夺注意力。键与值做两列对齐，扫读时不必逐行读句子。
 */
export function ArticleInfo({
  title,
  author,
  url,
  publishedAt,
  modifiedAt,
  timeZone,
  locale,
  showLicense = false,
}: ArticleInfoProps) {
  const dateTime = (iso: string) => ({
    dateTime: iso,
    text: `${formatDate(iso, timeZone)} ${formatTime(iso, timeZone)}`,
  })

  const published = dateTime(publishedAt)
  // 修改时间与发布时间同一天时不再重复一行，避免同一串数字出现两次
  const modified = modifiedAt && modifiedAt !== publishedAt ? dateTime(modifiedAt) : null

  return (
    <section className="article-info" aria-labelledby="article-info-heading">
      <h2 id="article-info-heading" className="article-info__heading">
        {t(locale, 'article.info.label')}
      </h2>

      <dl className="article-info__rows">
        <div className="article-info__row">
          <dt>{t(locale, 'article.info.title')}</dt>
          <dd>{title}</dd>
        </div>

        {author ? (
          <div className="article-info__row">
            <dt>{t(locale, 'article.info.author')}</dt>
            <dd>{author}</dd>
          </div>
        ) : null}

        {url ? (
          <div className="article-info__row">
            <dt>{t(locale, 'article.info.url')}</dt>
            <dd>
              <a href={url} className="article-info__link">
                {url}
              </a>
            </dd>
          </div>
        ) : null}

        <div className="article-info__row">
          <dt>{t(locale, 'article.info.published')}</dt>
          <dd>
            <time dateTime={published.dateTime}>{published.text}</time>
          </dd>
        </div>

        {modified ? (
          <div className="article-info__row">
            <dt>{t(locale, 'article.info.modified')}</dt>
            <dd>
              <time dateTime={modified.dateTime}>{modified.text}</time>
            </dd>
          </div>
        ) : null}
      </dl>

      {showLicense ? (
        <div className="article-info__license">
          <p>{t(locale, 'article.info.commercial')}</p>
          <p>
            {t(locale, 'article.info.licensePrefix')}{' '}
            <a
              href={LICENSE_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="article-info__link"
            >
              {t(locale, 'article.info.licenseName')}
            </a>{' '}
            {t(locale, 'article.info.licenseSuffix')}
          </p>
        </div>
      ) : null}
    </section>
  )
}
