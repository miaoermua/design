/**
 * Mock 数据（仅 MX_MOCK=1 时启用）
 *
 * 约束：这里的每一条数据都必须是 v2 契约里**真实存在**的字段与形状，
 * 且通过 `satisfies` 由 TypeScript 校验。Mock 不允许出现线上不存在的字段，
 * 也不允许为了让页面好看而伪造统计数据。
 *
 * 这些数据只用于离线预览与契约测试，绝不能作为真实请求失败后的兜底。
 *
 * 关于内容：人物与语气参照站点作者「喵二」的公开博客改写，但**全部是演示文案**，
 * 不是原文摘录，也不代表真实发生过的事情。`read_count` / `like_count` 一律是
 * 离线预览用的演示数值，与线上真实访问量、点赞数无关。
 */

import type { V2NoteRow } from '../contracts/v2/note'
import type { V2PostDetail, V2PostRow } from '../contracts/v2/post'
import type { V2Aggregate, V2LinkRow } from '../contracts/v2/site'
import type { V2CategoryRow, V2TagSum } from '../contracts/v2/taxonomy'
import type { V2PageRow } from '../contracts/v2/content'
import type { V2TopicRow } from '../contracts/v2/topic'
import type { V2Say } from '../contracts/v2/say'
import type { V2Project } from '../contracts/v2/project'

const cover = (seed: string) => `https://picsum.photos/seed/${seed}/1600/1000`

/* ────────────────────────── 日记专栏 ────────────────────────── */

export const mockTopics: V2TopicRow[] = [
  {
    id: 't1',
    name: '日常',
    slug: 'daily',
    description: '一天里值得留下来的部分',
    created_at: '2024-03-02T08:00:00.000Z',
  },
  {
    id: 't2',
    name: '鼓捣日记',
    slug: 'daogu',
    description: '记录折腾到凌晨的那些晚上',
    created_at: '2024-06-01T08:00:00.000Z',
  },
]

/* ────────────────────────── 分类 / 标签 ────────────────────────── */

export const mockCategories: V2CategoryRow[] = [
  { id: 'c1', name: '技术笔记', slug: 'tech', type: 0, created_at: '2024-03-02T08:00:00.000Z' },
  { id: 'c2', name: '随笔', slug: 'essay', type: 0, created_at: '2024-03-02T08:00:00.000Z' },
  { id: 'c3', name: '阅读', slug: 'reading', type: 0, created_at: '2024-05-11T08:00:00.000Z' },
]

export const mockTagSums: V2TagSum[] = [
  { name: '折腾', count: 2 },
  { name: 'OpenWrt', count: 1 },
  { name: 'CatWrt', count: 1 },
  { name: 'NAS', count: 1 },
  { name: 'Rust', count: 1 },
  { name: '校园网', count: 1 },
  { name: '备份', count: 1 },
  { name: '生活', count: 1 },
  { name: '摄影', count: 1 },
  { name: '写作', count: 1 },
]

/* ────────────────────────── 文章正文 ────────────────────────── */

