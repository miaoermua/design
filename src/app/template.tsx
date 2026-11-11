import type { ReactNode } from 'react'

/**
 * 页面过渡容器
 *
 * 为什么用 `template.tsx` 而不是在 layout 里加客户端动画组件：
 *
 *   - App Router 里 `template` 会在**每次导航时重新挂载**，
 *     因此 CSS 动画自然重放，不需要监听 pathname、不需要状态、也不需要
 *     把页面降级成 Client Component。
 *   - `layout` 不会随导航重挂载，把动画写在那里只会播一次。
 *
 * 动画本身只有「淡入 + 8px 上移」（见 globals.css 的 .page-enter），
 * 时长走 --duration-base。`prefers-reduced-motion` 下整段动画被移除，
 * 页面直接出现——不做「缩短版动画」是因为位移在减弱动效时仍会让人不适。
 *
 * 作用范围仅限 <main> 内的子节点，顶栏与页脚不参与，避免整页一起浮动。
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-enter">{children}</div>
}