# Folio Design System · Warm Paper × Lavender Blue

> 暖纸与薰衣草蓝：**Warm Paper 70% · Vintage Editorial 20% · Frosted Glass 10%**
> 这份文档是「改之前先读、改之后要同步」的唯一设计口径。任何视觉决定若与本文冲突，以本文为准；本文没写的，先补文档再写代码。
>
> **同步记录**：Phase 4A（自托管中文 Web Font：Noto Sans SC / Noto Serif SC）与 Phase 4B（Markdown 失效选择器删除、材质/媒体注释与契约测试）已并入主线，本文按两者的实际实现更新了 §2、§3.1、§5.2、§10（含 10.1/10.2）、§13、§14.1、§14.3、§14.5、§14.8、§14.9、§14.10。本次顶部玻璃参数调整为亮/暗均 24px blur，亮色 alpha 0.82 / saturate 1.4、暗色 tint 36 44 47 / saturate 1.25；并移除导航胶囊的内缘高光与描边。
>
> **2026-11-13 视觉收敛**：导航入口标签成为唯一的菜单触发器（移除旁挂省略号按钮与装饰箭头，触屏改为「先展开、再导航」两段式），新增 `.glass-control` 让工具组四个圆按钮共用一套冰面参数，页脚收敛为两行并统一 `.footer-sep`。同步 §1、§5.2、§7、§9、§14.5。
>
> **2026-11-13 友链卡片改为明信片 + 独立邮票**：`.friend-postcard` 取代原来的整卡邮票，卡片是暖纸明信片（桌面 312 × 144 ≈ 2.17:1，窄屏 312 × 140 ≈ 2.23:1，高度写死；桌面一行两枚、手机一列一张），右上角贴一枚 96px（窄屏 88px）的方形齿孔邮票（齿距 6px / 凹口 1.9px，四层 radial-gradient 取交集），邮票里是「同源模糊底 + 72px（窄屏 64px）圆形清晰头像」；日戳 76px（窄屏 68px），圆心落在邮票左下角，圆跨过邮票左缘与下缘形成骑缝，圆底 156 越过卡底 144、多的 12px 由 `overflow: hidden` 裁掉形成压边效果，且与 72px 主头像圆心相距 78.8px 只压模糊底、不盖主图；纸面用**卡片自建纸纹**（`--pc-grain`：0.62 的细颗粒 × 0.035 的疏密调制，`feComposite k1=1` 相乘），不再复用全站 `--material-grain-image`；纹理色走 `--pc-grain-ink` 的中性暖灰 / 暖白，刻意避开带青蓝的 `--text-heading`，纸底也不掺暗色下偏冷的 `--surface-sunk`，因此两种主题都不发蓝，也不会出现「一朵朵云」或斜纹网格。**卡片不再使用 `.glass-control`**，冰面恢复为只服务导航与浮标的材质，§1 的例外条款随之失效。样式从 `globals.css` 抽到 `src/features/friends/friend-postcard.css`，由 `globals.css` 顶部 `@import` 汇总。同步 §1、§2、§7。
>
> **2026-11-14 明信片宽度锁定 + 纸色转白 + 纸纹减量**：① 宽度从 `width: 100%` + `max-width` 改为绝对值 `width: var(--pc-w)`（19.5rem = 312px）配 `margin-inline: auto`。原因是父级 `<li>` 在 `justify-items-center` 下会收缩到内容宽，百分比宽度成了循环依赖 —— 长站名的卡被撑到上限、短站名的卡只剩内容宽，几张信封并排宽度不一致；现在所有卡片一律同宽同高，`max-width: 100%` 只负责极窄视口不溢出。日戳左缘与文字右缘的相切关系也不受影响：两侧都以 `-pad - stamp - gap` 从各自方向对齐，与卡片宽度无关。② 纸色由「偏蓝」转「偏白」：纸底 `--surface-raised` 84% × `--surface-lift` 16% 改为 **55% × 45%**（读成白纸，只留一点米调托住暖纸气质）；纸纹墨色 `--pc-grain-ink` 从 `--text-primary` 58% × `--surface-lift`（纯白）改为 **46% × `--surface`**（暖纸底）—— 纯白会把颗粒的中性偏冷显出来，满屏细砂平均后整张纸发青；暗色下另给 `.friend-postcard__paper` 掺一成 `--text-primary`，把冷调深墨 `#1b1f21` 抬成深灰纸。合成后实测：亮色 `#f0f0eb`（B−R = −5，仍偏暖）、暗色 `#3b3f3f`（B−R = +4，从 +6 收窄）。③ 纸纹 `opacity` 由 0.32 降到 **0.26**（暗色 0.28，因为暗色下颗粒是提亮不是压暗），有效覆盖率由 15.2% 降到 12.4%，减量两成，颗粒仍可辨但不再像一层噪点壳。同步 §7。
>
> **2026-11-15 右下工具组改用导航玻璃 + 光斑**：三枚独立圆形冰面按钮（`.glass-control`）改为**一整块与顶栏同源的玻璃胶囊**——`.toolbar-dock` 自己携带 `.nav-glass.glass-nav` 与 `.nav-spotlight` 两层，三个按钮退化为胶囊内的透明格子（`--radius-sm`、无边框、无独立 `backdrop-filter`）。材质参数一律走 `--nav-*`（实测两处 `backdrop-filter` 均为 `saturate(1.12) blur(22px)`、底色同为 `--nav-backdrop` 的 82% 暖纸），悬停/激活改用 `--nav-item-hover` / `--nav-item-active`，不再出现「顶栏偏蓝、浮标偏灰」。指针跟踪逻辑抽成 `useSpotlight(ref)` 一个 hook，顶栏卡片与工具胶囊共用，仍是 rAF + CSS 变量、不进 React 状态。光斑半径参数化为 `--nav-spotlight-size`：顶栏 11rem，胶囊收 5rem——48px 宽的宿主用 11rem 会整块均匀染色，看不出光点移动。`.glass-control` 因此退出消费（保留定义，与 `.glass-bar` 同例）。同步 §1、§5.2、§7、§9、§14.5、§14.8。
>
> **2026-11-15 导航药丸化 + 选中态细线 + 模糊减量**：① 导航卡片 `.nav-card` 与工具胶囊 `.toolbar-dock` 的 `border-radius` 从 `--radius-md`（6px）改为 `--radius-pill`（999px），形成药丸/胶囊形态。卡片内部的 `.nav-link`、`.nav-menu-trigger`、`.nav-avatar` 的圆角也一并改为 `--radius-pill`，工具按钮 `ToolbarButton` 同步。② 顶栏选中态从 `background-color: --nav-item-active`（洗底）改为**底部 1px 细线**（`::after` 渐变横线，两端透明、中间 `--accent-strong`）+ 文字色 `--accent-strong`，hover 保持浅底不变。③ `--nav-blur` 从 22px/20px 降至 14px/12px，`--nav-backdrop` 补偿透明度从 82%/88% 提到 85%/90%。不引入 framer-motion 依赖——细线不做 layoutId 滑动。同步 §5.2、§6、§7。
>
> **2026-11-15 主题配色实验：暖纸 × 薰衣草蓝（v1 Glacier → v2 Lavender Blue）**：只改调色板值、语义层与文档，组件层零改动。① 纸：`#f3f0e7`（L\* 94.8 / b\* +4.7 的牛皮米黄）→ `#fbfaf7`（L\* 98.3 / b\* +1.5，中性微暖），下沉面与更深面同步提亮。② 墨：正文 `#525650` → `#4a4a45`、次级 `#646760` → `#6b6b64`、装饰 `#85877f` → `#85857d`，全部中性化；**标题 `#344f58`（青绿）→ `#2c2a26`（中性深灰）** —— 标题与旧强调同族，是「强调不强调」的主因之一。③ 强调：`#63888e`（C\* 11–13，人眼读不出色相）→ `#586fa8`（C\* 34 / h 283°），三兄弟职责不变（`accent` 边界与填充 / `accent-strong` 唯一文字色 / 新增 `accent-active` 按下态预留），暗色一套同向反演。④ `--shadow-color` 由偏绿的 `34 40 38` 改为中性偏紫的 `43 40 48`。⑤ 导航玻璃 alpha 由 85% / 90% 收回 82% / 88%（**这是一次往返**：上一条「导航药丸化 + 模糊减量」先把 82/88 提到 85/90 补偿模糊下调，本轮再按 §4.1 的既有契约压回 82/88。最终值以源码为准 ＝ 82%/88%，两条记录方向相反不是笔误），与 `--nav-backdrop` 的既有契约和本文 §4.1 对齐（源码漂移，非配色决策）。⑥ 文档新增 §3.4，说明为什么**不**引入 `diary-*` 与 `rose-*`：前者的暗色五值与 accent 族逐字节相同、亮色唯一差异值 `#7188c7` 在 12px 日期行只有 3.33；后者无任何消费者。⑦ 顺带修掉三处既有红灯：友链明信片暗色块里三个 `rgb()` 字面量（其中 `rgb(198 215 217 / 0.12)` 是旧标题色的复制粘贴）、`.friend-postmark` 未声明的 `--postmark-rotate`（值由 TSX 内联注入，补默认值以消除静态扫描误报）、`say-grid.tsx` 用 `--text-tertiary` 承载 12px 日期（改 `--text-secondary`）。同步 §1、§3（含 3.1–3.4）、§11、§14.4。
>
> **2026-11-15 博文日记页面样式重构**：① 文章详情页去掉 `reading-sheet`（无界、无白底纸面），正文直接铺在页面 surface 上，对齐 Shiro 无界做法。② 日记详情页保留 `reading-sheet` 白底纸面，正文用新 Token `--container-diary: 40rem`（≈36 汉字/行），比文章的 `--container-prose: 48rem` 窄 8rem，形成视觉区分。③ 博文列表页去掉 `border-t` 与 `divide-y` 虚线分隔，改为 `flex flex-col gap-4` 的无边框纯净预览。④ `--container-prose` 从 40rem 加宽到 48rem（对齐 Shiro `max-w-3xl`），`--container-wide` 从 68rem 加宽到 72rem。同步 §6。（**历史条目，勿照抄**：本段提到的 `--container-diary` / `--container-prose` 在后续「阅读宽度体系」改造中已改名为 `--measure-note` / `--measure-post` 并删除，现值见 §6。）
>
> **2026-11-15 阅读辅助区样式重构**：参考 Shiro 侧栏做法，全面调整桌面端阅读辅助区的视觉和谐度。① `ReadingAside` 去掉虚线分隔（`border-t border-dashed`），改用间距分区；目录标题改为 `text-meta font-medium tracking-[0.06em] uppercase` 小型大写标签。② 阅读进度从桌面端圆环（`ReadingProgressRing`）改为竖向线性进度条（`ReadingProgressBar`）：高度 2rem、宽 1px、底色 `--edge`、填充色 `--accent` 从底部上升、旁边显示百分比数字。移动端折叠目录仍保留圆环进度。③ 目录列表活跃项竖线从 `w-px`（1px）改为 `w-[2px] rounded-full`，加强 accent 色可见性。④ `.action-rail-button` 的 `border-radius` 从 `--radius-sm` 改为 `--radius-pill`（药丸化），hover 色从 `--text-heading` 改为 `--accent-strong` + `--accent-wash` 底色。⑤ 桌面端（≥80rem）操作按钮隐藏文字标签只留图标（sr-only 方式），图标放大到 1.25rem，对齐 Shiro 纯图标竖排做法。同步 §7。
>
> **2026-11-15 一言与项目页面**：新增 `/says` 一言页面与 `/projects` 项目页面，完成 Mix Space 云函数 says/projects 的前端对接。① 完整 API 层：contracts（`V2Say`、`V2Project`）→ domain → adapters → repositories，mock 数据与路由同步覆盖。② Feature Registry 新增 `says: true`、`projects: true`。③ 导航 `ALL_NAV` 新增两个 `section: 'more'` 入口，自动归入菜单「更多」分区。④ 一言页面设计：暖纸底 + 双列网格（`sm:grid-cols-2`）+ 左缘 3px 彩色竖线（色相由 id 哈希）+ `surface-raised` 卡片 + `shadow-raise` + 出处/作者/相对时间。⑤ 项目页面设计：三列响应式网格（1→2→3 列）+ 圆形头像/首字母 fallback（色相由 name 哈希）+ 药丸行动链接（GitHub / 预览 / 文档）+ hover 上浮 + `shadow-pop`。⑥ i18n 中英双语完整覆盖（zh-CN 12 键、en 12 键；`LOCALES` 只有这两种，不是"三语"）。同步 §9。
>
> **2026-11-15 `.glass-control` 死链清理**：上一条「保留定义」的决定被本轮取代——颜色系统审计确认 `.glass-control` 在工具组改用 `.toolbar-dock` 的 `.glass-nav` 后已无任何 DOM 生产者（`toolbar-button.tsx` 只渲染胶囊内的透明格子，`tests/search-entry.test.tsx` 明确禁止按钮携带该类），遂按 `.glass-bar` 先例删除该类及其 `@supports` / `prefers-reduced-transparency` 分支，连同五个专用材质参数（tint 三元组、两档 alpha、blur、saturate，亮暗两套）。`--color-frost` 不受影响：仍经 `--edge-frost` 服务阅读纸面外框与 `.glass-panel` 边框；`--material-glass-rim` 保留（`.glass-panel` 顶缘高光）。契约测试改为反向断言：类与五个参数不得复活，tint/frost 逐通道同源断言随之移除。工具栏视觉零变化（删除的类本就没有消费者）。同步 §3.1、§3.3、§7、§14.5、§14.8。

