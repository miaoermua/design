import type { CSSProperties } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * 友链邮戳
 *
 * 装饰性 SVG：外圈快印、内圈虚线、弧形字与中央信封符号。
 * 所有卡片共用同一枚邮戳图案，唯一的差异是旋转角度（由 `seed` 确定性派生，
 * 不引入 SVG filter 也不增加合成层）。
 *
 * 旋转是纯 CSS transform，在 GPU 合成阶段完成，不触发重排也不触发重绘，
 * 65 个不同角度和 65 个相同角度的性能开销完全一致。
 *
 * 线条粗细按「渲染后 ≥ 0.7px」反推（`docs/DESIGN-SYSTEM.md` §7：邮戳是 SVG 印刷墨迹）：
 * 邮戳显示直径桌面 76px、窄屏 68px，而 viewBox 是 200 —— 缩放比约 0.38 / 0.34。
 * 早先的 1.8 / 0.9 / 0.7 换算下来只有 0.68 / 0.34 / 0.27px，全部落在亚像素区间，
 * 浏览器抗锯齿后是一层灰雾，看起来「糊」而不是「印上去的」。同时移除了一圈
 * (100.7, 99.3) 的重影：它的偏移只有 0.27px，在 76px 的显示尺寸上不产生可读的
 * 印刷差异，只贡献额外的模糊。现在最细的内圈也是 1.8（≈0.68px），外圈 2.6（≈1px）。
 *
 * 墨色仍按 §7 的要求用 `currentColor` + 语义 Token 混色，但把 `--accent-strong`
 * 的占比从 82% 降到 55%：82% 那版换算出来是 #41527e 的饱和蓝紫，配上 0.72×0.8
 * 的双重透明度，在暖纸上既淡到读不出印章、又冷到跳出色系；降到 55% 后得到
 * #3a4561 的蓝灰墨 —— 保留「蓝色日戳」的识别度，但落回 Warm Parchment 的墨色区间。
 */

const INK = 'color-mix(in srgb, var(--accent-strong) 55%, var(--text-heading))'

/** 线宽：viewBox 单位，渲染后见文件头注释 */
const RING = 2.6
const RING_HAIR = 2.2
const RING_INNER = 1.8
const ENVELOPE = 2.4

/** 从字符串派生 -7° ~ +7° 的确定性旋转角，同一 seed 永远同一角度 */
function seedRotation(seed: string): number {
  let sum = 0
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i)
  return -7 + (sum % 15)
}

interface PostmarkProps {
  seed?: string
  className?: string
}

export function Postmark({ seed, className }: PostmarkProps) {
  const uid = useId()
  const rotation = seed ? seedRotation(seed) : -3

  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
      className={cn('friend-postmark block', className)}
      style={{ color: INK, '--postmark-rotate': `${rotation}deg` } as CSSProperties}
    >
      <defs>
        <path id={`${uid}-top`} d="M 34 100 A 66 66 0 0 1 166 100" fill="none" />
        <path id={`${uid}-btm`} d="M 38 100 A 62 62 0 0 0 162 100" fill="none" />
      </defs>

      <g fill="none" stroke="currentColor" strokeLinecap="round">
        {/* 外层双圈：一实一虚。透明度只做墨量深浅，压到 0.5 以下的细线在
            1px 以内会被抗锯齿吃掉，所以下限不再往 0.3 走。 */}
        <circle cx="100" cy="100" r="93" strokeWidth={RING} opacity="0.85" />
        <circle
          cx="100"
          cy="100"
          r="86"
          strokeWidth={RING_HAIR}
          opacity="0.6"
          strokeDasharray="2 6"
        />
        <circle
          cx="100"
          cy="100"
          r="78"
          strokeWidth={RING_HAIR}
          opacity="0.72"
          strokeDasharray="2.4 5"
        />
        <circle cx="100" cy="100" r="46" strokeWidth={RING_INNER} opacity="0.5" />

        {/* 中央信封符号 */}
        <g strokeWidth={ENVELOPE} opacity="0.92">
          <rect x="78" y="84" width="44" height="32" rx="2" />
          <path d="M 78 86 L 100 101 L 122 86" />
        </g>
      </g>

      <g fill="currentColor">
        <text>
          <textPath href={`#${uid}-top`} startOffset="50%" textAnchor="middle">
            FOLIO · DESIGN BY MIAOER.
          </textPath>
        </text>
        <text>
          <textPath href={`#${uid}-btm`} startOffset="50%" textAnchor="middle">
            POSTMARK · FRIENDS
          </textPath>
        </text>
      </g>
    </svg>
  )
}
