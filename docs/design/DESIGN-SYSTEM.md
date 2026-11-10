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

铁律（由 `tests/design-tokens.test.ts` 守护）：

- 组件层不出现 HEX / `rgb()` 字面量。
- 组件层不出现 `dark:` 变体，暗色只覆盖 token。
- 任何 `var(--x)` 必须有定义（排除第三方前缀 `--tw-/--shiki/--katex/--mermaid/--hljs`）。

---

## 3. 色彩

### 3.1 亮色（默认，`:root`）

| 角色 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| 页面底 | `--color-paper` | `#f3f0e7` | `body`、`--surface` |
| 抬升面 | `--color-paper-raised` | `#f8f6ef` | 卡片、浮层、`--reading-surface` 基色 |
| 最高面 | `--color-paper-lift` | `#ffffff` | 内缘高光、玻璃 rim |
| 下沉面 | `--color-paper-sunk` | `#e9e5d9` | 代码块底、空状态 |
| 更深 | `--color-paper-deep` | `#dfd9c9` | 极少数描边阴影 |
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

---

## 4. 语义变量（组件唯一可用层）

| 变量 | 代理到 | 场景 |
| --- | --- | --- |
| `--surface` | `--color-paper` | 页面底 |
| `--surface-raised` | `--color-paper-raised` | 卡片/浮层 |
| `--surface-lift` | `--color-paper-lift` | 最高层 |
| `--surface-sunk` | `--color-paper-sunk` | 代码块、空状态 |
| `--surface-glass` | `--color-frost` | 玻璃基色 |
| `--text-primary` / `--text-strong` | ink / ink-soft | 正文 / 强调 |
| `--text-secondary` | ink-muted | 说明文、meta（**meta 不得用 tertiary**） |
| `--text-tertiary` | ink-faint | 12px 以下禁止用于正文 |
| `--text-heading` | heading | 所有标题与卡片标题 |
| `--edge` / `--edge-strong` | line / line-strong | 实线 / 虚线 |
| `--edge-frost` | `color-mix(frost 72%, ink 8%)` | 纸面外框、导航条下边 |
| `--accent` / `--accent-soft` / `--accent-strong` / `--accent-wash` / `--accent-line` | 见上表 | 交互与强调 |
| `--reading-surface` | `color-mix(paper-raised 94%, paper)` | 阅读纸面 |
| `--code-surface` | `paper-sunk` | 行内代码、代码块 |
| `--focus-ring` | `2px solid var(--accent)` | 全站唯一焦点样式 |
| `--shadow-raise` / `--shadow-pop` | 基于 `--shadow-color` | 纸面抬起 / 浮层 |

---

## 5. 排版

| 角色 | Token | 值 | 用途 |
| --- | --- | --- | --- |
| Display | `--text-display` | `clamp(2.125rem, 1.35rem + 3.1vw, 3.25rem)`，lh 1.1，ls −0.024em | 首页 hero、内页大标题 |
| Title | `--text-title` | `clamp(1.625rem, 1.35rem + 0.75vw, 2.125rem)`，lh 1.26 | 文章 h1、页面标题 |
| H2 | `--text-h2` | 1.375rem / 1.4 | 正文二级标题、区块标题 |
| H3 | `--text-h3` | 1.125rem / 1.5 | 卡片标题、正文三级标题 |
| Body | `--text-body` | 1.0625rem / 1.82 | 阅读正文 |
| Lead | `--text-lead` | 1.125rem / 1.8 | 导语、摘要 |
| Small | `--text-small` | 0.9375rem / 1.7 | 说明文 |
| Caption | `--text-caption` | 0.8125rem / 1.6 | 图注、注释 |
| Meta | `--text-meta` | 0.75rem / 1.5 | 日期、阅读数、kicker |
| Code | `--text-code` | 0.875rem / 1.7 | 行内与代码块 |

字体栈：

- 标题 `--font-serif`：`Source Han Serif SC → Noto Serif SC → Songti SC → SimSun → Georgia`
- 正文 `--font-sans`：`ui-sans-serif → -apple-system → PingFang SC → Noto Sans SC`
- 代码 `--font-mono`：`ui-monospace → JetBrains Mono → SF Mono → Menlo`

规则：

