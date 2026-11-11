# 自托管中文字体（Phase 4A）

Folio 的中文 Web Font 随仓库托管，运行期不请求任何第三方字体服务。

| 角色                    | 字族          | 字重轴          | 文件                                       |
| ----------------------- | ------------- | --------------- | ------------------------------------------ |
| 中文无衬线（正文 / UI） | Noto Sans SC  | 100–900（可变） | `noto-sans-sc/*.woff2`（101 片，4.29 MB）  |
| 中文衬线（标题 / 引用） | Noto Serif SC | 200–900（可变） | `noto-serif-sc/*.woff2`（101 片，5.75 MB） |

等宽仍使用系统字体栈（`--font-mono`），未引入 Web Font。

## 来源

- 字体：Google Fonts 官方分发（`fonts.googleapis.com` 的 CSS 接口 + `fonts.gstatic.com` 的 woff2 切片），
  即 Noto CJK 上游项目的 Web 版本；不是第三方镜像或二次打包。
- 切片方式：官方按 Unicode 区间切分的 101 个 `unicode-range` 分片，`unicode-range` 原样保留、未手工改写，
  因此不会出现「某区间的字形落在没有该字的文件里」这种丢字问题。
- 每个分片的来源 URL 记录在同目录的 `manifest.json` 中（`source` 字段），可逐片核对。
- 下载时间：2026-11-11。

## 许可

- Noto Sans SC / Noto Serif SC 均以 **SIL Open Font License 1.1** 发布。
- 许可证全文随仓库保存在 `LICENSE-OFL-NotoSansSC.txt`、`LICENSE-OFL-NotoSerifSC.txt`（取自
  `google/fonts` 仓库 `ofl/notosanssc/OFL.txt`、`ofl/notoserifsc/OFL.txt`）。
- 版权声明：`Copyright 2012 Google Inc. All Rights Reserved.`，OFL 中的 Reserved Font Name 为 `Source`；
  本项目使用的字族名 `Noto Sans SC` / `Noto Serif SC` 不是预留名，无需改名。
- 未对字形做任何修改（不改轮廓、不改 metrics、不做二次子集化），仅按官方切片原样分发。

## 重新生成

```bash
node scripts/fetch-noto-fonts.mjs           # 已有文件会跳过，仅补齐缺失
node scripts/fetch-noto-fonts.mjs --force   # 全部重新下载
```

脚本会重写 `src/design-system/styles/fonts.css`（@font-face + 语义变量覆盖）与各目录的 `manifest.json`。
字体版本升级时请一并核对许可证文本是否变化。

## 注意

- `fonts.css` 是生成物，不要手工改。
- 字体文件由 CSS 里的 `url()` 引用，经 Next.js 构建后落在 `/_next/static/media/`（带内容哈希、可长期缓存）。
- 变量字体在 Chrome DevTools 的 `CSS.getPlatformFontsForNode` 里可能显示为默认实例名（如 `Noto Sans SC Thin`），
  这是该字体 PostScript 名的默认实例，不代表实际按 Thin 渲染；字重轴由 `font-weight: 100 900` 生效。
