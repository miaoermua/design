# Folio Design System · Frozen Parchment

> 冰霜纸笺：**Warm Parchment 70% · Vintage Editorial 20% · Frozen Glass 10%**
> 这份文档是「改之前先读、改之后要同步」的唯一设计口径。任何视觉决定若与本文冲突，以本文为准；本文没写的，先补文档再写代码。

---

## 1. 设计语言

| 层次 | 占比 | 承担什么 | 材质 |
| --- | --- | --- | --- |
| 暖纸 Warm Parchment | 70% | 页面底、阅读纸面、卡片 | 纸色 + 极轻颗粒 + 环境光 |
| 编辑排版 Vintage Editorial | 20% | 衬线标题、发丝线、留白、悬挂标点 | 无（纯排版） |
| 冰面 Frozen Glass | 10% | 导航条、移动端浮层、少量状态 | 半透明冰川色 + 8–16px 模糊 |

三条不可越界：

1. 冰面只给「需要压住滚动内容」的局部，**不做全屏玻璃、不给正文卡片**。
2. 主题色（Glacier）承担交互识别，**不做大面积填充**；正文永远是墨色。
3. 装饰必须有理由：无统计卡片、无渐变按钮、无位移悬浮、无霓虹。

---

## 2. Token 分层

```
src/design-system/tokens/tokens.css      ← 唯一色值/字号/间距/圆角/阴影/动效/材质来源
src/design-system/styles/material.css    ← 材质实现（颗粒、环境光、纸面、冰面）
src/design-system/styles/{prose,media,footnotes,mentions,containers}.css
src/app/globals.css                      ← base 层：元素默认样式 + 少量结构化类
```

三层结构：

1. **`@theme`** — 调色板 / 字体 / 字号 / 版心 / 间距 / 圆角 / 阴影 / 动效。Tailwind v4 会同时生成工具类（`bg-paper`、`text-ink-muted`、`text-display` …）。
2. **`:root` 语义别名** — `--surface*`、`--text-*`、`--edge*`、`--accent*`、`--focus-ring*`、`--reading-surface`、`--code-surface`、`--material-*`。
3. **组件** — 只允许消费第 2 层（`bg-[var(--surface-raised)]`）或 `@theme` 生成的工具类。

铁律（守护范围与盲区逐项列在 §14.9，不要笼统理解为"全都有测试"）：

- 组件层不出现 HEX / `rgb()` / `hsl()` 字面量。TS/TSX 与 CSS **都**检查（CSS 侧豁免 `tokens.css` 自身，它才是色值的合法来源）。
- 组件层不出现 `dark:` 变体，暗色只覆盖 token。TS/TSX 与 CSS 都检查。
- 任何 `var(--x)` 必须有定义（排除第三方前缀 `--tw-/--shiki/--katex/--mermaid/--hljs`）。
- 本文与 `tokens.css` 必须同步：文档引用的 Token 必须存在、声明为精确值的必须相等、§13 的路径必须真实（`tests/design-doc-sync.test.ts`）。


---

## 3. 色彩

### 3.1 亮色（默认，`:root`）

| 角色 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| 页面底 | `--color-paper` | `#f3f0e7` | `body`、`--surface` |
| 抬升面 | `--color-paper-raised` | `#f8f6ef` | 卡片、浮层、`--reading-surface` 基色 |
| 最高面 | `--color-paper-lift` | `#ffffff` | 内缘高光、玻璃 rim |
| 下沉面 | `--color-paper-sunk` | `#e9e5d9` | 代码块底、空状态 |
| 更深 | `--color-paper-deep` | `#dfd9c9` | 唯一的 prose 消费者落在**已失效的选择器** `.prose .spoiler`（`prose.css:323-324`，渲染器实际产出 `.md-spoiler`）；亮色渲染路径上等价于无消费者。暗色值 `#0c0f11` 被 `--material-ambient` 消费（`tokens.css:248`），所以这个 Token **不能删**，但它的亮色用途需要重新确认 |
| 冰 | `--color-frost` | `#dce5e5` | 玻璃 tint、`--edge-frost` |
| 正文 | `--color-ink` | `#525650` | 段落 |
| 强正文 | `--color-ink-soft` | `#3f433f` | 强调段、`strong` |
| 次级 | `--color-ink-muted` | `#6b6f67` | 说明文、meta（AA ≥ 4.5:1） |
| 辅助 | `--color-ink-faint` | `#85877f` | **仅 ≥14px 或非文本** |
| 标题 | `--color-heading` | `#344f58` | h1–h6、卡片标题 |
| 边界 | `--color-line` | `#d8d4c8` | 1px 分隔 |
| 强边界 | `--color-line-strong` | `#c9c8bc` | 虚线分隔、引用左边线 |
| 主题色 | `--color-accent` | `#6d9298` | 焦点环、进度条、悬停下划线 |
| 主题浅 | `--color-accent-soft` | `#a8c1c4` | 下划线装饰、图表描边 |
| 主题深 | `--color-accent-strong` | `#526f75` | **唯一可用于 12–14px 小字的强调色** |
| 主题洗 | `--color-accent-wash` | `#e4ecec` | 选中底、标签底、`::selection` |
| 主题线 | `--color-accent-line` | `#b7cbcd` | kicker 前短横线、引线 |
| 危险 | `--color-danger` | `#a4503f` | `.md-callout--error/danger`、`ErrorState` 左边线（`containers.css:39`、`error-state.tsx:17`） |
| 警告 | `--color-warning` | `#8a6a2f` | `.md-callout--warning/caution`（`containers.css:32`） |
| 成功 | `--color-success` | `#4a6b52` | `.md-callout--success/tip`、`.md-details__summary` 下边线（`containers.css:26`、`containers.css:163`） |
| 信息 | `--color-info` | `#4a6a7c` | `.md-callout--info/important`（`containers.css:20`） |

