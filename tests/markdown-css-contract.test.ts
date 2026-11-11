/**
 * Markdown 真实 DOM ↔ CSS 选择器契约
 *
 * 这里检查的不是「某个字符串存在」，而是两条可证伪的对应关系：
 *   正向 —— 渲染器/增强组件真实产出的类名，样式表里必须有能命中的选择器；
 *   反向 —— 样式表里的 md-* 类，必须能在渲染器或增强组件里找到生产者。
 *
 * 边界：这是静态契约检查。CSS 优先级、color-mix()/backdrop-filter 的最终计算样式、
 * 亮暗主题下的实际观感仍需浏览器截图验收，本文件不声称覆盖那部分。
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { renderMarkdown } from '@/lib/content/markdown'
import { SRC, TOKENS, contrast, palette, stripCssComments } from './helpers/design-tokens'

const STYLES = join(SRC, 'design-system/styles')
const STYLE_FILES = [
  'prose.css',
  'media.css',
  'containers.css',
  'footnotes.css',
  'mentions.css',
  'material.css',
] as const

/** 去掉注释后的样式原文；注释里的说明文字不得参与选择器判定 */
const cssText = new Map<string, string>(
  STYLE_FILES.map((name) => [name, stripCssComments(readFileSync(join(STYLES, name), 'utf8'))]),
)
const allCss = [...cssText.values()].join('\n')

/** 取出 CSS 里每条规则的选择器部分（跳过 @media / @keyframes 头部与声明块） */
function selectorsIn(css: string): string[] {
  const result: string[] = []
  let buffer = ''
  for (const char of css) {
    if (char === '{') {
      const candidate = buffer.trim()
      if (candidate && !candidate.startsWith('@')) result.push(candidate)
      buffer = ''
    } else if (char === '}') {
      buffer = ''
    } else {
      buffer += char
    }
  }
  return result
}