const dormNetworkContent = [
  '宿舍的网从来不是「网络」，是三个人轮流赌气的一台机器。这篇不复述教程，只把折腾过的地方按顺序摆出来，方便下次再犯同样的错。',
  '',
  '## 一、先确认它断在哪一层',
  '',
  '掉线的时候最容易犯的错，是从结论开始排查：先怀疑固件，再怀疑运营商，最后才发现是水晶头松了。后来我固定按顺序看：光猫的灯、主路由的 WAN 口、旁路网关的转发，最后才是 DNS。',
  '',
  '> 顺序比经验可靠。经验只在同一种故障上有效。',
  '',
  '## 二、旁路网关不是路由',
  '',
  '把旁路网关塞进 DHCP 的网关选项，叫侵入式：所有设备先过主路由，再过旁路，再从旁路出网。好处是透明，坏处是它一挂，整层楼一起掉线。非侵入式则是设备自己配静态网关，挂了只影响那几台。',
  '',
  '| 方式 | 谁受影响 | 适合谁 |',
  '| --- | --- | --- |',
  '| 侵入式 | 全部 DHCP 设备 | 想省事、能接受连坐 |',
  '| 非侵入式 | 手动配静态的设备 | 家里还有别人要用网 |',
  '',
  '## 三、把规则写成文本',
  '',
  '防火墙规则改完就忘，是这类故障反复出现的根源。所以我把它落在文件里，而不是留在后台某个页面上：',
  '',
  '```bash',
  'nft list ruleset > /etc/nftables.d/backup.nft',
  '```',
  '',
  '## 四、算一下「够用」是多少',
  '',
  '四个人一条百兆，理论上一人 25 Mbps。实际可用带宽还要乘一个效率系数：',
  '',
  '$$',
  'B_{\\text{每人}} = \\frac{B_{\\text{总}} \\cdot \\eta}{n}, \\quad \\eta \\approx 0.7',
  '$$',
  '',
  '## 五、拓扑',
  '',
  '```mermaid',
  'graph LR',
  '  A[光猫] --> B[主路由]',
  '  B --> C[交换机]',
  '  C --> D[旁路网关]',
  '  C --> E[NAS]',
  '```',
  '',
  '![机柜里的线](https://picsum.photos/seed/miaoer-rack/1400/900)',
  '',
  '*图：理过一次的线，三天后又长回去了。*',
  '',
  '## 六、最后的结论',
  '',
  '**能用的方案通常不是最优雅的那个。** 现在这套配置不好看，但它连着三个月没让我半夜起来重启。',
].join('\n')

const contractContent = [
  '每一次「顺手猜一下字段」，半年后都会变成一次空白页。',
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
  '    readCount: numberOrNull(row.read_count),',
  '  }',
  '}',
  '```',
  '',
  '## 为什么不做「空数组兜底」',
  '',
  '把错误吞掉，换来的是更难排查的问题：页面上没有内容，控制台也没有报错。正确的做法是把错误暴露到错误边界，让部署的人知道后端挂了。',
  '',
  '> 数据层的职责是忠实，不是讨喜。',
].join('\n')

const readingContent = [
  '今年读得比往年少，但比往年慢。慢下来的好处是，能记住几句。',
  '',
  '## 一、《技术与时间》',
  '',
  '技术不是工具的总和，而是记忆的外化。这个说法在笔记本、博客和数据库之间来回对照时，会突然变得具体。',
  '',
  '## 二、《书籍的秩序》',
  '',
  '目录、索引、页边、注释共同构成了一套并行的阅读路径——这正是网页排版还没有完全学会的东西。',
  '',
  '## 三、翻了两页就放下的',
  '',
  '- 《长夜》',
  '- 《雪的练习生》',
  '- 《一个人的村庄》',
  '',
  '放下不是书的问题，是那阵子每天晚上都在给路由器刷固件。',
].join('\n')

const muteContent = [
  '通知关掉一周之后，世界没有变慢，是我变慢了。',
  '',
  '安静的软件有三个特征：',
  '',
  '1. 默认不打扰。',
  '2. 状态可见但不喧哗。',
  '3. 失败时说清楚原因。',
  '',
  '第三条最难。大多数产品把错误塞进一个三秒后消失的提示里，用户永远不知道自己错过了什么。',
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
  'CREATE INDEX idx_notes_created ON notes (created_at DESC);',
  'EXPLAIN QUERY PLAN',
  'SELECT title, created_at FROM notes ORDER BY created_at DESC LIMIT 20;',
  '```',
].join('\n')

const windowContent = [
  '十一月的窗台很挤：一盆绿萝、一个空的可乐罐、两台拆开的路由器。',
  '',
  '拍照的时候我尽量不去摆东西。摆出来的秩序是假的，光自己会找到它想照的地方。',
  '',
  '![十一月的窗台](https://picsum.photos/seed/miaoer-window/1400/1000)',
  '',
  '*图：下午三点的窗台。*',
].join('\n')