### 3.2 暗色（`[data-theme='dark']`，夜间纸墨，不是反色）

| 角色 | 值 | 说明 |
| --- | --- | --- |
| 页面底 | `#15181a` | 冷调深墨，非纯黑，避免 OLED 眩光 |
| 抬升面 | `#1b1f21` | 阅读纸面 |
| 最高面 | `#23282a` | 浮层 |
| 下沉面 | `#101315` | 代码块 |
| 正文 | `#d9dad2` | 柔白，非 `#fff` |
| 标题 | `#c6d7d9` | 带纸墨冷调 |
| 次级 | `#a3a69d` | AA |
| 辅助 | `#868981` | 仅大字/非文本 |
| 主题色 | `#8fb3b8` / 深 `#a8c1c4` | 提亮两档以保证暗底 ≥4.5:1 |
| 阴影基色 | `0 0 0` | 暗色下阴影必须纯黑 |

> 本表是 `[data-theme='dark']`（`tokens.css:208-259`）的**节选**，不是完整覆盖清单：`--color-paper-deep`、`--color-line*`、`--color-accent-wash/-line`、四个功能色、`--material-*` 的暗色值都写在源码里但未列在这里。`tests/design-doc-sync.test.ts` 因此只校验"文档列出的暗色值与源码一致"，不要求两表相等。

---

## 4. 语义变量（组件唯一可用层）

| 变量 | 代理到 | 场景 | 消费者状态 |
| --- | --- | --- | --- |
| `--surface` | `--color-paper` | 页面底 | 有 |
| `--surface-raised` | `--color-paper-raised` | 卡片/浮层、`.glass-panel` | 有 |
| `--surface-lift` | `--color-paper-lift` | （预留：最高层） | **无消费者**，见 §14.8 |
| `--surface-sunk` | `--color-paper-sunk` | 代码块、空状态 | 有 |
| `--surface-glass` | `--color-frost` | （预留：玻璃基色；冰面实际由 `--material-glass-*` 驱动） | **无消费者**，见 §14.8 |
| `--text-primary` / `--text-strong` | ink / ink-soft | 正文 / 强调 | 有 |
| `--text-secondary` | ink-muted | 说明文、meta（**meta 不得用 tertiary**） | 有 |
| `--text-tertiary` | ink-faint | 12px 以下禁止用于正文 | 有 |
| `--text-heading` | heading | 所有标题与卡片标题 | 有 |
| `--edge` / `--edge-strong` | line / line-strong | 实线 / 虚线 | 有 |
| `--edge-frost` | `color-mix(in srgb, frost 72% + ink 8%)` | 纸面外框、导航条下边 | 有 |
| `--accent` / `--accent-soft` / `--accent-strong` / `--accent-wash` / `--accent-line` | 见 §3.1 | 交互与强调 | 前四者有；`--accent-line` 仅经 Tailwind 工具类消费 |
| `--reading-surface` | `color-mix(in oklab, paper-raised 94%, paper)` | 阅读纸面 | 有 |
| `--code-surface` | `paper-sunk` | 行内代码、代码块 | 有 |
| `--focus-ring-width` | `2px` | 焦点环粗细的唯一来源 | 有（`globals.css:62`、`media.css:299`） |
| `--focus-ring-offset` | `2px` | 焦点环外偏移 | 有（`globals.css:63`） |
| `--focus-ring-color` | `--accent` | 焦点环颜色 | 仅 tokens 内部（被 `--focus-ring` 消费） |
| `--focus-ring` | `var(--focus-ring-width) solid var(--focus-ring-color)` | 全站唯一焦点样式 | 有（globals + 4 个 styles 文件） |
| `--shadow-color` | 亮 `34 40 38` / 暗 `0 0 0` | 阴影基色（RGB 三元组，供 `rgb()` 组合） | 仅 tokens 内部（被 `--shadow-raise/pop` 消费） |
| `--shadow-raise` / `--shadow-pop` | 基于 `--shadow-color` | 纸面抬起 / 浮层 | 有 |

「仅 tokens 内部」= 该变量不被组件直接引用，而是被 `tokens.css` 里另一条 Token 消费。这类 Token **不是死 Token**，删除会破坏定义链。


---

## 5. 排版

| 角色 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| Display | `--text-display` | `clamp(2.125rem, 1.35rem + 3.1vw, 3.25rem)`，lh 1.1，ls **−0.024em** | 首页 hero、内页大标题 |
| Title | `--text-title` | `clamp(1.625rem, 1.35rem + 0.75vw, 2.125rem)`，lh 1.26，ls **−0.014em** | 文章 h1、页面标题 |
| H2 | `--text-h2` | 1.375rem / lh 1.4（无字距覆盖） | 正文二级标题、区块标题 |
| H3 | `--text-h3` | 1.125rem / lh 1.5（无字距覆盖） | 卡片标题、正文三级标题 |
| Body | `--text-body` | 1.0625rem（= 17px @16px 根字号）/ lh **1.82** | `.prose` 阅读正文 |
| Lead | `--text-lead` | 1.125rem / lh 1.8 | 导语、摘要 |
| Small | `--text-small` | 0.9375rem / lh 1.7 | 说明文 |
| Caption | `--text-caption` | 0.8125rem / lh 1.6 | 图注、注释、表头 |
| Meta | `--text-meta` | 0.75rem / lh 1.5 | 日期、阅读数、kicker |
| Code | `--text-code` | 0.875rem / lh 1.7 | 行内与代码块 |

