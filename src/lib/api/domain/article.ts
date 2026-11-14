import type { Attachment } from './common'

/** 文章所属分类（官方 category 内嵌对象的最小投影） */
export interface ArticleCategoryRef {
  id: string
  name: string
  slug: string
}

/** 列表 / 卡片用文章模型 */
export interface Article {
  id: string
  title: string
  slug: string
  /** 官方摘要；为 null 表示作者没写，不填充任何替代文本 */
  summary: string | null
  /** 列表返回的正文原文（带 truncate=310，仍是 Markdown/HTML）；用于生成一行正文概览 */
  text: string | null
  category: ArticleCategoryRef | null
  tags: string[]
  /** 封面 = images[0]（v2 无 cover 字段） */
  cover: Attachment | null
  createdAt: string
  modifiedAt: string | null
  /** 官方计数；null = 后端未返回，UI 不显示该项 */
  readCount: number | null
  likeCount: number | null
  commentCount: number | null
  isPinned: boolean
}

/** 详情：额外携带正文与官方关联数据 */
export interface ArticleDetail extends Article {
  /** Markdown 原文（contentFormat 为 markdown 时） */
  content: string
  contentFormat: string
  copyright: boolean
  /** 官方 related（core 侧计算），没有则为空数组 */
  related: Article[]
  /** null = 匿名请求，后端未给登录态 */
  liked: boolean | null
}

export type ArticleSort = 'createdAt' | 'modifiedAt' | 'title'

/**
 * 列表查询参数。
 *
 * `truncate` 不在这里暴露：所有列表入口必须共用同一个截断长度，
 * 由 `listArticles` 统一注入，避免某个页面漏传而拉回整篇正文。
 */
export interface ArticleListQuery {
  page?: number
  size?: number
  year?: number
  sortBy?: ArticleSort
  sortOrder?: 1 | -1
  /** 官方的分类过滤参数（逗号分隔 ID），不是 slug */
  categoryIds?: string[]
  /**
   * 内容语言（BCP 47 主标签，如 `en`）。
   * 传给后端的 `?lang=`，由 Mix Space 返回已翻译的标题与正文；不传则返回原文。
   */
  lang?: string
}
