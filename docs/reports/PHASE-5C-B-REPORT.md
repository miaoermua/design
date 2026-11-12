# Phase 5C-B — Realtime Events & Live Article Updates

> 范围：实时事件通道（连接管理、协议、分发）、可复用通知组件、连接状态胶囊（Error Capsule）、
> 当前文章实时更新与降级策略。
> 约束遵守情况：独立 worktree、未提交/未推送/未合并、未触碰 Theme Config / Social Config / Social 组件。

---

## 1. 基线与工作区

| 项 | 值 |
| --- | --- |
| 仓库 | `miaoer/Documents/GitHub/design`（Folio） |
| worktree | `.worktrees/phase-5c-b-realtime` |
| 分支 | `phase-5c-b-realtime` |
| 基线 commit | `f13da24af7bdbd9e35cdd2e2119d70c8c87baf19` |
| 依赖 | `pnpm install --prefer-offline`（worktree 独立 `node_modules`） |
| 交付状态 | 全部改动留在工作区，**未 commit / 未 push / 未 merge** |

---

## 2. 结论摘要

1. **Core 17 的网关是原生 WebSocket**（`ws` + NestJS `WebSocketGateway`），不是 Kami 使用的 socket.io。协议信封、事件名、房间名、握手参数全部从 Core 源码取得，没有推测。
2. **事件不含「当前文章」语义**：`post.update` 携带完整文章，但房间按 `article-${id}` 隔离。Folio 只把事件当作「变了」的信号，正文一律经 BFF + 现有数据层重取。
3. **Kami 的做法不能照搬**：它把事件 payload 直接 `addOrPatch` 进 store，没有房间、没有新鲜度校验、没有竞态处理、也没有连接状态 UI。
4. **Kami 没有 Error Capsule**：它只把 `visitor.online` 的在线人数放在页脚，断线/请求失败对读者完全不可见。
5. Folio 交付了四个互相独立的模块：连接与协议（`src/lib/realtime`）、通知（`src/lib/notifications`）、连接状态（`src/lib/status`）、文章更新（`src/features/articles/live` + BFF 路由）。
6. 验证结果：`typecheck` / `lint` / `test`（34 文件 581 用例）/ `build` 全通过，生产构建冒烟请求通过。真实 Core 端到端 **NOT TESTED**（本机没有运行中的实例）。

---

## 3. Kami 审计 — WebSocket

| 问题 | 事实 | 证据 |
| --- | --- | --- |
| 初始化位置 | `_app` 挂载后动态 import 并调用一次 `initIO()`，单例模块持有 socket | `src/pages/_app.tsx:66-67` |
| 地址生成 | `io(\`${GATEWAY_URL}/web\`)` —— **socket.io 命名空间 `/web`**，不是原生 ws 路径 | `src/socket/socket-client.ts:17` |
| 协议 | socket.io 事件 `message`，内容为 JSON（对象或字符串）；`{ type, data }` 风格 | `src/socket/socket-client.ts` 消息回调 |
| 认证 | 无 token；连接即订阅公开事件（与 Core 旧 socket.io 网关一致） | 同上 |
| 心跳 | 客户端无应用层心跳，依赖 socket.io 内建 ping/pong | 源码中无 ping 定时器 |
| 重连 | `reconnectionDelay: 3000`、`reconnectionAttempts: 3`、`autoConnect: false` | `src/socket/socket-client.ts:19-21` |
| 页面切换 | 连接挂在 `_app`，路由切换不重建；事件通过全局 `eventBus` 广播，页面之间没有订阅生命周期 | `src/socket/socket-client.ts:52` |
| 状态 | `gatewayOnline` 存进 `useAppStore`，但**只用于页脚「正在浏览人数」**，不表达连接是否可用 | `src/socket/handler.ts:29`；`src/components/layouts/SiteLayout/Footer/index.tsx:37` |
| 去重/过期 | 无。同一事件收到两次就处理两次；无 `modifiedAt` 比较 | `src/socket/handler.ts` |
| 多标签页 | 无协调，每个 tab 各自一条 socket | 无相关代码 |