`lh` = 同族 `--text-*--line-height`；`ls` = `--text-*--letter-spacing`。只有 display 与 title 定义了字距，h2/h3 及更小层级没有字距变量 —— 组件若自行写 `tracking-*` 属于局部调整，不是 Token 缺失。

> 行高有两个基准，不要混淆：`.prose` 用 `--text-body--line-height` = 1.82（`prose.css:11`），而 `body` 元素默认是硬编码的 1.75（`globals.css:48-49`）。页面骨架（导航、页脚、空状态）落在 1.75 上，正文落在 1.82 上，是有意分工。

### 5.1 字号角色 → 实际消费者

只记录现有 Token 的语义映射，不新增平行字号。

| Token | 消费位置（节选） |
| --- | --- |
| `--text-display` | 首页 h1（`page.tsx:63`）、文章页响应式缩放（`articles/[category]/[slug]/page.tsx:154`） |
| `--text-title` | `PageHeader`（`ui/page-header.tsx:32`）、日记详情 h1 |
| `--text-h2` / `--text-h3` | `.prose` 标题、卡片标题、`friends` 等页 |
| `--text-body` | `body`、`.prose`、归档条目 |
| `--text-lead` | 首页导语（无衬线）、文章导语（衬线） |
| `--text-small` / `--text-caption` / `--text-meta` | 说明文、图注、`.meta` |
| `--text-code` | `.prose :code`（`prose.css:206`） |

同一 px 数值不代表同一语义。以下是**特殊排版用法**，尚未 Token 化，改动前请先确认是否值得升为 Token：

- 40px 日记日号：`text-[2.5rem]` + `tabular-nums`（`features/diaries/components/diary-day-group.tsx:24`）。
- 32px 归档年月标题：`text-[2rem]`（`app/archives/page.tsx:133`）。
- 标签页按计数动态取字号：`1.25 / 1.0625 / 1rem / 0.9375rem` 四档（`app/tags/page.tsx:18-22`）。
- 文章行标题（非 compact）：`text-[1.625rem]`（`features/articles/components/article-row.tsx:38`）。
- `.prose` 内部相对字号（`0.82em`、`1.04em`、`0.7em` …）是相对正文的比例微调，属于组件内部尺寸，不是新的字号角色。

### 5.2 字体栈与排版规则

字体栈（与 `tokens.css:58-64` 逐字对应；**首选**是设计意图，其余是系统回退）：

| Token | 首选 | CJK 回退 | 拉丁回退 | 关键字 |
| --- | --- | --- | --- | --- |
| `--font-serif`（标题） | `Source Han Serif SC` | `Noto Serif SC` → `Songti SC`（macOS）→ `SimSun`（Windows） | `Georgia` → `Times New Roman` | `serif` |
| `--font-sans`（正文） | `ui-sans-serif`（系统 UI 字体） | `PingFang SC`（macOS）→ `Hiragino Sans GB` → `Microsoft YaHei`（Windows）→ `Noto Sans SC`（Linux） | `-apple-system`、`Segoe UI` | `sans-serif` |
| `--font-mono`（代码） | `ui-monospace` | — | `SFMono-Regular`、`JetBrains Mono`、`SF Mono`、`Menlo`、`Consolas` | `monospace` |

- 全站**没有任何 `@font-face` / `next/font` / 字体包依赖**，字体完全来自本机已装字体。因此 `Source Han Serif SC` 在未安装它的机器上不会生效，中文标题实际落在 `Songti SC` / `SimSun` 上 —— 这直接影响 §14.1 的合成粗体风险。
- 回退顺序不是装饰品：它决定了"同一篇文章在不同系统上的字重观感"，调整前先想清楚要的是设计意图还是可用性。

规则：

- **标题衬线、正文无衬线**。`.prose` 正文用 `--font-sans`（`prose.css:9`），`.prose` 标题用 `--font-serif`（`prose.css:24`）。
- 「正文用衬线」目前**已实现两处**：`.prose blockquote` 显式 `font-family: var(--font-serif)` + `font-style: normal`（`prose.css:158-167`），文章页导语带 `font-serif`（`articles/[category]/[slug]/page.tsx:159`）。首页导语用 `text-lead` 但**不带** `font-serif`（`page.tsx:66`），所以同一个 `--text-lead` 字号在两处的字体族不同 —— 这是**已实现但未统一**的状态，见 §14.2。
- 中文标题不额外加字距；英文大标题靠 `--text-display--letter-spacing` / `--text-title--letter-spacing` 提供负字距，组件里另有少量 `tracking-*` 局部微调（如 `page.tsx:154` 的 `tracking-[-0.022em]`）。
- `.meta` = `--text-meta` + `--text-secondary` + `letter-spacing: 0.04em` + `tabular-nums`（`globals.css:147-152`）；分隔点用 `.meta-sep`（`·` 前后 0.5em，颜色 `--text-tertiary`，`globals.css:155-159`）。


---

## 6. 版心 / 间距 / 圆角 / 阴影 / 动效

| 项 | Token | 值 | 说明 |
| --- | --- | --- | --- |
| 正文版心 | `--container-prose` | 40rem | ≈36 汉字/行 @17px |
| 页面版心 | `--container-wide` | 68rem | 首页、列表页 |
| 窄栏 | `--container-narrow` | 30rem | 搜索空态等 |
| 页边距 | `--spacing-gutter` / `-lg` | 1.25rem / 2rem | `<640` / `≥640` |
| 区块间距 | `--spacing-section` | 5rem | 首页各 section 上下 |
| 区块内部 | `--spacing-stack` | 2rem | 标题与内容之间 |
| 圆角 | `--radius-xs/sm/md/pill` | 2 / 4 / 6 / 999px | 纸面用 xs，浮层用 md |
| 描边 | `--border-hairline` / `--border-rule` | 1px | 实线 / 虚线 |
| 阴影 | `--shadow-raise` / `--shadow-pop` | 双层极浅 | 全部走 `--shadow-color` |
| 动效 | `--duration-fast` | 140ms | **唯一有消费者的时长**：导航、链接下划线、代码底、预览层 |
| 动效 | `--duration-base` / `--duration-slow` | 240 / 420ms | **当前无消费者**，见 §14.8 |
| 缓动 | `--ease-out-soft` | `cubic-bezier(0.22, 0.61, 0.36, 1)` | 默认，全部 `transition`/`animation` 用它 |
| 缓动 | `--ease-in-out-soft` | `cubic-bezier(0.4, 0, 0.2, 1)` | **当前无消费者**，见 §14.8 |

