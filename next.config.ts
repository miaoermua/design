import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
    // Kami 同样用 rewrites 把这两个路径指向一个 `/api/feed`。
    return [{ source: '/atom.xml', destination: '/feed' }]
  },
}

export default nextConfig