**判定**：Kami 的实时通道是 **socket.io 私有实现**，与 Core 17 的 `/ws/web` 原生 WS 不是同一套协议。通道类型只有 WebSocket，没有 SSE / 轮询兜底。

---

## 4. Kami 审计 — 通知

| 维度 | 事实 | 证据 |
| --- | --- | --- |
| 触发事件 | socket 事件驱动：新动态、`post.create` / `note.create`（`hide` 为真时跳过）等 | `src/socket/handler.ts:34,57,76,105` |
| 结构 | `title` + `text` + `description` + `onclick` + 原生 `NotificationOptions` | `src/utils/notice.ts:61` |
| 组件位置 | 页内：react-toastify 的 `ToastContainer` + 自定义 `ToastCard`；页外：浏览器 `Notification` | `src/provider/toastify.tsx`；`src/components/widgets/Toast/card.tsx` |
| 出现/消失 | 页内 toast 5s 自动关闭；系统通知需用户点击或手动关闭 | `src/utils/notice.ts:80-100` |
| 点击跳转 | `onclick` 回调里 `window.open(...)`；系统通知点击后 `close()` | `src/utils/notice.ts:120-130` |
| 级别 | **没有级别**：只有一个视觉形态（头像 + 标题 + 相对时间） | `ToastCard` |
| 多条排列 | react-toastify 默认堆叠 | `src/provider/toastify.tsx` |
| 移动端 | `ToastCard` 内部按 `viewport.mobile/pad` 切换宽度 | `src/utils/notice.ts` 的 `isPadOrMobile` |
| 队列/去重/优先级 | 无去重、无优先级；重复事件会重复弹 | 无相关代码 |
| 前台/后台 | `document.hasFocus()` 为真走页内 toast，否则走系统通知（需授权） | `src/utils/notice.ts:78-126` |

**判定**：Kami 的通知是「单形态 + 双通道（页内 / 系统）」，没有级别、去重与优先级，且授权流程会在首访时申请浏览器通知权限。

---

## 5. Kami 审计 — Error Capsule

结论：**不存在**。

- 全仓没有网络/连接状态组件；`gatewayOnline` 仅用于页脚在线人数。
- 唯一的错误兜底是 React `ErrorBoundary`（渲染异常 → 兜底页 + 重新加载），见 `src/components/app/ErrorBoundary/index.tsx`，与网络、HTTP、WS 无关。
- 请求失败通过 toast 或页面自身的空状态表达，没有「已恢复」这一状态。
- 404 与服务器故障没有区分：没有统一的错误分类层。

---

## 6. Kami 审计 — 文章实时更新链路

数据流（全部依据源码）：

```
Core 广播 post.update（完整文章）
   → socket.io message
   → handler.ts:115  case POST_UPDATE
   → usePostCollection.getState().addOrPatch(data)     ← 直接把 payload 写进 store
   → 文章页从同一个 collection store 读 model
   → 正文 / 标题 / 目录随 store 更新而重渲染
```

- **推送的是完整内容**，不是「通知重取」：`handler.ts:116` 的入参就是文章对象。
- 删除：`POST_DELETE` → `softDelete(id)`（`handler.ts:121`），页面进入空状态，没有「已删除/取消发布」的读者提示。
- 没有 `modifiedAt` 比较、没有单飞、没有旧响应覆盖保护（因为根本没有请求）。
- 不保留滚动：内容高度变化时由浏览器自行决定视口位置。
- 分类/slug 变化：payload 里带新 slug，但没有跳转逻辑，读者可能停留在旧 URL 上拿到新内容。

**判定**：Kami 选择「信任 payload」，代价是正文与前端渲染管线脱钩；Folio 不采用。