> **2026-11-16 设置入口统一迁到页脚**：右下工具胶囊只留「回到顶部」，主题与语言从浮标和导航菜单里全部撤出，改为页脚设置区——语言选择器（Languages 图标 + 当前语言名 + 向上弹出的菜单，`menu` / `menuitemradio` 语义）与三态主题（Sun → Monitor → Moon，原生 radio + `radiogroup`）紧挨成一组。语言仍写 `folio-lang` cookie + `router.refresh()`（唯一写入点搬到 `use-locale-switcher.ts`），主题仍走 `useThemePreference`（`system` = 删除键）。删除 `NavSettings`、`LanguageButton`、`ThemeToggle` 三个组件，连线上的 `--nav-settings-surface` 一并移除（失去全部消费者，登记表无需扩列）。契约测试同步：`theme-preference` / `footer-settings` 改为驱动三段单选，菜单测试新增「菜单里不再有 radio」，工具胶囊按钮数从 3 改为 1。同步 §7、§9、§14。
>
> **2026-11-16 Footer 改为左右分区**：上一版把设置区横在信息区**上方**、整块 `flex flex-col`，结果所有内容都挤在左半边、右侧一大片空白；当时给 `.footer-settings` 加的 `padding-right: 4.5rem`（为 fixed 回顶浮标避让）对一条左对齐的 flex 行也根本不起作用。本轮改为两个**平级区域**：`.site-footer__info`（两行信息）与 `.site-footer__settings`（语言 + 主题），由 `.site-footer__inner` 的 grid 负责布局——≥48rem 为 `minmax(0,1fr) auto` + 设置区 `justify-content: flex-end` 贴右；<48rem 单列，信息在上、设置在下且都靠左。信息区第二行从「独立的一排链接 + 一行 Powered by」合并成**一条可换行的流**（`Powered by … Design.` / 备案 / `footer.links` 同处一个 `<p>`，链接 `nowrap`、间距由 `row-gap` 给），不再拆成多段。避让重新推导：设置区在桌面端已贴右，与浮标（`right: 1.5rem`、`bottom: 8rem`）水平重叠区被 233px 宽的控件组让开，实测五个视口 × 两主题相交面积为 0；手机端设置区落到最底下、靠左，页脚底部让出 4rem（原 6rem 是为「设置区在最上面」时的补偿，现在会留出无内容空白）。实测 390 / 768 / 1024 / 1280 / 1440：第二行在 ≥1024 为 1 行、768 为 2 行、390 为 2 行，五档 `scrollWidth - innerWidth` 均为 0（`scripts/visual/footer-layout.mjs`）。同步 §5.7、§7、§9、§14.2。
>
> **2026-11-16 桌面导航双态（Editorial Bar / Floating Dock）**：桌面顶栏从「单态悬浮卡片」升级为**一套 DOM、三种状态**，由 `<header data-mode>` 切换：`top` 为通栏透明的 Editorial Bar（`--nav-topbar-height` 4.25rem、与 `Container` 的 `--container-wide` + `--spacing-gutter` 逐像素对齐、`.nav-glass` 与 `.nav-spotlight` 在该态 `opacity: 0` / `display: none`），`hidden` 整块滑出并按 `visibility: hidden` 真正离开可聚焦树，`floating` 收紧为居中 560 × 50px、16px 微圆角、带玻璃与光斑的 Dock。状态机重写为 `top / hidden / floating` 三态并集中阈值：离开顶部 72px、回到顶部 40px（迟滞死区）、下滚累计 96px 隐藏、上滚累计 40px 显示；初始位置、`pageshow`、`popstate` 按位置重新落定，恢复中段页面不会先画一帧顶部栏；菜单 / 搜索打开与下拉悬停期间冻结形态，解锁 / 下拉解除时按位置恢复成可见的 Dock（`restore()`，避免把刚落回焦点的按钮一起收走）。**不做双 DOM**：导航数据、菜单开关、`aria-controls` 的 ID 与 Tab 顺序都保持唯一。移动端零改动——三态规则全部写在 `@media (min-width: 48rem)` 内，`<48rem` 块里不出现 `data-mode`。占位块改用 `--nav-topbar-height`，两态切换正文不跳。新增 Token：`--nav-topbar-height` / `--nav-dock-height` / `--nav-dock-width` / `--nav-dock-radius` / `--nav-dock-offset`（布局值，非颜色）；`--nav-bar-height` / `--nav-gap` / `--nav-inset` / `--nav-panel-max` 从 `globals.css` 的 `:root` 迁入 `tokens.css`。滚动阈值**不进 Token**（JS 读不到 CSS 变量，写进去就是第二份事实）。实测：1024 / 1104 / 1280 / 1440 / 1920 五档三态与对齐、1440 下两态的下拉与菜单、320 / 375 / 390 / 430 四档手机回归、768 断点归属，全部通过（`scripts/visual/nav-dual-state.mjs`）。新增 `tests/nav-dual-state.test.tsx`（18 例）守护单 DOM、状态机、冻结与断点边界。同步 §4.1、§6、§7、§9。
>
> **2026-11-16 文档与源码对齐（v0.2 合并前审计 T3）**：本轮只改文档与测试，**不动任何 Token 值、颜色、字号**。修掉六处会让"以本文为准"失效的错误：① §2 的「三层结构」改为**四层**（`@theme` / 语义别名 / 组件专属 `--nav-*`·`--note-*` / 材质 `--material-*`），并写清每层的消费权限——旧文把 `--material-*` 归进别名层、又规定"组件只消费第 2 层"，与 `--nav-*` 的实际消费自相矛盾；② §6 删掉三个**源码里已不存在**的 Token（`--container-prose` / `--container-diary` / `--spacing-gutter-lg`，它们被 `--measure-post` / `--measure-note` 与 `clamp()` 版 gutter 取代），补记 9 个从未进文档的布局 Token（`--measure-post|note|page|copy`、`--rail-toc|side`、`--shell-post|note|page`）与 `--gap-rail|side`、`--pad-paper-*`，并诚实标注 `--shell-page` **当前无消费者**；③ `--nav-blur` 的 §4.1 值 22/20 改为源码的 **14/12**（§7 本来就写 14/12，两处打架）；④ `--shadow-color` 的 34 40 38 改为 **43 40 48**；⑤ §5 仍把 `.nav-label` / `.nav-panel-link` 当现行类，实际早已由 `.nav-link` / `.nav-row` 取代，且 `.meta` 的行号引用已漂移 → 改为符号引用、不写行号；⑥ 断点表删掉不存在的 `--spacing-gutter-lg`、补上真实存在的 `md`（48rem，友链两列 + 导航双态起点）与 `69rem`（1104px 侧栏阈值），并把"没有 `md:` 使用"改成事实。另修：`--text-tertiary` 白名单 10 → **11 处**；「i18n 三语」→ **中英双语**（`LOCALES` 只有两种）；§9 的 `DiaryEntry` 描述从"多图 3 列缩略"改为**摘要 + 单张代表图**，`ArticleRow` 标题从"16→20px"改为实际的 `text-[1.625rem]`（26px，待 Token 化）；两条 2026-11-15 记录的先后按提交历史（`5856d6c` blur 14/alpha 85 → `291bfdd` alpha 82）**对调并注明这是一次往返**。§14.9 补 `nav-dual-state.test.tsx` 一行。配套修复：`tests/helpers/design-tokens.ts` 的路径分隔符与行尾归一（见 `.gitattributes`），此前 `design-color-system` 与 `markdown-css-contract` 的守卫在 Windows 上**恒不命中**。
> **2026-11-16 第二/三组：体验与兼容性收敛**：① **正文图补宽高**（T4）：`renderMarkdown` 新增 `RenderOptions.imageSizes`，`imageSizeIndex()` 从 core 的附件元数据建 `src → 宽高` 索引，命中才输出 `width`/`height`（未命中一个属性都不加，不猜比例）；相册静态轨道与**客户端增强后的 `<img>`** 共用同一份索引（`media-enhancer` 从 DOM 属性回读，否则重建节点会丢掉尺寸）。实测最长日记 CLS 从 **0.9244 → 0**，尺寸覆盖 471/475。② **打印样式**（T5，新增 `print.css`）与 **系统高对比度**（T13，新增 `forced-colors.css`），见 §7.2。③ **`--text-rowtitle` 新档位**（T7）：文章列表行标题过去写成 `text-[1.625rem]`，实为缺一档；固定 26px（不能用 clamp 的 `--text-title`，桌面会爬到 32–34px）。④ `--shell-page` 从「零消费者」改为真实使用（`/about` 的 `max-w`），并写明 **1104px = 65rem + 双侧 gutter**。⑤ `--text-tertiary` 白名单唯一承载可读文字的那条（分页禁用项）补上了真正的判定依据。
> **2026-11-18 首页编辑栅格（单列索引）**：上一轮 minimal 目录把文章区拉成通栏单列「表格」——每行右侧大片空白、行间虚线，与日记三列、More 居中各说各话。本轮全页统一到一套编辑栅格：≥lg 为 `--rail-home`（11rem，新增 Token）左轨 + 自适应内容列，轨距复用 `--gap-rail`；Hero 头像与区块标题（含 action 链接，竖排贴顶——`justify-between` 在拉伸高度下会把 action 推到轨底）落左轨，身份名、统计行、文章索引、日记栅格、More 按钮行落内容列，一条对齐线贯穿全页；<lg 退化单列（标题行在上、内容在下）。**文章区保持单列**：一行一篇，标题左、日期贴右缘同基线（≥sm；<sm 日期落标题下方），不做双列卡片阵（用户明确否决双列），行距 `gap-y-8` 与日记同族；日记区 <xl 单列（预览行宽收 `--measure-note`）、≥xl 三列，同样不经过双列阶段。`.home-more` 居中改左对齐。区块分隔统一「`--spacing-section` 留白 + 虚线 + `--spacing-stack` 内边距」，消掉旧版 pt-10 与 mt-5rem 叠加的双间距；Hero 经典布局去掉 pb，留白交给区块分隔。顺带删除上一轮相关阅读改版后零消费者的 `ArticleCard`（无消费者、无测试、§13 清单无引用），并修正 §5.1 / §9 对它和 `ArticleRow` 的过时描述。实测 390 / 768 / 1024 / 1280 亮色 + 1280 暗色：`scrollWidth - innerWidth` 均 0、无破图。真后端（`api.miaoer.net`，PORT=3000）复验又暴露两处并同批修掉：① 真站配置走**模板化 Hero**，它原先不进编辑栅格、上下各 160px 内边距与区块外距叠出约 240px 死留白——≥lg 整体缩进内容列（`lg:pl` = rail+gap）、头像贴版心右缘，竖向改顶 1.5×section、底部交给区块分隔，对齐线与留白节奏与经典布局一致；② GitHub 品牌黑作前景在暗色纸面上整枚不可见——`toSocialItems` 按 WCAG 相对亮度归一：L<0.05 或 L>0.95 的 hex 品牌色落回 null（语义次级色），中间亮度与 CSS var 色保留原值，新增 4 例单元测试覆盖拒绝与允许路径。真数据（6 篇长标题文章、3 日记、2 More 入口）五视口溢出 0、无破图；截图等待加长到 3s 以覆盖 Hero 逐字动画完成态。同步 §5.1、§6、§9。
> **2026-11-25 页脚改为 Shiro 分类导航**：按用户要求不保留兼容层，删除旧 `footer.links`，只接受官方 `footer.linkSections[]`（`name` + `links[{name, href, external}]`）。页脚顺序改为「分类导航 → 版权/签名 → Powered by/ICP → 右下语言与主题」；<48rem 分类竖排，≥48rem 横排且可折行。链接地址允许根相对路径、http(s) 与 mailto；`external` 省略时按地址推导，显式声明与地址类型矛盾时丢弃该条。分类最多 6 组、每组最多 8 条，组内按 href 去重。同步 §5.2、§9。
>
> **2026-11-25 阅读正文加宽（对照 Shiro）**：`--measure-post` 44 → **52rem**（704 → 832px，≈49 汉字/行 @17px），`--measure-note` 40 → **44rem**（640 → 704px，≈41 汉字/行），博文∶日记 = 1.18。依据是对 hoshiroko.com（Shiro，根字号 14px）的实测：博文正文 920px / 15.4px ≈ 60 字/行，日记纸面 840px（左右 padding 45）正文 748px ≈ 49 字/行，比例 1.23 —— 本主题取中间档，不追 60 字/行。派生 shell 需同时放得进 1280 视口的容器内容宽（1088）：`--shell-post` = 832 + 36 + 208 = **1076**，`--shell-note` = 704 + 2×56 + 36 + 208 = **1060**，都留有余量，因此 `--container-wide` 与 xl 断点不动。同步 §6。

---

## 1. 设计语言

| 层次                       | 占比 | 承担什么                         | 材质                          |
| -------------------------- | ---- | -------------------------------- | ----------------------------- |
| 暖纸 Warm Parchment        | 70%  | 页面底、阅读纸面、卡片           | 纸色 + 极轻颗粒 + 环境光      |
| 编辑排版 Vintage Editorial | 20%  | 衬线标题、发丝线、留白、悬挂标点 | 无（纯排版）                  |
| 冰面 Frosted Glass         | 10%  | 导航条、工具浮标、浮层           | 半透明纸色玻璃 + 14–24px 模糊 |

三条不可越界：

1. 冰面只给「需要压住滚动内容」的局部，**不做全屏玻璃、不给正文卡片**。友链明信片卡是这条规则的验证案例：它曾经用 `.glass-control` 做邮票纸面，改成「明信片 + 独立邮票」后**已完全退出冰面**，纸面改由暖纸底色 + 纸纤维 + 发丝边构成。内容卡片不得再以任何理由引入玻璃。
2. 主题色（Lavender Blue）承担交互识别，**不做大面积填充**；正文永远是墨色。
3. 装饰必须有理由：无统计卡片、无渐变按钮、无位移悬浮、无霓虹。

---

## 2. Token 分层

```
src/design-system/tokens/tokens.css      ← 唯一色值/字号/间距/圆角/阴影/动效/材质/字体栈来源
src/design-system/styles/fonts.css       ← 只声明 @font-face（自托管中文 Web Font），不含语义变量
src/design-system/styles/material.css    ← 材质实现（颗粒、环境光、纸面、冰面）
src/design-system/styles/{motion,prose,code-block,media,footnotes,mentions,containers}.css
src/design-system/styles/{print,forced-colors}.css  ← 印刷与系统高对比度，各自只包一个媒体查询
src/app/globals.css                      ← base 层：元素默认样式 + 少量结构化类
src/features/*/[component].css           ← 组件专属样式（当前：friends/friend-postcard.css），
                                           由 globals.css 顶部 @import 汇总引入
```

组件专属样式不进 `design-system/styles/`：那一层是站点级材质与排版，可整体关闭；单个页面/组件的规则留在自己的 feature 目录，一个组件一个文件，`globals.css` 只做入口汇总。

四层结构（与 `tokens.css` 顶部注释逐条对应，改层级先改两处）：

1. **`@theme`** — 调色板 / 字体 / 字号 / 版心 / 间距 / 圆角 / 阴影 / 动效。Tailwind v4 会同时生成工具类（`bg-paper`、`text-ink-muted`、`text-display` …）。
2. **`:root` 语义别名** — `--surface*`、`--text-*`、`--edge*`、`--accent*`、`--state-*`、`--focus-ring*`、`--reading-surface`、`--code-surface`。这是**全站共用**的一层：任何组件都可以消费。
3. **组件专属** — `--nav-*`（导航族：`site-nav` / `toolbar-dock` / `site-nav-menu`）与 `--note-*`（Markdown 容器族：`containers.css`）。这一层只允许**对应组件族内部**消费，页面与其它组件不得借用：`--nav-backdrop` 出现在正文卡片上，就说明有人拿错了层。
4. **材质** — `--material-*`（颗粒、环境光、冰面参数），只由 `material.css` 消费；整层可关闭（见 §7）。

组件消费规则（按层，不按"新旧"）：

- 业务组件（页面、功能组件）**只用第 2 层**或 `@theme` 生成的工具类。
- 第 3 层只在自己的组件族里消费：`--nav-*` 的消费者是 `globals.css` 的 `.site-nav` / `.toolbar-dock` 样式块与 `material.css` 的 `.glass-nav`；`--note-*` 的消费者是 `containers.css`。
- **任何层都不直接引用 `--color-*` 调色板**。唯一例外是 `media.css` 与 `reading.css` 的反色浮层（`--color-ink` / `--color-paper`），由 `tests/design-color-system.test.ts` 的例外清单逐条登记，新增例外必须先说服这张表。

铁律（守护范围与盲区逐项列在 §14.9，不要笼统理解为"全都有测试"）：

- 组件层不出现 HEX / `rgb()` / `hsl()` 字面量。TS/TSX 与 CSS **都**检查（CSS 侧豁免 `tokens.css` 自身，它才是色值的合法来源）。
- 组件层不出现 `dark:` 变体，暗色只覆盖 token。TS/TSX 与 CSS 都检查。
- 任何 `var(--x)` 必须有定义（排除第三方前缀 `--tw-/--shiki/--katex/--mermaid/--hljs`）。
- 本文与 `tokens.css` 必须同步：文档引用的 Token 必须存在、声明为精确值的必须相等、§13 的路径必须真实（`tests/design-doc-sync.test.ts`）。

---

## 3. 色彩

主题：**Warm Paper × Lavender Blue**（暖纸 × 薰衣草蓝）。三条轴向各管一件事，改色时不要串台：

- **纸**中性微暖（`L* 98.3` / `b* +1.5`），暖意来自色相 `h≈97°`，不是把颜色调黄；
- **墨**完全中性（`a*` / `b*` 都压在 4 以内），不再带青绿倾向；
- **强调**只有一条薰衣草蓝（`h 283°` / `C* 34`），是页面里唯一的冷色。

> 演进史：v1 的 `#63888e`（Glacier 灰青）彩度只有 `C* 11–13`，落在人眼读不出色相的中性区间 —— 这才是"说不出是什么颜色"的根因，而不是色相偏了。v1 同时存在四种温度（暖纸 + 冷青强调 + 青绿标题 + 冷灰墨），互相打架；v2 把标题与正文退回中性，只留一处冷色。

### 3.1 亮色（默认，`:root`）

| 角色       | Token                   | 值        | 用途                                                                                                                                                                               |
| ---------- | ----------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 页面底     | `--color-paper`         | `#fbfaf7` | `body`、`--surface`。`L* 98.3` / `b* +1.5`（v1 是 94.8 / +4.7 的牛皮米黄）                                                                                                         |
| 抬升面     | `--color-paper-raised`  | `#fdfcf9` | 卡片、浮层、`--reading-surface` 基色                                                                                                                                               |
| 最高面     | `--color-paper-lift`    | `#ffffff` | 内缘高光、玻璃 rim                                                                                                                                                                 |
| 下沉面     | `--color-paper-sunk`    | `#f3f1ea` | 代码块底、空状态、`--code-surface`                                                                                                                                                 |
| 更深       | `--color-paper-deep`    | `#e7e4da` | 亮色下**没有组件消费者**；暗色值仍被暗色 `--material-ambient` 消费，是真实使用中的环境光基色。**不得因为亮色零消费者而删除**（`design-color-system.test.ts` 有反向守护，见 §14.8） |
| 冰         | `--color-frost`         | `#e2e8f1` | 经 `--edge-frost` 服务阅读纸面外框与 `.glass-panel` 边框                                                                                                                           |
| 正文       | `--color-ink`           | `#4a4a45` | 段落。纸面 8.54                                                                                                                                                                    |
| 强正文     | `--color-ink-soft`      | `#35352f` | 强调段、`strong`。纸面 11.82                                                                                                                                                       |
| 次级       | `--color-ink-muted`     | `#6b6b64` | 一切**需要读**的文字（含 12px meta）；在 paper/raised/lift/sunk/reading/wash 上均 ≥4.5:1（最差 wash 4.73）                                                                         |
| 装饰       | `--color-ink-faint`     | `#85857d` | **装饰专用**：图标、分隔点、图表线、未激活控件（非文本 ≥3:1，最差 wash 3.28）。**禁止用作正文或 meta**（§11）                                                                      |
| 标题       | `--color-heading`       | `#2c2a26` | h1–h6、卡片标题。**中性深灰**（v1 是青绿 `#344f58`）                                                                                                                               |
| 边界       | `--color-line`          | `#e0dcd1` | 1px 分隔                                                                                                                                                                           |
| 强边界     | `--color-line-strong`   | `#cec9bc` | 虚线分隔、引用左边线                                                                                                                                                               |
| 主题色     | `--color-accent`        | `#586fa8` | 装饰与交互**边界**：焦点环、进度条、细线、指示点、下划线、按钮填充（非文本 ≥3:1，最差 wash 4.35）。**禁止用作文字色**（§3.3）                                                      |
| 主题浅     | `--color-accent-soft`   | `#8296c8` | 下划线装饰、图表描边、导航光斑                                                                                                                                                     |
| 主题深     | `--color-accent-strong` | `#465b91` | **唯一可用于文字的强调色**；全表面 ≥4.5:1（最差 wash 5.85）                                                                                                                        |
| 主题洗     | `--color-accent-wash`   | `#eef0fc` | 选中底、标签底、`::selection`                                                                                                                                                      |
| 主题线     | `--color-accent-line`   | `#bbc8e9` | kicker 前短横线、引线                                                                                                                                                              |
| 主题按     | `--color-accent-active` | `#394b7c` | 按下态预留：比 `accent` 再深一档（`L* 33`）。**当前无别名、无消费者** —— 现有代码没有任何 `:active` 颜色规则，调色板层不受死 Token 检查约束，先留值以免将来加 pressed 态时再调色   |
| 危险       | `--color-danger`        | `#a4503f` | 状态色，**组件必须经 `--state-danger` 消费**；Callout / Banner / ErrorState                                                                                                        |
| 警告       | `--color-warning`       | `#7d5f28` | 经 `--state-warning` 消费；比 4D 基线深一档，保证 8% 底纹上标题 ≥4.5:1                                                                                                             |
| 成功       | `--color-success`       | `#4a6b52` | 经 `--state-success` 消费；Callout / Banner / Ins / diff / 状态胶囊                                                                                                                |
| 信息       | `--color-info`          | `#4a6a7c` | 经 `--state-info` 消费；Callout / Banner / Toaster                                                                                                                                 |
| 便签鼠尾草 | `--color-note-sage`     | `#d8ddca` | Tags 索引签纸色（§14.12）                                                                                                                                                          |
| 便签灰蓝   | `--color-note-blue`     | `#d2dde2` | 同上                                                                                                                                                                               |
| 便签陶土   | `--color-note-clay`     | `#e6d2c6` | 同上                                                                                                                                                                               |
| 便签麦芽   | `--color-note-ochre`    | `#e7dbbc` | 同上                                                                                                                                                                               |
| 便签米色   | `--color-note-cream`    | `#efe6d3` | 同上                                                                                                                                                                               |

### 3.2 暗色（`[data-theme='dark']`，夜间纸墨，不是反色）

暗色底是**暖灰紫黑**（`paper` 的色相 `h 303°`、`C* 2.1`），不是冷蓝黑，也不是纯黑。层级识别交给 `--edge*` 与阴影，不靠把每一层都提亮。

| 角色     | 值                       | 说明                                                       |
| -------- | ------------------------ | ---------------------------------------------------------- |
| 页面底   | `#141316`                | 暖灰紫黑，非纯黑，避免 OLED 眩光                           |
| 抬升面   | `#1c1b1f`                | 阅读纸面                                                   |
| 最高面   | `#252329`                | 浮层                                                       |
| 下沉面   | `#0f0e11`                | 代码块。**比页面更暗**，与亮色同向（理由见下方警告）       |
| 更深     | `#0a090c`                | 环境光基色。**必须最暗**，否则右下角环境光会发光而不是压暗 |
| 正文     | `#d0cdd0`                | 柔白，非 `#fff`                                            |
| 标题     | `#e4e1e8`                | 中性微紫白，不再带纸墨青调                                 |
| 次级     | `#a4a0aa`                | AA，最差 wash 5.50                                         |
| 装饰     | `#85818a`                | 装饰专用；最差 wash 3.70（≥3:1），语义规则两套主题一致     |
| 主题色   | `#a8b8e4` / 深 `#8fa2d5` | 提亮以保证暗底 ≥4.5:1；`accent-strong` 是最差面 6.14       |
| 阴影基色 | `0 0 0`                  | 暗色下阴影必须纯黑                                         |

> **下沉面 / 更深 是本轮唯一没有照移植表取值的一对，不要"修正"回去。** 移植表给的是 `#2e2b32` / `#39353e`（比 `paper` 更亮，一套"越高越亮"的 Material 阶梯），但这两个 Token 在本仓库各有硬消费者，按表取值会产生两处可见回归：① `--code-surface` 等于 `paper-sunk`，代码块会比页面还亮、且亮过浮层；② 暗色 `--material-ambient` 用 `paper-deep` 画右下角环境光，角上会**发光**而不是压暗。因此保留移植表的色相与彩度，只把明度方向按角色收回。