断点（实测口径）：

| 断点 | 等宽 | 承担 | 实现方式 |
| --- | --- | --- | --- |
| `sm` | 40rem（640px） | 纸面起铺、页边距升到 `--spacing-gutter-lg`、阅读纸面上色 | Tailwind `sm:`（46 处）+ `material.css:53` `@media (min-width: 40rem)` |
| `lg` | 64rem（1024px） | 阅读区加宽（内边距 3.5rem） | Tailwind `lg:`（12 处）+ `material.css:63` `@media (min-width: 64rem)` |
| `xl` | 80rem（1280px） | 文章 TOC 侧栏：网格加列、`<details>` 版收起 | Tailwind `xl:`（4 处，均在 `articles/[category]/[slug]/page.tsx`） |

- Tailwind v4 走 CSS-first 配置：仓库里没有 `tailwind.config.*`，`tokens.css` 也没有覆盖 `--breakpoint-*`，所以 `sm/lg/xl` 就是 Tailwind 默认值。**没有 `md:` / `2xl:` 使用**，"移动优先 + 三档断点"目前是事实，不只是规范。
- 与断点区分开：**组件内部局部尺寸条件**不算断点。现存两处桌面优先的窄屏收紧 —— `prose.css:375` 与 `prose.css:416` 的 `@media (max-width: 640px)`，它们调整的是正文内部节奏，不要为了"统一"把它们改写成 `min-width`。
- 材质/无障碍类查询（`prefers-reduced-motion` 6 处、`prefers-reduced-transparency` 1 处）与 `@supports not (backdrop-filter)` 属于能力探测，也不属于断点。


---

## 7. 材质层（可整体关闭）

| 类 | 实现 | 用量 |
| --- | --- | --- |
| `.paper-grain` | 单层 `feTurbulence` SVG 噪点，`position: fixed`，`opacity var(--material-grain-opacity)` | 全站 1 层，不随内容滚动 |
| `.paper-ambient` | 两组径向渐变（顶部受光 + 右下阴影），对比度极低 | 全站 1 层 |
| `.reading-sheet` | `<640` 无底色；`≥640` 铺 `--reading-surface` + `--edge-frost` 细边 + `--shadow-raise`；`≥1024` 内边距 3.5rem | 文章/日记详情各 1 个 |
| `.glass-bar` | `rgb(var(--material-glass-tint) / var(--material-glass-alpha-bar))` + `backdrop-filter: saturate(var(--material-glass-saturate)) blur(var(--material-glass-blur))` + 内缘高光 `--material-glass-rim`（亮色解析为 `rgb(220 229 229 / 0.9)`、14px 模糊；暗色 tint 换成 `24 30 32`、16px） | 仅 `SiteHeader` |
| `.glass-panel` | 实色 `--surface-raised` + 边框 + `--shadow-pop`（**刻意不做玻璃**，避免菜单下正文与菜单文字叠加） | 移动端导航面板 |

退化路径：`@supports not (backdrop-filter)` → 实色纸面；`prefers-reduced-transparency: reduce` → 实色且关闭模糊。
**关闭全部材质**：删掉 `globals.css` 顶部对 `material.css` 的 `@import`，站点仍是完整的纸色排版。

---

## 8. 主题机制

1. `<html data-theme="light|dark">` 是唯一开关；`<html>` 首帧前由 `layout.tsx` 内联脚本写入（读 `localStorage.folio-theme`，缺省跟 `prefers-color-scheme`），因此不会闪烁。
2. `ThemeToggle`（客户端，`aria-pressed` + 明暗图标）只改这个属性并写 `localStorage`。
3. 所有颜色来自 CSS 变量，切主题不需要重新请求、不需要 `dark:` 类。
4. Mermaid 图表监听 `data-theme` 变化重新渲染，并在取色时把 `color-mix()/oklab()` 解析成 sRGB（见 `mermaid-hydrator.tsx`）。

---

## 9. 组件与状态

