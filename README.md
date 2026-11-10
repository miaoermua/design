# design

实验性质的 Mix-space 前端主题，暂名 Design

使用 [Mix-Space](https://github.com/mx-space/) Core（12.x）API v2 进行开发

借鉴使用:

- [Shiro](https://github.com/Innei/Shiro)
- [kami](https://github.com/mx-space/kami)
- [mx-starter](https://github.com/miaoermua/mx-starter)

## 构建与运行

需要 Node.js 22.12+ 与 pnpm 10.x（见 `package.json` 的 `engines` / `packageManager`）。

```bash
pnpm install
cp .env.example .env.local   # 至少填写 MX_SERVER_URL
pnpm dev                     # http://localhost:3000
```

`MX_SERVER_URL` 填后端 origin，**不要**带 `/api/v2`（客户端会自动拼接该前缀），例如 `https://api.miaoer.net`。只想离线预览时设 `MX_MOCK=1`，使用内置 fixtures，无需后端；其余变量说明见 `.env.example`。

生产构建与全量检查：

```bash
pnpm build && pnpm start
pnpm verify                  # typecheck + lint + test + build
```
