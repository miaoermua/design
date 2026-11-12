# AGENTS.md

Folio 仓库对所有 Coding Agent 的长期工程约束。**本文件优先级高于个人习惯**；与本文冲突的做法，先提出来，不要直接执行。

文档分工：

| 文档                         | 地位                                                      |
| ---------------------------- | --------------------------------------------------------- |
| `AGENTS.md`（本文件）        | 工程约束与行为边界，长期有效                              |
| `docs/DESIGN-SYSTEM.md`      | 视觉规范权威（颜色、排版、材质、组件状态）                |
| `docs/FEATURE.md`            | 功能实现矩阵：**事实快照，不是任务清单**（维护规则见 §9） |
| `docs/audits/PHASE-*.md`     | 阶段事实与验收证据，**进度以这些报告为准**                |
| `README.md` / `.env.example` | 运行方式与配置项                                          |

---

## 1. Project Identity

- **Folio** 是基于 [Mix Space](https://github.com/mx-space/) 官方协议（**API v2 / Core 12.x**）的独立前端主题，不是 Mix Space 的 fork，也不是通用博客模板。
- 核心设计方向：**Quiet Editorial × Contemporary Publishing**。
- 视觉体系：**Frozen Parchment**（纸张的暖 + 冰面的冷，二者关系是产品的识别点）。
- 产品文案：**A Quiet Space for Thoughts**。
- 可以借鉴 Shiro / kami / mx-starter 的**产品完成度**（信息架构、交互细节、边界情况处理），但**不得复制闭源实现**，也不得把它们的内部约定当成 Mix Space 的能力。

---

## 2. Technology Stack

以 `package.json` 为准，不得凭空引入下表之外的技术。

| 层       | 实际使用                                                                       |
| -------- | ------------------------------------------------------------------------------ |
| 框架     | Next.js 15.5（App Router，`export const dynamic = 'force-dynamic'`）           |
| UI       | React 19，Server Components 优先                                               |
| 语言     | TypeScript 5.9（`strict`）                                                     |
| 样式     | Tailwind CSS v4（`@tailwindcss/postcss`，**CSS-first**，无 `tailwind.config`） |
| Markdown | `marked` + `sanitize-html` + `shiki` + `katex` + `mermaid`                     |
| 测试     | Vitest 5 + jsdom + `@testing-library/react`                                    |
| 包管理   | pnpm 10（`packageManager` 锁定版本），Node ≥ 22.12                             |
| 视觉采集 | `scripts/visual/*.mjs`：系统 Chrome + CDP 直连，**没有 Playwright/Puppeteer**  |

注意事项：

- Tailwind v4 只有 CSS 配置。设计 Token 写在 `src/design-system/tokens/tokens.css` 的 `@theme` 里，**不要**新建 `tailwind.config.*`。
- 样式入口是 `src/app/globals.css`（`@import` tokens 与各样式层）；`fonts.css` 在 `src/app/layout.tsx` 里单独引入，顺序不能随意调整。

---

## 3. Architecture Principles

**依赖方向单向**：页面 / 路由 → `src/features/*` → `src/lib/api` → 契约。反向依赖一律视为设计错误。

- **API Adapter 与 UI 分离**：`src/lib/api/` 内部再分 `client/`（HTTP）、`contracts/v2/`（上游原始形状）、`domain/`（前端领域模型）、`adapters/`（转换）、`repositories/`（页面级用例）、`mock/`（`MX_MOCK=1` fixtures）、`errors/`。
- 页面与 feature **只能从 `src/lib/api/index.ts` 取数**，不得直接 `import` `client/` 或 `contracts/`。
- **Feature Registry 是唯一开关源**：`src/core/registry/features.ts`。关闭一个模块必须同时满足三件事——导航消失（`src/core/navigation` 过滤）、路由不可达（页面顶层 `requireFeature`）、不产生请求（守卫在任何取数之前）。因此关模块是**改一个布尔值**，不是删文件。
- 每个 feature 用 `manifest.ts` 声明 `key / name / description / routes / endpoints`，让"这个模块读写哪些接口"可被检索。
- 模块设计目标是 **Enable / Disable / Replace / Remove / Configure** 五件事都成立：新模块不要写死在页面里，也不要假设自己永远开启。
- **Server Components 优先**；只有真实交互（预览、spoiler 展开、轮播、主题切换）才下沉到 Client Components，且把 `'use client'` 压到最小子树。
- **不为单个功能引入大型依赖**。新增运行时依赖需先说明：现有依赖为何不够、体积代价、是否有更小的替代。
- 禁止重复请求、重复 Markdown 解析、无谓重渲染：取数在 RSC 完成；同一份 Markdown 只解析一次；不要在 render 内做 I/O。

---

## 4. Protocol Constraints

- 严格遵循 Mix Space 官方协议，只实现 **v2**（`MX_API_VERSION=2`）。契约方言开关存在只是为未来移植留位，**当前不要实现 v3**。
- **不擅自增加上游不存在的字段**，也不要在前端"补"一个后端没有的概念。
- **不实现 Kami 不支持的扩展属性**。Kami 支持什么，就去读 Kami 的渲染器与文档，不要靠主题截图推断。
- 不根据其他主题（Shiro 等）的功能**推断 Mix Space 后端能力**；能证明的只有官方 API 文档与真实响应。
- **不改 API 契约来迁就前端表现**。渲染需要的数据要么协议里有，要么前端在 domain 层算出来。
- 新增 Markdown 能力前，先确认三件事：官方协议是否定义、`src/lib/content/` 渲染管线是否支持、`tests/` 里是否有对应安全与契约测试。三者缺一，先补证据再动代码。

---

## 5. Design System

**唯一权威**：`docs/DESIGN-SYSTEM.md`。**唯一 Token 来源**：`src/design-system/tokens/tokens.css`。

分层（自上而下，组件只能碰第二层）：

1. `@theme` — 调色板、字体栈、字号、版心、间距、圆角、阴影、动效。
2. `:root` 语义别名 + `[data-theme='dark']` 覆盖 — **组件唯一可用层**。
3. 材质参数（`material.css`）— 可整体关闭。

硬性要求：

- 组件消费**语义 Token**，不消费调色板原值。
- **禁止硬编码颜色**（含 `#hex`、`rgb()`、`oklch()` 字面量）。`tests/design-tokens.test.ts` 与 `tests/design-doc-sync.test.ts` 会直接失败。
- 浅色与暗色**语义必须一致**：暗色只覆盖 Token 值，不新增只在暗色存在的语义。
- 不随意增加渐变、阴影、`backdrop-filter`。材质是稀缺资源，多一处就掉一分。
- 不滥用卡片容器：能靠留白与分隔线解决的分组，不要套卡片。
- 不破坏 Frozen Parchment 的**纸张 / 冰面材质关系**（暖底 + 冷界面），这是识别点，不是可调参数。
- 字体使用项目自托管的 **Noto Sans SC / Noto Serif SC**；`fonts.css` **只声明 `@font-face`**，字体栈（`--font-sans` / `--font-serif` / `--font-mono`）只写在 `tokens.css` 的 `@theme` 里，**不得在 `fonts.css` 重复定义语义变量**。
- **修改字体、颜色、圆角、间距等视觉参数，必须重新执行对应视觉基线测量**（见第 8 节），并把新的数字写回报告；旧基线数字随之作废，不得继续引用。
- 新增 Token 走 `DESIGN-SYSTEM.md` §12 的流程（语义命名 → 明暗两套值 → 文档同步 → 测试）。

---

## 6. CSS and Component Rules

- **类名必须对应真实 DOM 生产者**。写选择器前先确认渲染器真的产出这个类（`src/lib/content/` 与 `src/components/markdown/`），不要照着别的主题的命名猜。
- **删除选择器前必须搜索生产者和消费者**（`grep` 类名 + 看渲染管线），确认是三无（无产出、无引用、无测试依赖）再删。
- **不保留无效的历史选择器**。`tests/markdown-css-contract.test.ts` 固化了这条：死选择器回归会让测试失败。
- **组件专属 blur 不得提升为全局材质 Token**。`material.css` 里的材质是站点级；`.glass-bar`、卡片、浮层各自的 `blur(6px)/blur(8px)` 属于组件实现细节，合并会失去局部微调能力。
- **渐进增强**：任何效果都必须有无 JavaScript 时的基本可用性。范例是 spoiler —— 无 JS 是普通可读文本，有 JS 才模糊并可展开。
- 优先语义化 HTML（`figure`/`figcaption`/`details`/`summary`/`blockquote`/`table`），不要用 `div` + `role` 重建语义。
- 交互元素必须支持：键盘可达、可见焦点状态（不要 `outline: none` 了事）、`prefers-reduced-motion` 下的降级。

---

## 7. Performance

- 图片：显式尺寸（或 `aspect-ratio`）、首屏外懒加载、不加载不需要的分辨率。本地 SVG 素材优先。
- 避免布局偏移：图片/嵌入内容预留空间；字体切换不要引起大范围重排。
- 动画优先 `transform` / `opacity`，避免触发布局与重绘的属性。
- 注意首屏字体请求量：自托管分片按 `unicode-range` 命中，**不要为了"少文件"把 202 个分片合并**（那会让首屏下载量成倍增长）。
- **不凭 bundle 体积或字体总磁盘大小推断实际网络成本**。`202 个文件 × 平均大小` 不是下载量；真实成本以网络请求记录为准。
- 性能优化必须提供**实测证据**（请求数、传输字节、时间点），没有测量就没有结论。
- **不得编造 LCP、INP、CLS、FCP 等指标**。没跑 Lighthouse 就写 NOT TESTED。

---

## 8. Testing and Validation

按影响范围选择，**改了什么就跑什么**：

| 改动                     | 必跑                                                                  |
| ------------------------ | --------------------------------------------------------------------- |
| 任何 TS/TSX              | `pnpm typecheck`、`pnpm lint`                                         |
| 任意逻辑                 | `pnpm test`                                                           |
| Markdown 渲染 / CSS 契约 | `pnpm test tests/markdown*.test.ts tests/containers.test.ts`          |
| 字体（新增/替换/改加载） | `pnpm test tests/self-hosted-fonts.test.ts`                           |
| Token / 设计文档         | `pnpm test tests/design-tokens.test.ts tests/design-doc-sync.test.ts` |
| 颜色、字号、圆角、间距   | `scripts/visual/` 对应脚本（见下）                                    |
| 发布前                   | `pnpm verify`（typecheck + lint + test + build）                      |

视觉采集（**只测量，不优化**）：

```bash
# 复用生产构建：先构建，再以 mock 数据启动
MX_MOCK=1 PORT=3021 pnpm start
node scripts/visual/capture.mjs    # 视口矩阵 + 组件特写 → docs/audits/assets/phase-4d/
node scripts/visual/contrast.mjs   # WCAG 对比度 → contrast.json
node scripts/visual/spoiler.mjs    # 无 JS / 键盘 / 鼠标
node scripts/visual/fonts.mjs      # 冷热缓存字体请求
node scripts/visual/media.mjs      # Mermaid / 相册 / 预览
```

- 脚本依赖系统 Chrome（可用 `FOLIO_CHROME` 覆盖路径），**不要为此引入 Playwright**。
- **截图不入库**：`docs/audits/assets/phase-4d/screenshots/*.png` 是本地产物，`manifest.json` 里的路径仅作追溯。仓库只保留采集脚本、测试页、固定素材与测量 JSON。
- 测试状态只能依据**实际执行结果**。源码看着没问题不等于浏览器 PASS；`NOT TESTED` 不得写成 `PASS`。
- 全仓 `prettier --check .` 存在历史遗留不通过文件，不要为了"变干净"批量格式化无关文件；只保证本次触碰的文件通过。

---

## 9. Coding Agent Workflow

开始任务前：

1. `git status` 与 `git worktree list`，确认当前在哪个工作树、有没有别人的未提交改动。
2. 读相关文档（视觉改动读 `DESIGN-SYSTEM.md`，进度读最近的 `docs/audits/PHASE-*.md`）。
3. 先审计再改：把"现状是什么、证据在哪"写清楚，再动手。

执行中：

- **不覆盖用户未提交修改**。目标文件有未提交改动且与本次改动冲突时，停下来问，不要"顺手覆盖"。
- **不擅自 `commit` / `push` / 改远程分支**。提交只在明确要求时发生。
- **不擅自删除**工作区、分支、未跟踪文件和历史证据（截图、报告、JSON）。清理临时文件前先确认它不在交付清单里。
- **不将 `NOT TESTED` 写成 `PASS`**，也不要把"看起来对"写成实测结论。
- **每次功能变更同步 `docs/FEATURE.md`**，只改本次真正涉及的行（规则见下方「功能矩阵维护」）。
- **大任务拆阶段**，一个阶段一个可验证的产物；阶段之间不留半成品在主干上。
- **多 Agent 并行时先分配不重叠的文件范围**，禁止两个 Agent 同时改同一文件或同一目录。
- 如需要提交工作区请符合满足提交信息规范，按照历史记录中推演提交信息，不要提交除文档以外的编码或审查报告
- 遇到无法解释的冲突、失败或数据不一致：**保留现场并报告**，不要为了"跑通"去改无关代码。

### 功能矩阵维护（`docs/FEATURE.md`）

- **每次新增、修改或删除功能，同步更新矩阵里对应的行**：实现状态、配置/API、核心代码、验证情况、备注与本次改动保持一致。**只改本次真正涉及的行**，不顺手"整理"整张表、不改与本任务无关的行、不重写别人的审计基线。
- **它是事实记录，不是任务清单，也不是进度表。** `未实现` / `部分实现` / `定义未启用` / `配置无消费者` / `NOT TESTED` 都是合法且可能长期存在的状态，**不是待办、不是缺陷、不是催办信号**。矩阵只回答「现在是什么」，不回答「下一步做什么」。
- **禁止为了让表"填满 / 全绿"而做任何事**：不得把未实现改成已实现、不得把 `NOT TESTED` 写成 `PASS`、不得凭空补行凑数、不得把推测写成事实、不得把「有意不做」改写成「遗漏」。
- **禁止把矩阵里的「未实现」当成开发任务去实现。** 有些功能不做是有明确设计考虑的，动手前先读该行「备注」与对应阶段报告；典型例子：v3 协议（只实现 v2）、评论 / 点赞 / 任何写操作（站点只读，`featureFlags` 关闭）、`iconify` 运行时加载（无加载器，配置保留但渲染降级）、内联 CSS 字符串（注入面，只接受外部 URL）、Kami 私有扩展字段（协议里没有）。**没有新的产品决策，就不要去"补齐"这些项。**
- **矩阵不追求穷举**：不要把「别的主题有 / 协议里提过 / 自己想得到」的功能都列进来充门面。是否收录取决于本仓库实际的设计边界；有些功能不写进表本身就是一种考虑，不要用「补全覆盖面」的名义加行。
- **状态变化必须带证据**：代码路径 + 实际执行结果（沿用第 8 节规则）。只有真的实现了、并且验证过，才改成 `已实现`。
- **可以优化结构、图例与措辞，但优化不等于改写结论**：不得借「优化」之名抹掉刻意保留的未实现状态，也不得把「声明与实现不一致」这类待决策项直接改成「已解决」。
- 与阶段报告的分工不变：矩阵记「现在是什么」，报告记「为什么 / 怎么验的」。不要在矩阵里展开决策过程，也不要把报告全文搬进矩阵。

收尾交付必须包含：修改清单、测试/验证结果（含失败项）、未解决事项、最终 `git status`。

---

## 10. Current Project Status

| 阶段 | 内容                                                                  | 状态                                       |
| ---- | --------------------------------------------------------------------- | ------------------------------------------ |
| 4A   | 自托管 Noto Sans SC / Noto Serif SC（202 个 WOFF2 分片 + OFL 许可证） | 完成（未提交）                             |
| 4B   | CSS 缺陷修复（删除死选择器，补媒体/材质规则）+ CSS 契约测试           | 完成（未提交）                             |
| 4C   | 4A/4B 整合 + 设计规范同步（字体栈单一来源 = `tokens.css`）            | 完成（未提交）                             |
| 4D-0 | 视觉验收环境：CDP 采集脚本、Markdown 全组件样张、首次视觉基线         | 完成（未提交）                             |
| 4E   | 4A–4D-0 整合进 `main` + 建立本文件（截图不入库）                      | 完成（已提交 `682e34d`）                   |
| 4E-1 | 工程收尾：ESLint 忽略 `.worktrees`、截图仓库外归档、`.gitignore`      | 完成（未提交）                             |
| 4D-1 | 五处对比度缺陷修复（Callout note/warning/caution、移动导航按钮）      | 完成（未提交）；54 项重采全过，最低 4.58:1 |
| 4D-2 | 视觉修复续                                                            | **未开始**                                 |

当前已知未修问题（细节见 `docs/audits/` 对应阶段报告）：

- 桌面导航链接（≥640px）**4.07:1**（Light）：与已修的「目录」按钮同因，属 `--text-secondary` 落在玻璃栏合成背景上；修复会加重页头视觉重量，留给 4D-2 决策（见 `PHASE-4D-1-CONTRAST-FIXES.md` §5）。
- 代码块 token 颜色与 Mermaid 图内文字**未做对比度抽样**，不能视为通过。
- 200% 缩放、forced-colors、Safari / Firefox / 移动真机均 **NOT TESTED**。

**本节只是索引，不是事实来源。** 阶段完成后更新本表，细节写进 `docs/audits/` 的阶段报告；不要把所有报告全文搬进本文件。
