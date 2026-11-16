# AGENTS.md

本文记录 Folio 的默认工程约束与已知陷阱，不覆盖用户对当前任务的明确要求。用户明确要求的变更或操作（如修改设计系统、提交代码）直接执行，不重复征求同意；只有范围不清或可能误伤他人数据时才先确认。

Folio 是基于 Mix Space 官方协议 API v2 / Core 12.x 的前端主题，不是通用博客模板。目录与组件清单以代码为准，不在这里重复。

---

## 文档分工

- `AGENTS.md`：Agent 的默认工程约束；用户对当前任务的明确要求可提出例外。
- `docs/DESIGN-SYSTEM.md`：视觉规范权威，不是只读文档；按用户要求或实现需要可以修改。Token 具体值以 `src/design-system/tokens/tokens.css` 为准。
- `docs/FEATURE.md`：已实现功能的事实快照，不是任务清单。
- `docs/audits/PHASE-*.md`：阶段事实与验收证据，进度以报告为准。
- `README.md` / `.env.example`：运行方式与配置项。

---

## 工作区

开始前看 `git status --short`、`git rev-parse HEAD`、`git worktree list`。

- 默认不覆盖他人未提交的改动、不清理无关并行改动。
- 默认不执行 `reset --hard`、强制 checkout、clean、删 worktree 等破坏性操作；用户明确要求且目标和影响范围清楚时可以执行，不明确就先确认。
- 默认不 commit、push、改远程分支或合并 PR；用户明确要求时直接按要求执行，不额外确认。
- 默认保留 `docs/audits/` 历史报告；如用户要求清理，先确认具体范围及引用。

---

## 协议与架构

- 默认只实现 Mix Space API v2；任务明确要求支持其他版本时，先核对官方协议并同步更新契约、文档和测试。不凭空虚构上游字段或概念。依赖版本以 `package.json` 为准，包管理使用 pnpm。
- 依赖方向为页面/路由 → feature → `src/lib/api` → 契约。API 的 client、contracts、domain、adapters、repositories、mock、errors 分层；页面与 feature 只从 `src/lib/api/index.ts` 取数。
- 取数在 RSC 完成；避免重复请求、重复 Markdown 解析和 render 内 I/O。新增大型运行时依赖前，说明必要性与替代方案。

---

## Feature 开关

`src/core/registry/features.ts` 是唯一开关源。关一个模块必须**同时**：导航消失、路由 `requireFeature` 拦下、守卫在任何取数之前（零请求）。所以关模块是改布尔值，不是删文件。

有路由的 feature 必须有 `manifest.ts`；key 唯一且是 `featureFlags` 的键，routes 对应真实 `page.tsx` 且该页守卫同一个 key。`tests/feature-manifest.test.ts` 守这四条。

> 踩过：两份清单写同一个 `key`，按 key 建索引时后者静默覆盖前者；另一份把别的模块的路由写进自己 `routes`。都不报错。

---

## 设计 Token

- 视觉规范以 `docs/DESIGN-SYSTEM.md` 为准，Token 唯一来源是 `src/design-system/tokens/tokens.css`；Tailwind v4 使用 CSS 配置，不新增 `tailwind.config.*`。
- 组件使用语义 Token，不硬编码颜色；浅色与暗色保持相同语义。保持暖纸底与冷色界面的设计关系，避免无必要的材质和卡片。
- `fonts.css` 只声明项目自托管字体的 `@font-face`；字体栈只定义在 `tokens.css`。
- 新增 Token 时同步更新 Token、设计文档和测试；修改视觉参数后，重新采集对应基线并更新报告。

---

## CSS 选择器

- 写规则前确认组件**真的产出**这个类。别因为别的主题用了某类名就推断 Folio 也有——照抄得到一条永不生效的规则。
- 删/改名前列出生产者、消费者、测试三处；三无才删。
- 不保留失效选择器；优先语义化 HTML，布局尺寸从 Token 派生。
- **`backdrop-filter` 元素会成为 `position: fixed` 后代的包含块**。玻璃挂独立层，别挂承载 fixed 菜单的卡片上（实测菜单 350px → 161px）。
- **客户端重建 DOM 节点必须继承关键属性**。新建 `<img>` 要带上 `width`/`height`（相册增强实测：470 张图一次位移 0.92）。

---

## 无 JS

内容本体不依赖 JS，JS 只做增强。spoiler 是范例：无 JS 是普通文本，有 JS 才模糊可展开。不要做"藏起来却打不开"的死路。

交互一律要键盘可达、可见焦点、`prefers-reduced-motion` 降级。

---

## 图片与性能

- 尺寸用附件元数据的真实值，按**完整地址**匹配（别只比文件名）。
- **拿不到就一个属性都不加**。猜比例会把图撑成长条，比有位移更糟。
- 列表页只出摘要 + 必要的一张图；判断标准是"服务端输出多少节点"，不是"CSS 藏了多少"。
- **不得编造 LCP/INP/CLS/FCP**。没实测就写 `NOT TESTED`。

---

## 验收

| 层                       | 能证明什么                     |
| ------------------------ | ------------------------------ |
| 静态审计                 | 实现存在，**不能**证明看起来对 |
| Dev Server + CDP（默认） | 真实渲染与交互                 |
| 生产构建                 | 只在明确需要时，且先说明原因   |

- 日常视觉验收不用 `next build` / `next start` 当预览。
- 截图不入库。脚本依赖系统 Chrome，不引入 Playwright。
- `NOT TESTED` 不得写成 `PASS`；区分"没跑"和"跑失败"。
- 日常按改动范围运行 `pnpm typecheck`、`pnpm lint`、`pnpm test` 或对应测试。视觉基线使用 `scripts/visual/*.mjs`，默认对 Dev Server 采集；只有生产行为确需验证时才构建。

---

## 测试

- 修红灯前判断是**真缺陷**还是**陈旧断言**并给出证据；默认不删测试、不 skip 或放宽断言来求全绿，确认为过时的测试可据证据更新。
- 守卫或契约变更应覆盖允许与拒绝路径；涉及新增约束时，验证违规输入确实会被拦截。
- 路径比较用 `relativeToRoot()`，跨行比较先 `normalizeEol()`。不归一会让断言在某个平台**恒不命中**，看起来像"没这个选择器"。

---

## 文档

- Token 值以 `tokens.css` 为准，视觉规则以 `DESIGN-SYSTEM.md` 为准，两者同批改。
- 文档里**不写死行号、不写死"共 N 处"**。用符号引用。
- 功能变更同批更新 `FEATURE.md`：写"已实现"要能指到代码与验证方式。阶段报告写入 `docs/audits/` 并从矩阵索引；历史测试结果保留时间语境，不冒充当前结果。
- 全仓 `prettier --check` 有历史红。新文件必须过；只做内容编辑的历史文件不整篇重排。
