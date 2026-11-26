/**
 * Mix Space API v2 — 活动/房间契约
 *
 * 来源：线上实测（2026-11-26，core v12.10.0）
 *
 *   GET /api/v2/activity/rooms      ← 注意是**单数** activity
 *   GET /api/v2/activity/online-count
 *
 * `activity/rooms` 实测响应（只留结构与关键字段）：
 *
 *   {
 *     "rooms": ["lang:zh-CN", "article-200512341081591808"],
 *     "room_count": { "lang_zh_cn": 2, "article_200512341081591808": 1 },
 *     "objects": {
 *       "posts": [{
 *         "title": "…", "slug": "…", "created_at": "…",
 *         "category": { "id": "…", "name": "博客", "slug": "blog", "type": 0 },
 *         "category_id": "…", "id": "200512341081591808"
 *       }],
 *       "notes": [], "pages": [], "recentlies": []
 *     }
 *   }
 *
 * 两个容易踩空的地方：
 *   1. 房间名本身是 `article-<id>`（`buildArticleRoomName()` 用连字符），
 *      但**响应里的键名被整体 snake_case 化**：`-` 与 `:` 都变成 `_`，
 *      于是 `article-<id>` 变成 `article_<id>`、`lang:zh-CN` 变成 `lang_zh_cn`。
 *      用连字符去查 `room_count[...]` 会永远拿到 undefined。
 *   2. `objects` 按类型分数组返回（posts / notes / pages / recentlies），
 *      类型信息来自「在哪一个数组里」，不在行内。
 *
 * `notes` 行带 `nid`（自增 id，路由用），`posts` 行带 `category.slug`；
 * 两者都是导航所需，缺失时对应条目应当被丢弃而不是猜地址。
 */

export interface V2ActivityRoomRef {
  id?: unknown
  nid?: unknown
  slug?: unknown
  title?: unknown
  category?: unknown
}

export interface V2ActivityRooms {
  rooms?: unknown
  /** snake_case 之后的对象：键是 `article_<id>` / `lang_<lang>` */
  room_count?: unknown
  objects?: {
    posts?: unknown
    notes?: unknown
    pages?: unknown
    recentlies?: unknown
  }
}
