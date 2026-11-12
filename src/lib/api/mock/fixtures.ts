/**
 * Mock 数据（仅 MX_MOCK=1 时启用）
 *
 * 约束：这里的每一条数据都必须是 v2 契约里**真实存在**的字段与形状，
 * 且通过 `satisfies` 由 TypeScript 校验。Mock 不允许出现线上不存在的字段，
 * 也不允许为了让页面好看而伪造统计数据。
 *
 * 这些数据只用于离线预览与契约测试，绝不能作为真实请求失败后的兜底。
 */

import type { V2NoteRow } from '../contracts/v2/note'
import type { V2PostDetail, V2PostRow } from '../contracts/v2/post'
import type { V2Aggregate, V2LinkRow } from '../contracts/v2/site'
import type { V2CategoryRow, V2TagSum } from '../contracts/v2/taxonomy'
import type { V2PageRow } from '../contracts/v2/content'

const cover = (seed: string) => `https://picsum.photos/seed/${seed}/1600/1000`

/* ────────────────────────── 分类 / 标签 ────────────────────────── */

export const mockCategories: V2CategoryRow[] = [
  { id: 'c1', name: '技术笔记', slug: 'tech', type: 0, created_at: '2024-03-02T08:00:00.000Z' },
  { id: 'c2', name: '随笔', slug: 'essay', type: 0, created_at: '2024-03-02T08:00:00.000Z' },
  { id: 'c3', name: '阅读', slug: 'reading', type: 0, created_at: '2024-05-11T08:00:00.000Z' },
]

export const mockTagSums: V2TagSum[] = [
  { name: '排版', count: 2 },
  { name: '设计', count: 1 },
  { name: '前端', count: 1 },
  { name: 'TypeScript', count: 1 },
  { name: '数据库', count: 1 },
  { name: '数据结构', count: 1 },
  { name: '摄影', count: 1 },
  { name: '生活', count: 1 },
  { name: '阅读', count: 1 },
  { name: '写作', count: 1 },
]

/* ────────────────────────── 文章正文 ────────────────────────── */

const paperContent = [
  '排版的本质不是装饰，而是**控制读者的呼吸节奏**。一段文字的密度、行距与留白，决定了眼睛在纸面上移动时的停顿位置。',
  '',
  '## 一、先定行宽，再定字号',
  '',
  '中文正文的舒适行宽大约在 32 到 40 个字之间。低于 28 个字，视线会频繁回行；高于 45 个字，眼睛需要移动更大的距离才能找到下一行的起点。',
  '',
  '> 行宽不是一个像素值，而是一个字数区间。它随字号变化，也随字体变化。',
  '',
  '在 17px 的字号下，`40rem` 大约能容纳 36 个汉字，这正好落在区间的中部。',
  '',
  '## 二、留白要成比例',
  '',
  '段落之间、标题之前、区块之间的留白需要遵循同一套比例关系，否则页面会显得「有的地方太挤，有的地方太散」。本项目使用的基础节奏是：',
  '',
  '- 段落间距：1.35 倍行高',
  '- 标题上方：2.4 倍行高',
  '- 区块之间：5rem',
  '',
  '| 层级 | 用途 | 间距基准 |',
  '| --- | --- | --- |',
  '| Display | 页面主标题 | 3.5rem |',
  '| Heading | 文章内标题 | 2.4em |',
  '| Body | 正文 | 1.35em |',
  '| Metadata | 时间与分类 | 0.5rem |',
  '',
  '## 三、光与纸',
  '',
  '纸面不是纯白的。真实的纸会吸收一部分光，也会反射环境中的暖色。因此背景取 `#f7f3ec` 这类偏暖的中性色，再叠加一层极淡的颗粒：',
  '',
  '```css',
  '.paper-grain {',
  '  opacity: 0.5;',
  '  background-image: url("data:image/svg+xml,…feTurbulence…");',
  '}',
  '```',
  '',
  '颗粒的不透明度必须低到「不刻意寻找就注意不到」，否则它会变成噪声，而不是质感。',
  '',
  '## 四、数学公式与图表的排版',
  '',
  '行内公式如 $E = mc^2$ 需要与正文基线对齐；独立公式则单独占一行，并允许横向滚动：',
  '',
  '$$',
  'L = \\frac{1}{n} \\sum_{i=1}^{n} \\left( \\frac{y_i - \\hat{y}_i}{\\sigma} \\right)^2',
  '$$',
  '',
  '结构关系用图表表达更清楚：',
  '',
  '```mermaid',
  'graph LR',
  '  A[原始 Markdown] --> B[marked 解析]',
  '  B --> C[Shiki 高亮]',
  '  B --> D[KaTeX 公式]',
  '  B --> E[Mermaid 图表]',
  '  C --> F[HTML]',
  '  D --> F',
  '  E --> F',
  '```',
  '',
  '![纸面上的光](https://picsum.photos/seed/folio-paper/1400/900)',
  '',
  '*图：窗边的纸，下午四点。*',
  '',
  '## 五、克制',
  '',
  '最后一条原则：**当你犹豫要不要加一个装饰时，不加。** 排版的力量来自秩序，而不是元素的数量。',
].join('\n')