> **Accent 三兄弟是主题适配策略，不是三个可各自调整的品牌色**：亮色"越深越强"、暗色"越亮越强"，方向相反但职责一致（`accent` 边界 / `accent-strong` 文字 / `accent-active` 按下）。改三者中任何一个，都必须同时验证另一主题的同名角色 —— `tokens.css` 文件头也写了同一条提醒，`design-color-system.test.ts` 会对亮暗两套分别跑完整矩阵。

> 本表是 `[data-theme='dark']` 的**节选**，不是完整覆盖清单：`--color-frost`、`--color-line*`、`--color-accent-wash/-line/-active`、四个功能色、五个便利贴色、`--material-*` 的暗色值都写在源码里但未列在这里。`tests/design-doc-sync.test.ts` 因此只校验"文档列出的暗色值与源码一致"，不要求两表相等。

### 3.3 颜色职责总览（先看这张表，再看具体值）

| 分类          | Token                                                                           | 设计职责                                                              | 允许的使用场景                                                          | 禁止的使用场景                                                        | 亮/暗主题要求                                                                  |
| ------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 核心 · 纸     | `--surface` / `--surface-raised` / `--surface-lift` / `--surface-sunk`          | 五级纸张层级：页面底 → 卡片 → 最高光 → 下沉 → 深层                    | body、卡片、浮层、代码块、骨架                                          | 不用于文字；`--color-paper-deep` 亮色不铺面                           | 亮色保持暖纸明暗层次；暗色保持低亮度，层级识别交给 `--edge*` 与阴影（§14.3）   |
| 核心 · 纸     | `--reading-surface` / `--code-surface`                                          | 派生表面：阅读纸面（亮色=纯白，暗色=oklab 94/6 混合）/ 代码底         | 文章详情、代码块、搜索输入                                              | 不另造第四套底色                                                      | 两套主题配方不同：亮色页纸已到 L\* 98.3，raised 撑不出层次；暗色取 lift 会过亮 |
| 核心 · 墨     | `--text-primary` / `--text-strong` / `--text-heading`                           | 正文、强调段、标题                                                    | 一切正文与标题                                                          | 不用于装饰线                                                          | 亮暗都 ≥4.5:1（暗色正文 ≥7:1）                                                 |
| 核心 · 墨     | `--text-secondary`                                                              | **唯一可用于 12px meta 的次级文字色**                                 | 日期、说明、空态、页脚、kbd、placeholder、代码块行号/diff 头            | 五档便利贴纸、`paper-deep`、`frost` 上禁用（未达 4.5:1）              | 在 paper/raised/lift/sunk/reading/wash 上 ≥4.5:1，亮色最差 wash 4.73           |
| 核心 · 墨     | `--text-tertiary`                                                               | **装饰色，不是更淡的灰**                                              | 图标、分隔点、图表连线、未激活控件                                      | 一切需要读的文字（尤其 12px）；`sunk` / `deep` / `frost` / 便利贴表面 | 非文本 ≥3:1；静态使用点由 `design-color-system.test.ts` 的装饰白名单逐项登记   |
| 核心 · 强调   | `--accent`                                                                      | 装饰与交互边界、按钮填充                                              | 焦点环、1–2px 细线、进度条描边、指示点、下划线颜色、实心按钮底          | **文字色**（`color:` 与 `text-[...]`），有静态禁令                    | 非文本 ≥3:1；亮色最差 wash 4.35                                                |
| 核心 · 强调   | `--accent-strong`                                                               | 需要读的强调文字                                                      | 链接、脚注角标、hover、mention、画廊箭头、导航焦点环                    | 大面积填充                                                            | 所有承载文字的表面 ≥4.5:1；亮色最差 wash 5.85                                  |
| 核心 · 强调   | `--accent-soft` / `--accent-line` / `--accent-wash` / `--accent-active`         | 柔和装饰 / 强调细线 / 选中与 hover 浅底 / 按下态                      | 下划线装饰、kicker 短横线、选中底、pressed 态                           | 正文与链接文字                                                        | 装饰色不套用文字门限；`accent-active` 是调色板预留（无别名、无消费者）         |
| 语义 · 状态   | `--state-danger` / `--state-warning` / `--state-success` / `--state-info`       | 功能色唯一入口                                                        | Callout / Banner 的 tone 与 ink、Ins、diff、状态胶囊、Toaster、表单错误 | 品牌装饰；组件直接取 `--color-danger` 等                              | 亮暗各一套值，标题在 8% 底纹上 ≥4.5:1（亮色最差 4.83）                         |
| 语义 · 边框   | `--edge` / `--edge-strong` / `--edge-frost`                                     | 1px 边界（普通 / 强 / 冰面）                                          | 分隔线、虚线、阅读纸面外框                                              | 文字                                                                  | 装饰性发丝边不套 3:1；需要识别边界的控件另按非文本门限                         |
| 组件 · 便利贴 | `--note-sage` / `--note-blue` / `--note-clay` / `--note-ochre` / `--note-cream` | Tags 索引签的五种纸色                                                 | 只服务 `.tag-note__body` 与其 hover 混色                                | 普通正文、链接、按钮                                                  | 纸面上的文字只用 `--text-heading` / `--text-primary`（§11）                    |
| 组件 · 导航   | `--nav-*`                                                                       | 悬浮导航的角色色（背景、边框、hover、active、文字、图标、焦点、光斑） | `.nav-card` / 菜单 / 工具按钮                                           | 全站其它组件                                                          | 亮暗各一套；`--nav-ink` 在玻璃上 ≥4.5:1                                        |
| 材质          | `--material-*`                                                                  | 颗粒、环境光、浮层顶缘高光（rim）                                     | `material.css`                                                          | 组件直接拿来当文字色                                                  | 玻璃 tint / alpha / blur / saturate 已随 `.glass-control` 删除，不得复活       |
| 焦点 / 阴影   | `--focus-ring*` / `--shadow-*`                                                  | 全站唯一焦点样式与投影基色                                            | 焦点环、投影                                                            | 文字与底色                                                            | 焦点环按非文本 ≥3:1；亮色基色 `43 40 48`（中性偏紫）                           |

**读表两条铁律**：① 组件只消费第 2 层（语义）与第 3 层（组件专属），不直接取 `--color-*`（受控例外见 §14.3）；② 12px 文字只能用表里标了「≥4.5:1」的墨色，层级靠字号/字重/字距/布局表达，不靠压低对比度。

### 3.4 日记与装饰色：为什么没有 `diary-*` 与 `rose-*`

**日记沿用品牌 accent 族，不新增独立 Token。** 依据是它自己的值：

- 暗色下"日记五色"（accent / strong / soft / wash / line）与品牌 accent 族**逐字节相同**；
- 亮色下唯一不同的只有 `#7188c7`（`diary-accent`），而它在 12px 日期行上只有 **3.33**，达不到 AA —— 承担不了"日记日期"这个文本角色；
- 日记详情页（`src/app/diaries/[id]/page.tsx`）复用的是 `reading-sheet` / `meta` / `link-quiet` 这套共享组件，**本来就没有独立的日记颜色语义**。

新增一套与 brand 同值的 `diary-*` 只会得到五个没有视觉差异的别名。按 §7 的边界（不要为了消灭死 Token 而制造无意义消费者、不要重做日记页），本轮**不新增**。日记的品牌识别由"共享组件 + 新 accent"自动获得：日期走 `--text-secondary`，链接与 hover 走 `--accent-strong`，与全站同一套规则。

**装饰色（`rose-*` / `lavender-*`）同样不新增。** 头像衍生的粉、紫目前没有任何组件消费者；一旦加入就是四到五个死色板。若将来出现真实场景（徽章、插画配色），再按 §12 的流程引入，并同时给出消费者。粉**不得**用于链接、按钮、正文或大面积背景。

### 3.5 阅读纸面：亮色为什么改成纯白，暗色为什么不动

提亮页纸会**连带吃掉**阅读纸面的层次，这一点在只比色值时看不出来，必须实测渲染像素：

| 场景                              | v1 分离度（纸面内 − 页面底，8bit） | v2 改前 | v2 现在 |
| --------------------------------- | ---------------------------------- | ------- | ------- |
| 亮色 `.reading-sheet`（日记详情） | `6,7,9`                            | `3,3,3` | `5,6,9` |
| 暗色 `.reading-sheet`             | `4,5,5`                            | `6,6,6` | `6,6,6` |

原因是数学上没空间了：v1 页纸 L\* 94.8、raised L\* 97.5，中间还有 2.7 个 L\* 可以铺纸面；v2 页纸提到 L\* 98.3 后，raised 只比它高 0.7 个 L\*，`94/6` 混合出来的纸面与页面底只差 3 级灰阶 —— 在 1280×900 截图里已经读不出"一张纸压在桌面上"，只剩一圈发丝边，而且 `--edge-frost` 对纸面只有 1.18，救不回来。

因此**只改亮色**：`--reading-surface` 直接取 `--color-paper-lift`（纯白），分离度回到 5–9 级（≈ v1）。页纸仍是暖的、纸面是白的，"暖桌 + 白纸"比 v1 的"米黄桌 + 米白纸"关系更清楚。

暗色**不跟**：暗色 page L\* 12 → lift L\* 20 台阶本来就宽，取 lift 会跳到 15–17 级，纸面从"浮起的一张纸"变成"一块亮板"，抢正文注意力。所以暗色保留 `94/6` 配方，且实测已比 v1 更清楚（6 对 4–5）。

> 这两条配方必须一起看：`tests/design-color-system.test.ts` 的 `reading` 推导按主题分别取 lift / 混合，并由"配方与源码一致"那条断言钉住两端，避免改了 CSS 却仍在测旧底色。

## 4. 语义变量（组件唯一可用层）

| 变量                                                                                 | 代理到                                                     | 场景                                                                  | 消费者状态                                                              |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `--surface`                                                                          | `--color-paper`                                            | 页面底                                                                | 有                                                                      |
| `--surface-raised`                                                                   | `--color-paper-raised`                                     | 卡片/浮层、`.glass-panel`                                             | 有                                                                      |
| `--surface-lift`                                                                     | `--color-paper-lift`                                       | 阅读层最高层：AI 摘要卡、AI 精读窗口                                  | 有                                                                      |
| `--surface-sunk`                                                                     | `--color-paper-sunk`                                       | 代码块、空状态                                                        | 有                                                                      |
| `--text-primary` / `--text-strong`                                                   | ink / ink-soft                                             | 正文 / 强调                                                           | 有                                                                      |
| `--text-secondary`                                                                   | ink-muted                                                  | **一切要读的次级文字**，含 12px meta（全表面 ≥4.5:1）                 | 有                                                                      |
| `--text-tertiary`                                                                    | ink-faint                                                  | **装饰专用**：图标 / 分隔点 / 图表线 / 未激活控件；禁止任何要读的文字 | 有（11 处白名单，逐条见 `design-color-system.test.ts` 的 `DECORATIVE`） |
| `--text-heading`                                                                     | heading                                                    | 所有标题与卡片标题                                                    | 有                                                                      |
| `--edge` / `--edge-strong`                                                           | line / line-strong                                         | 实线 / 虚线                                                           | 有                                                                      |
| `--edge-frost`                                                                       | `color-mix(in srgb, frost 72% + ink 8%)`                   | 纸面外框、导航条下边                                                  | 有                                                                      |
| `--accent` / `--accent-soft` / `--accent-strong` / `--accent-wash` / `--accent-line` | 见 §3.1                                                    | 交互与强调                                                            | 前四者有；`--accent-line` 仅经 Tailwind 工具类消费                      |
| `--state-danger`                                                                     | `--color-danger`                                           | 功能色：危险状态（Callout / Banner / 表单错误）                       | 有                                                                      |
| `--state-warning`                                                                    | `--color-warning`                                          | 功能色：警告状态                                                      | 有                                                                      |
| `--state-success`                                                                    | `--color-success`                                          | 功能色：成功状态（含 Ins / diff）                                     | 有                                                                      |
| `--state-info`                                                                       | `--color-info`                                             | 功能色：信息状态                                                      | 有                                                                      |
| `--reading-surface`                                                                  | 亮色 `paper-lift` / 暗色 `oklab 94/6(paper-raised, paper)` | 阅读纸面（亮色取纯白、暗色取混合，理由见 §3.4）                       | 有                                                                      |
| `--code-surface`                                                                     | `paper-sunk`                                               | 行内代码、代码块                                                      | 有                                                                      |
| `--focus-ring-width`                                                                 | `2px`                                                      | 焦点环粗细的唯一来源                                                  | 有（`globals.css:62`、`media.css:299`）                                 |
| `--focus-ring-offset`                                                                | `2px`                                                      | 焦点环外偏移                                                          | 有（`globals.css:63`）                                                  |
| `--focus-ring-color`                                                                 | `--accent`                                                 | 焦点环颜色                                                            | 仅 tokens 内部（被 `--focus-ring` 消费）                                |
| `--focus-ring`                                                                       | `var(--focus-ring-width) solid var(--focus-ring-color)`    | 全站唯一焦点样式                                                      | 有（globals + 4 个 styles 文件）                                        |
| `--shadow-color`                                                                     | 亮 `43 40 48` / 暗 `0 0 0`                                 | 阴影基色（RGB 三元组，供 `rgb()` 组合）                               | 仅 tokens 内部（被 `--shadow-raise/pop` 消费）                          |
| `--shadow-raise` / `--shadow-pop`                                                    | 基于 `--shadow-color`                                      | 纸面抬起 / 浮层                                                       | 有                                                                      |

「仅 tokens 内部」= 该变量不被组件直接引用，而是被 `tokens.css` 里另一条 Token 消费。这类 Token **不是死 Token**，删除会破坏定义链。

### 4.1 导航组件语义变量（`--nav-*`）

悬浮导航（`.nav-card` 与共用的 `.nav-panel`）专用的一组语义变量，亮暗各一套。**全部由 `--color-*` / `--accent-*` 混色派生，没有往调色板里加新颜色**；非选中项一律走墨色，Accent 只出现在选中底、hover 提示与 Spotlight 光斑三处。

| 变量                    | 亮色               | 暗色               | 场景                                                                   |
| ----------------------- | ------------------ | ------------------ | ---------------------------------------------------------------------- |
| `--nav-backdrop`        | `paper-raised` 82% | `paper-raised` 88% | 卡片与菜单底（配 `--nav-blur`）                                        |
| `--nav-edge`            | `line-strong` 42%  | `line-strong` 72%  | 发丝边                                                                 |
| `--nav-shadow`          | 0.04 / 0.26 双层   | 0.5 / 0.72 双层    | 悬浮投影（暗色需更实）                                                 |
| `--nav-blur`            | 14px               | 12px               | 毛玻璃半径（原 22/20，2026-11-15 模糊减量时下调）                      |
| `--nav-saturate`        | 1.12               | 1.06               | 毛玻璃饱和度                                                           |
| `--nav-ink`             | `ink-muted`        | `ink-muted`        | 非选中项文字、图标、分组标题、空态、说明（合并前两条后的唯一默认墨色） |
| `--nav-ink-strong`      | `color-heading`    | `color-ink-soft`   | 悬停 / 选中文字                                                        |
| `--nav-item-hover`      | `accent-soft` 15%  | `accent` 16%       | hover 底，仅轻微提示                                                   |
| `--nav-item-active`     | `accent-wash`      | `accent-wash`      | 选中项底                                                               |
| `--nav-item-active-ink` | `color-heading`    | `color-ink-soft`   | 选中项文字                                                             |
| `--nav-spotlight`       | `accent-soft` 26%  | `accent` 30%       | 指针光斑                                                               |
| `--nav-divider`         | `line` 68%         | `line` 82%         | 快捷栏与菜单内的分隔线                                                 |
| `--nav-focus`           | `accent-strong`    | 继承亮色           | 菜单项与分段控件的焦点环                                               |

**布局尺寸（第三层，随导航双态新增）**。下面是几何值，不是颜色：三种状态的所有尺寸都由这几个值派生，`globals.css` 只消费、不另写平行数值。

| 变量                  | 值                  | 场景                                                        |
| --------------------- | ------------------- | ----------------------------------------------------------- |
| `--nav-bar-height`    | 3.5rem              | 移动端底部胶囊高度（双态不参与手机端）                      |
| `--nav-topbar-height` | 4.25rem             | Editorial Bar 高度，也是 `.site-nav-spacer` 的占位高度      |
| `--nav-dock-height`   | 3.125rem            | Floating Dock 高度                                          |
| `--nav-dock-width`    | 35rem               | Floating Dock 宽度上限（560px，收缩动画的终点）             |
| `--nav-dock-radius`   | 1rem                | Dock 圆角（16px 微圆角卡片，**不是** `--radius-pill` 药丸） |
| `--nav-dock-offset`   | 0.875rem            | Dock 与视口顶边的距离                                       |
| `--nav-gap`           | 0.5rem              | 卡片与菜单 / 下拉面板之间的缝                               |
| `--nav-inset`         | 0.75rem             | 移动端与物理边缘的距离（不含安全区）                        |
| `--nav-panel-max`     | `min(34rem, 72dvh)` | 菜单面板最大高度                                            |

滚动阈值（离开顶部 72px / 回到顶部 40px / 下滚 96px 隐藏 / 上滚 40px 显示）**刻意不是 CSS 变量**：JS 读不到 CSS 变量，写进 Token 就成了第二份事实，阈值只存在于 `use-header-scroll.ts`。

本轮合并了两条**没有独立视觉职责**的导航 Token：原 `nav-icon`（与 `nav-ink` 亮暗都同值）、原 `nav-ink-muted`（= `ink-faint`，在导航玻璃上只有 3.2–3.4:1，却承担 12px 分组标题与空态）。两者的消费者统一并入 `--nav-ink`，层级改由字号、字距与大写表达。历史判断保留在本段，不再单列 Token 行。

这些变量**只在导航内部消费**（消费者是 `globals.css` 的 `.site-nav` 样式块与 `material.css` 的 `.glass-nav`），不替代 `--surface` / `--text-*` 等全站语义层；页脚、正文、卡片仍用 §4 主表那批变量。Tags 的多彩便利贴（§14.12）完全不读这一组，两条视觉线路互不影响。

---

## 5. 排版

| 角色        | Token                | 值                                                                     | 用途                                                                                             |
| ----------- | -------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Display     | `--text-display`     | `clamp(2.125rem, 1.9rem + 0.8vw, 2.5rem)`，lh **1.2**，ls **−0.024em** | 首页身份名（34–40px）                                                                            |
| PageHeading | `--text-pageheading` | `clamp(1.625rem, 1.25rem + 1.4vw, 2.25rem)`，lh 1.26，ls **−0.02em**   | `PageHeader` 内页页头（26–36px）                                                                 |
| Headline    | `--text-headline`    | `clamp(1.5rem, 1.125rem + 1.4vw, 2.125rem)`，lh 1.22，ls **−0.022em**  | 文章详情 h1、Markdown 样张 h1（24–34px）                                                         |
| Title       | `--text-title`       | `clamp(1.5rem, 1.25rem + 0.9vw, 1.875rem)`，lh 1.26，ls **−0.014em**   | 日记详情 h1、卡片标题、错误页（24–30px）                                                         |
| RowTitle    | `--text-rowtitle`    | 1.375rem（固定值 22px，不随视口变化）/ lh 1.3 / ls **−0.01em**         | 文章列表每一条的 h3。**不能用 `text-title`**：那是 clamp，行标题需固定在 22px 才不把一屏行数压掉 |
| H2          | `--text-h2`          | 1.375rem / lh 1.4（无字距覆盖）                                        | 正文二级标题、区块标题                                                                           |
| H3          | `--text-h3`          | 1.125rem / lh 1.5（无字距覆盖）                                        | 卡片标题、正文三级标题                                                                           |
| Body        | `--text-body`        | 1.0625rem（= 17px @16px 根字号）/ lh **1.82**                          | `.prose` 阅读正文                                                                                |
| Lead        | `--text-lead`        | 1.125rem / lh 1.8                                                      | 导语、摘要                                                                                       |
| Small       | `--text-small`       | 0.9375rem / lh 1.7                                                     | 说明文                                                                                           |
| Caption     | `--text-caption`     | 0.8125rem / lh 1.6                                                     | 图注、注释、表头                                                                                 |
| Meta        | `--text-meta`        | 0.75rem / lh 1.5                                                       | 日期、阅读数、kicker                                                                             |
| Code        | `--text-code`        | 0.875rem / lh 1.7                                                      | 行内与代码块                                                                                     |