/* ────────────────────────── 文章 ────────────────────────── */

const postRows: V2PostRow[] = [
  {
    id: 'p1',
    title: '把宿舍网络折腾成能用的样子',
    slug: 'dorm-network',
    text: dormNetworkContent,
    content_format: 'markdown',
    summary: '顺序比经验可靠。从断在哪一层、旁路网关怎么连坐，到把防火墙规则写成文本。',
    images: [{ src: cover('miaoer-rack'), width: 1600, height: 1000, accent: '#8a9a8f' }],
    category: { id: 'c2', name: '随笔', slug: 'essay', type: 0 },
    tags: ['折腾', 'OpenWrt'],
    is_published: true,
    copyright: true,
    read_count: 1284,
    like_count: 36,
    // AI 参与声明：数组形态（core 的复选框组），用于验证多选项叠加
    meta: { aiGen: [0, 8], keywords: ['OpenWrt', '网络'] },
    created_at: '2026-11-02T09:10:00.000Z',
    modified_at: '2026-11-04T02:20:00.000Z',
  },
  {
    id: 'p2',
    title: '契约层不是洁癖，是被坑出来的',
    slug: 'contract-layer',
    text: contractContent,
    content_format: 'markdown',
    summary: '契约、适配器、仓储：为什么数据层要做三件事，以及为什么不该用空数组兜底。',
    images: [{ src: cover('miaoer-contract'), width: 1600, height: 1000 }],
    category: { id: 'c1', name: '技术笔记', slug: 'tech', type: 0 },
    tags: ['Rust', '校园网'],
    is_published: true,
    copyright: false,
    read_count: 642,
    like_count: 18,
    created_at: '2026-10-18T11:40:00.000Z',
    modified_at: null,
  },
  {
    id: 'p3',
    title: '今年读完的，和翻两页就放下的',
    slug: 'reading-2026',
    text: readingContent,
    content_format: 'markdown',
    summary: '今年读得比往年少，但比往年慢。慢下来的好处是，能记住几句。',
    images: [{ src: cover('miaoer-books'), width: 1600, height: 1000 }],
    category: { id: 'c3', name: '阅读', slug: 'reading', type: 0 },
    tags: ['写作', '备份'],
    is_published: true,
    copyright: false,
    read_count: 388,
    like_count: 22,
    created_at: '2026-09-21T07:30:00.000Z',
    modified_at: null,
  },
  {
    id: 'p4',
    title: '关掉通知之后',
    slug: 'mute-notifications',
    text: muteContent,
    content_format: 'markdown',
    summary: '不打扰、可见、失败时说清楚原因。',
    images: null,
    category: { id: 'c2', name: '随笔', slug: 'essay', type: 0 },
    tags: ['OpenWrt', '生活'],
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
    title: 'NAS 上那个数据库，页是怎么长的',
    slug: 'sqlite-pages',
    text: sqliteContent,
    content_format: 'markdown',
    summary: '页、分支因子与覆盖索引：从磁盘结构理解 EXPLAIN QUERY PLAN。',
    images: [{ src: cover('miaoer-sqlite'), width: 1600, height: 1000 }],
    category: { id: 'c1', name: '技术笔记', slug: 'tech', type: 0 },
    tags: ['NAS', 'CatWrt'],
    is_published: true,
    copyright: false,
    read_count: 2140,
    like_count: 63,
    created_at: '2026-02-08T03:15:00.000Z',
    modified_at: '2026-02-09T06:00:00.000Z',
  },
  {
    id: 'p6',
    title: '十一月的窗台',
    slug: 'november-window',
    text: windowContent,
    content_format: 'markdown',
    summary: '窗台上有一盆绿萝、一个空可乐罐、两台拆开的路由器。',
    images: [{ src: cover('miaoer-window'), width: 1600, height: 1000 }],
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
    title: '停电二十分钟',
    slug: 'power-cut',
    text: '整栋楼停电二十分钟。来电之后第一件事不是开灯，是听路由器风扇转起来没有。\n\n风从走廊灌进来，楼下的银杏落了一地，扫地的师傅扫成一小堆，又故意留了一小片。',
    content_format: 'markdown',
    is_published: true,
    has_password: false,
    mood: '平静',
    weather: '晴',
    bookmark: true,
    location: '东莞',
    images: [{ src: cover('miaoer-note-wind'), width: 1600, height: 1000 }],
    read_count: 96,
    like_count: 12,
    // AI 参与声明：标量形态（早期单选写法），用于验证与数组形态都能解析
    meta: { aiGen: 1 },
    topic_id: 't1',
    topic: { id: 't1', name: '日常', slug: 'daily' },
    public_at: '2026-11-06T10:20:00.000Z',
    created_at: '2026-11-06T10:12:00.000Z',
    modified_at: null,
  },
  {
    id: '30',
    nid: 30,
    title: '给路由器刷回旧固件',
    slug: 'rollback-firmware',
    text: '花了一晚上把路由器刷回上一版固件。刷的时候有点舍不得，刷完之后后台安静了很多。\n\n> 新功能也会过期。',
    content_format: 'markdown',
    is_published: true,
    has_password: false,
    mood: '轻松',
    weather: '阴',
    bookmark: false,
    images: null,
    read_count: 143,
    like_count: 25,
    topic_id: 't2',
    topic: { id: 't2', name: '鼓捣日记', slug: 'daogu' },
    public_at: '2026-11-03T12:40:00.000Z',
    created_at: '2026-11-03T12:40:00.000Z',
  },
  {
    id: '29',
    nid: 29,
    title: '台风天',
    slug: 'typhoon-day',
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
    text: '把「我想买个更好的路由器」改成了「我想把现在这台修好」，事情突然就变简单了。',
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
    name: '喵二',
    username: 'miaoer',
    introduce: '缘，妙不可言。写博客，也折腾路由器和固件。',
    avatar: 'https://picsum.photos/seed/miaoer-avatar/400/400',
    social_ids: { github: 'miaoermua', rss: '' },
  },
  seo: {
    title: '喵二の小博客',
    description: '一个关于路由器、备份和日常的博客。',
    keywords: ['折腾', 'OpenWrt', '博客', '日记'],
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
    name: '拾光',
    url: 'https://example.org/light',
    avatar: 'https://picsum.photos/seed/miaoer-link1/200/200',
    description: '一个写字的人，偶尔修图。',
    state: 0,
  },
  {
    id: 'l2',
    name: '深夜调参',
    url: 'https://example.org/latenight',
    avatar: null,
    description: '凌晨两点还在看日志的博客。',
    state: 0,
  },
]

