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
 */

const INK = 'color-mix(in srgb, var(--accent-strong) 82%, var(--text-heading))'

const RING = 1.8
const DASH = '1.2 3.8'

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
        {/* 外层双圈：一实一虚 */}
        <circle cx="100" cy="100" r="93" strokeWidth={RING} opacity="0.85" />
        <circle cx="100" cy="100" r="86" strokeWidth="0.9" opacity="0.55" strokeDasharray="1.5 7" />
        {/* 轻微重影 */}
        <circle cx="100.7" cy="99.3" r="93" strokeWidth={RING * 0.5} opacity="0.28" />
        <circle
          cx="100"
          cy="100"
          r="78"
          strokeWidth={RING * 0.8}
          opacity="0.7"
          strokeDasharray={DASH}
        />
        <circle cx="100" cy="100" r="46" strokeWidth="0.7" opacity="0.4" />

        {/* 中央信封符号 */}
        <g strokeWidth={RING * 0.7} opacity="0.9">
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