const contractContent = [
  '前后端之间的每一次「顺手猜一下字段」，都会在半年后变成一次线上空白页。',
  '',
  '## 契约层的三层结构',
  '',
  '1. **Contract**：官方响应的原样类型，一个字段都不改。',
  '2. **Adapter**：把官方字段翻译成领域模型，负责缺省语义。',
  '3. **Repository**：给业务模块用的稳定接口。',
  '',
  '```ts',
  'export function toArticle(row: V2PostRow): Article {',
  '  return {',
  '    id: String(row.id),',
  '    title: row.title,',
  '    read_count: numberOrNull(row.read_count),',
  '  }',
  '}',
  '```',
  '',
  '## 为什么不做「空数组兜底」',
  '',
  '把错误吞掉，换来的是更难排查的问题：页面上没有内容，控制台也没有报错。正确的做法是把错误暴露到错误边界，让部署者知道后端挂了。',
  '',
  '> 数据层的职责是忠实，不是讨喜。',
].join('\n')

const readingContent = [
  '今年读得不多，但读得比往年慢。慢下来的好处是，能记住一些句子。',
  '',
  '## 一、《技术与时间》',
  '',
  '技术不是工具的总和，而是人类记忆的外化。这个说法在笔记本、博客和数据库之间来回对照时，会突然变得具体。',
  '',
  '## 二、《书籍的秩序》',
  '',
  '书的秩序不是线性的。目录、索引、页边、注释共同构成了一套并行的阅读路径——这正是网页排版还没有完全学会的东西。',
  '',
  '## 三、几本小说',
  '',
  '- 《长夜》',
  '- 《雪的练习生》',
  '- 《一个人的村庄》',
  '',
  '小说提供的是时间的密度，非虚构提供的是结构的清晰。两者都需要。',
].join('\n')

const quietContent = [
  '有些软件是安静的：它不提醒你它存在，不猜测你想要什么，也不在你打字的时候弹出建议。',
  '',
  '安静的软件有三个特征：',
  '',
  '1. 默认不打扰。',
  '2. 状态可见但不喧哗。',
  '3. 失败时说清楚原因。',
  '',
  '第三条最难。大多数产品把错误藏在 toast 里，三秒后消失，用户永远不知道自己错过了什么。',
].join('\n')

const sqliteContent = [
  'B+ 树的每个节点是一页。理解这一点，索引的行为就不再神秘。',
  '',
  '## 页与分支因子',
  '',
  '在 4KB 的页里，一个整数主键的索引项大约占 13 字节，因此单页可以容纳约 300 个键。三层树即可索引约 2700 万行数据。',
  '',
  '$$',
  'N = b^{h}, \\quad b \\approx 300',
  '$$',
  '',
  '## 覆盖索引',
  '',
  '当查询需要的列都在索引里时，SQLite 可以完全不回表。这解释了为什么 `EXPLAIN QUERY PLAN` 里出现 `USING COVERING INDEX` 的查询会快一个数量级。',
  '',
  '```sql',
  'CREATE INDEX idx_posts_created ON posts (created_at DESC);',
  'EXPLAIN QUERY PLAN',
  'SELECT title, created_at FROM posts ORDER BY created_at DESC LIMIT 20;',
  '```',
].join('\n')

const winterContent = [
  '冬天的光很斜。它从窗户的右下角切进来，把桌面上的一切都拉出长长的影子。',
  '',
  '拍照的时候我尽量不去摆东西。摆出来的秩序是假的，光自己会找到它想照的地方。',
  '',
  '![冬日的光](https://picsum.photos/seed/folio-winter/1400/1000)',
  '',
  '*图：下午三点的书桌。*',
].join('\n')

/* ────────────────────────── 文章 ────────────────────────── */