- **标题衬线、正文无衬线**。正文用衬线只在两处允许：导语/摘要（`text-lead`）与引用块（`.prose blockquote`）。
- 中文标题不额外加字距，英文大标题用负字距（`tracking-[-0.02em]`）。
- `.meta` = `--text-meta` + `--text-secondary` + `letter-spacing: 0.04em` + `tabular-nums`；分隔点用 `.meta-sep`（`·` 前后 0.5em）。

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
| 动效 | `--duration-fast/base/slow` | 140 / 240 / 420ms | 只解释状态变化 |
| 缓动 | `--ease-out-soft` | `cubic-bezier(.22,.61,.36,1)` | 默认 |

断点：`40rem`（640，纸面起铺）、`64rem`（1024，阅读区加宽）、`80rem`（1280，文章 TOC 侧栏）。移动优先，组件内不写自定义断点。

---

## 7. 材质层（可整体关闭）

| 类 | 实现 | 用量 |
| --- | --- | --- |
| `.paper-grain` | 单层 `feTurbulence` SVG 噪点，`position: fixed`，`opacity var(--material-grain-opacity)` | 全站 1 层，不随内容滚动 |
| `.paper-ambient` | 两组径向渐变（顶部受光 + 右下阴影），对比度极低 | 全站 1 层 |
| `.reading-sheet` | `<640` 无底色；`≥640` 铺 `--reading-surface` + `--edge-frost` 细边 + `--shadow-raise`；`≥1024` 内边距 3.5rem | 文章/日记详情各 1 个 |
| `.glass-bar` | `rgb(220 229 229 / .9)` + `backdrop-filter: saturate(1.25) blur(14px)` + 内缘高光 | 仅 `SiteHeader` |
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

- 正文 `.prose` 走 `--font-sans`，17px / 1.82；标题、引用为衬线。
- `h2` 用 1.375rem + 上方 2.4em 留白；`h3` 1.125rem。
- 链接：默认 `--accent-strong` + `text-decoration-color: --accent-soft`，hover 实线。
- 引用：`border-left: 2px solid --edge-strong`，`--text-secondary`，取消斜体（中文斜体难读）。
- 行内代码：`--code-surface` 底 + `--radius-xs` + `--text-code`；代码块用 Shiki 主题，外层纸面与 `--code-surface` 对齐。
- 表格：表头 `--text-secondary` 小字，行分隔 `--edge`，移动端横向滚动并保留最小列宽。
- 图片：`figure` 内 `border: --edge`，`figcaption` 居中 `text-caption`；Gallery/Carousel 沿用既有 `media.css`，只换 token。
- KaTeX：继承正文色；独立公式允许横向滚动。
- Mermaid：`theme: 'base'` + 从 token 解析出的 sRGB，节点底色 `--accent-wash`，边 `--text-tertiary`。
- 脚注、@提及：`footnotes.css` / `mentions.css`，只用语义变量。

---

## 11. 可访问性

- 正文/背景 ≥ 4.5:1，标题 ≥ 7:1（亮暗两套都在 `tests/design-tokens.test.ts` 里算）。
- `.meta` 一律 `--text-secondary`；`--text-tertiary` 只用于非文本或 ≥14px。
- 焦点环全站一致，不 `outline: none`。
- 动效受 `prefers-reduced-motion` 与 `motion-safe:` 控制。
- 玻璃受 `prefers-reduced-transparency` 控制，退化后仍可读。
- 语义结构：每页一个 `h1`；列表页用 `article` + `h2/h3`；TOC 用 `nav[aria-label]`。

---

## 12. 扩展一个新的 Token（流程）

1. 判断属于哪一层：调色板（`@theme`）/ 语义别名（`:root`）/ 材质参数（`:root` 的 `--material-*`）。**不要**直接给组件加 HEX。
2. 亮色写在 `@theme` 与 `:root`，暗色只覆盖对应变量（保持同名）。
3. `pnpm test` —— 引用完整性、硬编码、对比度三项会立刻告诉你漏了哪。
4. 在本文第 3/4/5 节补一行；本文与 `tokens.css` 必须同批更新。

---

## 13. 文件清单

```
docs/design/DESIGN-SYSTEM.md          ← 本文
docs/design/PHASE-0-AUDIT.md          ← 改造前的问题清单（含证据）
docs/design/PHASE-1-3-REPORT.md       ← Token / 布局 / 阅读体验三阶段的交付报告
docs/design/shots/*.png               ← 真实截图（亮/暗/移动端）
src/design-system/tokens/tokens.css
src/design-system/styles/material.css
src/design-system/styles/{prose,media,footnotes,mentions,containers}.css
tests/design-tokens.test.ts
```