`lh` = 同族 `--text-*--line-height`；`ls` = `--text-*--letter-spacing`。display / pageheading / headline / title 四个标题档位都定义了字距，h2/h3 及更小层级没有字距变量 —— 组件若自行写 `tracking-*` 属于局部调整，不是 Token 缺失。

**四个标题档位按「会不会折行」分层，不按页面重要性分层**：字越大越可能单行、行高可以越紧（display 1.2 → pageheading 1.26 → headline 1.22 → title 1.26）。之所以 headline 比 pageheading 更紧，是因为它虽然字号更大，但它是长句标题、经常折 2–3 行，需要把行与行压在一个语义块里；而 pageheading 几乎永远单行（2–6 字），松一点不影响密度。

> 行高有两个基准，不要混淆：`.prose` 用 `--text-body--line-height` = 1.82（`prose.css:11`），而 `body` 元素默认是硬编码的 1.75（`globals.css:48-49`）。页面骨架（导航、页脚、空状态）落在 1.75 上，正文落在 1.82 上，是有意分工。
>
> 移动端不再单独压正文：`prose.css` 的 `@media (max-width: 640px)` 曾把 `.prose` 降成 `1rem / 1.8`，使文章正文（16px）比全局 `body`（17px）更小，形成全站唯一的「正文比 UI 小」倒挂。现已在所有断点统一吃 `--text-body` + 伴生行高，窄屏只收紧 `h2` 的上边距。

### 5.1 字号角色 → 实际消费者

只记录现有 Token 的语义映射，不新增平行字号。

| Token                                             | 消费位置（节选）                                                               |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `--text-display`                                  | 首页身份名 h1（`app/page.tsx`）                                                |
| `--text-pageheading`                              | `PageHeader` 统一页头 h1（`ui/page-header.tsx`）                               |
| `--text-headline`                                 | 文章详情 h1（`articles/[category]/[slug]/page.tsx`）、Markdown 视觉样张 h1     |
| `--text-title`                                    | 日记详情 h1（`diaries/[id]/page.tsx`）、`error.tsx` / `not-found.tsx` / 分类页 |
| `--text-rowtitle`                                 | 文章列表每一条的 h3（`ArticleRow` 完整与 minimal 变体）                        |
| `--text-h2` / `--text-h3`                         | `.prose` 标题、卡片标题、`friends` 等页                                        |
| `--text-body`                                     | `body`、`.prose`（含移动端）、归档条目                                         |
| `--text-lead`                                     | 首页导语（无衬线）、文章导语（衬线）                                           |
| `--text-small` / `--text-caption` / `--text-meta` | 说明文、图注、`.meta`                                                          |
| `--text-code`                                     | `.prose :code`（`prose.css:206`）                                              |

同一 px 数值不代表同一语义。以下是**特殊排版用法**，尚未 Token 化，改动前请先确认是否值得升为 Token：

- 40px 日记日号：`text-[2.5rem]` + `tabular-nums`（`features/diaries/components/diary-day-group.tsx:24`）。
- 32px 归档年月标题：`text-[2rem]`（`app/archives/page.tsx:133`）。
- 标签页按计数动态取字号：`1.25 / 1.0625 / 1rem / 0.9375rem` 四档（`app/tags/page.tsx:18-22`）。
- 文章行标题（非 compact）：`text-[1.625rem]`（`features/articles/components/article-row.tsx:38`）。
- `.prose` 内部相对字号（`0.82em`、`1.04em`、`0.7em` …）是相对正文的比例微调，属于组件内部尺寸，不是新的字号角色。

### 5.2 字体栈与排版规则

字体栈（与 `tokens.css` 的 `@theme` 逐字对应；**首选**是设计意图，其余是系统回退）：

| Token                  | 首选            | CJK 回退                                                                  | 拉丁回退                                                           | 关键字       |
| ---------------------- | --------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------ |
| `--font-serif`（标题） | `Noto Serif SC` | `Source Han Serif SC` → `Songti SC`（macOS）→ `SimSun`（Windows）         | `Georgia` → `Times New Roman`                                      | `serif`      |
| `--font-sans`（正文）  | `Noto Sans SC`  | `PingFang SC`（macOS）→ `Hiragino Sans GB` → `Microsoft YaHei`（Windows） | `ui-sans-serif`、`-apple-system`、`Segoe UI`                       | `sans-serif` |
| `--font-mono`（代码）  | `ui-monospace`  | —                                                                         | `SFMono-Regular`、`JetBrains Mono`、`SF Mono`、`Menlo`、`Consolas` | `monospace`  |

**字体来源与策略**（自托管，Phase 4A 起）：

- 中文正文/UI 用 **Noto Sans SC**（可变 100–900），中文标题/引用/编辑排版用 **Noto Serif SC**（可变 200–900）。二者均为 **SIL Open Font License 1.1**，许可全文与版权、Reserved Font Name 声明随仓库分发（`src/assets/fonts/LICENSE-OFL-*.txt`）。
- 字体文件来自 **Google Fonts 官方 CSS 接口分发的 WOFF2 切片**（`fonts.googleapis.com` / `fonts.gstatic.com` 一次性抓取），抓取后随仓库托管；**运行期不产生任何第三方字体请求**。
- 使用官方 **101 片 `unicode-range` 子集**，`unicode-range` 原样保留、不手工改写。**不做语料驱动的二次子集化**：中文完整性优先于体积，避免"用户写进生僻字才缺字"。
- 分片不覆盖的罕见字（如 `齉`）由回退栈里的系统字体渲染；这是有意的渐进降级，不是缺陷。
- `--font-mono` **不参与**中文本地化，等宽仍是系统栈（`--font-mono` 的取值与 Phase 4A 之前完全一致）。
- 职责分离：**`fonts.css` 只声明 `@font-face`**（202 条规则 + 分片 URL），**`tokens.css` 只定义语义字体栈**。字体栈 **不得** 在 `fonts.css` 里再用 `:root` 覆盖一次——同一变量两个来源会在 Cascade 里产生不可见的漂移。202 条 `@font-face` 也 **不得** 迁进 `tokens.css`。
- 回退顺序不是装饰品：它决定了"同一篇文章在不同系统上的字重观感"，调整前先想清楚要的是设计意图还是可用性。

规则：

- **标题衬线、正文无衬线**。`.prose` 正文用 `--font-sans`（`prose.css:9`），`.prose` 标题用 `--font-serif`（`prose.css:24`）。
- 「正文用衬线」目前**已实现三处**：`.prose blockquote` 显式 `font-family: var(--font-serif)` + `font-style: normal`，文章页导语、首页 Hero 导语都带 `font-serif`。**同一个 `--text-lead` 在三处现在字体族一致**（此前首页是无衬线，属未统一状态，已收敛）。导语也不再各自写 `leading-[1.7]` / `leading-[1.75]`，统一吃 `--text-lead--line-height`（1.8）。
- 中文标题不额外加字距；英文大标题靠 `--text-display--letter-spacing` / `--text-pageheading--letter-spacing` / `--text-headline--letter-spacing` / `--text-title--letter-spacing` 提供负字距。**四个标题档位的字距现在全部来自 Token**，组件不再用 `tracking-[-0.022em]` 之类的任意值覆盖（原文章 h1 与 PageHeader 的覆盖已并入 Token）。
- **标题字号与行高必须成对消费**：正确写法是 `text-pageheading` / `text-headline`（一个类同时给出 font-size、line-height、letter-spacing），**禁止**再写 `text-[calc(var(--text-display)*0.78)] leading-[1.25]` 这种「自己算字号 + 手写行高」的组合 —— 前者的行高无处可查，后者在断点换系数时会跳变（原实现 640px 处跳 11.7px）。
- `.meta` = `--text-meta` + `--text-secondary` + `letter-spacing: 0.04em` + `tabular-nums`（`globals.css` 的 `.meta`）；分隔点用 `.meta-sep`（`·` 前后 0.5em，颜色 `--text-tertiary`）。**不要在这里写行号**：这两个类在 `globals.css` 里的位置随导航段落一起漂移过。
- **导航层级靠字重，不靠新字号**：`.nav-link`（顶栏与移动快捷栏的一级入口）用 `--text-small` + 字重 500 + lh 1.4 + 0.01em 字距；`.nav-row`（下拉与菜单子项）同字号、继承常规字重、lh 1.5。两者共用 `--text-small`，不新增平行字号 Token（见 §5.1）。旧的 `.nav-label` / `.nav-panel-link` 已随下拉选择器一起移除，不要再引用。
- **页脚导航在上、信息在下**：`.site-footer__nav` 使用 Shiro 的 `linkSections` 分类结构（分类名 + 右向箭头 + 链接组），<48rem 分组竖排，≥48rem 横排并可折行；分类导航与版权/出处不共用一条流。
- **信息与设置仍是左右两个平级区域**：`.site-footer__inner` 在 ≥48rem 用 `grid-template-columns: minmax(0, 1fr) auto`（信息区吃剩余宽度、设置区按内容收窄并贴右），<48rem 退化成单列（信息在上、设置在下，两者都靠左）。设置区**不再**横在信息区上方。
- **信息区两行分工**：第一行 `© 年份区间`（`.meta`）+ 衬线名字（`--text-body`/500/`--text-heading`）+ 签名（`--text-small`/次级色）；第二行 `--text-meta`/次级色。分隔符统一用 `.footer-sep`（`｜`，前后 0.55em，`--text-tertiary`）。
- **第二行是一条可换行的流**（`.site-footer__meta` = `flex-wrap`），不是若干段落：`Powered by … Design.` 与备案是流里的最小单元，链接自身 `nowrap`，宽度不足时整条单元换行而不是被劈开。分隔符是独立 flex item，所以只需 `row-gap`，不与 `.footer-sep` 的 `margin-inline` 叠加。

---

## 6. 版心 / 间距 / 圆角 / 阴影 / 动效

| 项            | Token                                               | 值                                                            | 说明                                                                                        |
| ------------- | --------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 文章正文宽    | `--measure-post`                                    | 52rem                                                         | 832px，文章详情正文；≈49 汉字/行 @17px                                                      |
| 日记正文宽    | `--measure-note`                                    | 44rem                                                         | 704px，日记详情正文；≈41 汉字/行，比文章窄 8rem                                             |
| 普通页正文宽  | `--measure-page`                                    | 44rem                                                         | 704px，普通页（`/about`、`/pages/:slug`）正文                                               |
| 文案宽        | `--measure-copy`                                    | 48rem                                                         | 768px，导语、摘要、搜索与错误页文案                                                         |
| 目录轨        | `--rail-toc`                                        | 13rem                                                         | 208px，文章 / 日记右侧目录，**独立占位、不挤正文**                                          |
| 侧栏轨        | `--rail-side`                                       | 17rem                                                         | 272px，普通页左侧身份卡                                                                     |
| 首页左轨      | `--rail-home`                                       | 11rem                                                         | 176px，首页区块标题 / Hero 头像轨（≥lg），轨距复用 `--gap-rail`                             |
| 正文—目录间距 | `--gap-rail`                                        | 2.25rem                                                       | 正文与目录轨之间                                                                            |
| 侧栏—正文间距 | `--gap-side`                                        | 4rem                                                          | 侧栏与正文之间                                                                              |
| 纸张内边距    | `--pad-paper-inline`                                | `clamp(0px, 8vw - 3rem, 3.5rem)`                              | `.reading-sheet` 左右留白，连续响应式                                                       |
| 纸张上下留白  | `--pad-paper-block-start` / `--pad-paper-block-end` | `clamp(0.5rem, 3vw, 3.5rem)` / `clamp(1rem, 3.5vw, 4rem)`     | 纸面首尾留白                                                                                |
| 文章 shell    | `--shell-post`                                      | `calc(measure-post + gap-rail + rail-toc)`                    | 文章详情桌面外壳宽度                                                                        |
| 日记 shell    | `--shell-note`                                      | `calc(measure-note + 2×pad-paper + gap-rail + rail-toc)`      | 日记详情桌面外壳宽度                                                                        |
| 普通页 shell  | `--shell-page`                                      | `calc(rail-side + gap-side + measure-page)` = 65rem（1040px） | `/about` 的两栏网格上限。**侧栏显示阈值 1104px = 这个值 + 双侧 gutter**（1040 + 64）        |
| 页面版心      | `--container-wide`                                  | 72rem                                                         | 首页、列表页                                                                                |
| 窄栏          | `--container-narrow`                                | 30rem                                                         | 搜索空态等                                                                                  |
| 页边距        | `--spacing-gutter`                                  | `clamp(1.25rem, 0.189rem + 4.528vw, 2rem)`                    | 连续变化：375px→20px、640px 起封顶 32px（**没有 `-lg` 变体**）                              |
| 区块间距      | `--spacing-section`                                 | 5rem                                                          | 首页各 section 上下                                                                         |
| 区块内部      | `--spacing-stack`                                   | 2rem                                                          | 标题与内容之间                                                                              |
| 圆角          | `--radius-xs/sm/md/pill`                            | 2 / 4 / 6 / 999px                                             | 纸面用 xs，浮层用 md，移动端导航与工具胶囊用 pill；桌面 Dock 用 `--nav-dock-radius`（16px） |
| 描边          | `--border-hairline` / `--border-rule`               | 1px                                                           | 实线 / 虚线                                                                                 |
| 阴影          | `--shadow-raise` / `--shadow-pop`                   | 双层极浅                                                      | 全部走 `--shadow-color`                                                                     |
| 动效          | `--duration-fast`                                   | 140ms                                                         | 导航、链接下划线、代码底、预览层与错峰间隔                                                  |
| 动效          | `--duration-base` / `--duration-slow`               | 240 / 420ms                                                   | 页面 / 面板过渡与首页内容淡入                                                               |
| 缓动          | `--ease-out-soft`                                   | `cubic-bezier(0.22, 0.61, 0.36, 1)`                           | 默认，全部 `transition`/`animation` 用它                                                    |
| 缓动          | `--ease-in-out-soft`                                | `cubic-bezier(0.4, 0, 0.2, 1)`                                | **当前无消费者**，见 §14.8                                                                  |

断点（实测口径）：

| 断点    | 等宽            | 承担                                               | 实现方式                                                                                      |
| ------- | --------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `sm`    | 40rem（640px）  | 纸面起铺、阅读纸面上色                             | Tailwind `sm:` + `material.css` 的 `@media (min-width: 40rem)`                                |
| `md`    | 48rem（768px）  | 友链卡片转两列；**桌面导航双态的起点**             | Tailwind `md:`（仅 `friends/page.tsx`）+ `globals.css` 导航段落的 `@media (min-width: 48rem)` |
| `lg`    | 64rem（1024px） | 阅读区加宽（纸张内边距 3.5rem）                    | Tailwind `lg:` + `material.css:63` `@media (min-width: 64rem)`                                |
| `xl`    | 80rem（1280px） | 文章 / 日记 TOC 侧栏加列、`<details>` 折叠版收起   | Tailwind `xl:`（文章/日记详情、阅读工具、项目网格等多处）                                     |
| `69rem` | 1104px          | 普通页左侧身份卡显示阈值：低于它侧栏收起、正文单列 | 任意值断点 `min-[69rem]:`，仅 `about/page.tsx`（4 处）                                        |

- Tailwind v4 走 CSS-first 配置：仓库里没有 `tailwind.config.*`，`tokens.css` 也没有覆盖 `--breakpoint-*`，所以 `sm/md/lg/xl` 就是 Tailwind 默认值。**没有 `2xl:` 使用**；`md:` 只有 `friends/page.tsx` 一处（768px 两列），与导航双态的 48rem 断点是同一个值，改其中一个要同时看另一个。`69rem` 是唯一一个任意值断点（1104px），它不在 Tailwind 档位里，**修改前先想清楚为什么不复用 `xl`**。
- 断点处数会随功能增减，本文不再写死"共 N 处"——写死的那一刻就开始过期。要看当前分布，直接在 `src` 下搜 `sm:` / `md:` / `lg:` / `xl:` / `min-[69rem]:` 这几个前缀。
- 与断点区分开：**组件内部局部尺寸条件**不算断点。现存两处桌面优先的窄屏收紧 —— `prose.css:353` 与 `prose.css:394` 的 `@media (max-width: 640px)`，它们调整的是正文内部节奏，不要为了"统一"把它们改写成 `min-width`。
- 材质/无障碍类查询（`prefers-reduced-motion` 6 处、`prefers-reduced-transparency` 1 处）与 `@supports not (backdrop-filter)` 属于能力探测，也不属于断点。

---

## 7. 材质层（可整体关闭）

| 类               | 实现                                                                                                                                                                                    | 用量                                                                                                                   |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `.paper-grain`   | 单层 `feTurbulence` SVG 噪点，`position: fixed`，`opacity var(--material-grain-opacity)`                                                                                                | 全站 1 层，不随内容滚动                                                                                                |
| `.paper-ambient` | 两组径向渐变（顶部受光 + 右下阴影），对比度极低                                                                                                                                         | 全站 1 层                                                                                                              |
| `.reading-sheet` | `<640` 无底色；`≥640` 铺 `--reading-surface` + `--edge-frost` 细边 + `--shadow-raise`；`≥1024` 内边距 3.5rem                                                                            | 文章/日记详情各 1 个                                                                                                   |
| `.glass-nav`     | 纸面底 `--nav-backdrop` + `backdrop-filter: saturate(var(--nav-saturate)) blur(var(--nav-blur))`（亮 14px / 暗 12px）+ `--nav-edge` 发丝边 + `--nav-shadow`。**底色调是暖纸，不是冰色** | Floating Dock、右下工具胶囊、移动端底部胶囊（三处都挂在宿主的 `.nav-glass` 层）；Editorial Bar 状态下该层 `opacity: 0` |
| `.glass-panel`   | 实色 `--surface-raised` + 边框 + `--shadow-pop`（**刻意不做玻璃**，避免菜单下正文与菜单文字叠加）                                                                                       | 搜索面板                                                                                                               |

`.glass-nav` 用 `--nav-backdrop`（暖纸），是全站唯一的玻璃材质。`.glass-bar` 曾是一块「大面积冰色薄片」的预留类，全站从没有 DOM 生产者，`scripts/visual/contrast.mjs` 里 `.glass-bar a` 的采样目标也一直匹配不到元素；已删除该类及其专用 alpha 参数。它**没有**被并入导航。将来若真需要整行玻璃，必须连同真实生产者一起新增。

