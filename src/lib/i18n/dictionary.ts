/**
 * 界面文案字典
 *
 * 为什么需要这个文件：Mix Space 的翻译能力作用于**内容**（`?lang=` 让后端返回
 * 已翻译的 posts / notes / pages），并不翻译主题自己的按钮与区块标题——
 * 实测 `/aggregate` 的 seo.title、seo.description 在 `?lang=en` 下仍是原文，
 * 也不存在 UI 文案接口。因此界面层由本字典承担。
 *
 * 收录范围：本次改动触及的框架级文案（导航、顶栏、首页、Explore、Pages、Footer）。
 * 其余内页文案仍是中文，未纳入字典——那需要逐页重写，不属于本阶段范围。
 */

import type { Locale } from './config'

const zh = {
  'nav.home': '首页',
  'nav.articles': '文章',
  'nav.diaries': '日记',
  'nav.explore': '探索',
  'nav.pages': '页面',
  'nav.friends': '友链',
  'nav.allArticles': '全部文章',
  'nav.allDiaries': '全部日记',
  'nav.allPages': '全部页面',
  'nav.noCategories': '还没有分类',
  'nav.noTopics': '还没有专栏',
  'nav.noPages': '还没有独立页面',
  'nav.categoriesUnavailable': '分类暂时取不到',
  'nav.topicsUnavailable': '专栏暂时取不到',
  'nav.pagesUnavailable': '页面暂时取不到',
  'nav.directory': '展开更多',

  'home.kicker': '文章 · 日记 · 归档',
  'home.latestBlogs': '最近写的',
  'home.latestNotes': '日记',
  'home.allArticles': '全部文章',
  'home.allDiaries': '全部日记',
  'home.countArticles': '文章 {count} 篇',
  'home.countDiaries': '日记 {count} 篇',
  'home.latestDiary': '最新的日记 →',
  'home.emptyArticles': '还没有公开的文章',
  'home.emptyArticlesHint': '后端返回的文章列表为空（不是加载失败）。',
  'home.emptyNotes': '还没有公开的日记',
  'home.emptyNotesHint': '日记模块已启用，但列表为空。',

  'explore.title': '探索',
  'explore.kicker': '探索',
  'explore.description': '按时间找文章，或者按主题找文章。',
  'explore.tabArchives': '归档',
  'explore.tabTags': '标签',
  'explore.archivesTitle': '时间轴',
  'explore.archivesDescription': '文章与日记共用一条时间轴：最近的月份在最上面。',

  'pages.title': '独立页面',
  'pages.kicker': '页面',
  'pages.description': '不进入时间轴的常驻页面，例如站点说明与关于。',
  'pages.empty': '还没有独立页面',

  'action.search': '搜索',
  'action.mode': '切换主题',
  'action.language': '切换语言',
  'action.backToTop': '回到顶部',
  'action.menu': '菜单',
  'action.close': '关闭',

  'search.title': '搜索',
  'search.placeholder': '输入关键词…',
  'search.hint': '回车打开完整搜索结果',
  'search.empty': '没有匹配的内容',
  'search.emptyHint': '换个关键词试试。',
  'search.loading': '正在搜索…',
  'search.failed': '搜索请求失败',
  'search.openFull': '查看全部结果',

  'state.langUnavailable': '该语言暂无译文',
} as const

export type MessageKey = keyof typeof zh

const en: Record<MessageKey, string> = {
  'nav.home': 'Home',
  'nav.articles': 'Articles',
  'nav.diaries': 'Notes',
  'nav.explore': 'Explore',
  'nav.pages': 'Pages',
  'nav.friends': 'Links',
  'nav.allArticles': 'All articles',
  'nav.allDiaries': 'All notes',
  'nav.allPages': 'All pages',
  'nav.noCategories': 'No categories yet',
  'nav.noTopics': 'No topics yet',
  'nav.noPages': 'No pages yet',
  'nav.categoriesUnavailable': 'Categories unavailable',
  'nav.topicsUnavailable': 'Topics unavailable',
  'nav.pagesUnavailable': 'Pages unavailable',
  'nav.directory': 'Show more',

  'home.kicker': 'Articles · Notes · Archive',
  'home.latestBlogs': 'Latest writing',
  'home.latestNotes': 'Notes',
  'home.allArticles': 'All articles',
  'home.allDiaries': 'All notes',
  'home.countArticles': '{count} articles',
  'home.countDiaries': '{count} notes',
  'home.latestDiary': 'Latest note →',
  'home.emptyArticles': 'No public articles yet',
  'home.emptyArticlesHint': 'The backend returned an empty article list (not a failure).',
  'home.emptyNotes': 'No public notes yet',
  'home.emptyNotesHint': 'The notes module is enabled, but the list is empty.',

  'explore.title': 'Explore',
  'explore.kicker': 'Explore',
  'explore.description': 'Find writing by date, or find it by topic.',
  'explore.tabArchives': 'Archive',
  'explore.tabTags': 'Tags',
  'explore.archivesTitle': 'Timeline',
  'explore.archivesDescription': 'Articles and notes share one timeline, newest month first.',

  'pages.title': 'Pages',
  'pages.kicker': 'Pages',
  'pages.description': 'Standalone pages outside the timeline, such as this site and about.',
  'pages.empty': 'No standalone pages yet',

  'action.search': 'Search',
  'action.mode': 'Toggle theme',
  'action.language': 'Switch language',
  'action.backToTop': 'Back to top',
  'action.menu': 'Menu',
  'action.close': 'Close',

  'search.title': 'Search',
  'search.placeholder': 'Type a keyword…',
  'search.hint': 'Press Enter for full results',
  'search.empty': 'No matches',
  'search.emptyHint': 'Try a different keyword.',
  'search.loading': 'Searching…',
  'search.failed': 'Search request failed',
  'search.openFull': 'See all results',

  'state.langUnavailable': 'No translation available for this language',
}

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { zh, en }

/** 取一条界面文案；缺失键回退到中文，不回退到 key 本身（避免界面出现变量名） */
export function t(locale: Locale, key: MessageKey): string {
  return DICTIONARIES[locale]?.[key] ?? zh[key]
}

/**
 * 带占位符的文案：`{count}` 之类的简单替换。
 *
 * 刻意不引入 i18n 模板库：本项目的变量只有「数量」一种，
 * 一个 replace 就够，ICU 语法在这里是过度设计。
 */
export function tf(locale: Locale, key: MessageKey, vars: Record<string, string | number>): string {
  let text = t(locale, key)
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, String(value))
  }
  return text
}

/** 供客户端组件一次性取整份字典（避免逐条传 props） */
export function dictionary(locale: Locale): Record<MessageKey, string> {
  return DICTIONARIES[locale] ?? zh
}
