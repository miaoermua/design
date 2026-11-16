import { networkInterfaces } from 'node:os'
import type { NextConfig } from 'next'

/**
 * 本机所有非回环 IPv4 地址。
 *
 * 手机连同一个 Wi-Fi 时用的是这个地址（如 `10.90.87.25`），不是 `localhost`。
 * 逐个网卡取而不是写死一个：切网络、插网线、开热点都会换 IP，
 * 写死之后的表现是「昨天手机还能点、今天又点不动了」，很难查。
 */
function localIPv4(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((info) => info?.family === 'IPv4' && !info.internal)
    .map((info) => info!.address)
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // 开发时用 127.0.0.1 或局域网 IP 打开也必须能跑客户端代码。
  //
  // Next 16 默认只把 `localhost` 当作可信 dev origin，其它主机名请求
  // `/_next/hmr` 等 dev 资源会被直接拦掉。表现很有迷惑性：HTML 与 CSS 都
  // 正常渲染，但 React 永远不 hydrate —— 导航菜单、回到顶部、页脚设置、
  // 顶栏聚光灯会**一起**失灵，控制台里只有一条 WebSocket 握手失败。
  //
  // 自动带上本机网卡地址是为了手机真机预览开箱可用；另有 `DEV_ORIGINS`
  // 环境变量兜底（逗号分隔），给「手机走的是另一台机器的地址」这种情形用。
  // 生产构建不走这里，不受影响。
  allowedDevOrigins: [
    '127.0.0.1',
    ...localIPv4(),
    ...(process.env.DEV_ORIGINS?.split(',').map((host) => host.trim()) ?? []),
  ],
  // 封面、正文图片来自用户自建的对象存储 / CDN，主机名不可预知。
  // 走 next/image 需要把每个域名写进 remotePatterns，主题无法替用户决定；
  // 因此统一使用原生 <img>（配合 width/height + loading="lazy"）。
  images: { unoptimized: true },
  experimental: {
    // 主题侧没有需要 React Compiler 优化的大客户端树。
    optimizePackageImports: ['katex', 'shiki'],
  },
  async rewrites() {
    // `/atom.xml` 与 `/feed` 在后端是同一个 handler（core 的 `@Get(['/feed',
    // '/atom.xml'])`），这里也做成同一个 route 的两个入口，而不是复制一份实现。
    // Kami 与 Shiro 同样用 rewrites 把这两个路径指向一个实现。
    //
    // 老路径 `/feed.xml` 不在这里：它有自己的 route（早期本地渲染版本），
    // 站内已无入口指向它，暂不并入。
    return [{ source: '/atom.xml', destination: '/feed' }]
  },
}

export default nextConfig
