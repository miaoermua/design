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
}

export default nextConfig