---

## 7. Mix Space Core 官方能力审计

源码：`mx-space/core`，`apps/core` 版本 **17.0.2**。

### 7.1 通道

| 项 | 事实 | 证据 |
| --- | --- | --- |
| 传输 | **原生 WebSocket**（`ws`），NestJS `WebSocketGateway` | `apps/core/src/processors/gateway/web/events.gateway.ts` |
| 路径 | `/ws/web` | 同上（`@WebSocketGateway({ path: '/ws/web' })`） |
| 信封 | `{ v: 1, event: string, payload?: unknown, id?: string }` | `packages/ws-client/src/protocol.ts` |
| 握手参数 | `?lang=zh|en`、`?socket_session_id=`  | `events.gateway.ts` `handleConnection` |
| 认证 | **无**。网关只下发公开数据，不做身份校验 | 同上 |
| 回放 | **无**。连接建立后只收到 `gateway.connect` 问候与 `visitor.online`，断线期间事件不补发 | 同上 |
| 心跳 | 服务端协议层 ping，客户端回 pong；应用层另有 `ping` 事件（带 `id` 才回 `ack`） | `events.gateway.ts:203` |

### 7.2 入站事件（客户端 → 服务端）

| 事件 | 载荷 | 说明 | 证据 |
| --- | --- | --- | --- |
| `room.join` | `{ room }` | 房间名不限制（拒绝 `collab:` 前缀），成功后回 `ack` | `events.gateway.ts:208` |
| `room.leave` | `{ room }` | 同上 | `events.gateway.ts:236` |
| `ping` | `{ id? }` | 带 `id` 时回 `ack` | `events.gateway.ts:203` |
| `lang.update` | `{ lang }` | 切换后续事件的语言 | `events.gateway.ts:280` |

房间名前缀常量：`article-`（`apps/core/src/modules/activity/activity.util.ts:1`），构造函数 `buildArticleRoomName(id)` = `article-${id}`。

### 7.3 出站事件（服务端 → 客户端）与载荷

| 事件 | 载荷 | 广播范围 | 证据 |
| --- | --- | --- | --- |
| `gateway.connect` | 字符串 `'WebSocket connected'`（在线数另由 `visitor.online` 下发） | 单连接 | `apps/core/src/processors/gateway/base.gateway.ts:14` |
| `post.update` | **完整文章**（`toPublicPostPayload`） | `article-${id}` 房间 | `visitor-event-dispatch.service.ts:138-149` |
| `post.republish` | 同 `post.update` | 同上 | 同上 |
| `post.create` | 公开文章载荷（可裁剪） | 全局（无房间） | `visitor-event-dispatch.service.ts` |
| `post.delete` | **id 字符串** | `article-${id}` 房间 | 同上 `:153-156` |
| `post.unpublish` | **id 字符串** | `article-${id}` 房间 | 同上 |
| `ack` | `{ ok, code? }` | 请求方 | `packages/ws-client/src/protocol.ts` |

事件名常量：`apps/core/src/constants/business-event.constant.ts:1-30`（`POST_CREATE/UPDATE/UNPUBLISH/REPUBLISH/DELETE` 与 `GATEWAY_CONNECT`）。

### 7.4 官方 SDK

`@mx-space/ws-client@0.2.0`（MIT，已发布到 npm，`npm view` 确认）位于 Core monorepo `packages/ws-client`：原生 WS 客户端，带指数退避、`ping`、`request/ack`、连接状态回调。

**Folio 未引入，原因**：

1. 包的 `exports` 指向 `src/*.ts`（未编译），Next 需要额外配置 `transpilePackages` 才能消费；
2. 它面向 admin / bot，没有房间生命周期（join/leave + 重连自动重放）、`pause/resume`、事件去重，这些正好是阅读端需要的；
3. 引入后仍要在外面包一层 `useSyncExternalStore` 适配与状态机，等于两套连接状态。