`.glass-control` 曾是工具组圆按钮的独立冰面（冰色 tint + 更实的遮罩 + 更小的模糊）。右下工具组改为 `.toolbar-dock` 一整块 `.glass-nav` 后，按钮退化为胶囊内的透明格子，该类失去全部 DOM 生产者，已按 `.glass-bar` 同例删除：类规则、`@supports` / `prefers-reduced-transparency` 分支、五个专用材质参数（tint 三元组、两档 alpha、blur、saturate，亮暗两套）全部移除，`design-color-system.test.ts` 与 `markdown-css-contract.test.ts` 断言其不得复活。**工具按钮的材质由宿主胶囊的 `.glass-nav` 统一承担**，不要给按钮重新引入独立玻璃。

Frost 的去向：`--color-frost` 不再以 RGB 三元组形式服务玻璃 tint（该用途随 `.glass-control` 删除），仍经 `--edge-frost` 混色服务 `.reading-sheet` 外框与 `.glass-panel` 边框；`design-color-system.test.ts` 守护这条语义链不被误删。

两条必须记住的实现约束：

1. **玻璃不能挂在 `.nav-card` 上**。带 `backdrop-filter` 的元素会成为 `position: fixed` 后代的包含块，移动端菜单面板会被缩进卡片内部（实测宽度从 350px 缩到 161px）。因此 `.glass-nav` 落在卡片内独立的 `.nav-glass` 绝对定位层，卡片本身不带滤镜；`tests/nav-menu.test.tsx` 有回归护栏。
2. **菜单面板刻意做实色，不跟着卡片做玻璃**。卡片只有 50–68px 高，透一点无妨；面板下压着整段正文，实测即使把不透明度提到 97% 仍能看到文章标题的淡影。这与 `.glass-panel` 的判断一致：浮层优先可读性。面板沿用 `--surface-raised` + `--nav-edge` + `--nav-shadow`，与卡片同色系但实心。

**日文字形：全站统一走 SC，不引入 JP 字体**（**A**，实测确认，属设计决定）

- 实测（CDP `CSS.getPlatformFontsForNode`，看的是**实际渲染**而非声明栈）：平假名、片假名、日文汉字、日文标点、半角片假名全部命中 `Noto Sans SC`，`isCustom: true`，**零回退**。
- `unicode-range` 覆盖已逐码位验证：`U+3042`(あ) `U+30A2`(ア) `U+65E5`(日) `U+300C`(「) `U+3002`(。) `U+3001`(、) `U+FF01`(！) `U+FF71`(ｱ) 在 Sans / Serif 两侧均为 `covered: true`（202 条 `@font-face` 规则逐条比对）。
- 前进宽度：所有 CJK 字符（含假名与全角标点）在 17px 下均为 **1em = 17.00px**，等宽成立。标点位置实测无坏行首（行首未出现 `。」』？！）`）。
- 可变字重轴确实生效：40px 下同一字符串 `Noto Sans SC` 100→900 宽度 551.4→601.92 单调递增，**证明 600 是真字重、不是合成粗体**。
- **已知差异（设计选择，不是缺陷）**：日文汉字用的是 **SC 字形的日文覆盖**，不是 Noto Sans JP。`直` / `骨` / `次` / `関` 等字在 SC 与 JP 标准下笔形不同。全站统一 SC 是有意决定（一套字体服务中/日，避免再引入 ~5MB 的 JP 字体）；若将来要 JP 笔形，须作为独立设计决策，不能顺手替换。

### 7.1 导航双态（Editorial Bar / Floating Dock）

一次导航改造，**一套 DOM、三种状态**，由 `<header class="site-nav" data-mode>` 切换。三态的视觉差异全部落在同一个 `.nav-card` 上，靠 `max-width` / `height` / `border-radius` / `transform` / `opacity` 过渡；没有第二棵导航树，因此导航数据、菜单开关、`aria-controls` 指向的 ID 与 Tab 顺序都只有一份。

| 维度 | `top`（Editorial Bar）        | `floating`（Floating Dock）        | `hidden`                                                              |
| ---- | ----------------------------- | ---------------------------------- | --------------------------------------------------------------------- |
| 宽度 | `min(视口, --container-wide)` | `--nav-dock-width`（560px）        | 同 `top`（只是滑出）                                                  |
| 高度 | `--nav-topbar-height`（68px） | `--nav-dock-height`（50px）        | —                                                                     |
| 圆角 | 无（通栏）                    | `--nav-dock-radius`（16px）        | —                                                                     |
| 背景 | 透明                          | `.nav-glass`（`opacity: 1`）       | —                                                                     |
| 边框 | 无                            | `--nav-edge` 发丝边                | —                                                                     |
| 光斑 | `display: none`               | 保留                               | —                                                                     |
| 位置 | 贴顶，与版心 / gutter 对齐    | 贴顶居中，下沉 `--nav-dock-offset` | `translateY(-100% - --nav-gap)` + `opacity: 0` + `visibility: hidden` |

要点：

- **顶部态刻意什么都不画**。轻盈感来自「没有玻璃、没有边框、没有光斑」，而不是再叠一层更淡的样式；`--nav-pad` 在 `top` 是 `--spacing-gutter`，在 `floating` 收成 `0.5rem`，菜单面板的右边缘也跟着这个变量走。
- **对齐靠容器，不靠第二套版心**：`.site-nav` 在桌面只负责铺满视口（`padding-inline: 0`），卡片自己取 `--container-wide` + `--spacing-gutter`，与 `Container` 组件逐像素一致（实测 1024/1104/1280/1440/1920 五档左缘全部对齐）。
- **`hidden` 必须真的离开可聚焦树**：只写 `opacity: 0` 会让键盘 Tab 走进看不见的链接。`visibility: hidden` 的过渡延迟与滑出动画等长（`transition-delay` 第 6 位对应 `transition-property` 第 6 项），退场才不会被截断。
- **占位块只有一种高度**（`--nav-topbar-height`）：两态切换不改变文档流，正文不跳。
- **移动端完全不参与**：三态规则全部写在 `@media (min-width: 48rem)` 里，`max-width: 47.9375rem` 块里不出现任何 `data-mode`，`tests/nav-dual-state.test.tsx` 守护这条边界。手机仍是贴底药丸、始终可见。
- `prefers-reduced-motion: reduce` 时 `.nav-card` 与 `.nav-glass` 的过渡归零，状态切换瞬时完成，不播放位移与淡入。

退化路径：`@supports not (backdrop-filter)` → 实色纸面（`.glass-nav`）；`prefers-reduced-transparency: reduce` → 实色且关闭模糊。
工具按钮的激活态走 `--nav-item-active` + `--nav-item-active-ink`（与 `.nav-link[data-active='true']` 同一对语义 Token），按钮自身不再携带任何材质或 `[data-active]` 底色规则。
友链明信片的邮戳不属于材质层：它是 SVG 墨迹（`currentColor` + 语义 Token 混色），不加模糊、不加投影，避免变成第二枚玻璃按钮。**邮戳只有一个图案，卡片之间的差异只有旋转角**（`Postmark` 的 `seedRotation()`：`seed` 的 UTF-16 code unit 求和后映射到 −7°~+7°，`seed` 取 `link.id`）。早期版本用 FNV-1a 从 `id + url` 派生五组变体（墨色 / 透明度 / 线宽 / 虚线），`520ec32` 按「简化 + 性能」收敛成单一图案；这是**当前的设计决定**，不是遗漏——不要再按「变体」去描述或实现它。邮戳允许压过邮票左缘与下缘、也允许盖在模糊底上，圆底还会越过卡底 12px 由根节点 `overflow: hidden` 裁掉（`--pc-mark-ox` / `--pc-mark-dy` 把它定位到 164–240 / 80–156），但不覆盖 72px 主头像（圆心距 78.8px ≥ 36 + 38）—— 这里**没有**齿孔 alpha mask 参与（齿孔 mask 只作用于邮票的 `__stamp-paper`）。双层头像的底层是同一张头像的 `blur()` 副本（组件内 `filter` + 透明度），同样不算材质 Token；邮票纸边的 `drop-shadow` 是组件级细节，不得提升为材质参数。
明信片的纸面与纸纹同样不进材质层：卡片自建 `--pc-grain`（两层频率相乘）、底色与墨色都在 `friend-postcard.css` 里用语义 Token 混色，**不消费 `--material-grain-*`**。全站材质关掉后这张卡仍是一张完整的暖纸明信片；反过来，改 `--material-grain-opacity` 也不会影响它 —— 两者的颗粒是刻意分开的（全站那张 240px / SVG 内 0.05 不透明度，贴到 312px 小卡上会被压平到看不出纸）。
**关闭全部材质**：删掉 `globals.css` 顶部对 `material.css` 的 `@import`，站点仍是完整的纸色排版。

---

## 7.2 印刷与系统高对比度（两个"离屏"渲染路径）

屏幕样式有截图可看，这两条没有：打印要看纸、高对比度要改系统设置。它们最容易在
重构中被静默删掉，因此各自有契约测试（`tests/print-css.test.ts`、`tests/forced-colors.test.ts`），
并且**都不允许污染常规渲染** —— 前者整份包在 `@media print`，后者包在
`@media (forced-colors: active)` / `@media (prefers-contrast: more)`。

**打印（`print.css`）**

| 处理                  | 对象                                                                                                                                                                                         | 理由                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `display: none`       | `.site-nav`、`.site-nav-spacer`、`.toolbar-dock`、`.reading-aside`、`.reading-inline`、`.search-panel`、`.nav-panel`、`.nav-flyout`、`.comments`、`footer`、`.paper-grain`、`.paper-ambient` | 固定定位的导航会盖住每页顶部；占位块必须跟着隐藏，否则每页空一条导航的高度 |
| 去底去边去影          | `.reading-sheet`                                                                                                                                                                             | 屏幕上的白纸 + 发丝边在纸上是灰框                                          |
| `max-width: none`     | `.prose`、`main`                                                                                                                                                                             | 704px 的固定行宽在 A4 上是浪费                                             |
| `break-inside: avoid` | `figure` / `blockquote` / `.md-callout` / `.md-banner`                                                                                                                                       | 图与图注不该被拆到两页                                                     |
| `break-inside: auto`  | `pre` / `table`                                                                                                                                                                              | 长代码与宽表**允许**跨页，强行不拆会切掉内容                               |
| 不展开 URL            | `a`                                                                                                                                                                                          | 中文排版里「正文 + 括号里的长 URL」比省略更难读                            |

隐藏必须用 `display: none`：`visibility: hidden` / `opacity: 0` / `height: 0` 都仍然占位，
打印出来是一片空白页。

**系统高对比度（`forced-colors.css`）**

强制色模式下浏览器会把颜色换掉、透明度抹平，所以这套规则**不加新颜色**，
只把被抹掉的信息改用系统色（`Canvas` / `CanvasText` / `LinkText` / `Highlight`）
与**结构**表达：

- 玻璃与浮层 → `background: Canvas` + `CanvasText` 实线边（否则卡片边界消失）
- 光斑、纸纹噪点、受光渐变、明信片的模糊底头像 → 直接不显示（会变成突兀色块）
- 当前页 / 当前目录项 → 加粗 + 下划线（屏幕上是浅底 + 细线，强制色下都会没）
- 代码块 / 便利贴 / Callout / 表格 → 补 1px 实线边（底色被统一后失去层次）
- 焦点环 → `outline-color: Highlight`（`--accent` 会被替换）

`prefers-contrast: more` 是另一回事：它表示"我希望对比更强"，不是"别管我的颜色"，
因此保留自己的配色，只把 `--edge` 提到 `--edge-strong`、选中细线从 1px 加到 2px。
`--text-tertiary` **不抬**——它是装饰专用色，抬到 secondary 会让图标与分隔点跟正文抢注意力。

两个新增的语义类：`.reading-aside` / `.reading-inline` / `.search-panel` 是给这三个容器
补的稳定名字（此前它们只有工具类），打印与强制色都需要一个不随排版改动的引用点。

---

## 8. 主题机制

1. `<html data-theme="light|dark">` 是唯一开关；`<html>` 首帧前由 `layout.tsx` 内联脚本写入（读 `localStorage.folio-theme`，缺省跟 `prefers-color-scheme`），因此不会闪烁。
2. 主题写入只有一处：`useThemePreference()`，全站只有一个消费点——页脚的三段单选（`FooterSettings`）。**`system` 的实现是删除 `folio-theme` 键**，不存一个 `'system'` 字面量 —— 所以「跟随系统」永远等价于「没有偏好」。
3. 所有颜色来自 CSS 变量，切主题不需要重新请求、不需要 `dark:` 类。
4. Mermaid 图表监听 `data-theme` 变化重新渲染，并在取色时把 `color-mix()/oklab()` 解析成 sRGB（见 `mermaid-hydrator.tsx`）。

---

## 9. 组件与状态