const postRows: V2PostRow[] = [
  {
    id: 'p1',
    title: '纸张、留白与呼吸：把网页排版当成纸书',
    slug: 'paper-and-whitespace',
    text: paperContent,
    content_format: 'markdown',
    summary: '排版的本质不是装饰，而是控制读者的呼吸节奏。从行宽、留白、颗粒与公式排版谈起。',
    images: [{ src: cover('folio-paper'), width: 1600, height: 1000, accent: '#c9b7a3' }],
    category: { id: 'c2', name: '随笔', slug: 'essay', type: 0 },
    tags: ['排版', '设计'],
    is_published: true,
    copyright: true,
    read_count: 1284,
    like_count: 36,
    meta: null,
    created_at: '2026-11-02T09:10:00.000Z',
    modified_at: '2026-11-04T02:20:00.000Z',
  },
  {
    id: 'p2',
    title: '在前后端之间画一条契约线',
    slug: 'typescript-contract-layer',
    text: contractContent,
    content_format: 'markdown',
    summary: '契约、适配器、仓储：为什么数据层要做三件事，以及为什么不该用空数组兜底。',
    images: [{ src: cover('folio-contract'), width: 1600, height: 1000 }],
    category: { id: 'c1', name: '技术笔记', slug: 'tech', type: 0 },
    tags: ['前端', 'TypeScript'],
    is_published: true,
    copyright: false,
    read_count: 642,
    like_count: 18,
    created_at: '2026-10-18T11:40:00.000Z',
    modified_at: null,
  },
  {
    id: 'p3',
    title: '二〇二六，读过的书与记住的句子',
    slug: 'reading-notes-2026',
    text: readingContent,
    content_format: 'markdown',
    summary: '今年读得不多，但读得比往年慢。慢下来的好处是，能记住一些句子。',
    images: [{ src: cover('folio-books'), width: 1600, height: 1000 }],
    category: { id: 'c3', name: '阅读', slug: 'reading', type: 0 },
    tags: ['阅读', '写作'],
    is_published: true,
    copyright: false,
    read_count: 388,
    like_count: 22,
    created_at: '2026-09-21T07:30:00.000Z',
    modified_at: null,
  },
  {
    id: 'p4',
    title: '安静的软件',
    slug: 'quiet-software',
    text: quietContent,
    content_format: 'markdown',
    summary: '不打扰、可见、失败时说清楚原因。',
    images: null,
    category: { id: 'c2', name: '随笔', slug: 'essay', type: 0 },
    tags: ['设计', '生活'],
    is_published: true,
    copyright: false,
    read_count: 917,
    like_count: 41,
    pin_at: '2026-06-20T00:00:00.000Z',
    created_at: '2026-06-14T14:05:00.000Z',
    modified_at: null,
  },
  {
    id: 'p5',
    title: 'SQLite 索引的物理形状',
    slug: 'sqlite-index-internals',
    text: sqliteContent,
    content_format: 'markdown',
    summary: '页、分支因子与覆盖索引：从磁盘结构理解 EXPLAIN QUERY PLAN。',
    images: [{ src: cover('folio-sqlite'), width: 1600, height: 1000 }],
    category: { id: 'c1', name: '技术笔记', slug: 'tech', type: 0 },
    tags: ['数据库', '数据结构'],
    is_published: true,
    copyright: false,
    read_count: 2140,
    like_count: 63,
    created_at: '2026-02-08T03:15:00.000Z',
    modified_at: '2026-02-09T06:00:00.000Z',
  },
  {
    id: 'p6',
    title: '冬日的光',
    slug: 'winter-light',
    text: winterContent,
    content_format: 'markdown',
    summary: '冬天的光很斜，它自己会找到想照的地方。',
    images: [{ src: cover('folio-light'), width: 1600, height: 1000 }],
    category: { id: 'c2', name: '随笔', slug: 'essay', type: 0 },
    tags: ['摄影', '生活'],
    is_published: true,
    copyright: false,
    read_count: 512,
    like_count: 29,
    created_at: '2025-12-19T08:45:00.000Z',
    modified_at: null,
  },
]

export const mockPosts: V2PostRow[] = postRows

/** 详情：related 由「同分类的其它文章」构成，liked 匿名访问为 null */
export function mockPostDetail(category: string, slug: string): V2PostDetail | null {
  const row = postRows.find((item) => item.slug === slug && item.category?.slug === category)
  if (!row) return null
  return {
    ...row,
    related: postRows
      .filter((item) => item.id !== row.id && item.category?.slug === row.category?.slug)
      .slice(0, 3),
    liked: null,
  }
}

/* ────────────────────────── 日记 ────────────────────────── */

