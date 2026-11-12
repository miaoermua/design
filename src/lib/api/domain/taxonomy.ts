export interface Category {
  id: string
  name: string
  slug: string
  /** 官方 count（仅分类详情提供）；null = 未知 */
  count: number | null
}

export interface Tag {
  name: string
  count: number | null
}

/**
 * 站点身份
 *
 * 所有字段都可能为 null —— 表示后端没配，而不是「配置了空字符串」。
 * UI 必须自己决定缺省呈现（而不是在这里编造一个值）。
 */
export interface SiteIdentity {
  title: string | null
  description: string | null
  keywords: string[]
  icon: string | null
  siteUrl: string | null
  owner: {
    name: string | null
    introduce: string | null
    avatar: string | null
    socialIds: Record<string, string>
  }
  commentsEnabled: boolean
  latestDiaryId: string | null
}

export interface FriendLink {
  id: string
  name: string
  url: string
  avatar: string | null
  description: string | null
  /** core LinkState：0 已通过 / 1 审核中 / 2 已过期 / 3 已屏蔽 / 4 已拒绝 */
  state: number
  hidden: boolean
}

export interface SearchHit {
  id: string
  /** 搜索结果混排文章与日记，用类型决定跳转目标 */
  kind: 'post' | 'note'
  title: string
  /** note 命中才有 nid（本主题用 id 跳转，nid 仅作展示/备用） */
  nid: number | null
  /** 文章详情需要 slug；note 命中实测为 null */
  slug: string | null
  /** 已含后端插入的 <mark> 高亮片段；未命中片段时为 null */
  snippet: string | null
  categorySlug: string | null
  /** 分类中文名（界面上展示 name，链接用 slug） */
  categoryName: string | null
  createdAt: string
}