export const mockAboutPage: V2PageRow = {
  id: 'page-about',
  title: '关于',
  slug: 'about',
  subtitle: '折腾路由器的人',
  text: [
    '这里是一个用来放长文章和短日记的地方。',
    '',
    '白天上班，晚上折腾路由器和固件。相信排版是一种克制的手艺，也相信好的阅读体验不需要解释。',
    '',
    '## 关于这个站点',
    '',
    '- 内容托管在自建的 Mix Space 后端上',
    '- 主题是为长阅读重新设计的，不是任何现有主题的换皮',
    '- 没有统计脚本，没有推荐算法',
    '',
    '## 联系',
    '',
    '可以通过 GitHub 或邮件找到我。',
    '',
    '（本页为离线预览用的演示数据，不是正式站点页面。）',
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
      { title: '关于', url: '/about' },
      { title: '留言', url: '/message' },
      { title: '友链', url: '/friends' },
      { title: 'RSS', url: '/feed' },
      { title: 'GitHub', url: 'https://github.com/miaoermua/design' },
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
      {
        // 只有显式 channel: true 的项才会出现在订阅弹窗里
        url: 'https://t.me/folio_demo',
        title: 'Telegram 频道',
        icon: { type: 'builtin', name: 'telegram' },
        color: '#0088CC',
        channel: true,
      },
    ],
    icon_stylesheets: ['https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css'],
  },
  custom: {
    // 与线上 Kami 片段同形状：外部样式表 URL 数组（内联 CSS 字符串已不再支持）
    css: ['https://static.miaoer.net/static/remixicon/fonts/remixicon.css'],
  },
  homepage: {
    profile: { enabled: true },
    articles: { enabled: true, limit: 6 },
    notes: { enabled: true, limit: 3 },
    more: {
      enabled: true,
      // 三种入口各来一个：内置点赞 / 内置订阅 / 站内链接 + CSS 图标
      items: [
        { title: '点赞', type: 'like' },
        { title: '订阅', type: 'subscribe' },
        { title: '全部文章', type: 'link', url: '/articles' },
        { title: '归档', type: 'link', url: '/archives', icon: { type: 'builtin', name: 'rss' } },
        {
          title: 'GitHub',
          type: 'link',
          url: 'https://github.com/miaoermua',
          icon: { type: 'css', name: 'fa-brands fa-github' },
        },
      ],
    },
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

// ── Says ─────────────────────────────────────────────────────────

export const mockSays: V2Say[] = [
  {
    id: '100001',
    text: '少啰嗦，先看东西……',
    source: '',
    author: '罗永浩',
    created_at: '2025-06-21T10:44:17.240Z',
  },
  {
    id: '100002',
    text: '螳螂捕蝉，黄雀在后，黄雀是谁？我看不到。蝉与螳螂……倒是遍地乱跑。',
    source: '《黑神话：悟空》',
    author: '',
    created_at: '2024-08-28T07:11:04.134Z',
  },
  {
    id: '100003',
    text: '天生骄傲',
    source: '锤子科技',
    author: '',
    created_at: '2023-09-12T15:32:47.175Z',
  },
  {
    id: '100004',
    text: 'Hello, World!',
    source: 'The C Programming Language',
    author: 'Brian Kernighan',
    created_at: '2022-02-12T10:10:12.595Z',
  },
  {
    id: '100005',
    text: '不要因为走得太远而忘记为什么出发',
    source: '锤子便签',
    author: '卡里·纪伯伦',
    created_at: '2023-07-26T14:47:25.910Z',
  },
  {
    id: '100006',
    text: '星星之火，可以燎原。',
    source: '',
    author: '',
    created_at: '2022-08-13T08:53:45.332Z',
  },
]

// ── Projects ─────────────────────────────────────────────────────

export const mockProjects: V2Project[] = [
  {
    id: '200001',
    name: 'CatWrt',
    description: '基于 Lean LEDE 修改的 OpenWrt 发行版，开箱即用的路由器固件。',
    preview_url: 'https://www.miaoer.xyz',
    doc_url: 'https://www.miaoer.xyz/posts/blog/cattools',
    project_url: 'https://github.com/miaoermua/CatWrt',
    images: [],
    avatar: null,
    text: '# CatWrt\n\n开箱即用的 OpenWrt 发行版。',
    created_at: '2023-08-22T08:00:00.000Z',
  },
  {
    id: '200002',
    name: 'Folio',
    description: 'Warm-parchment Mix Space 前端主题，暖纸编辑式设计。',
    preview_url: null,
    doc_url: null,
    project_url: 'https://github.com/miaoermua/folio',
    images: [],
    avatar: null,
    text: '# Folio\n\n一个暖纸风格的博客主题。',
    created_at: '2024-05-01T00:00:00.000Z',
  },
  {
    id: '200003',
    name: 'Mix Space',
    description: '现代个人博客系统，RESTful API + 前端主题分离。',
    preview_url: 'https://mx-space.js.org',
    doc_url: 'https://mx-space.js.org',
    project_url: 'https://github.com/mx-space/core',
    images: [],
    avatar: 'https://mx-space.js.org/logo.png',
    text: '# Mix Space\n\n开源博客系统。',
    created_at: '2024-07-26T11:17:13.031Z',
  },
]