**替换路径**：`src/lib/realtime/client.ts` 是唯一与传输层耦合的文件（`connect/teardown/重连调度`）。若后续要换成官方 SDK，只需改这一个文件，`bus` / `controller` / UI 不受影响。

### 7.5 详情重取与缓存/失效

- Core 的文章详情接口就是 `GET /posts/:category/:slug`，Folio 已有 `src/lib/api/repositories/posts.ts`（`revalidate: 300` + `tags: ['posts']`）。
- Core 不提供 ETag / 条件请求契约（源码中未见 `If-None-Match` 处理），**不编造**；Folio 用 `modifiedAt` 做新鲜度判断，用 `revalidateTag('posts')` 做缓存失效。
- 事件本身不提供版本号，因此「有没有变」只能由重取结果的 `modifiedAt` 回答。

---

## 8. 与 Kami 的差异

| 维度 | Kami | Folio |
| --- | --- | --- |
| 传输 | socket.io 私有实现 | 原生 WS `/ws/web`（官方协议 v1） |
| 订阅粒度 | 全局广播 | `article-${id}` 房间 + 全局总线 |
| 事件语义 | payload 即正文 | payload 只是信号，正文重取 |
| 新鲜度 | 无 | `modifiedAt` 比较，旧事件直接丢弃 |
| 竞态 | 无 | 单飞 + 末尾补跑 + token 丢弃过期响应 |
| 删除/取消发布 | store 里删掉，页面空白 | BFF 判定 `gone` → 提示 + 刷新到 404 |
| 地址变化 | 不处理 | BFF 返回 `moved` → `router.replace` |
| 通知 | 单形态、无级别/去重/优先级 | 四级、去重窗口、最多 3 条且不挤掉 error |
| 连接状态 | 只有在线人数 | 独立胶囊：offline / realtime / api / recovered |
| 降级 | 无 | 断线时 60s 可见性感知轮询 + 重连补一次核对 |
| 多标签页 | 各连各的 | 各连各的（同 Kami；未做跨 tab 选主） |

---

## 9. Folio 架构与数据流

```
layout.tsx（RSC）
 ├─ resolveRealtimeConfig(locale)        // 只在服务端读 MX_* 环境变量
 ├─ <RealtimeRuntime url lang />          // 唯一连接宿主，渲染 null
 ├─ <Toaster />                           // 只读 notificationStore
 └─ <StatusCapsule />                     // 只读 statusStore

浏览器
 RealtimeRuntime
   └─ createRealtimeClient ──(事件)──> realtimeBus.emit
        │                                  │
        │ 状态变化                          ├─ useRealtimeEvent(handler)
        └────────────> statusStore          │     └─ 文章页 controller
                    realtimeBus.state       │           └─ POST /api/articles/live
                                            │                 └─ getArticle(fresh:true)
                                            │                       └─ revalidateTag('posts')
                                            └─ 任意模块可订阅（稳定接口）
```

### 9.1 连接管理（`src/lib/realtime`）

- **单连接**：`client.start()` 幂等（`socket` 已存在直接返回），全站只有 `RealtimeRuntime` 调用它。
- **生命周期**：effect 内创建 → 卸载 `stop()`；`attachSession(null)` 解绑房间会话。
- **退避**：base 1s、cap 30s、equal jitter；默认无限重试（`maxAttempts: 0`），浏览器 `offline` 时 `pause()` 停手，`online` 再 `resume()`。
- **心跳**：25s 发 `ping`，60s 无任何帧判死并主动断开重连。
- **重连后**：自动重发已加入的房间（`Set` 去重），并触发一次文章 `check()`（因为服务端不回放）。
- **浏览器离线**：`offline` → `pause()`（主动 `close`，不计入失败次数）；`online` → `resume()`。
- **SSR**：`WebSocket` 只在 `connect()` 内取用；三个 store 都提供 `getServerSnapshot`。