| 组件 | 文件 | 状态 |
| --- | --- | --- |
| `SiteHeader` | `layout/site-header.tsx` | sticky 玻璃条；滚动时下边线始终可见 |
| `NavLinks` | `layout/nav-links.tsx` | inline：hover 变 `--accent-strong` + 1px 下划线生长；active：`--accent` 实线；stacked：`--accent-wash` 底 |
| `ThemeToggle` | `layout/theme-toggle.tsx` | 32×32 方形按钮，hover 变 `--surface-sunk` |
| `SiteFooter` | `layout/site-footer.tsx` | 品牌 + 两组导航 + 版权，虚线分隔 |
| `Container` | `ui/container.tsx` | `prose / wide / narrow` 三档 |
| `PageHeader` | `ui/page-header.tsx` | kicker（短横线 + 12px）+ Display 标题 + 摘要 + meta |
| `ArticleRow` | `features/articles/...` | 标题 16→20px，hover 变 `--accent-strong`；日期/分类/阅读数 pill |
| `ArticleCard` | 同上 | 首页主推：图 + 标签 + 32px 衬线标题 + 摘要 |
| `ReadingProgress` | `ui/reading-progress.tsx` | 顶部 1px `--accent` 进度条，`motion-safe` 过渡 |
| `Toc` / `TocList` | `ui/toc.tsx` / `ui/toc-list.tsx` | ≥1280 sticky 右栏；<1280 折叠 `<details>`，`aria-current="location"` 跟随滚动 |
| `ArticleNeighbors` | `features/articles/...` | 虚线分隔的上一篇/下一篇，标题 hover 变主题色 |
| `DiaryDayGroup` | `features/diaries/...` | 40px 衬线日号 + `2026.11` + 星期 |
| `DiaryEntry` | 同上 | 左 60px 时间列；单图 26rem 给足版面，多图退成 3 列缩略 |
| `Pagination` | `ui/pagination.tsx` | 方形页码，当前页实底 `--text-heading` |
| `EmptyState` / `ErrorState` | `ui/*` | 虚线框 + 衬线标题 + 一句说明 + 一个出口 |

九态检查（任何交互元素都要过一遍）：default / hover / active / focus-visible / selected / disabled / loading / empty / error。焦点统一 `outline: var(--focus-ring); outline-offset: 2px`。

---

## 10. Markdown 视觉

- 正文 `.prose`：`--font-sans` + `--text-body`（17px）/ 1.82 + `letter-spacing: 0.004em`（`prose.css:8-16`）。
- 标题：`.prose :is(h1,h2,h3,h4)` 用 `--font-serif` + 600 + `letter-spacing: -0.01em`（`prose.css:23-27`）；`h2` = `--text-h2` + 上方 2.4em，`h3` = `--text-h3`，`h1` = `--text-title` + 2.6em。
- 链接：**颜色继承正文**，靠下划线识别 —— `text-decoration-color: --accent-soft`、1px、offset 0.22em；hover 升到 `--accent` + 2px（`prose.css:74-88`）。`--accent-strong` 不是链接的默认色。
- 引用：`border-left: 2px solid var(--color-accent-soft)` + `--text-secondary` + `--font-serif` + `font-style: normal`（中文斜体难读）+ `1.04em` / lh 1.85（`prose.css:158-167`）。
- 列表：`ul` 用 4px 圆点 `::before`，色为 `--color-accent-soft`（`prose.css:124-133`）；`ol > li::marker` 用 `--text-tertiary` + mono + 0.85em。
- 行内代码：`.prose code` = `--font-mono` + `0.875em`（相对正文，不是 `--text-code`）+ `--code-surface` 底 + `--radius-sm` + `overflow-wrap: anywhere`（`prose.css:189-195`）；代码块 `.prose pre` 用 `--edge` 描边、`--radius-md`、`--code-surface` 底、`--text-code` / `--text-code--line-height`、`tab-size: 2`（`prose.css:196-208`），着色交给 Shiki。
- 表格：`th` 用 `--text-caption` + 600 + `letter-spacing: 0.04em` + `text-transform: uppercase`（`prose.css:254-262`），行分隔 `--edge`；窄屏横向滚动。
- 图片：`.prose figure` **只有 `margin: 2em 0`，没有边框**（`prose.css:280-282`）；`figcaption` 居中 + `--text-caption` + `--text-secondary`（`prose.css:284-290`）。Gallery/Carousel 沿用 `media.css`，只换 Token。
- KaTeX：`.prose .katex` 放大到 `1.04em`，`.katex-display` 用 `overflow-x: auto` 允许独立公式横向滚动（`prose.css:293-302`）。
- Mermaid：未渲染态是 `--edge-strong` **虚线**占位框 + `--surface-raised` 底（`prose.css:304-316`）；渲染成功后改为实线 `--edge`（`prose.css:317-320`）。图表取色由 `mermaid-hydrator.tsx` 把 Token 解析成 sRGB（`theme: 'base'`，`mermaid-hydrator.tsx:103`）。
- 脚注、@提及、提示块：`footnotes.css` / `mentions.css` / `containers.css`。这三层里有直接消费第 1 层调色板的写法（`--color-accent-soft`、`--color-accent-wash`、`--color-danger` 等），与 §2 的"组件只消费第 2 层"并不完全一致，见 §14.3。
- **已失效的选择器**：`prose.css:323-352` 的 `.prose .spoiler` 与 `.prose .callout` 不匹配任何真实产出（渲染器给出 `.md-spoiler` / `.md-callout` / `.md-banner`，见 `inline-marks.ts:72`、`containers.css:12-38`）。它们不报错、不影响渲染，但会让人误以为样式生效 —— 处理原则见 §14.8。


---

## 11. 可访问性

对比度门限**以 `tests/design-tokens.test.ts` 的实际断言为准**（`palette()` 取 `tokens.css` 里的 HEX，`contrast()` 按 WCAG 相对亮度计算）：

| 前景 | 背景 | 门限 | 亮色 | 暗色 |
| --- | --- | --- | --- | --- |
| `--color-ink` | `--color-paper` | 亮 ≥ 4.5:1，暗 ≥ **7:1** | ✅ 已断言 | ✅ 已断言 |
| `--color-heading` | `--color-paper` | ≥ 7:1 | ✅ 已断言 | ✅ 已断言 |
| `--color-ink-muted` | `--color-paper-raised` | ≥ 4.5:1 | ✅ 已断言 | ✅ 已断言 |
| `--color-accent-strong` | `--color-paper-raised` | ≥ 4.5:1 | ✅ 已断言 | —（暗色未断言此项） |
| `--color-accent` | `--color-paper-raised` | ≥ 4.5:1 | —（亮色未断言此项） | ✅ 已断言 |