| 组件                                         | 文件                                        | 状态                                                                                                                                                                                                                                                                                        |
| -------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SiteHeader`                                 | `layout/site-header.tsx`                    | 服务端壳：从 `core/navigation` 取快捷栏 / 菜单主导航 / 更多，按 Feature 开关收敛后下发；自身不渲染交互                                                                                                                                                                                      |
| `SiteHeaderClient`                           | `layout/site-header-client.tsx`             | 一棵 DOM 三种状态（`data-mode`：`top` Editorial Bar / `floating` Dock / `hidden`）：桌面双态、移动底部悬浮；只含头像 / 博客 / 日记 / 菜单四个入口；右下工具组挂载点；下拉悬停与菜单打开时冻结滚动形态                                                                                       |
| `SiteNavMenu`                                | `layout/site-nav-menu.tsx`                  | 桌面与移动共用同一份内容的菜单面板：站点身份 → 主导航 → 更多（原生 `<details>` 分组）；**不再挂设置**，`tocSlot` 为目录预留位                                                                                                                                                               |
| `FooterSettings`                             | `layout/footer-settings.tsx`                | 全站唯一的设置区：左语言选择器（图标 + 名称 + 向上弹出的菜单）/ 右三态主题（Sun → Monitor → Moon）。语言走 `useLocaleSwitcher`，主题走 `useThemePreference`，不另存状态。挂在页脚**右侧**那一栏（`.site-footer__settings`），桌面端整体靠右、手机端落到信息区下方                           |
| `ToolbarGroup` / `ToolbarButton`             | `layout/toolbar-button.tsx`                 | 40px 方格（`--radius-pill`），**自身无材质**：玻璃与光斑由 `.toolbar-dock` 的 `.glass-nav` + `.nav-spotlight` 提供；悬停/激活复用 `--nav-item-hover` / `--nav-item-active`，tooltip 仅 hover / focus-visible                                                                                |
| `SiteFooter`                                 | `layout/site-footer.tsx`                    | 上部 Shiro 分类导航（`footer.linkSections`：分类名 › 链接）；下部左右两区——年份 + 衬线名字 + 签名 / Powered by + ICP，右侧语言与主题。`｜` 统一用 `.footer-sep`                                                                                                                             |
| `Container`                                  | `ui/container.tsx`                          | `prose / wide / narrow` 三档                                                                                                                                                                                                                                                                |
| `PageHeader`                                 | `ui/page-header.tsx`                        | kicker（短横线 + 12px）+ Display 标题 + 摘要 + meta                                                                                                                                                                                                                                         |
| `ArticleRow`                                 | `features/articles/...`                     | 标题 `text-rowtitle`（22px 固定档），hover 变 `--accent-strong`；完整变体日期左轨 + 分类/标签/阅读数，标题下一行 `line-clamp-1` 正文概览（`withExcerpt`）；minimal 变体只留标题 + 日期，作首页单列索引行（≥sm 日期贴右缘同基线）                                                            |
| `ReadingProgressRing` / `ReadingProgressBar` | `ui/reading-progress.tsx`                   | 环形（26px，移动端折叠目录行右侧）与竖向线性（2rem×1px，桌面端侧栏）两种阅读进度指示，共用 scroll 监听。环形百分比在环外右侧，竖向条百分比在条右侧。填充色 `--accent`，底色 `--edge`                                                                                                        |
| `AISummaryCard`                              | `features/ai-summary/...`                   | 纸面卡片（`--surface-lift` 混 `--reading-surface`）：左上 AI 图标 + 标题，右侧「AI 精读」按钮与箭头；折叠只改可见性                                                                                                                                                                         |
| `Dialog` / `InsightsDialog`                  | `ui/dialog.tsx`、`features/ai-insights/...` | portal + 遮罩模糊 + 滚动锁 + 焦点陷阱与归还；精读窗口桌面居中、移动近全屏，头部固定、内容区自滚                                                                                                                                                                                             |
| `Comments`                                   | `features/comments/...`                     | 编辑式版面：标题 → 匿名表单 → 列表（缩进 + 细线，不套卡片）→ 回复 → 加载更多；根评论与回复共用表单组件                                                                                                                                                                                      |
| `Toc` / `TocList`                            | `ui/toc.tsx` / `ui/toc-list.tsx`            | ≥1280 sticky 右栏；<1280 折叠 `<details>`，`aria-current="location"` 跟随滚动；活跃项 `w-[2px] rounded-full bg-accent` 竖线指示                                                                                                                                                             |
| `DiaryDayGroup`                              | `features/diaries/...`                      | 40px 衬线日号 + `2026.11` + 星期                                                                                                                                                                                                                                                            |
| `DiaryEntry`                                 | 同上                                        | **列表条目 = 摘要，不是正文**：左 60px 时间列 + 纯文本摘要（`excerpt()`，140 字，`line-clamp-3/4`）+ **最多一张**代表图（`firstImageSource()`，正文优先、再退附件；命中附件时带原始宽高占位）+ 「继续阅读」。不跑 Markdown 渲染、不输出全部附件；完整正文与 Shiki/KaTeX 只在 `/diaries/:id` |
| `Pagination`                                 | `ui/pagination.tsx`                         | 方形页码，当前页实底 `--text-heading`                                                                                                                                                                                                                                                       |
| `EmptyState` / `ErrorState`                  | `ui/*`                                      | 虚线框 + 衬线标题 + 一句说明 + 一个出口                                                                                                                                                                                                                                                     |

九态检查（任何交互元素都要过一遍）：default / hover / active / focus-visible / selected / disabled / loading / empty / error。焦点统一 `outline: var(--focus-ring); outline-offset: 2px`。

---

## 10. Markdown 视觉

- 正文 `.prose`：`--font-sans` + `--text-body`（17px）/ 1.82 + `letter-spacing: 0.004em`（`prose.css:8-16`）。
- 标题：`.prose :is(h1,h2,h3,h4)` 用 `--font-serif` + 600 + `letter-spacing: -0.01em`（`prose.css:23-27`）；`h2` = `--text-h2` + 上方 2.4em，`h3` = `--text-h3`，`h1` = `--text-title` + 2.6em。
- 链接：**颜色继承正文**，靠下划线识别 —— `text-decoration-color: --accent-soft`、1px、offset 0.22em；hover 升到 `--accent` + 2px（`prose.css:74-88`）。`--accent-strong` 不是链接的默认色。
- 引用：`border-left: 2px solid var(--color-accent-soft)` + `--text-secondary` + `--font-serif` + `font-style: normal`（中文斜体难读）+ `1.04em` / lh 1.85（`prose.css:158-167`）。
- 列表：`ul` 用 4px 圆点 `::before`，色为 `--color-accent-soft`（`prose.css:124-133`）；`ol > li::marker` 用 `--text-tertiary` + mono + 0.85em。
- 行内代码：`.prose code` = `--font-mono` + `0.875em`（相对正文，不是 `--text-code`）+ `--code-surface` 底 + `--radius-sm` + `overflow-wrap: anywhere`（`prose.css:192-199`）。
- 围栏代码块：**是一个独立组件，不再由 `prose.css` 画外壳**。服务端一次产出 `.code-block`（标题栏 + 行号槽 + 滚动区 + 原样 Shiki `<pre>`），外观全在 `code-block.css`；`prose.css` 只保留「作者手写裸 `<pre>`」的兜底（`.prose > pre` / 非 `__content` 下的 `pre`），且显式排除卡片内部，避免同一属性两处定义。行高、字号、内边距、`white-space` 的取舍与三条硬约束写在 `code-block.css` 顶部注释里。
- 裸 `<pre>` 兜底：用 `--edge` 描边、`--radius-md`、`--code-surface` 底、`--text-code` / `--text-code--line-height`、`tab-size: 2`（`prose.css:205-216`），着色交给 Shiki。
- 表格：`th` 用 `--text-caption` + 600 + `letter-spacing: 0.04em` + `text-transform: uppercase`（`prose.css:254-262`），行分隔 `--edge`；窄屏横向滚动。
- 图片：`.prose figure` **只有 `margin: 2em 0`，没有边框**（`prose.css:280-282`）；`figcaption` 居中 + `--text-caption` + `--text-secondary`（`prose.css:284-290`）。Gallery/Carousel 沿用 `media.css`，只换 Token。
- KaTeX：`.prose .katex` 放大到 `1.04em`，`.katex-display` 用 `overflow-x: auto` 允许独立公式横向滚动（`prose.css:293-302`）。
- Mermaid：未渲染态是 `--edge-strong` **虚线**占位框 + `--surface-raised` 底（`prose.css:304-316`）；渲染成功后改为实线 `--edge`（`prose.css:317-320`）。图表取色由 `mermaid-hydrator.tsx` 把 Token 解析成 sRGB（`theme: 'base'`，`mermaid-hydrator.tsx:103`）。
- 脚注、@提及、提示块：`footnotes.css` / `mentions.css` / `containers.css`。这三层里有直接消费第 1 层调色板的写法（`--color-accent-soft`、`--color-accent-wash`、`--color-danger` 等），与 §2 的"组件只消费第 2 层"并不完全一致，见 §14.3。
- **已失效的选择器（已删除）**：`.prose .spoiler` 与 `.prose .callout` 这两段规则不匹配任何真实产出（渲染器给出 `.md-spoiler` / `.md-callout` / `.md-banner`，见 `inline-marks.ts:72`、`containers.css:12-38`），Phase 4B 已把它们从 `prose.css` 移除，`tests/markdown-css-contract.test.ts` 会阻止它们回来。不要再以"兼容旧选择器"为理由恢复。

### 10.1 Markdown 样式职责（谁负责什么）

Markdown 扩展一律使用**真实渲染器输出的 `.md-*` 类名**；CSS 必须与之对齐，不允许为不存在的 DOM 类名保留无意义规则。

| 样式文件                         | 负责范围                                                                                                    |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `prose.css`                      | `.prose` 正文排版：段落、标题、列表、引用、表格、行内代码、裸 `<pre>` 兜底、图片与图注、KaTeX、Mermaid 占位 |
| `code-block.css`                 | 围栏代码块组件：标题栏（文件名 / 语言标识 / 复制按钮）、行号槽、滚动区、折叠遮罩、行高亮与 diff 增删配色    |
| `containers.css`                 | Callout / Banner / Details / Spoiler 等块级容器：外壳、图标区、类型配色、折叠与剧透状态                     |
| `media.css`                      | Gallery / Carousel、图片预览层（`.md-preview`）等媒体交互                                                   |
| `footnotes.css` / `mentions.css` | 脚注、@提及                                                                                                 |
| `reading.css`                    | AI 摘要卡、AI 精读窗口（含窗口内的 Markdown 排版）、评论区；只消费语义 Token，不新增全局材质                |

- **Callout 类型配色只有一个实现**：`.md-callout--*` 的左边线与标题色在 `containers.css`；`prose.css` **不得**再出现同名规则，否则两个文件会争夺同一属性、调色时只改一处就静默失效。
- **Callout 的装饰色与文字色必须分开**：`--notice-tone` 只做左边线、圆点与 8% 底纹（装饰下限 3:1），标题文字用 `--notice-ink`（下限 4.5:1）。中性提示没有功能色，`--notice-ink` 取 `--text-primary`，**不得**复用 `--edge-strong` 这类描边色——Phase 4D-1 之前二者共用同一变量，实测标题只有 1.5:1。
- **Spoiler 是渐进增强**：无 JS 时内容必须正常可读（默认可见，不靠 CSS 兜底隐藏）；JS 初始化后容器带 `data-spoiler-ready="true"`，展开后该项带 `data-revealed="true"`。**不得**用旧的 `.prose .spoiler` 一类选择器把内容永久隐藏——那会让无 JS 读者看不到正文。
- **代码块也是渐进增强**：折叠由客户端按「内容是否超过视口一半」施加，短块不出现控件，`expand` 与用户手动展开后不再折叠；`.code-block__body` 默认不限高，**不得**把 `max-height` 写成无条件的，否则无 JS 时长代码块会被永久截断且没有展开入口。
- **代码卡的骨架只在服务端产出一次**（`highlight.ts` → `renderCard`）。客户端只补复制按钮与折叠，**不得重新解析已生成的 Shiki HTML**、不得把行号塞进 `<pre>` 里——行号是 `<pre>` 的兄弟节点，复制时才天然取不到。

### 10.2 新增 Markdown 扩展的检查清单

每次新增扩展（新语法或新渲染器输出）必须同步确认：

1. Renderer 是否**真实输出**对应类名（读渲染器代码，不靠猜）。
2. CSS 是否存在**能命中**该 DOM 的选择器。
3. CSS 是否存在**没有生产者**的死类（有则删，或补渲染器）。
4. 亮色与暗色是否都只通过语义 Token 取色（无 HEX、无 `dark:` 变体）。
5. 是否需要扩充 `tests/markdown-css-contract.test.ts` 的样例与契约检查（渲染器输出 ↔ CSS 选择器 ↔ 死类扫描三者要同时覆盖）。

---

## 11. 可访问性

对比度门限分两层：`tests/design-tokens.test.ts` 断言下表的 HEX 组合，`tests/design-color-system.test.ts` 断言完整矩阵（亮/暗 × 标准表面 / 派生表面 / 五种便利贴 / Callout / Banner / 导航玻璃 / 玻璃控件）。后者的 `color-mix(in oklab, …)` 按 CSS Color 5 的 OKLab 插值计算，半透明层按 sRGB alpha 合成并只对代表性的背后底色取极值，**不是** sRGB 逐通道近似。两者都用 WCAG 2.x 相对亮度公式。

| 前景                    | 背景                   | 门限                     | 亮色                | 暗色                |
| ----------------------- | ---------------------- | ------------------------ | ------------------- | ------------------- |
| `--color-ink`           | `--color-paper`        | 亮 ≥ 4.5:1，暗 ≥ **7:1** | ✅ 已断言           | ✅ 已断言           |
| `--color-heading`       | `--color-paper`        | ≥ 7:1                    | ✅ 已断言           | ✅ 已断言           |
| `--color-ink-muted`     | `--color-paper-raised` | ≥ 4.5:1                  | ✅ 已断言           | ✅ 已断言           |
| `--color-accent-strong` | `--color-paper-raised` | ≥ 4.5:1                  | ✅ 已断言           | —（暗色未断言此项） |
| `--color-accent`        | `--color-paper-raised` | ≥ 4.5:1                  | —（亮色未断言此项） | ✅ 已断言           |

- 亮色正文是 **4.5:1（AA）**，暗色正文是 **7:1**：暗色下的正文要求比亮色更严，这是夜间纸墨的有意选择，不是笔误。
- 两色的 `--color-heading` 都要求 **≥ 7:1**。
- **旧版 HEX 表格未被任何断言覆盖**的范围：`--color-ink-soft`、`--color-accent-soft`、`--color-accent-line`、`--color-line` / `--color-line-strong`。它们都是装饰/非文本色，按非文本 3:1 口径在完整矩阵里核验。
- 过去 `color-mix()` 混合后的实际底色（`--reading-surface`、`--code-surface`、Callout/Banner 底纹、半透明导航）无法被 `palette()` 解析，本轮已由完整矩阵覆盖。四个功能色（`--color-danger/warning/success/info`）也已纳入：Callout 标题在其自身 8% 底纹上亮色最差 4.83、暗色最差 5.83；Banner 上的 `--text-secondary` 亮色最差 4.80、暗色最差 6.14。
- **仍未被任何断言覆盖，因此不得声称通过**：背后是图片/渐变时的半透明玻璃、亚像素抗锯齿与字体渲染、系统高对比模式、第三方运行时（Mermaid / Shiki / KaTeX）注入的样式，以及 TSX 条件表达式拼出的类名（由「tertiary 装饰白名单」与「accent 不作文字色」两条 Token 级禁令兜底）。

其余口径：

- **文字色分层**：`.meta`（12px）与一切要读的次级文字一律 `--text-secondary`；`--text-tertiary` 是装饰色，静态使用点逐项登记在 `tests/design-color-system.test.ts` 的白名单；`--accent` 禁止作 `color:`，强调文字一律 `--accent-strong`（`footnotes.css` / `prose.css` / `mentions.css` / `media.css` 四处 hover 已改）。
- **特殊表面文字规则**：Code Block / Callout / Banner / Note / Glass / Frost / Navigation 上不能默认套用 `--text-secondary`。规则是 —— ① 五档便利贴纸只用 `--text-heading` / `--text-primary`（secondary 在亮色最深的陶土纸上只有 3.68:1）；② Callout 标题用对应 `--state-*`，Banner 正文可用 `--text-secondary`（亮色最差 4.80）；③ 代码块底 = `paper-sunk`，secondary 4.75 达标；④ 导航玻璃上的分组标题/空态/说明已并入 `--nav-ink`（原 `nav-ink-muted` 只有 3.2–3.4:1）；⑤ `paper-deep` / `frost` 不承载次级文字。完整数值见 `tests/design-color-system.test.ts` 的矩阵输出口径与 §3.3 总览表。
- 焦点环全站一致，不 `outline: none`。
- 动效受 `prefers-reduced-motion` 与 `motion-safe:` 控制。
- 玻璃受 `prefers-reduced-transparency` 控制，退化后仍可读。
- 语义结构：每页一个 `h1`；列表页用 `article` + `h2/h3`；TOC 用 `nav[aria-label]`。
- **图标化控件不得丢语义**：页脚三态主题只显示图标，名字改由 `<input aria-label>` 提供、`title` 给悬停提示、`<svg aria-hidden>` 不参与朗读；选中态除 `[data-active]` 的圆形浮起底外，还有面上的差别（lift + 内描边 + 轻投影），不只靠颜色。三格各 36px、等宽。

---

## 12. 扩展一个新的 Token（流程）

1. 判断属于哪一层：调色板（`@theme`）/ 语义别名（`:root`）/ 材质参数（`:root` 的 `--material-*`）。**不要**直接给组件加 HEX。
2. 亮色写在 `@theme` 与 `:root`，暗色只覆盖对应变量（保持同名）。
3. `pnpm test` —— 引用完整性、硬编码、对比度、文档同步四组检查会立刻告诉你漏了哪（守护范围与盲区见 §14.9）。
4. 在本文第 3/4/5/6 节补一行；本文与 `tokens.css` 必须同批更新。只改一边就会被 `tests/design-doc-sync.test.ts` 拦下。
5. **新增/修改颜色必须同时满足**：① 在 §3.3 总览表里能说出唯一职责，且与已有 Token 不重叠；② 亮暗两套各有值（`design-doc-sync.test.ts` 检查同名）；③ 若用于文字，在完整矩阵覆盖的每个表面上 ≥4.5:1；若只做非文本，≥3:1；④ 组件经语义层消费，不直接取 `--color-*`；⑤ 新增的 `color-mix()` 配方必须在测试里有对应公式与一致断言；⑥ 不得复活已随 `.glass-control` 删除的玻璃 tint 等材质参数（反向断言守护）。改完跑 `pnpm test`，`design-color-system.test.ts` 会逐面报出比值，不会静默通过。

---

## 13. 文件清单

以下路径均已核对存在（`tests/design-doc-sync.test.ts` 会重复检查本节，路径失效即失败）：

```
docs/DESIGN-SYSTEM.md                                 ← 本文

src/design-system/tokens/tokens.css                   ← 唯一 Token 来源（含语义字体栈）
src/design-system/styles/fonts.css                    ← 自托管字体 @font-face（生成物，勿手改）
src/assets/fonts/                                     ← WOFF2 分片 + OFL 许可 + manifest
scripts/fetch-noto-fonts.mjs                          ← 字体抓取/生成脚本
src/design-system/styles/material.css                 ← 材质实现
src/design-system/styles/motion.css                   ← 可复用动效 primitive 与减弱动效策略
src/design-system/styles/prose.css                    ← 正文排版
src/design-system/styles/code-block.css               ← 围栏代码块组件（标题栏 / 行号 / 复制 / 折叠 / diff）
src/design-system/styles/media.css                    ← 图片 / Gallery / 预览层
src/design-system/styles/containers.css               ← 提示块 / 横幅 / 折叠 / 剧透
src/design-system/styles/footnotes.css                ← 脚注
src/design-system/styles/mentions.css                 ← @提及
src/design-system/styles/reading.css                  ← AI 摘要卡 / 精读窗口 / 评论区
src/app/globals.css                                   ← base 层 + @import 编排

tests/design-tokens.test.ts                           ← Token 结构 / 引用 / 硬编码 / 死 Token
 tests/helpers/design-tokens.ts                        ← 共享解析 + OKLab 混色 + 装饰白名单常量
 tests/design-color-system.test.ts                     ← 亮暗对比度矩阵 / Token 架构 / 文字颜色纪律
tests/design-doc-sync.test.ts                         ← 文档与 Token 的同步契约
tests/markdown-css-contract.test.ts                   ← 渲染器类名 ↔ CSS 选择器 ↔ 死类
tests/self-hosted-fonts.test.ts                       ← 字体资源 / 许可 / 字体栈契约
```

**本节不包含截图。** 仓库里没有 `docs/design/shots/`，也没有 `PHASE-0-AUDIT.md` / `PHASE-1-3-REPORT.md` —— 旧版本清单引用过这三个不存在的路径，现已删除。视觉验收以运行站点为准（见 §14.10）；历史审计截图位于 `docs/audits/`，不属于设计系统交付物。

---

## 14. 设计约束与实现状态

每条规则都标注它现在处于哪个状态，**不允许把 C 读成 A**：

- **A** = 已有实现，**且**由自动化测试守护。
- **B** = 已有实现，但**没有**自动化守护（靠人工评审维持）。
- **C** = 新增的设计建议，**尚未实施**，不构成当前事实。

### 14.1 CJK 字重与合成粗体风险

现状是 **B**。全站只有两档显式字重：**CSS `font-weight: 600` 共 15 处**、**`font-weight: 500` 共 4 处**（`grep -rn 'font-weight: *600' src/ --include=*.css`，2026-11-16 实测）。**没有 300 / 400 / 700 的显式声明**：`400` 是 `body` 的浏览器默认值，不写即继承；`300`/`700` 全站零使用。TSX 侧另有 `font-medium`（500）**6 处**、`font-semibold`（600）**1 处**，其余文字靠 CSS 或默认继承。

> 本节历史数字（"CSS 600 共 8 处、500 一处"）已作废：那是 Nav 与页脚重构之前的快照，当时 `.nav-avatar__fallback`、`.nav-identity__avatar`、`.nav-identity__name`、`.ai-summary__label`、`.comment__author`、`.comment-composer__whisper-label` 尚未存在或未计入。**统计口径是「源码里出现 `font-weight:` 的规则块数」，不是文档行数**，改代码后必须重跑计数。

按风险分类（下表即这 15 处 CSS 600 + 4 处 CSS 500）：

| 位置                                                | 字重 | 字体族                          | 场景                 | 合成粗体风险                                                                                                                                                        |
| --------------------------------------------------- | ---- | ------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `globals.css`（`body` 内的 `h1–h6`）                | 600  | `--font-sans`（继承自 body）    | 全站标题基线         | 低：`Noto Sans SC` 是 100–900 可变字体，600 是真字重；仅当 Web Font 未加载、回退到 `Microsoft YaHei`（只有 Regular/Bold）时才可能被合成                             |
| `prose.css`（`.prose :is(h1,h2,h3,h4)`）            | 600  | `--font-serif`                  | **中文正文标题**     | 低：`Noto Serif SC` 是 200–900 可变字体，600 是真字重（自托管，见 §5）；只有当字体文件加载失败、回退到 `Songti SC` / `SimSun` 时才回到"只有 Regular/Bold"的两档情形 |
| `prose.css`（`strong`）                             | 600  | `--font-sans`                   | 强调段               | 中低：sans 家族普遍有半粗                                                                                                                                           |
| `prose.css`（`th`）                                 | 600  | `--font-sans`（caption + 大写） | 表头                 | 低：拉丁为主、字号小                                                                                                                                                |
| `containers.css`（`.md-callout__title`）            | 600  | `--font-sans`                   | 提示块标题           | 中：内容是中文                                                                                                                                                      |
| `containers.css`（`.md-details__summary`）          | 600  | `--font-sans`                   | 折叠块摘要           | 中：内容是中文                                                                                                                                                      |
| `mentions.css`（`::before` 徽标 `GH`/`TW`/`TG`）    | 600  | `--font-sans`                   | 平台徽标文字         | 低：拉丁字形                                                                                                                                                        |
| `footnotes.css`（`.prose .footnotes__title`）       | 600  | `--font-sans`                   | 小字 + 0.12em 字距   | 低                                                                                                                                                                  |
| `reading.css`（`.ai-summary__label`）               | 600  | `--font-sans`                   | AI 摘要标签          | 中：内容是中文，但字号 12px                                                                                                                                         |
| `reading.css`（`.comment__author`）                 | 600  | `--font-serif`（继承自父块）    | 评论作者名           | 中低：中文姓名，字号 12px                                                                                                                                           |
| `reading.css`（`.comment-composer__whisper-label`） | 600  | `--font-sans`                   | 悄悄话表单标签       | 中：内容是中文                                                                                                                                                      |
| `reading.css`（`.ai-gen__mark`）                    | 600  | `--font-sans`                   | `AI` 徽章            | 低：拉丁字母，本轮已从 10px 提到 `--text-meta`                                                                                                                      |
| `globals.css`（`.nav-avatar__fallback`）            | 600  | `--font-sans`                   | 头像首字母兜底       | 低：单个字母                                                                                                                                                        |
| `globals.css`（`.nav-identity__avatar`）            | 600  | `--font-sans`                   | 导航身份块头像首字母 | 低：单个字母                                                                                                                                                        |
| `globals.css`（`.nav-identity__name`）              | 600  | `--font-sans`                   | 导航身份块名称       | 中：中文，但字号 15px 且有 `text-overflow: ellipsis`                                                                                                                |
| `globals.css`（`.nav-link`）                        | 500  | `--font-sans`                   | 顶栏一级导航         | 低                                                                                                                                                                  |
| `friend-postcard.css`（`.friend-postcard__title`）  | 500  | `--font-serif`                  | 友链卡片名称         | 中低：可能含中文                                                                                                                                                    |
| `friend-postcard.css`（`.friend-postmark text`）    | 500  | `--font-sans`（10px，SVG）      | 邮戳弧形字（装饰）   | 低：纯装饰图案                                                                                                                                                      |
| `reading.css`（`.article-info__heading`）           | 500  | `--font-sans`                   | 文末信息区标题       | 低                                                                                                                                                                  |

结论与建议（**不改任何 CSS 字重**）：

- 语义方向保持不变：**400 正文 / 500 导航与次要强调 / 600 标题与表头**。15 处 600 里没有一处是正文段落，4 处 500 全部是导航项、卡片名称或信息区标题 —— 与这条方向一致。
- 自托管之后，"中文衬线只有 Regular/Bold 两档"这个前提**在 Web Font 命中时不成立**：`Noto Serif SC` 提供 200–900 连续字重，600 不再依赖系统字体解析。因此这一条从"高风险待验收"降级为"**降级路径上的残余风险**"——只有字体文件加载失败时才复现。
- 不能把 600 一律降成 500：即便在降级路径上，500 与 600 也都会落到同一个真字重或同一个合成品上，**降低数值不等于降低合成风险**，反而可能让拉丁与中文看起来不一致。
- 仍需人工验收的点（不是自动化能回答的）：100–400 字重区间在真实正文尺寸下的观感，以及 Web Font 加载失败时 `Songti SC` / `SimSun` 的合成粗体是否可接受（见 §14.10）。**这是设计决策，不是文档修正**。
- 自动化守护（**A**，已实现）：`tests/typography-contract.test.ts` 断言「同一条规则里同时出现 `--font-serif` 与 `font-weight: 600`」只能落在标题族选择器（含 `h1–h6` 或 title/heading 语义）。靠**继承**拿到衬线的选择器（如 `.comment__author`）不在覆盖范围内——静态扫描无法还原继承链，这是已知盲区，不假装全覆盖。同批守的还有：禁止显式 `font-weight: 400`（那是继承默认值，写出来只会在换字体时多一个同步点）。

### 14.2 字号角色与衬线一致性

- 字号角色映射见 §5.1：**13 个 Token**各自有明确语义，**同一 px 不代表同一语义**（`--text-h3` 与 `--text-lead` 都是 1.125rem，前者是层级、后者是语气）。**A**（`tests/design-doc-sync.test.ts` 校验映射表里的 Token 真实存在）。
- **标题字号与行高的配对（Phase 3A，A）**：四个标题档位（display / pageheading / headline / title）现在都用「一个工具类同时给出 font-size + line-height + letter-spacing」的方式消费，组件层不再出现标题上的 `leading-[...]` 任意值覆盖，也不再出现 `text-[calc(var(--text-display)*0.78)]` 这类自算字号。原实现的四处覆盖（首页 h1 `leading-[1.2]`、文章 h1 `0.78/0.82 + 1.25/1.2`、PageHeader `1.24`、日记 h1 `1.28`）已分别并入 Token。
- 新增 `--text-pageheading` 与 `--text-headline` 的判断依据见 §5：原实现用 `display × 0.78/0.82/0.92` 三个系数表达「内页页头」与「文章标题」两个语义，但系数不是语义、`calc` 出来的行高也无处可查，且 640px 断点换系数时产生 11.7px 台阶。新增后的值与原终值逐一实测对齐（见 `docs/audits/PHASE-3A.md`），因此首屏观感不变。
- 特殊排版用法现状（**A**，已重新盘点）：文章行标题已改用 `--text-rowtitle`；归档 32px 年月与标签页动态字号在后续重构中已不存在。**仍保留的 6 处字面量字号**全部登记在 `tests/typography-contract.test.ts` 的 `ALLOWED_LITERAL_SIZES`（带理由）：40px 日记日号、28px 归档年份、17px 页头描述、17px 空态说明、18px 搜索输入、15px 搜索占位。新增第 7 处会让测试失败，删除实现则对应白名单条目失效——两个方向都拦。
- 导语衬线**已统一**（**A**）：文章页与首页 Hero 都用 `--font-serif`，行高统一取 `--text-lead--line-height`。`tests/typography-contract.test.ts` 双向守护——导语段落缺 `font-serif`、或自己写 `leading-[...]` 覆盖，都会失败（两个大号标签用法在例外清单里，带理由）。

### 14.3 中性色阶与分层例外

纸（5 级）：`paper` 页面底 → `paper-raised` 卡片 → `paper-lift` 最高光 → `paper-sunk` 沉底 → `paper-deep` 最深（现仅暗色材质用，见 §3.1）。
墨（3 级文字 + 1 级装饰）：`ink` → `ink-soft` → `ink-muted` 是文字层级，`ink-faint` **不是第四级灰**，而是装饰专用色（图标 / 分隔 / 图表线 / 未激活控件），禁止承载任何要读的文字。视觉层级靠字号、字重、字距，不靠压低对比度。
线（2 级）：`line` 实线 / `line-strong` 虚线与引用左线。
**A**：`--surface*` / `--text*` / `--edge*` 与调色板的一一对应关系由 `tests/design-doc-sync.test.ts` 校验（文档 §4 的"代理到"必须与源码同批改动）。

**正文链接的下划线必须用 `--accent`，不能用 `--accent-soft`**（**A**，2026-11-17 修正）

正文链接是 `color: inherit` —— 与周围文字**完全同色**（实测 `linkVsBody = 1`），下划线是唯一的识别线索。它因此不属于「装饰」，必须满足 WCAG 1.4.11 的 3:1 非文本对比：

| 下划线色                   | 亮/阅读面 | 亮/页面底 | 暗/阅读面 | 暗/页面底 | 判定              |
| -------------------------- | --------- | --------- | --------- | --------- | ----------------- |
| `--accent-soft`（旧）      | 2.94      | 2.82      | 1.95      | 2.11      | ❌ 四处全部 < 3:1 |
| **`--accent`（现）**       | **4.94**  | **4.73**  | **8.69**  | **9.38**  | ✅                |
| `--accent-strong`（hover） | 6.63      | 6.36      | 6.77      | 7.31      | ✅                |

> **口径与取数方式**（2026-11-17 实测校正）：四个面都是**浏览器里真实渲染出来的颜色**，不是拿 `tokens.css` 的 hex 手算——`--reading-surface` 在暗色下是 `color-mix(in oklab, …)`，computed 值形如 `oklab(0.222803 0.00355288 -0.00683348)`，必须先经 canvas 采样成 sRGB 才能算对比度。
>
> | 面                      | 亮色实测           | 暗色实测        |
> | ----------------------- | ------------------ | --------------- |
> | 阅读面 `.reading-sheet` | `rgb(255,255,255)` | `rgb(28,27,30)` |
> | 页面底 `body`           | `rgb(251,250,247)` | `rgb(20,19,22)` |
>
> **本节曾有两个错误数字必须作废**：`--accent` 暗色曾写 10.64、hover 曾写 8.29。它们是把 `oklab()` 的前三个数字当成 RGB 0–255 直接代入亮度公式得出的（`0.22` 被当成接近零的通道值），量级完全失真。正确值是 8.69（阅读面）与 6.77。教训：**涉及 `color-mix` / `oklab` 的表面，必须先在浏览器里解析成 sRGB 再算**。

hover 从 `--accent` 抬到 `--accent-strong` 并加粗到 2px，保持可感知的层次；`focus-visible` 走全局 `--focus-ring`（`--accent`，浏览器实测 outline 为 `solid 2px rgb(88,111,168)` 亮 / `rgb(168,184,228)` 暗）。全站未定义 `:visited` 样式，访问过的链接外观不变 —— 这是既定取舍（文章链接多为一次性跳转，标记已读收益低），不是缺陷。

`tests/design-color-system.test.ts` 有 4 条断言锁住这一点：静置与 hover 都必须声明下划线色、静置色在所有承载表面 ≥3:1、hover 与静置必须不同色、`color: inherit` 与 `text-decoration: underline` 必须同时存在（否则链接完全不可辨）。

分层例外（**A**，本轮收敛）：§2 说组件只消费第 2 层，现在只剩**一处受控例外** —— 图片预览的**反色浮层**（`media.css` 的遮罩/前景、`reading.css` 的一处遮罩）必须直接取 `--color-ink` / `--color-paper`，因为它的语义就是「遮罩用墨、前景用纸」，套正向语义别名反而会在暗色下失效。例外以文件+Token 为单位登记在 `tests/design-color-system.test.ts`，新增一处就会失败，登记项失效也会失败。

原先的散乱引用已全部归入语义层：`prose.css` 的圆点/引用左线改走 `--accent-soft` 与 `--accent-line`；功能色改走 `--state-*`（Callout / Banner / Ins / diff / 状态胶囊 / Toaster / 表单错误）；`--accent-wash` 类底色改走 `--accent-wash`。历史判断保留在本段，不再作为待办。

### 14.4 Accent 使用纪律

- 规则：主题色承担交互识别，**不做大面积填充**；正文永远是墨色（§1、§3.1）。
- 状态：**A**。本轮把 Accent 拆成两条可测职责：`--accent` 是**装饰与交互边界**（细线、焦点环、进度条描边、指示点、下划线颜色、按钮填充，非文本 ≥3:1，亮色最差 4.35），`--accent-strong` 是**唯一可用于文字的强调色**（全表面 ≥4.5:1，亮色最差 5.85）。`--accent-active` 是调色板级的按下态预留，当前无别名、无消费者。`tests/design-color-system.test.ts` 直接禁止 `color: var(--accent)` 与 `text-[var(--accent)]`，四处曾把 accent 当文字用的 hover/角标已改为 `--accent-strong`。
- `--accent-strong` 与 `--color-info` 在 v2 里已拉开（ΔE 23.99，v1 只有 7.54）但语义不同：前者是交互，后者是状态，**不合并**；`--accent-soft` 与 `--accent-line` 是填充与描边两种用途，**不合并**；`--edge-frost` 与 `--accent-line` 一个是中性冰面框、一个是强调细线，**不合并**。理由见 §3.3。
- **明确不作为测试**：用源码统计去证明"Accent 视觉面积 ≤5%"是不可靠的 —— 源码里出现的次数与渲染面积没有对应关系（一个 `bg-accent-wash` 可以铺满整屏，也可以只有 2px）。因此本条**只作为视觉纪律**，由 §14.10 的人工验收负责，不新增会误报的自动测试。

### 14.5 Blur 与材质层级

现状是 **A/已定案**：`material.css` 头注释（Phase 4B 修正）与实现一致 —— 材质层的 `backdrop-filter` 只出现在 `.glass-*`，另有两处**组件专属**模糊单独记录。

| 材质                                                    | 位置                     | 模糊                                                | 参数归属                            |
| ------------------------------------------------------- | ------------------------ | --------------------------------------------------- | ----------------------------------- |
| `.glass-nav`（导航卡片 / 工具胶囊内的 `.nav-glass` 层） | `material.css`           | `--nav-blur`：亮 14px / 暗 12px                     | 导航语义 Token（§4.1）              |
| 已删除的整行玻璃薄片类（原 `.glass-bar`）               | —                        | 无 DOM 生产者，已删除（见 §7）                      | 死 CSS，不再计入材质                |
| 已删除的工具组圆按钮冰面（原 `.glass-control`）         | —                        | 无 DOM 生产者，已连同五个专用材质参数删除（见 §7）  | 死 CSS，不再计入材质                |
| `.glass-panel`（搜索面板）                              | `material.css`           | **无模糊**（刻意实色，避免菜单与正文叠字）          | 语义 Token + `--material-glass-rim` |
| `.nav-panel`（菜单面板，实色）                          | `globals.css` 导航样式块 | **无模糊**（实色 `--surface-raised`，避免正文透字） | 语义 Token（§4）                    |
| Gallery 翻页按钮                                        | `media.css:196`          | `blur(6px)` + `color-mix(--surface-raised 88%)`     | **组件专属参数**（有意不 Token 化） |
| 图片预览遮罩 `.md-preview`                              | `media.css:233`          | `blur(8px)` + `color-mix(--color-ink 84%)`          | **组件专属参数**（有意不 Token 化） |

边界判定（已定案，不再作为待办）：模糊只用于"必须压住滚动内容或图片"的薄层，正文卡片永不使用。

- 材质层现存的玻璃参数只有 `--material-glass-rim`（`.glass-panel` 顶缘高光）；`.glass-nav` 的模糊与饱和走 `--nav-*` 导航语义 Token。
- `.md-gallery__nav` 的 `blur(6px)` 与 `.md-preview` 的 `blur(8px)` 是**组件专属参数**：它们服务于图片交互，透明度、用途、主题无关性都与顶栏玻璃不同。**不得**为了"统一"把它们改成导航玻璃的模糊参数（顶栏半径与小面积按钮的 6/8px 用途不同，合并属于实质视觉变更）。

关闭路径（**A**，可人工验证）：删掉 `globals.css:3` 对 `material.css` 的 `@import`，站点仍是完整的纸色排版 —— 这是材质层与排版层解耦的真实边界。

### 14.6 动效语义与 reduced-motion

- 语义：动效**只解释状态变化**，不做装饰性位移。`motion.css` 提供可复用的淡入、上移、面板入场与错峰类；页面过渡使用 240ms，首页区块使用 420ms 淡入并以 140/280ms 错峰。各值均来自 duration / ease Token，不做额外戏剧化效果。**A**：实现与路径已核对；Reduced Motion 浏览器行为未单独实测。
- 降级：**A** 有实现、**B** 无测试。`globals.css:30-41` 在 `prefers-reduced-motion: reduce` 下把 `scroll-behavior` 改 auto 并统一缩短 animation / transition；`motion.css` 对页面、面板与首页入场动画显式关闭；另有局部 reduced-motion 覆盖（`prose.css`、`media.css`、`containers.css` 等）。
- 注意：全局 `!important` 兜底已经覆盖了绝大多数情况，`motion-safe:` 属于"额外保守"的写法，不是缺失。不要为了统一风格而新增无意义检测。

### 14.7 最小字号护栏

- 事实：**A**（本轮由 B 升为 A，补齐了自动化守护）。最小字号角色是 `--text-meta` = 0.75rem（12px）。
- **旧表述已作废**：本节曾写「全站唯一低于 12px 的 `font-size` 是 `.friend-postmark text` 10px」。那是**只扫绝对数值**得出的结论，漏掉了 em 链与伪元素。2026-11-17 的实测把真实清单扩到 **7 条**（5 条现存 + 2 条已处理，见下两表），其中 `.prose .md-mention::before` 与 `.home-more__count` 是旧口径完全看不到的。

**判定口径（三层，缺一层就会漏）**：

| 来源              | 例子                        | 能否只靠文本匹配               |
| ----------------- | --------------------------- | ------------------------------ |
| 字面量 px / rem   | `font-size: 10px`、`0.7rem` | 能                             |
| 语义 Token        | `var(--text-caption)`       | 能（需查 Token 值）            |
| **相对父级 em**   | `0.9em`                     | **不能** —— 取决于祖先最终字号 |
| **继承 / 伪元素** | `::before` 生成内容         | **不能** —— 不在 DOM 里        |

`.prose code { 0.875em }` 是这条口径最好的例子：正文段落里算 14.875px（合格），落进 13px 的脚注区就是 11.375px（不合格）。**同一段 CSS 文本，两个结论**，所以 em 必须结合祖先求值。

**当前全部低于 12px 的规则（`tests/small-fonts.test.ts` 断言此表与源码一致）**：

| 选择器                           | 求值                                | 分类           | 依据                                                                  |
| -------------------------------- | ----------------------------------- | -------------- | --------------------------------------------------------------------- |
| `.friend-postmark text`          | 10px 字面量                         | decorative     | SVG 用户单位，随邮戳等比缩放，属图案（且 `svg` 本身带 `aria-hidden`） |
| `.prose .heading-anchor`         | 0.7em × 17px(h4) = **11.9px**       | decorative     | `opacity: 0`，仅 hover/聚焦出现                                       |
| `.home-more__count`              | 0.95em × 12px = **11.4px**          | decorative     | JSX 标了 `aria-hidden="true"`，读屏不读它                             |
| `.prose .footnote-backref__hint` | 0.9em × 13px(脚注) = **11.7px**     | footnote-inner | 脚注区已是 13px 次级说明，内部再小一档                                |
| `.prose code`                    | 0.875em × 13px(脚注) = **11.375px** | footnote-inner | 仅当行内代码落进脚注区                                                |

已解决的问题两条（保留记录，不再是豁免）：

| 选择器                       | 原值                   | 处理                             | 原因                                                                       |
| ---------------------------- | ---------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `.prose .md-mention::before` | 0.7em × 17px = 11.9px  | **改为 0.71em = 12.07px**        | 见下条说明                                                                 |
| `.home-more__notify-state`   | 0.95em × 12px = 11.4px | **删除规则与豁免**（2026-11-17） | TSX 里零消费者（订阅面板迁成模态弹窗后遗留的死 CSS），给它发豁免是虚假覆盖 |

- **平台徽标为什么不是豁免而是改字号**：`.prose .md-mention::before`（GH/TW/TG）曾经是 11.9px。它挂在 `::before` 上，而**生成内容加不了 ARIA 属性**——「装饰类可证」的三个条件（`svg` / `opacity:0` / `aria-hidden`）一个都不成立。既然它承载「这是哪个平台」的信息，正确处理是把字号提到 12px 以上（0.71em = 12.07px，视觉差 0.17px 不可辨），而不是塞进白名单。
- **`.home-more__count` 为什么归 decorative 而不是 footnote-inner**：它的真实父级是 `.home-more__entry`（12px），不是 `.footnotes`。原来的 `footnote-inner` 归类套错了理由——真正成立的是 JSX 上的 `aria-hidden="true"`。`aria-hidden` 是 DOM 属性，CSS 里看不到，因此证明必须跨文件到 TSX 取（`tsxAriaHiddenClasses()`）。
- **KaTeX 的 `.vlist-s` 不在名单里**：它来自 `node_modules` 的第三方样式表（零宽占位，1px），不归本项目维护，列进来等于把别人的问题伪装成本项目已审核的例外。

**守卫实现**（**A**）：

- 判定内核：`tests/helpers/small-fonts.ts`（482 → 约 600 行）；断言：`tests/small-fonts.test.ts`（**34 用例**）。
- 白名单 `SUB_12PX_ALLOWANCES` 分三类：`structural` / `decorative` / `footnote-inner`，每条必须带理由。
- 六条纪律，任一不满足即失败：
  1. 白名单选择器必须真实存在（失效即报错）；
  2. 装饰类必须给出**可机检**的证明（`svg` / `opacity:0` / `aria-hidden`），且该条件在规则里成立；
  3. 装饰证明返回**成立集合**而非单值——`.friend-postmark` 的 `<svg>` 同时满足 `svg`（结构）与 `aria-hidden`（语义），声明哪条都应认可，顺序不该决定对错；
  4. 脚注类必须登记 em 求值祖先、解析值**确实** < 12px，且祖先选择器必须含 `.footnotes`（"脚注内再小一档"这个理由对它才成立）；
  5. 白名单条目的类名必须在 `.ts` / `.tsx` 里有真实生产者——**死豁免**（CSS 还在、DOM 没了）同样失败；
  6. **TSX 侧零容忍** —— `text-[11px]` / `text-[0.7rem]` 一律失败，因为任意值没有"场景"可辩。
- **`aria-hidden` 必须跨文件证明**：它是 DOM 属性，CSS 里永远看不到。`tsxAriaHiddenClasses()` 扫 TSX 的 JSX 开标签，把带 `aria-hidden` 的类名收集起来供装饰证明使用。只看 CSS 会把 `.home-more__count` 误判成「承载信息的小字」。
- **`svg` 证明要求结构证据**：`text` / `textPath` 必须作为**元素名**出现，**且该 CSS 文件里确实存在 `svg` 元素选择器**。否则 `.prose text` 这种写法会被误判成「SVG 文字」而白送豁免（实测 `prose.css` 里没有任何 `svg` 选择器，`friend-postcard.css` 有 `.friend-postcard__mark svg`）。
- **em 祖先必须显式登记**（`EM_ANCESTORS`）而不是猜：`.footnotes` 是 `.prose .footnote-backref__hint` 的 DOM 祖先，但它既不出现在后者的选择器里，也不在同一条规则链上。未登记祖先的 em 规则判为**不可验证**（不是放行）。
- **渲染器产出的类名也算有生产者**：`heading-anchor` 与 `footnote-backref__hint` 不是 JSX，而是 `src/lib/content/markdown.ts` / `footnotes.ts` 用模板字符串拼的 HTML。死豁免检测因此扫 `.ts` 与 `.tsx`，只扫 `.tsx` 会把它们误报成孤儿。
- **反向验证记录**：注入一条指向死 CSS（`.home-more__panel-hint`）的豁免后，三个守卫同时失败（无生产者 / 祖先缺失 / 祖先非脚注容器）；注入一条不存在的选择器后，失效检查失败。确认守卫不是空转，验证后已还原。

**已知盲区（如实记录，不假装全覆盖）**：TSX 里由条件表达式拼出的类名、跨行拼接的 class 字符串，静态扫描无法可靠还原最终 DOM；这部分由对比度矩阵与 Token 级禁令兜底。另外 `inherit` 不视为独立小字号来源（它的实际大小由父级决定，父级自己会被检查）。

### 14.8 死 Token 的识别与处理原则

**定义（可自动判定的那一类）**：语义别名层的 Token 不生成 Tailwind 工具类，唯一消费方式是 `var()`。若它在 `tokens.css` 之外没有任何 `var()` 引用，即为死 Token。

当前白名单为**空**（**A**：`tests/helpers/design-tokens.ts` 的 `KNOWN_DEAD_ALIASES`）：「颜色系统收敛」轮按完整证据链删除了原登记的 surface-glass 死别名 —— 它在 CSS、Tailwind 工具类、TSX、运行时动态引用、暗色覆盖、测试白名单、文档七处都无消费者，底层 `--color-frost` 仍经 `--edge-frost` 活着。历史判断保留在本段，不重复当作新发现报告。

**2026-11-15 `.glass-control` 死链清理**：工具组改用 `.toolbar-dock` 的 `.glass-nav` 后，`.glass-control` 失去全部 DOM 生产者（2026-11-15 工具组改组时曾决定「保留定义」，本轮审计后改为删除，与 `.glass-bar` 同例）。同批删除五个只被该类消费的材质参数：material-glass-tint（亮暗两套三元组）、material-glass-alpha-control、material-glass-alpha-control-hover、material-glass-blur、material-glass-saturate，并移除 tint/frost 逐通道同源断言（失去比对对象）。`--color-frost`、`--edge-frost`、`--material-glass-rim`、`.glass-nav`、`.glass-panel` 全部保留且有消费者。五个参数已登记进 `design-color-system.test.ts` 的「已删除 Token 不允许复活」名单，`markdown-css-contract.test.ts` 同时断言 `.glass-control` 选择器不得重新出现。

| Token                | 状态                                           | 处理                                                       |
| -------------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| `--ease-in-out-soft` | 动效 Token：无 `var()`、无 `ease-*` 工具类使用 | 仍登记在单独的动效名单，`tests/design-tokens.test.ts` 守护 |

**必须区分、不得误判为死 Token**：

1. **主题内部引用**：`--focus-ring-color`、`--shadow-color` 只被 `tokens.css` 内其它 Token 消费 —— 删除会破坏定义链。
2. **调色板 → 别名链**：`--color-paper-raised`、`--color-ink-*`、`--color-heading`、`--color-line-strong` 等只在 `tokens.css` 内被第 2 层引用，是**分层正常现象**。
3. **工具类间接消费**：`@theme` 里的 Token 会生成 Tailwind 工具类（`font-serif`、`text-display`、`text-lead`、`border-line` 等已在用）。**静态源码扫描无法可靠判定这一层的死 Token**（详见 §14.9），因此不在自动检查范围内断言它们死了。
4. **Token 的消费者被删了，但 Token 本身还在用**：`--color-paper-deep` 的 prose 消费者（`.prose .spoiler`）已在 Phase 4B 随失效选择器一并删除，但暗色值仍被 `--material-ambient` 消费（§3.1）。**亮色暂无消费者不等于可以删除**——它是有意保留的预留位，删除属于设计决策。

**处理原则**：默认只记录、不删除 —— 删除 Token 属于设计决策（可能是有意保留的预留位），且必须同批改 §3/§4/§6 与暗色覆盖。**本轮唯一例外**是上面那条：七处证据全部为零，且已于同批删除定义、白名单与文档行。`tests/design-color-system.test.ts` 另有「已删除 Token 不允许复活」的反向断言。

本轮同时删除的两个导航别名（原 nav-icon / nav-ink-muted）不属于死 Token：它们有消费者，只是与 `--nav-ink` 无独立视觉职责，属于**合并**而非删除，见 §4.1。

死 CSS 的识别（**A**，Phase 4B 已实现）：`tests/markdown-css-contract.test.ts` 把渲染器输出 ↔ CSS 选择器 ↔ 死类扫描串起来检查 —— 正文扩展块必须以渲染器真实产出的 `md-*` 类名命中，`.prose .spoiler` / `.prose .callout` 这类旧选择器一旦回来即失败。范围是正文扩展块，不是全站 CSS AST。

### 14.9 自动化守护范围与盲区

| 规则                                                                 | 测试                                                            | 状态                                                                                    |
| -------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Token 族结构、暗色覆盖同名                                           | `design-tokens.test.ts`                                         | A                                                                                       |
| `var()` 引用完整性（全 CSS + TSX）                                   | `design-tokens.test.ts`                                         | A                                                                                       |
| TS/TSX 层禁止 HEX 字面量                                             | `design-tokens.test.ts`                                         | A                                                                                       |
| **CSS 层禁止 HEX / `rgb()` / `hsl()` 字面量**（`tokens.css` 豁免）   | `design-tokens.test.ts`（本次扩展）                             | A                                                                                       |
| **CSS 层禁止 `dark:` 变体**（本次扩展）                              | `design-tokens.test.ts`                                         | A                                                                                       |
| **语义别名死 Token 白名单**（本次新增）                              | `design-tokens.test.ts`                                         | A                                                                                       |
| **字号角色使用情况**（本次新增）                                     | `design-tokens.test.ts`                                         | A                                                                                       |
| 对比度门限（§11 表中 5 组 HEX）                                      | `design-tokens.test.ts`                                         | A                                                                                       |
| 亮暗对比度矩阵（标准/派生表面、便利贴、Callout/Banner、导航/玻璃）   | `design-color-system.test.ts`（本轮新增）                       | A                                                                                       |
| 组件不直接消费调色板 / 状态语义层完整 / 已删除 Token 不复活          | `design-color-system.test.ts`（本轮新增）                       | A                                                                                       |
| tertiary 装饰白名单 / accent 不作文字色 / 小字号×弱色                | `design-color-system.test.ts`（本轮新增）                       | A（覆盖范围与盲区写在测试文件头）                                                       |
| `.glass-control` 类与五个专用材质参数不得复活；frost 语义链保留      | `design-color-system.test.ts` / `markdown-css-contract.test.ts` | A                                                                                       |
| 文档 Token 存在性 / 精确值 / 字体栈 / §13 路径                       | `design-doc-sync.test.ts`                                       | A                                                                                       |
| Markdown 渲染器输出 ↔ CSS 选择器（`.md-*`）                          | `markdown-css-contract.test.ts`（Phase 4B 新增）                | A                                                                                       |
| 失效选择器回归（`.prose .spoiler` / `.prose .callout`）              | `markdown-css-contract.test.ts`                                 | A                                                                                       |
| Callout 类型配色只有 `containers.css` 一处实现                       | `markdown-css-contract.test.ts`                                 | A                                                                                       |
| 导航双态：单 DOM / 三态转换 / 迟滞阈值 / 48rem 断点归属 / 交互冻结   | `nav-dual-state.test.tsx`                                       | A（真实浏览器观感另见 `docs/audits/PHASE-nav-dual-state.md`）                           |
| 自托管字体：202 分片 / manifest / OFL / 无外部地址                   | `self-hosted-fonts.test.ts`（Phase 4A 新增）                    | A                                                                                       |
| 字体栈单一来源（`tokens.css` 定义、`fonts.css` 只声明 `@font-face`） | `self-hosted-fonts.test.ts`                                     | A                                                                                       |
| `@theme` 调色板层是否被工具类消费                                    | —                                                               | **盲区**：需要 Tailwind 的类名提取，用正则冒充会误报，故不做                            |
| 半透明玻璃背后是图片/渐变时的实际底色                                | —                                                               | **盲区**：矩阵只对五种代表性纯色背后底色取极值，见 `design-color-system.test.ts` 文件头 |
| TSX 条件表达式拼出的最终 class 字符串                                | —                                                               | **盲区**：由 tertiary/accent 两条 Token 级禁令 + 对比度矩阵兜底                         |
| `color-mix()` 合成色的实际对比度                                     | `design-color-system.test.ts`                                   | **A（本轮补齐）**：OKLab 插值 + sRGB alpha 合成；仅对代表性背后底色取极值               |
| 全站 CSS 的 AST 级选择器有效性                                       | —                                                               | **部分盲区**：正文扩展块已由 contract 测试覆盖，其余选择器仍不做脆弱解析                |
| Accent 视觉面积、材质层级、字重观感                                  | —                                                               | 人工验收，见 §14.10                                                                     |

### 14.10 断点使用规范与人工验收

- 断点事实与口径见 §6：**A**（只有 `sm/lg/xl` 三档，无 `md:`/`2xl:`，无 `--breakpoint-*` 覆盖）。
- 组件内部局部尺寸条件（`prose.css:353`、`prose.css:394` 的 `max-width: 640px`）不算断点，**不要为了统一而改写它们**。

**已实测完成（2026-11-17，Chromium / Windows，Dev Server + CDP）**：

| 项目                | 结论 | 证据                                                                                                                           |
| ------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| 暗色主题全套排版    | 通过 | 正文 13.32:1、h2 16.23:1、引用块 8.18:1、代码块 13.37:1、元信息 7.22:1，全部 ≥ AA 4.5                                          |
| 暗色衬线/无衬线层级 | 通过 | 标题与引用为 Serif、正文为 Sans，截图确认可分                                                                                  |
| 暗色日记卡片        | 通过 | 日号 40px/600 Serif + `tabular-nums`，条目 14.31:1、正文 7.22:1                                                                |
| 320px 极窄屏        | 通过 | 页面横向溢出 0、真正越界元素 0；正文 16.5 字/行；引用/表格/列表/代码块子元素泄漏均为 0                                         |
| 320px 滚到底遮挡    | 通过 | 三档视口 `coveredByNavPx = 0`（浮动底栏不遮蔽末行）                                                                            |
| 日文混排            | 通过 | 见 §5.2「日文字形」；平台字体命中率 100%                                                                                       |
| 正文链接可辨识度    | 通过 | 静置下划线 4.94:1(亮)/8.69:1(暗) 实测；hover 6.63/6.77 为规则级验证；focus-visible 实测 outline 2px `--accent`（口径见 §14.3） |

**仍未实测（不得写成 PASS）**：

| 项目                    | 状态           | 原因                                                                        |
| ----------------------- | -------------- | --------------------------------------------------------------------------- |
| Safari / macOS 字体观感 | **NOT TESTED** | 无可用环境                                                                  |
| iOS Safari 字体与安全区 | **NOT TESTED** | 无可用环境                                                                  |
| Android Chrome 字体     | **NOT TESTED** | 无可用环境                                                                  |
| Linux Chromium          | 部分等价       | 同 Blink + HarfBuzz 整形，但未在真机跑                                      |
| `:visited` 链接样式     | **无规则**     | 全站（除打印样式）未定义 `:visited`，访问过的链接不变化；属已知取舍，非缺陷 |

以下各项**必须人工视觉验收，本任务未声称通过**：

1. 亮/暗两套在 390 / 768 / 1024 / 1280 下的标题字重观感（§14.1 的合成粗体风险；自托管后主要看 100–400 区间的观感，而不是合成粗体）。
2. `.reading-sheet` 在 ≥640 / ≥1024 的铺纸与内边距节奏。
3. 材质全关（移除 `material.css` 导入）后版面是否仍完整。
4. Accent 的实际视觉面积占比（§14.4）。
5. Gallery 与预览层的组件专属 blur 在深色图片上是否过强（§14.5）。
6. **跨平台字体观感**（自托管后新增的验收项）：Safari / iOS / Windows / Android 上正文与标题的实际字形、行高与字重是否一致；罕见字回退到系统字体时的观感是否可接受（§5.2）。
7. 320–375px 窄屏的**中文标点挤压观感**与 `text-wrap: balance` 换行是否美观 —— 几何已实测合格（见上表），但"好不好看"仍需人眼确认。

### 14.11 文章封面与标题渐变（临时方案）

> **状态（**C**）：临时设计稿，尚未定稿。** 本节记录一次针对文章详情页的试验性调整，不构成当前事实，不是已确立的全局规范；定稿前不要把它当作其他地方可复用的模式。

**设计目的**：让封面与文章标题形成连续的视觉关系——封面底部不再以一条硬边结束，而是溶进标题所在的纸面，使标题成为封面与正文信息之间的衔接段落。

- **结构与方向**：封面（`.article-cover`）与标题容器（`.article-hero`）放进同一个 grid 单元叠着（`.article-cover-stack`），标题对齐到封面底边、直接压在图上；渐变在标题容器内**自上而下**由透明走到纸面底色，读起来是封面底边被标题这段纸色接管。
- **渐变终点**：容器底部 = 封面底边 = 标题结束处，那里正好收成 100% 纸面。容器高度 = 引导高度 + 标题实际高度 + 收尾留白（这三个量都由 `article-cover.css` 里的组件局部变量与标题内容决定，**不是站点 Token**），所以多行标题会把渐变带整体拉长、短标题自动收短，**没有固定高度**，也不会顺流滑进信息区。
- **信息区不参与渐变**：发布日期、阅读时间、阅读量、喜欢数、更新时间、分类与标签全部位于渐变区域之外，继续使用正常页面背景；不叠半透明色、不与封面重叠、不降低对比度。为此发布日期从原来的「面包屑行」下移到元信息行，与阅读数据同一行。
- **文字落点**：标题整体落在渐变带上（这正是本次调整的目的）：文字起始处渐变约 78–88% 不透明，最后一行的位置到 100%；不增加毛玻璃、模糊或装饰性描边。
- **无封面文章**：不渲染封面与渐变容器，标题回到原有的 `mt-5` 间距，不产生空白占位，也不影响标题与信息区的相对节奏。
- **响应式**：引导高度 `clamp(3.5rem, 7vw, 5.5rem)`，标题越长渐变带越长；渐变终点色必须与标题所在表面一致——`<640px` 正文直接铺页面纸（`--surface`），`≥640px` 起 `.reading-sheet` 铺 `--reading-surface`，两边不一致会在纸边留下色差。
- **实现位置**：结构在 `src/app/articles/[category]/[slug]/page.tsx`，样式在 `src/features/articles/article-cover.css`（经 `globals.css` 汇总引入）。
- **待定项**：过渡长度与留白的最终数值、暗色下的观感、以及是否把「封面在前」推广到日记/页面详情，均未定。

### 14.12 Tags 彩色便利贴索引签（临时方案）

> **状态（**C**）：临时设计稿，尚未定稿。** 只用于 /tags 与「探索 → 标签」的索引签，不构成当前事实，不是新的全局组件语言。

**形状**：一张从书页边缘伸出的纸签 —— 左边朝左的尖角，右边圆角矩形，两者是**同一块纸**：`clip-path` 在元素上裁出左尖角（`polygon(0 50%, 0.95rem 0, 100% 0, 100% 100%, 0.95rem 100%)`），右侧圆角由 `border-radius` 提供，二者取交集，圆角不会被裁掉。不是「箭头按钮 + 右侧卡片」拼出来的两件东西。

**投影**：`clip-path` 会连同 `box-shadow` 一起裁掉，所以投影挂在父级 `filter: drop-shadow()` 上，跟随裁剪后的轮廓，用 `--shadow-color` 的透明度档位控制强度。

**文字格式**：`#标签名 · 数量`。标签名用 `--text-heading` 与衬线体，数量用 `--text-meta` 字号并以 `·` 分隔；数量不可用时不渲染该段。数量**没有**用次级色：`--text-secondary` 在这五档纸色上实测只有 3.5–4.1:1，12px 达不到 AA 4.5，因此改用 `--text-primary`，层级交给字号与衬线差别。

**纸色**：五档低饱和复古纸色，新增语义变量 `--note-sage` / `--note-blue` / `--note-clay` / `--note-ochre` / `--note-cream`（暗色有独立取值，压到纸面之上一点）。饱和度与明度都贴着 `--surface` 走，避免彩色块把版面拽走；不使用荧光色与高饱和色。

**宽度**：`inline-flex` + 内容自适应，短标签自然收、长标签自然长，不写固定宽度；到容器宽度才收，仅在极端长名字上对标签名做省略号兜底。

**颜色分配**：由标签名生成稳定哈希后映射到五档纸色，不用随机数、不加依赖、不改接口与标签数据结构。组件内就地实现 FNV-1a 32 位哈希（不跨 feature 复用实现，避免 taxonomy 依赖 friends），按 UTF-16 code unit 迭代标签名，取无符号结果对 5 取模，落到固定序列 sage / blue / clay / ochre / cream。哈希只依赖 `name` 本身：同名恒同色；新增、删除标签或改变列表顺序都不会影响其它任何标签的颜色；服务端与浏览器计算结果一致。五档纸色及其暗色取值保持不变。代价是相邻标签可能撞色（不再保证列表上五色均匀轮转），这是换取「颜色跟着名字走」的取舍。

**交互**：Hover 整张纸上浮 1.5px、纸色略深（`color-mix` 与 `--text-primary` 混合）、投影加重，不做缩放与旋转；Focus 用 `--focus-ring` 画在未裁剪的外层链接上，保证焦点环不被 `clip-path` 裁掉；`prefers-reduced-motion` 下取消位移与过渡。

**实现位置**：组件 `src/features/taxonomy/components/tag-note-list.tsx`，样式 `src/features/taxonomy/tag-note.css`（经 `globals.css` 汇总引入），由 /tags 与 /explore 的标签分区共用。

**待定项**：五档配色的最终取值、暗色下的观感、数量为空时的排版，以及是否把尖角换成更钝的楔形，均未定。
