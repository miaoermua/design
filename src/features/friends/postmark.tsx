import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * 友链邮戳（原型）
 *
 * 装饰性 SVG：外圈快印、内圈虚线、弧形字与中央邮政符号。
 * 所有变化来自 `seed` 的稳定哈希（FNV-1a），同一友链在刷新与重渲染后保持同一枚邮戳，
 * 渲染期不调用 Math.random()，也不生成任何图片资源。
 */

/** 三种墨色都从语义 Token 混出，明暗主题自动跟随；不用功能色做装饰。 */
const INK_MIXES = [
  'color-mix(in srgb, var(--accent-strong) 82%, var(--text-heading))',
  'color-mix(in srgb, var(--text-heading) 86%, var(--accent))',
  'color-mix(in srgb, var(--text-secondary) 70%, var(--accent-strong))',
] as const

const DASH_PATTERNS = ['0.5 3.4', '1.2 3.8', '2 3.2'] as const

export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

interface PostmarkProps {
  seed: string
  className?: string
}

export function Postmark({ seed, className }: PostmarkProps) {
  const hash = hashSeed(seed)
  const rotation = -7 + (hash % 15)
  const ink = INK_MIXES[(hash >>> 4) % INK_MIXES.length]
  const opacity = 0.54 + ((hash >>> 6) % 5) * 0.04
  const ring = 1.5 + ((hash >>> 9) % 4) * 0.24
  const dash = DASH_PATTERNS[(hash >>> 12) % DASH_PATTERNS.length]
  const symbol = (hash >>> 17) % 3
  const seedValue = ((hash >>> 21) % 89) + 10
  const uid = `pm-${hash.toString(36)}`

  const style = {
    color: ink,
    '--postmark-rotate': `${rotation}deg`,
    '--postmark-opacity': opacity.toFixed(3),
  } as CSSProperties

  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      focusable="false"
      className={cn('friend-postmark block', className)}
      style={style}
    >
      <defs>
        <path id={`${uid}-top`} d="M 34 100 A 66 66 0 0 1 166 100" fill="none" />
        <path id={`${uid}-bottom`} d="M 38 100 A 62 62 0 0 0 162 100" fill="none" />
        {/* 极轻的位移噪点：让圆环边缘像真实印泥一样略微毛糙 */}
        <filter id={`${uid}-ink`} x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.9"
            numOctaves="2"
            seed={seedValue}
            result="noise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="noise"
            scale="1.1"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>

      <g filter={`url(#${uid}-ink)`} fill="none" stroke="currentColor" strokeLinecap="round">
        {/* 外层双圈：一实一虚，虚圈承担齿孔感 */}
        <circle cx="100" cy="100" r="93" strokeWidth={ring} opacity="0.85" />
        <circle cx="100" cy="100" r="86" strokeWidth="0.9" opacity="0.55" strokeDasharray="1.5 7" />
        {/* 轻微重影：模拟一次压印不齐 */}
        <circle cx="100.7" cy="99.3" r="93" strokeWidth={ring * 0.5} opacity="0.28" />
        <circle
          cx="100"
          cy="100"
          r="78"
          strokeWidth={ring * 0.8}
          opacity="0.7"
          strokeDasharray={dash}
        />
        <circle cx="100" cy="100" r="46" strokeWidth="0.7" opacity="0.4" />

        {symbol === 0 ? (
          <g strokeWidth={ring * 0.7} opacity="0.9">
            <rect x="78" y="84" width="44" height="32" rx="2" />
            <path d="M 78 86 L 100 101 L 122 86" />
          </g>
        ) : symbol === 1 ? (
          <g strokeWidth={ring * 0.65} opacity="0.9">
            <path d="M 100 80 V 120" />
            <path d="M 80 90 L 120 110" />
            <path d="M 80 110 L 120 90" />
          </g>
        ) : (
          <g strokeWidth={ring * 0.65} opacity="0.9">
            <path d="M 76 92 q 6 -5 12 0 t 12 0 t 12 0 t 12 0" />
            <path d="M 76 100 q 6 -5 12 0 t 12 0 t 12 0 t 12 0" />
            <path d="M 76 108 q 6 -5 12 0 t 12 0 t 12 0 t 12 0" />
          </g>
        )}
      </g>

      <g fill="currentColor">
        <text>
          <textPath href={`#${uid}-top`} startOffset="50%" textAnchor="middle">
            FOLIO · DESIGN BY MIAOER.
          </textPath>
        </text>
        <text>
          <textPath href={`#${uid}-bottom`} startOffset="50%" textAnchor="middle">
            POSTMARK · FRIENDS
          </textPath>
        </text>
      </g>
    </svg>
  )
}