- 亮色正文是 **4.5:1（AA）**，暗色正文是 **7:1**：暗色下的正文要求比亮色更严，这是夜间纸墨的有意选择，不是笔误。
- 两色的 `--color-heading` 都要求 **≥ 7:1**。
- **未被任何断言覆盖，因此不得声称通过**：`--color-ink-soft`、`--color-ink-faint`（仅在 §3.1 以"仅 ≥14px 或非文本"约束）、`--color-accent-soft`、`--color-accent-line`、`--color-line` / `--color-line-strong`、四个功能色 `--color-danger/warning/success/info`，以及 `--reading-surface`、`--code-surface` 这类 `color-mix()` 混合后的实际底色（`palette()` 只识别 6 位 HEX，混合色不在其能力范围内）。

其余口径：

- `.meta` 一律 `--text-secondary`；`--text-tertiary` 只用于非文本或 ≥14px。
- 焦点环全站一致，不 `outline: none`。
- 动效受 `prefers-reduced-motion` 与 `motion-safe:` 控制。
- 玻璃受 `prefers-reduced-transparency` 控制，退化后仍可读。
- 语义结构：每页一个 `h1`；列表页用 `article` + `h2/h3`；TOC 用 `nav[aria-label]`。


---

## 12. 扩展一个新的 Token（流程）

1. 判断属于哪一层：调色板（`@theme`）/ 语义别名（`:root`）/ 材质参数（`:root` 的 `--material-*`）。**不要**直接给组件加 HEX。
2. 亮色写在 `@theme` 与 `:root`，暗色只覆盖对应变量（保持同名）。
3. `pnpm test` —— 引用完整性、硬编码、对比度、文档同步四组检查会立刻告诉你漏了哪（守护范围与盲区见 §14.9）。
4. 在本文第 3/4/5/6 节补一行；本文与 `tokens.css` 必须同批更新。只改一边就会被 `tests/design-doc-sync.test.ts` 拦下。

---

## 13. 文件清单

以下路径均已核对存在（`tests/design-doc-sync.test.ts` 会重复检查本节，路径失效即失败）：

```
docs/design/DESIGN-SYSTEM.md                          ← 本文

src/design-system/tokens/tokens.css                   ← 唯一 Token 来源
src/design-system/styles/material.css                 ← 材质实现
src/design-system/styles/prose.css                    ← 正文排版
src/design-system/styles/media.css                    ← 图片 / Gallery / 预览层
src/design-system/styles/containers.css               ← 提示块 / 横幅 / 折叠 / 剧透
src/design-system/styles/footnotes.css                ← 脚注
src/design-system/styles/mentions.css                 ← @提及
src/app/globals.css                                   ← base 层 + @import 编排

tests/design-tokens.test.ts                           ← Token 结构 / 引用 / 硬编码 / 对比度
tests/design-doc-sync.test.ts                         ← 文档与 Token 的同步契约
```

**本节不包含截图。** 仓库里没有 `docs/design/shots/`，也没有 `PHASE-0-AUDIT.md` / `PHASE-1-3-REPORT.md` —— 旧版本清单引用过这三个不存在的路径，现已删除。视觉验收以运行站点为准（见 §14.10）；历史审计截图位于 `docs/audits/`，不属于设计系统交付物。

---

## 14. 设计约束与实现状态

每条规则都标注它现在处于哪个状态，**不允许把 C 读成 A**：

- **A** = 已有实现，**且**由自动化测试守护。
- **B** = 已有实现，但**没有**自动化守护（靠人工评审维持）。
- **C** = 新增的设计建议，**尚未实施**，不构成当前事实。

### 14.1 CJK 字重与合成粗体风险

现状是 **B**。全站只有一档加粗：CSS 里 `font-weight: 600` 共 8 处（另有 `font-medium` = 500 一处，在 `ui/error-state.tsx:19`）。按风险分类（下表即这 8 处）：

| 位置 | 字体族 | 场景 | 合成粗体风险 |
| --- | --- | --- | --- |
| `globals.css:74`（h1–h6 默认） | `--font-sans` | 全站标题基线 | 中：`PingFang SC` 有 Semibold，macOS 上通常取真字重；`Microsoft YaHei` 只有 Regular/Bold，600 会被就近解析或合成 |
| `prose.css:25`（`.prose h1–h4`） | `--font-serif` | **中文正文标题** | **高**：`Songti SC` / `SimSun` 一般只有 Regular 与 Bold，600 极易触发浏览器合成粗体；`Source Han Serif SC` 未安装时（无 Web Font，见 §5）就落到这两个家族上 |
| `prose.css:68`（`strong`） | `--font-sans` | 强调段 | 中低：sans 家族普遍有半粗 |
| `prose.css:259`（`th`） | `--font-sans`（caption + uppercase） | 表头 | 低：拉丁为主、字号小 |
| `mentions.css:27`（`::before` 徽标 `GH`/`TW`/`TG`） | `--font-sans` | 平台徽标文字 | 低：拉丁字形 |
| `footnotes.css:60`（返回锚点标签） | `--font-sans` | 小字 + 0.12em 字距 | 低 |
| `containers.css:58`（`.md-callout__title`） | `--font-sans` | 提示块标题 | 中：内容是中文 |
| `containers.css:127`（`.md-details__summary`） | `--font-sans` | 折叠块摘要 | 中：内容是中文 |

结论与建议（**本轮不改任何 CSS 字重**）：