function classNamesInSelector(selector: string): string[] {
  return [...selector.matchAll(/\.(-?[a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((match) => match[1])
}

function classesInCss(css: string): Set<string> {
  const result = new Set<string>()
  for (const selector of selectorsIn(css)) {
    for (const name of classNamesInSelector(selector)) result.add(name)
  }
  return result
}

function classesInHtml(html: string): Set<string> {
  const result = new Set<string>()
  for (const match of html.matchAll(/\bclass="([^"]*)"/g)) {
    for (const token of match[1].split(/\s+/)) if (token) result.add(token)
  }
  return result
}

/** 取某个精确选择器的声明块，用于验证属性确实挂在该组件上 */
function declarationsFor(css: string, selector: string): string | null {
  const head = `${selector} {`
  const at = css.indexOf(head)
  if (at < 0) return null
  const open = css.indexOf('{', at)
  const close = css.indexOf('}', open)
  return close < 0 ? null : css.slice(open + 1, close)
}

/** 渲染器 + 客户端增强组件的全部源码，作为「类名生产者」的证据 */
let producerSource = ''
for (const dir of [join(SRC, 'lib/content'), join(SRC, 'components/markdown')]) {
  for (const file of readdirSync(dir)) {
    const full = join(dir, file)
    if (statSync(full).isFile()) producerSource += `${readFileSync(full, 'utf8')}\n`
  }
}

const MARKDOWN_SAMPLES = [
  '这里 ||隐藏内容|| 结尾',
  '::: info 标题\n正文\n:::',
  '::: warning 注意\n正文\n:::',
  '::: banner{info}\n通栏提示\n:::',
  '::: details 概要\n- 一\n- 二\n:::',
  '> [!NOTE]\n> 正文',
  '联系 [Innei]{GH@Innei} 谢谢',
  '::: gallery\n![一](https://a.test/1.webp)\n:::',
  '::: carousel\n![一](https://a.test/1.webp)\n:::',
  '![普通图](https://a.test/x.webp)',
]

const CORE_CLASSES = [
  'md-spoiler',
  'md-callout',
  'md-banner',
  'md-details',
  'md-gallery',
  'md-mention',
] as const

const produced = new Set<string>()
const allSelectors = selectorsIn(allCss)
const styledClasses = classesInCss(allCss)

beforeAll(async () => {
  for (const sample of MARKDOWN_SAMPLES) {
    const { html } = await renderMarkdown(sample)
    for (const name of classesInHtml(html)) produced.add(name)
  }
})

describe('Markdown 真实 DOM 与 CSS 选择器契约', () => {
  it('样例确实渲染出各扩展块，避免空跑导致假通过', () => {
    for (const name of CORE_CLASSES) {
      expect(produced.has(name), `渲染样例没有产出 ${name}，请检查语法是否已变更`).toBe(true)
    }
  })

  it('渲染器产出的扩展基础类都能被样式选择器命中', () => {
    const coreFromDom = [...produced].filter(
      (name) => name.startsWith('md-') && !name.includes('__') && !name.includes('--'),
    )
    const missing = coreFromDom.filter((name) => !styledClasses.has(name))
    expect(missing, `以下真实类名在样式表中没有选择器:\n${missing.join('\n')}`).toEqual([])
  })

  it('已确认失效的旧规则不再出现在任何样式选择器里', () => {
    // 注释里保留了历史说明，因此这里只检查剥离注释后的选择器文本
    const legacy = allSelectors.filter((selector) =>
      /(?:^|\s)\.prose\s+\.(?:spoiler|callout)\b|\.spoiler\.is-revealed|\.is-revealed\b/.test(
        selector,
      ),
    )
    expect(legacy, `仍存在无法命中真实 DOM 的旧规则:\n${legacy.join('\n')}`).toEqual([])

    // 裸类名同样不允许：Renderer 只输出 md-* 前缀
    expect(styledClasses.has('spoiler')).toBe(false)
    expect(styledClasses.has('callout')).toBe(false)
    expect(styledClasses.has('is-revealed')).toBe(false)
  })

  it('扩展块样式只有一份实现，且 Spoiler 渐进增强状态机完整', () => {
    const containers = cssText.get('containers.css') as string
    const prose = cssText.get('prose.css') as string
    const containerClasses = classesInCss(containers)

    for (const name of ['md-spoiler', 'md-callout', 'md-banner', 'md-details']) {
      expect(containerClasses.has(name), `containers.css 缺少 ${name} 规则`).toBe(true)
    }
    expect(classesInCss(prose).has('md-spoiler'), 'prose.css 不应重复实现扩展块').toBe(false)
    expect(classesInCss(prose).has('md-callout'), 'prose.css 不应重复实现扩展块').toBe(false)

    for (const state of ["[data-spoiler-ready='true']", "[data-revealed='true']"]) {
      expect(containers, `Spoiler 状态机选择器缺失: ${state}`).toContain(state)
    }
  })

  it('反向：样式表里的 md-* 类都有生产者（修饰类按前缀判定）', () => {
    const mdClasses = [...styledClasses].filter((name) => name.startsWith('md-'))
    const orphans = mdClasses.filter((name) => {
      // --info / --warning 等由 `md-callout--${type}` 动态拼接，源码里没有完整字符串
      if (name.includes('--')) return !producerSource.includes(name.split('--')[0])
      return !producerSource.includes(name)
    })
    expect(orphans, `以下样式类找不到生产者:\n${orphans.join('\n')}`).toEqual([])
  })
})

describe('图片预览与材质边界', () => {
  it('两处组件专属 blur 保留在各自规则内，数值未被材质参数吞并', () => {
    const media = cssText.get('media.css') as string
    const nav = declarationsFor(media, '.md-gallery__nav')
    const preview = declarationsFor(media, '.md-preview')

    expect(nav, '找不到相册翻页按钮规则').not.toBeNull()
    expect(nav).toContain('backdrop-filter: blur(6px)')
    expect(preview, '找不到图片预览遮罩规则').not.toBeNull()
    expect(preview).toContain('backdrop-filter: blur(8px)')

    const material = cssText.get('material.css') as string
    // 材质层仍以 --material-glass-* 参数驱动，且没有把组件专属数值写进来
    expect(material).toContain('var(--material-glass-blur)')
    expect(selectorsIn(material).some((s) => s.includes('.glass-bar'))).toBe(true)
    expect(selectorsIn(material).some((s) => s.includes('.glass-panel'))).toBe(true)
    expect(material, '材质层混入了组件专属 blur 数值').not.toMatch(/blur\((?:6|8)px\)/)
  })

  it('预览浮层的亮暗反色前提仍成立（遮罩 ink / 前景 paper）', () => {
    const media = cssText.get('media.css') as string
    expect(declarationsFor(media, '.md-preview')).toContain('var(--color-ink)')
    for (const selector of [
      '.md-preview__caption',
      '.md-preview__counter',
      '.md-preview__close,\n.md-preview__nav',
    ]) {
      const block = declarationsFor(media, selector)
      expect(block, `找不到 ${selector} 的声明块`).not.toBeNull()
      expect(block, `${selector} 缺少 paper 前景色`).toContain('var(--color-paper)')
    }

    // 亮色 ink 深于 paper、暗色 ink 浅于 paper：两套主题下反色对比都成立
    for (const theme of [palette('light'), palette('dark')]) {
      const ink = theme.get('--color-ink') as string
      const paper = theme.get('--color-paper') as string
      expect(contrast(ink, paper), 'ink 与 paper 必须保持足够反差').toBeGreaterThanOrEqual(4.5)
    }
  })

  it('材质注释与实际用途一致：不再声称 backdrop-filter 仅存在于 .glass-*', () => {
    const materialWithComments = readFileSync(join(STYLES, 'material.css'), 'utf8')
    expect(materialWithComments).toContain('材质层的 backdrop-filter 只出现在 .glass-* 上')
    expect(materialWithComments).toContain('media.css 另有两处组件专属的局部模糊')
  })
})

describe('--color-paper-deep 消费者', () => {
  const tokens = stripCssComments(readFileSync(TOKENS, 'utf8'))

  it('变量在亮暗两套都定义，暗色环境光仍在消费，变量不得删除', () => {
    const definitions = [...tokens.matchAll(/(--color-paper-deep)\s*:/g)]
    expect(definitions.length, '亮色与暗色各应有一处定义').toBe(2)

    const darkStart = tokens.indexOf("[data-theme='dark']")
    expect(darkStart).toBeGreaterThan(0)
    const darkBlock = tokens.slice(darkStart)
    expect(darkBlock).toContain('var(--color-paper-deep)')
    expect(darkBlock).toContain('--material-ambient')
  })

  it('浅色下失效的 .prose .spoiler 消费者已移除', () => {
    const prose = cssText.get('prose.css') as string
    expect(prose, 'prose.css 不应再引用已废弃的浅色消费者').not.toContain('var(--color-paper-deep)')
  })
})

// 静态检查无法覆盖：CSS 计算样式、backdrop-filter 实际渲染、亮暗主题截图对比。
// 这三项需要浏览器视觉验收，见 docs/audits/PHASE-4B-CSS-DEFECT-FIXES.md。