const noteRows: V2NoteRow[] = [
  {
    id: '31',
    nid: 31,
    title: '傍晚的风',
    slug: 'evening-wind',
    text: '起了风。楼下的银杏落了一地，扫地的师傅把它扫成一小堆，又故意留了一小片。\n\n回来的路上买了两个橘子，皮很厚，剥开的时候整个手都是香的。',
    content_format: 'markdown',
    is_published: true,
    has_password: false,
    mood: '平静',
    weather: '晴',
    bookmark: true,
    location: '杭州',
    images: [{ src: cover('folio-note-wind'), width: 1600, height: 1000 }],
    read_count: 96,
    like_count: 12,
    public_at: '2026-11-06T10:20:00.000Z',
    created_at: '2026-11-06T10:12:00.000Z',
    modified_at: null,
  },
  {
    id: '30',
    nid: 30,
    title: '删掉一个功能',
    slug: 'delete-a-feature',
    text: '花了一下午删掉一个自己写的功能。删的时候有点舍不得，删完之后页面安静了很多。\n\n> 功能也会过期。',
    content_format: 'markdown',
    is_published: true,
    has_password: false,
    mood: '轻松',
    weather: '阴',
    bookmark: false,
    images: null,
    read_count: 143,
    like_count: 25,
    public_at: '2026-11-03T12:40:00.000Z',
    created_at: '2026-11-03T12:40:00.000Z',
  },
  {
    id: '29',
    nid: 29,
    title: '雨',
    slug: 'rain',
    text: '下了一整天的雨。窗台上的绿萝长出了新叶，卷着，还没打开。\n\n把《书籍的秩序》最后两章读完了。',
    content_format: 'markdown',
    is_published: true,
    has_password: false,
    mood: '安静',
    weather: '雨',
    bookmark: false,
    images: null,
    read_count: 71,
    like_count: 8,
    public_at: '2026-10-28T13:05:00.000Z',
    created_at: '2026-10-28T13:05:00.000Z',
  },
  {
    id: '28',
    nid: 28,
    title: '一句话',
    slug: 'one-sentence',
    text: '把「我想要一个更好的博客」改成了「我想写一篇更好的文章」，事情突然就变简单了。',
    content_format: 'markdown',
    is_published: true,
    has_password: false,
    mood: '清醒',
    weather: '多云',
    bookmark: true,
    images: null,
    read_count: 205,
    like_count: 33,
    public_at: '2026-10-20T02:30:00.000Z',
    created_at: '2026-10-20T02:30:00.000Z',
  },
  {
    id: '27',
    nid: 27,
    title: '一些不方便公开的事',
    slug: 'private-note',
    text: '',
    content_format: 'markdown',
    is_published: true,
    has_password: true,
    mood: '复杂',
    bookmark: false,
    images: null,
    read_count: 4,
    like_count: 0,
    public_at: '2026-10-11T09:00:00.000Z',
    created_at: '2026-10-11T09:00:00.000Z',
  },
]

export const mockNotes: V2NoteRow[] = noteRows

export function mockNoteDetail(id: string): { status: number; body: unknown } | null {
  const row = noteRows.find((item) => item.id === id || String(item.nid) === id)
  if (!row) return null
  if (row.has_password) {
    return { status: 403, body: { ok: 0, code: 14000, message: '该日记受密码保护' } }
  }
  return { status: 200, body: { ...row, liked: null } }
}

/* ────────────────────────── 站点 ────────────────────────── */

export const mockAggregate: V2Aggregate = {
  user: {
    name: '林序',
    username: 'miaoermua',
    introduce: '写字，也写代码。喜欢纸、光和排版。',
    avatar: 'https://picsum.photos/seed/folio-avatar/400/400',
    social_ids: { github: 'miaoermua', rss: '' },
  },
  seo: {
    title: 'Folio',
    description: '一份关于排版、代码与日常的纸上记录。',
    keywords: ['排版', '设计', '前端', '日记'],
    icon: null,
    icon_dark: null,
  },
  url: { web_url: 'https://example.com' },
  comment_options: { disable_comment: false, allow_guest_comment: true },
  latest_note_id: { id: '31', nid: 31 },
  ai: { enable_summary: false },
}

export const mockLinks: V2LinkRow[] = [
  {
    id: 'l1',
    name: '纸上',
    url: 'https://example.org/paper',
    avatar: 'https://picsum.photos/seed/folio-link1/200/200',
    description: '一个关于排版与印刷的博客。',
    state: 0,
  },
  {
    id: 'l2',
    name: '夜航',
    url: 'https://example.org/night',
    avatar: null,
    description: '深夜写下的技术笔记。',
    state: 0,
  },
]