- 不能把 600 一律降成 500：`--font-serif` 的中文标题如果只有 Regular/Bold 两档，500 与 600 都会落到同一个真字重或同一个合成品上，**降低数值不等于降低合成风险**，反而可能让拉丁与中文看起来不一致。
- 需要人工验收的点：在 macOS（Songti）与 Windows（SimSun）上对比中文衬线标题的观感，确认是"真半粗"还是"合成粗"。若判定为不可接受的合成品，再讨论衬线标题改用 700（真 Bold）或换家族，**这是设计决策，不是文档修正**。
- 建议的自动化守护（**C**）：断言"衬线 + 600"的组合只出现在标题族选择器里，避免正文段落被加到同一组合。目前没有这类检查。

### 14.2 字号角色与衬线一致性

- 字号角色映射见 §5.1：10 个 Token 各自有明确语义，**同一 px 不代表同一语义**（`--text-h3` 与 `--text-lead` 都是 1.125rem，前者是层级、后者是语气）。**A**（`tests/design-doc-sync.test.ts` 校验映射表里的 Token 真实存在）。
- 特殊排版用法（40px 日号、32px 归档年月、标签页动态字号、文章行标题）目前是 **B**：源码里是硬编码 `text-[...]`，无 Token、无守护。是否升格为 Token 需要设计决策。
- 导语衬线不一致（文章页 serif / 首页 sans）是 **B**，属于已知的未统一状态，不是缺陷描述错误。

### 14.3 中性色阶与分层例外

纸（5 级）：`paper` 页面底 → `paper-raised` 卡片 → `paper-lift` 最高光 → `paper-sunk` 沉底 → `paper-deep` 最深（现仅暗色材质用，见 §3.1）。
墨（4 级）：`ink` → `ink-soft` → `ink-muted` → `ink-faint`，语义上"读得越少越淡"，且 `ink-faint` 只允许 ≥14px 或非文本。
线（2 级）：`line` 实线 / `line-strong` 虚线与引用左线。
**A**：`--surface*` / `--text*` / `--edge*` 与调色板的一一对应关系由 `tests/design-doc-sync.test.ts` 校验（文档 §4 的"代理到"必须与源码同批改动）。

分层例外（**B**，如实记录，不粉饰）：§2 说组件只消费第 2 层，但样式层存在直接引用第 1 层调色板的写法 —— `prose.css:132`（列表圆点 `--color-accent-soft`）、`prose.css:161`（引用左线同色）、`prose.css:324`（已失效块）、`media.css:299`（焦点环用 `--color-paper`）、`containers.css` 与 `error-state.tsx`（功能色 `--color-danger` 等）。这些引用合法（Token 存在且被 `var()` 检查放行），但"第 2 层是唯一入口"这句话在实现上并不严格成立。是否收紧为规则 **C**。

### 14.4 Accent 使用纪律

- 规则：主题色承担交互识别，**不做大面积填充**；正文永远是墨色（§1、§3.1）。
- 状态：**B**。`--color-accent` 的直接大面积使用只出现在阅读进度条、焦点环、下划线、选中底（`--accent-wash`）等处，靠人工评审维持。
- **明确不作为测试**：用源码统计去证明"Accent 视觉面积 ≤5%"是不可靠的 —— 源码里出现的次数与渲染面积没有对应关系（一个 `bg-accent-wash` 可以铺满整屏，也可以只有 2px）。因此本条**只作为视觉纪律**，由 §14.10 的人工验收负责，不新增会误报的自动测试。

### 14.5 Blur 与材质层级

现状是 **B**，且与 material.css 头注释的"backdrop-filter 只出现在 `.glass-*` 上"不一致：

| 材质 | 位置 | 模糊 | 是否走 Token |
| --- | --- | --- | --- |
| `.glass-bar`（导航条） | `material.css:73-78` | `--material-glass-blur`：亮 14px / 暗 16px | ✅ 全部 `--material-*` |
| `.glass-panel`（移动导航面板） | `material.css:84-89` | **无模糊**（刻意实色，避免菜单与正文叠字） | ✅ |
| Gallery 控制按钮 | `media.css:186-194` | **硬编码** `blur(6px)` + `color-mix(--surface-raised 88%)` | ❌ 参数不在 Token |
| 图片预览遮罩 `.md-preview` | `media.css:222-229` | **硬编码** `blur(8px)` + `color-mix(--color-ink 84%)` | ❌ 参数不在 Token |

层级判断标准（保持现状即可）：模糊只用于"必须压住滚动内容或图片"的薄层；正文卡片永不使用。**C**：把这两处硬编码 blur 收进 `--material-*`，或明确它们属于组件局部参数。

关闭路径（**A**，可人工验证）：删掉 `globals.css:3` 对 `material.css` 的 `@import`，站点仍是完整的纸色排版 —— 这是材质层与排版层解耦的真实边界。

### 14.6 动效语义与 reduced-motion

- 语义：动效**只解释状态变化**，不做装饰性位移。140ms 全站唯一实际使用的时长（导航、下划线、代码底、预览入场）；240/420ms 与 `--ease-in-out-soft` 无消费者（§14.8）。**A**：Token 存在性由测试守护；使用情况见 §14.9 盲区。
- 降级：**A** 有实现、**B** 无测试。`globals.css:27-38` 在 `prefers-reduced-motion: reduce` 下把 `scroll-behavior` 改 auto 并对所有元素施加 `animation-duration/transition-duration: 0.01ms !important`；另有 5 处局部 reduced-motion 覆盖（`prose.css`、`media.css`、`containers.css` 等）。组件层只有 2 处 `motion-safe:` 用法（含 `ui/reading-progress.tsx:44`）。
- 注意：全局 `!important` 兜底已经覆盖了绝大多数情况，`motion-safe:` 属于"额外保守"的写法，不是缺失。不要为了统一风格而新增无意义检测。

### 14.7 最小字号护栏