### 9.2 通知（`src/lib/notifications`）

- 四级：`info` / `success` / `warning` / `error`；默认时长 5s / 4s / 7s / 8s。
- 去重：默认键 `level:title`，5s 窗口；同键重复入队返回 `null`。
- 容量：最多 3 条，超出时挤掉**最旧的非 error**；全是 error 时按旧到新挤掉。
- 交互：手动关闭（focus-visible）、`durationMs: 0` 常驻、可选 `action` 链接（`next/link`）。
- 可访问性：info/success 用 `role="status"`，warning/error 用 `role="alert"`；容器 `pointer-events-none`，卡片 `pointer-events-auto`。

### 9.3 连接状态胶囊（`src/lib/status`）

- 优先级：`offline` > `realtime` > `api` > `recovered`。
- 首次抖动不弹（`realtimeGraceAttempts = 2`），之后显示「第 N 次重试」。
- 恢复后 4s 自动隐藏；文案按 `locale` 本地化。
- **不含 URL / 状态码 / 堆栈**；`pointer-events-none`，不遮挡交互；`role="status"` + `aria-live="polite"`。
- 404 **不算**服务器故障：`isNotFound` 单独处理成 `gone`。

### 9.4 文章实时更新（`src/features/articles/live` + `src/app/api/articles/live/route.ts`）

1. 文章页挂载 `LiveArticleUpdater`，把 `{ id, category, slug, modifiedAt }` 传给 controller，并 `realtimeBus.joinArticle(id)`。
2. 事件到达 → `toArticleSignal()` 只认 `post.update|republish|delete|unpublish`，其余（`comment.*`、`visitor.*`）忽略。
3. 只处理 `signal.id === identity.id`；`update` 若 `modifiedAt` 不比当前新则忽略（防重复、防乱序）。
4. 单飞：请求进行中再来事件，只置 `pending` 标记；当前请求结束后再补跑一次。所有响应带 `token`，过期响应直接丢弃。
5. BFF `POST /api/articles/live` 在服务端校验入参（id/slug 字符集、时间字段类型，非法直接 400），用 `getArticle(..., { fresh: true })` 绕过 300s 缓存：
   - `updated` → `revalidateTag('posts')` + 返回 `updated`；
   - `unchanged` → 仅返回状态，不失效缓存；
   - `moved`（新位置 id 一致）→ 返回新路径；
   - `gone`（404 / 地址被别的文章占用）→ 失效缓存 + 返回 `gone`；
   - 上游故障 → `502 { status: 'error' }`，不把错误细节带给浏览器。
6. 客户端按结果分支：`updated` → 通知 + `router.refresh()`（保留滚动）；`moved` → 通知 + `router.replace()`；`gone` → 常驻警告 + `router.refresh()`（落到 404 边界）；`error` → 只更新胶囊。
7. **不信任 payload**：事件里的正文、标题、封面一律不用；渲染只走服务端 Markdown 管线，因此目录、阅读时长、上下篇、`modifiedAt` 同源更新。
8. 滚动保留：刷新前记录 `scrollY`，`rAF` 与 280ms 各复位一次，且仅在偏差 > 2px 时执行，避免和读者抢滚动条。
9. 降级：WS 不在 `online` 时，每 60s `check()` 一次；仅在 `document.visibilityState === 'visible'` 时发请求；`visibilitychange` / `online` 立即补一次。WS 正常时不轮询。

---

## 10. 文件清单

### 新增（源码 16 个）