export const mockAboutPage: V2PageRow = {
  id: 'page-about',
  title: '关于',
  slug: 'about',
  subtitle: '写字的人',
  text: [
    '这里是一个用来放长文章和短日记的地方。',
    '',
    '白天写前端代码，晚上写字。相信排版是一种克制的手艺，也相信好的阅读体验不需要解释。',
    '',
    '## 关于这个站点',
    '',
    '- 内容托管在自建的 Mix Space 后端上',
    '- 主题是为长阅读重新设计的，不是任何现有主题的换皮',
    '- 没有统计脚本，没有推荐算法',
    '',
    '## 联系',
    '',
    '可以通过 GitCool 或邮件找到我。',
  ].join('\n'),
  content_format: 'markdown',
  created_at: '2024-03-02T08:00:00.000Z',
  modified_at: '2026-10-30T04:00:00.000Z',
}

/**
 * 独立页面列表：与 mockAboutPage 共用同一份正文来源，避免两处描述不一致。
 * order 与线上一致（是排序权重，不是 ID）。
 */
export const mockPages: V2PageRow[] = [
  mockAboutPage,
  {
    id: 'page-site',
    title: '站点',
    slug: 'site',
    subtitle: '这个站点是怎么搭起来的',
    text: [
      '## 技术栈',
      '',
      '- Next.js App Router + React Server Components',
      '- Mix Space Core 作为内容后端',
      '- 全文自托管，没有统计脚本',
      '',
      '## 关于写作',
      '',
      '文章偏长，日记偏短。两者共用一条时间轴，但阅读节奏不同。',
    ].join('\n'),
    content_format: 'markdown',
    order: 1,
    created_at: '2024-03-01T08:00:00.000Z',
    modified_at: '2026-09-12T04:00:00.000Z',
  },
]

/**
 * 主题 Snippet 的 mock 数据。
 *
 * 形状与真实后端的 YAML Snippet 一致：后端用 js-yaml 解析后返回对象，
 * 所以这里直接是对象，不是 YAML 字符串。内容覆盖各功能分区，
 * 让离线预览能验证 Footer 链接、ICP、Social 顺序、首页数量、Donate 与自定义 CSS。
 */
export const mockThemeSnippet: Record<string, unknown> = {
  footer: {
    since: 2021,
    links: [
      { name: '友链', url: 'https://www.miaoer.net/friends' },
      { name: '留言', url: 'https://www.miaoer.net/message' },
    ],
    icp: {
      enabled: true,
      label: '粤ICP备2021127881号',
      url: 'https://beian.miit.gov.cn/',
    },
  },
  social: {
    enabled: true,
    // 三种图标类型都有示例：builtin（默认路径）、css（需配样式表）、
    // iconify（当前降级，用于验证不会留白）。
    items: [
      {
        url: 'https://github.com/miaoermua',
        title: 'GitHub',
        icon: { type: 'builtin', name: 'github' },
        color: '#181717',
      },
      {
        url: 'https://t.me/miaoer_subscribe/92',
        title: 'Telegram Group',
        icon: { type: 'css', name: 'fa fa-paper-plane' },
        color: '#0088CC',
      },
      {
        url: 'mailto:i@miaoer.net',
        title: 'E-Mail',
        icon: { type: 'css', name: 'fa fa-at' },
        color: '#8E71C1',
      },
      {
        // name 保留但当前不加载：渲染层会降级成兜底图形
        url: 'https://t.me/miaoer_subscribe',
        title: 'Telegram Channel',
        icon: { type: 'iconify', name: 'mingcute:telegram-fill' },
        color: '#FFA500',
      },
    ],
    icon_stylesheets: [
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css',
    ],
  },
  custom: {
    // 与线上 Kami 片段同形状：外部样式表 URL 数组（内联 CSS 字符串已不再支持）
    css: ['https://static.miaoer.net/static/remixicon/fonts/remixicon.css'],
  },
  homepage: {
    profile: { enabled: true },
    articles: { enabled: true, limit: 6 },
    notes: { enabled: true, limit: 3 },
  },
  donate: {
    enabled: true,
    label: '赞赏',
    qrcode: [
      { name: '微信', url: 'https://picsum.photos/seed/donate-wechat/224' },
      { name: '支付宝', url: 'https://picsum.photos/seed/donate-alipay/224' },
    ],
  },
  bandevtool: { enabled: false },
}