- 事实：**B**。最小字号角色是 `--text-meta` = 0.75rem（12px），全站最小的是 `--text-caption` 0.8125rem 之下的相对字号（`mentions.css:26` 的 `0.7em`、`footnotes.css:12` 的 `0.72em`，相对 caption 计算后可低于 12px，但都是非正文的符号/标记）。
- 颜色护栏：12px 以下禁止用 `--text-tertiary`（§3.1、§11）—— 目前**没有**自动检查能识别"某个 class 的字号 × 颜色"组合。
- 建议（**C**）：若要护栏成真，最小可行检查是"禁止出现小于 `--text-meta` 的绝对 rem/px 字号"，但必须先决定相对字号（`em`）是否豁免，否则会误报现有合法用法。

### 14.8 死 Token 的识别与处理原则

**定义（可自动判定的那一类）**：语义别名层的 Token 不生成 Tailwind 工具类，唯一消费方式是 `var()`。若它在 `tokens.css` 之外没有任何 `var()` 引用，即为死 Token。

当前命中（**A**：由 `tests/design-tokens.test.ts` 的死 Token 检查固定为白名单）：

| Token | 状态 | 处理 |
| --- | --- | --- |
| `--surface-lift` | 别名无消费者；底层 `--color-paper-lift` 经 `--material-glass-rim` / `--material-ambient` 活着 | 本轮只记录，不删 |
| `--surface-glass` | 别名无消费者；底层 `--color-frost` 经 `--edge-frost` 活着 | 同上 |
| `--duration-base` / `--duration-slow` | 无 `var()`、无 `duration-*` 工具类使用 | 同上 |
| `--ease-in-out-soft` | 无 `var()`、无 `ease-*` 工具类使用 | 同上 |

**必须区分、不得误判为死 Token**：

1. **主题内部引用**：`--focus-ring-color`、`--shadow-color` 只被 `tokens.css` 内其它 Token 消费 —— 删除会破坏定义链。
2. **调色板 → 别名链**：`--color-paper-raised`、`--color-ink-*`、`--color-heading`、`--color-line-strong` 等只在 `tokens.css` 内被第 2 层引用，是**分层正常现象**。
3. **工具类间接消费**：`@theme` 里的 Token 会生成 Tailwind 工具类（`font-serif`、`text-display`、`text-lead`、`border-line` 等已在用）。**静态源码扫描无法可靠判定这一层的死 Token**（详见 §14.9），因此不在自动检查范围内断言它们死了。
4. **样式已失效但 Token 活着**：`--color-paper-deep` 的 prose 消费者位于失效选择器内（§3.1）。这类要靠"死 CSS 检查"发现，而不是"死 Token 检查"。

**处理原则**：本轮一律**只记录，不删除**。删除 Token 属于设计决策（它可能是有意保留的预留位），且必须同批改 §3/§4/§6 与暗色覆盖。

死 CSS 的识别线索（**B**）：CSS 里出现的 `.spoiler` / `.callout` 类名与渲染器产出的 `md-*` 前缀不一致。建议的检查是"正文扩展块类名必须以 `md-` 开头"，但需要同时核对 `sanitize.ts` 的 class 白名单，否则容易误报 —— 目前**未实现（C）**。

### 14.9 自动化守护范围与盲区

| 规则 | 测试 | 状态 |
| --- | --- | --- |
| Token 族结构、暗色覆盖同名 | `design-tokens.test.ts` | A |
| `var()` 引用完整性（全 CSS + TSX） | `design-tokens.test.ts` | A |
| TS/TSX 层禁止 HEX 字面量 | `design-tokens.test.ts` | A |
| **CSS 层禁止 HEX / `rgb()` / `hsl()` 字面量**（`tokens.css` 豁免） | `design-tokens.test.ts`（本次扩展） | A |
| **CSS 层禁止 `dark:` 变体**（本次扩展） | `design-tokens.test.ts` | A |
| **语义别名死 Token 白名单**（本次新增） | `design-tokens.test.ts` | A |
| **字号角色使用情况**（本次新增） | `design-tokens.test.ts` | A |
| 对比度门限（仅 §11 表中 5 组） | `design-tokens.test.ts` | A |
| 文档 Token 存在性 / 精确值 / 字体栈 / §13 路径 | `design-doc-sync.test.ts`（本次新增） | A |
| `@theme` 调色板层是否被工具类消费 | — | **盲区**：需要 Tailwind 的类名提取，用正则冒充会误报，故不做 |
| `color-mix()` 合成色的实际对比度 | — | **盲区**：`palette()` 只解析 6 位 HEX；要覆盖需浏览器/构建期求值 |
| CSS 完整 AST 级规则（选择器有效性、死 CSS） | — | **盲区**：无依赖前提下不做脆弱解析 |
| Accent 视觉面积、材质层级、字重观感 | — | 人工验收，见 §14.10 |

### 14.10 断点使用规范与人工验收

- 断点事实与口径见 §6：**A**（只有 `sm/lg/xl` 三档，无 `md:`/`2xl:`，无 `--breakpoint-*` 覆盖）。
- 组件内部局部尺寸条件（`prose.css:375`、`prose.css:416` 的 `max-width: 640px`）不算断点，**不要为了统一而改写它们**。

以下各项**必须人工视觉验收，本任务未声称通过**：

1. 亮/暗两套在 390 / 768 / 1024 / 1280 下的标题字重观感（§14.1 的合成粗体风险）。
2. `.reading-sheet` 在 ≥640 / ≥1024 的铺纸与内边距节奏。
3. 材质全关（移除 `material.css` 导入）后版面是否仍完整。
4. Accent 的实际视觉面积占比（§14.4）。
5. Gallery 与预览层的硬编码 blur 在深色图片上是否过强（§14.5）。


