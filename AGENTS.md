# AGENTS.md

Folio 仓库对所有 Coding Agent 的长期工程约束。**提示词有特殊需求需要按照提示词的特殊需求完成**；与本文冲突的做法，先提出来，不要直接执行。

文档分工：

| 文档                         | 地位                                                       |
| ---------------------------- | ---------------------------------------------------------- |
| `AGENTS.md`（本文件）        | 工程约束与行为边界，长期有效                               |
| `docs/DESIGN-SYSTEM.md`      | 视觉规范权威（颜色、排版、材质、组件状态）                 |
| `docs/FEATURE.md`            | 功能实现矩阵：**事实快照，不是任务清单**（维护规则见末节） |
| `docs/audits/PHASE-*.md`     | 阶段事实与验收证据，**进度以这些报告为准**                 |
| `README.md` / `.env.example` | 运行方式与配置项                                           |

---

## Project Identity

- **Folio** 是基于 [Mix Space](https://github.com/mx-space/) 官方协议（**API v2 / Core 12.x**）的前端主题，不是通用博客模板。
- 可以借鉴 Shiro / kami / mx-starter 的**产品完成度**（信息架构、交互细节、边界情况处理），但不得把它们的内部约定当成 Mix Space 的能力。
- Design 和 Folio 都是该仓库的代号，不代表最终名字。

---

## Technology Stack

以 `package.json` 为准，勿重复维护依赖版本或引入项目未采用的技术。样式使用 Tailwind v4 的 CSS 配置；Token 位于 `src/design-system/tokens/tokens.css`，不要新增 `tailwind.config.*`。`fonts.css` 在 `src/app/layout.tsx` 中单独引入，勿随意调整顺序。

---

## Architecture Principles

**依赖方向单向**：页面 / 路由 → `src/features/*` → `src/lib/api` → 契约。反向依赖一律视为设计错误。

- API 分层：`client`、`contracts/v2`、`domain`、`adapters`、`repositories`、`mock`、`errors` 各司其职；页面与 feature **只能从 `src/lib/api/index.ts` 取数**，不得直接依赖 `client` 或 `contracts`。
- **Feature Registry 是唯一开关源**（`src/core/registry/features.ts`）：关闭模块时，导航、路由和请求都必须受守卫控制；新增 feature 必须同时登记 `featureFlags` 与含 routes/endpoints 的 `manifest.ts`。
- **不为单个功能引入大型依赖**。新增运行时依赖需先说明：现有依赖为何不够、体积代价、是否有更小的替代。
- 避免重复请求、重复 Markdown 解析和无谓重渲染；取数在 RSC 完成，不在 render 内做 I/O。

---

## Protocol Constraints

- 严格遵循 Mix Space 官方协议，只实现 **v2**（`MX_API_VERSION=2`）。契约方言开关存在只是为未来移植留位，**当前不要实现 v3 API**。
- **不擅自增加上游不存在的字段**，也不要在前端"补"一个后端没有的概念，也就是不要独立实现不存在的东西。

---

## Design System

**唯一权威**：`docs/DESIGN-SYSTEM.md`。**唯一 Token 来源**：`src/design-system/tokens/tokens.css`。

Token 分层与视觉规范以 `tokens.css` 和设计系统文档 §2 为准。

硬性要求：

- 组件使用语义 Token，不硬编码颜色；浅色与暗色保持相同语义。例外以相关测试登记为准。
- 保持 Warm Paper × Lavender Blue 的暖底冷界面关系；避免无必要的材质、阴影和卡片。
- 使用项目自托管字体；`fonts.css` 只声明 `@font-face`，字体栈只定义在 `tokens.css`。
- 新增 Token 时，同步更新 `tokens.css`、`DESIGN-SYSTEM.md` 和测试。修改视觉参数后，重新测量对应基线并更新报告。

---

## CSS 与组件规则

- CSS 选择器必须对应真实 DOM；删除或改名之前检查生产者、引用和测试，不保留失效选择器。
- 组件专属效果留在组件内；带 `backdrop-filter` 的层不要包住承载 `position: fixed` 后代的元素。
- 优先语义化 HTML；交互需支持键盘、可见焦点和减少动态效果设置，并保证无 JS 时基本可用。
- 布局尺寸从 Token 派生；具体视觉规则以 `DESIGN-SYSTEM.md` 为准。

---

## 性能与图片

- 图片和嵌入内容应预留真实尺寸；列表只渲染摘要和必要媒体，避免承载详情页内容。
- 性能结论以实际网络或测量数据为依据；未测的指标标为 `NOT TESTED`。

---

## 验证与验收

### 日常开发验证（默认）

标准启动命令，默认使用 3000 端口，仅供 miaoer 的测试使用：

```bash
MX_SERVER_URL=https://api.miaoer.net \
MX_THEME_NAME=folio \
./node_modules/.bin/next dev -p 3000
```

- 修改代码后用 HMR 实时预览，不重启、不重新构建。
- **不得为了普通页面预览执行 `next build`**；**不得把 `next start` 当作日常开发预览命令**。
- 只在 Dev Server 无法满足具体验证需求（构建期行为、生产专属问题等）时，才考虑生产构建，并**说明原因**。
- 按改动范围运行 `pnpm typecheck`、`pnpm lint`、`pnpm test` 或对应的 Vitest 测试。

开始任务前：

1. `git status` 与 `git worktree list`，确认当前在哪个工作树、有没有别人的未提交改动。
2. 读相关文档（视觉改动读 `DESIGN-SYSTEM.md`，进度读最近的 `docs/audits/PHASE-*.md`）。
3. 先审计再改：把"现状是什么、证据在哪"写清楚，再动手。

执行中：

- **不覆盖用户未提交修改**。目标文件有未提交改动且与本次改动冲突时，停下来问，不要"顺手覆盖"。
- **不擅自 `commit` / `push` / 改远程分支**。提交只在明确要求时发生，除非提示词里面写了特殊需求否则不要执行，如需要执行请按照英文规范进行提交。
- 如果有并发 Coding 或者个人改动，如果没改到本次任务内容，不要中断，这是多个开发并行行为，除非文件全改乱了、动到了本次任务的内容，那就停下来。

视觉基线使用 `scripts/visual/*.mjs`，默认对 Dev Server 采集，不需要生产构建；仅在生产行为必须验证时才运行 `pnpm build`。测试与采集状态以实际执行结果为准，截图不要提交或存入仓库。

---

## 功能矩阵与报告（`docs/FEATURE.md`）

- 新增、修改或删除功能时同步更新 `FEATURE.md`；阶段报告放在 `docs/audits/` 并在矩阵中索引。矩阵是事实快照，不是任务清单。