| 文件 | 行数 | 职责 |
| --- | --- | --- |
| `src/lib/realtime/protocol.ts` | 147 | 信封解析、事件常量、房间名、slug/id 校验 |
| `src/lib/realtime/client.ts` | 383 | 连接状态机、退避、心跳、房间重放、pause/resume |
| `src/lib/realtime/bus.ts` | 149 | 单例总线、状态快照、事件订阅、房间会话 |
| `src/lib/realtime/config.ts` | 80 | 服务端 URL 解析（`MX_REALTIME_URL` / 推导 / 关闭 / mock） |
| `src/lib/realtime/use-realtime.ts` | 28 | `useRealtimeSnapshot` / `useRealtimeEvent` |
| `src/lib/notifications/store.ts` | 192 | 通知队列、去重、时长、容量、优先级 |
| `src/lib/notifications/use-notifications.ts` | 12 | 订阅 hook |
| `src/lib/status/store.ts` | 179 | 状态优先级、防抖阈值、恢复隐藏 |
| `src/lib/status/use-status.ts` | 12 | 订阅 hook |
| `src/components/realtime/realtime-runtime.tsx` | 75 | 唯一连接宿主 |
| `src/components/ui/toaster.tsx` | 95 | 通知条 UI |
| `src/components/ui/status-capsule.tsx` | 67 | 状态胶囊 UI |
| `src/features/articles/live/controller.ts` | 232 | 事件→更新决策（纯逻辑） |
| `src/features/articles/live/refresh.ts` | 47 | 调用 BFF 并把响应收敛成 `RefreshOutcome` |
| `src/features/articles/live/live-updater.tsx` | 189 | 页面接线、滚动、轮询、通知 |
| `src/app/api/articles/live/route.ts` | 133 | BFF：校验 + 重取 + 失效缓存 |

### 修改（5 个）

| 文件 | 改动 |
| --- | --- |
| `src/app/layout.tsx` | 挂载 `RealtimeRuntime` / `Toaster` / `StatusCapsule`，服务端解析配置 |
| `src/app/articles/[category]/[slug]/page.tsx` | 挂载 `LiveArticleUpdater`，传 identity 与 `isRealtimeEnabled()` |
| `src/lib/api/repositories/posts.ts` | `getArticle` 增加 `fresh` 选项（`revalidate: 0`） |
| `src/components/layout/search-panel.tsx` | BFF 搜索失败/成功上报状态胶囊 |
| `.env.example` | 新增 `MX_REALTIME_URL` / `MX_REALTIME` 说明 |

### 新增（测试 8 个，107 用例）

`tests/realtime-protocol.test.ts`（17）、`tests/realtime-client.test.ts`（16）、`tests/realtime-bus.test.ts`（11）、`tests/notifications-store.test.ts`（12）、`tests/status-store.test.ts`（11）、`tests/live-article-controller.test.ts`（20）、`tests/live-article-route.test.ts`（10）、`tests/realtime-ssr.test.ts`（10）。

---

## 11. 测试与验证结果

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 类型 | `pnpm typecheck` | 通过 |
| 静态检查 | `pnpm lint` | 通过（0 warning / 0 error） |
| 单元测试 | `pnpm test` | **34 文件 / 581 用例全通过**（新增 8 文件 / 107 用例） |
| 生产构建 | `MX_MOCK=1 pnpm build` | 通过；`/articles/[category]/[slug]` 6.62 kB / 首屏 119 kB，共享 104 kB |
| 冒烟 | `MX_MOCK=1 PORT=3031 pnpm start` | `/` 200、`/articles/essay/paper-and-whitespace` 200、`POST /api/articles/live` 返回 `unchanged` / `updated` / `invalid(400)`，服务端日志无异常 |

任务书第六节覆盖对照：

