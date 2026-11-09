/**
 * 站点级常量
 *
 * 这里只放「不随后端变化」的东西。站点名称/描述/头像一律来自 /aggregate，
 * 缺失时由 UI 使用下面的回退展示（回退是 UI 决策，不是数据伪造）。
 */

export const SITE_NAME_FALLBACK = 'Folio'
export const SITE_DESCRIPTION_FALLBACK = '一份纸上记录'

/** 首页各区块条数（受 v2 size 上限 50 约束） */
export const HOME_RECENT_ARTICLES = 5
export const HOME_RECENT_DIARIES = 4
export const LIST_PAGE_SIZE = 10

/** 归档页一次拉取的最大条数（v2 上限 50） */
export const ARCHIVE_PAGE_SIZE = 50
