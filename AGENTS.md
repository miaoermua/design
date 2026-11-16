# AGENTS.md

Folio 仓库对所有 Coding Agent 的长期工程约束。**提示词有特殊需求需要按照提示词的特殊需求完成**；与本文冲突的做法，先提出来，不要直接执行。

文档分工：

| 文档                         | 地位                                                      |
| ---------------------------- | --------------------------------------------------------- |
| `AGENTS.md`（本文件）        | 工程约束与行为边界，长期有效                              |
| `docs/DESIGN-SYSTEM.md`      | 视觉规范权威（颜色、排版、材质、组件状态）                |
| `docs/FEATURE.md`            | 功能实现矩阵：**事实快照，不是任务清单**（维护规则见 §9） |
| `docs/audits/PHASE-*.md`     | 阶段事实与验收证据，**进度以这些报告为准**                |
| `README.md` / `.env.example` | 运行方式与配置项                                          |

---

## Project Identity

- **Folio** 是基于 [Mix Space](https://github.com/mx-space/) 官方协议（**API v2 / Core 12.x**）的前端主题，也不是通用博客模板。
- 可以借鉴 Shiro / kami / mx-starter 的**产品完成度**（信息架构、交互细节、边界情况处理）也不得把它们的内部约定当成 Mix Space 的能力。
- Design 和 Folio 都是该仓库的代号，不代表最终名字。

---

## Technology Stack

以 `package.json` 为准，不得凭空引入下表之外的技术。

| 层       | 实际使用                                                                       |
| -------- | ------------------------------------------------------------------------------ |
| 框架     | Next.js 15.5（App Router，`export const dynamic = 'force-dynamic'`）           |
| UI       | React 19，Server Components 优先                                               |
| 语言     | TypeScript 5.9（`strict`）                                                     |
| 样式     | Tailwind CSS v4（`@tailwindcss/postcss`，**CSS-first**，无 `tailwind.config`） |
| Markdown | `marked` + `sanitize-html` + `shiki` + `katex` + `mermaid`                     |
| 测试     | Vitest 5 + jsdom + `@testing-library/react`                                    |
| 包管理   | pnpm 10（`packageManager` 锁定版本），Node ≥ 22.12，不允许使用 npm 管理器  |
| 视觉采集 | `scripts/visual/*.mjs`：系统 Chrome + CDP 直连，**没有 Playwright/Puppeteer**  |

注意事项：

- Tailwind v4 只有 CSS 配置。设计 Token 写在 `src/design-system/tokens/tokens.css` 的 `@theme` 里，**不要**新建 `tailwind.config.*`。
- 样式入口是 `src/app/globals.css`（`@import` tokens 与各样式层）；`fonts.css` 在 `src/app/layout.tsx` 里单独引入，顺序不能随意调整。

---

## Architecture Principles

**依赖方向单向**：页面 / 路由 → `src/features/*` → `src/lib/api` → 契约。反向依赖一律视为设计错误。

- **API Adapter 与 UI 分离**：`src/lib/api/` 内部再分 `client/`（HTTP）、`contracts/v2/`（上游原始形状）、`domain/`（前端领域模型）、`adapters/`（转换）、`repositories/`（页面级用例）、`mock/`（`MX_MOCK=1` fixtures）、`errors/`。
- 页面与 feature **只能从 `src/lib/api/index.ts` 取数**，不得直接 `import` `client/` 或 `contracts/`。
- **不为单个功能引入大型依赖**。新增运行时依赖需先说明：现有依赖为何不够、体积代价、是否有更小的替代。
- 禁止重复请求、重复 Markdown 解析、无谓重渲染：取数在 RSC 完成；同一份 Markdown 只解析一次；不要在 render 内做 I/O。

---

## Protocol Constraints

- 严格遵循 Mix Space 官方协议，只实现 **v2**（`MX_API_VERSION=2`）。契约方言开关存在只是为未来移植留位，**当前不要实现 v3 API**。
- **不擅自增加上游不存在的字段**，也不要在前端"补"一个后端没有的概念，也就是不要独立实现不存在的东西。
---

## Design System

**唯一权威**：`docs/DESIGN-SYSTEM.md`。**唯一 Token 来源**：`src/design-system/tokens/tokens.css`。

`@theme` — 调色板、字体栈、字号、版心、间距、圆角、阴影、动效。

硬性要求：

- 字体使用项目自托管的 **Noto Sans SC / Noto Serif SC**；`fonts.css` **只声明 `@font-face`**，字体栈（`--font-sans` / `--font-serif` / `--font-mono`）只写在 `tokens.css` 的 `@theme` 里，**不得在 `fonts.css` 重复定义语义变量**。
- **修改字体、颜色、圆角、间距等视觉参数，必须重新执行对应视觉基线测量**（见第 8 节 B，默认在 Dev Server 上采集，**不等于执行生产构建**），并把新的数字写回报告；旧基线数字随之作废，不得继续引用。
- 新增 Token 走 `DESIGN-SYSTEM.md` §12 的流程（语义命名 → 明暗两套值 → 文档同步 → 测试）。

### A. 日常开发验证（默认）

标准启动命令，默认使用 3000 端口，仅供 miaoer 的测试使用：

```bash
MX_SERVER_URL=https://api.miaoer.net \
MX_THEME_NAME=folio \
./node_modules/.bin/next dev -p 3000
```

- 修改代码后用 HMR 实时预览，不重启、不重新构建。
- **不得为了普通页面预览执行 `next build`**；**不得把 `next start` 当作日常开发预览命令**。
- 只在 Dev Server 无法满足具体验证需求（构建期行为、生产专属问题等）时，才考虑生产构建，并**说明原因**后按 C 执行。

开始任务前：

1. `git status` 与 `git worktree list`，确认当前在哪个工作树、有没有别人的未提交改动。
2. 读相关文档（视觉改动读 `DESIGN-SYSTEM.md`，进度读最近的 `docs/audits/PHASE-*.md`）。
3. 先审计再改：把"现状是什么、证据在哪"写清楚，再动手。

执行中：

- **不覆盖用户未提交修改**。目标文件有未提交改动且与本次改动冲突时，停下来问，不要"顺手覆盖"。
- **不擅自 `commit` / `push` / 改远程分支**。提交只在明确要求时发生，除非提示词里面写了特殊需求否则不要执行，如需要执行请按照英文规范进行提交。

如果有并发 Coding 或者个人改动，如果没改到本次任务内容，不要中断，这是多个开发并行行为，除非文件全改乱了，动到了本次任务的内容，就需要停止本次任务。

### 功能矩阵维护（`docs/FEATURE.md`）

每次新增、修改或删除功能，同步更新 FEATURE.md

不允许提交截图文件，在结束开发后，无特殊要求需要放入回收站。如果改动较大，用户需要对比请保留，不允许在项目文件夹内存放截图文件及上传 git 仓库。

本节只是索引，不是事实来源，阶段完成后简单描述，如有写报告请写到 docs/audits/ 下。