| 要求 | 覆盖用例 |
| --- | --- |
| 连接建立 / 断开 / 重连 | `realtime-client.test.ts`（open / close / 重连退避 / 心跳判死 / stop 幂等） |
| 重复连接防护 | `start()` 幂等、`stop()` 后不再重连、`dispose` 后无请求 |
| 重复事件 / 异常帧 | `realtime-protocol.test.ts`（脏帧返回 null）、`live-article-controller.test.ts`（同版本忽略） |
| 通知关闭 / 自动消失 / 去重 / 优先级 | `notifications-store.test.ts` |
| 错误与恢复 | `status-store.test.ts`（offline > realtime > api > recovered、恢复自动隐藏） |
| 事件匹配 / 非当前文章 | `live-article-controller.test.ts`（other id 不请求） |
| 连续更新无竞态 | 单飞 + 补跑 + 串行落地用例 |
| 滚动保留 | `live-updater.tsx` 实现；浏览器行为 **NOT TESTED**（无真机/浏览器自动化） |
| 删除 / 不可访问 | `live-article-route.test.ts`（404 → gone、地址被占用 → gone） |
| 降级 | `realtime-ssr.test.ts`（无 `WebSocket` 时退避不抛错）、`config.ts` 的 off/mock 分支 |
| SSR 不访问浏览器 API | `realtime-ssr.test.ts`（node 环境 import 全部模块 + 服务端快照稳定） |

---

## 12. 未实现能力、限制与建议

### 12.1 未实现（含原因）

1. **真实 Core 端到端**：本机没有运行中的 Core 17 实例，无法验证真实握手、房间隔离与事件时序 → 标记 `NOT TESTED`。冒烟只在 mock 数据下完成。
2. **系统级通知（Web Notifications）**：Kami 有，Folio 不做。原因是首访申请权限与「安静」的定位冲突，且任务书只要求可复用页内通知。
3. **多标签页连接去重**：每个 tab 各一条连接（与 Kami 相同）。Core 的在线人数按连接计，多开会被计多次。可选方案：`BroadcastChannel` 选主 + 从标签转发事件。
4. **跨 tab 同步已读/通知状态**：未做。
5. **`post.create` 的 UI 消费**：列表页不会实时插入新文章（事件已在总线上，按需订阅即可）。
6. **评论 / 留言 / 动态的实时更新**：只接了文章，其他事件被协议层忽略。
7. **条件请求（ETag / If-None-Match）**：Core 未提供该契约，不虚构；新鲜度判断依赖 `modifiedAt`。
8. **`lang.update` 入站事件**：未使用，切语言走整页重渲染 + 重连。
9. **自适应轮询**：固定 60s，未按失败次数退避。
10. **官方 `@mx-space/ws-client` 依赖**：未引入（见 §7.4），替换路径已留。

### 12.2 已知限制

- `router.refresh()` 会重跑整页 RSC（含上下篇、相关文章），比「只换正文」贵；换来的是单一渲染管线与零内容信任。
- 断线期间事件不补发，最长 60s 的可见性窗口内可能看到旧内容；重连后会立即 `check()` 补齐。
- `revalidateTag('posts')` 依赖 fetch 缓存生效；若部署环境因 `force-dynamic` 使 fetch 未缓存，该调用是无害 no-op，`fresh: true` 仍能绕过缓存拿到新数据。
- WS 地址默认由 `MX_SERVER_URL` 推导为 `wss://<host>/ws/web`；反向代理改写路径时必须显式配置 `MX_REALTIME_URL`，否则连接会一直失败并最终进入 `offline`（不弹错误细节）。
- 胶囊的「第 N 次重试」来自客户端计数，不是服务端状态。

### 12.3 建议

1. **真机验收清单**：在 Core 17 + 真实反代上依次验证——建立连接、后台改文章触发 `updated`、只改草稿不触发、取消发布触发 `gone`、改 slug/分类触发 `moved`、断网 30s 后恢复、关闭网关后胶囊出现并在恢复后消失、移动端胶囊与通知不遮挡正文。
2. 若多标签页在线数被高估影响运营，再引入 `BroadcastChannel` 选主。
3. 若后续要接评论实时更新，复用 `realtimeBus` + `joinArticle` 即可，不需要动连接层。
4. 若 Core 未来在事件里给出 ETag 或版本号，可把 `modifiedAt` 比较替换为版本比较，减少一次无谓重取。
