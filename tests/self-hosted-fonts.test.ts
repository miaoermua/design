import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SRC, stripCssComments } from './helpers/design-tokens'

/**
 * Phase 4A：自托管中文字体的构建期契约
 *
 * 这些断言不检查「好看」，只保证字体管线的几个硬条件不被后续改动悄悄破坏：
 *   - 样式表里没有任何外部字体地址（运行期不得回落到第三方 CDN）；
 *   - @font-face 的 url() 都指向仓库内的 woff2，且与 manifest、磁盘三方一致；
 *   - unicode-range 由官方切片给出，同一字族的汉字区间不重叠；
 *   - 语义变量覆盖只把自托管字体放到回退栈首位，等宽栈保持系统字体；
 *   - 许可文件随字体一起分发。
 */

const FONTS_CSS = join(SRC, 'design-system/styles/fonts.css')
const ASSETS = join(SRC, 'assets/fonts')

type FamilySpec = { family: string; dir: string; weight: string; slices: number }

const FAMILIES: FamilySpec[] = [
  { family: 'Noto Sans SC', dir: 'noto-sans-sc', weight: '100 900', slices: 101 },
  { family: 'Noto Serif SC', dir: 'noto-serif-sc', weight: '200 900', slices: 101 },
]

type Face = {
  family: string
  url: string
  weight: string
  display: string
  ranges: Array<[number, number]>
}

const css = stripCssComments(readFileSync(FONTS_CSS, 'utf8'))

function parseRanges(text: string): Array<[number, number]> {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const bounds = part.replace(/^U\+/i, '').split('-')
      const start = Number.parseInt(bounds[0], 16)
      const end = bounds.length > 1 ? Number.parseInt(bounds[1], 16) : start
      return [start, end] as [number, number]
    })
}

function parseFaces(source: string): Face[] {
  return source
    .split('@font-face')
    .slice(1)
    .map((block) => {
      const body = block.slice(0, block.indexOf('}'))
      const family = body.match(/font-family:\s*'([^']+)'/)?.[1] ?? ''
      const url = body.match(/url\('([^']+)'\)/)?.[1] ?? ''
      const weight = body.match(/font-weight:\s*([^;]+);/)?.[1].trim() ?? ''
      const display = body.match(/font-display:\s*([^;]+);/)?.[1].trim() ?? ''
      const rangeText = body.match(/unicode-range:([\s\S]*?);/)?.[1] ?? ''
      return { family, url, weight, display, ranges: parseRanges(rangeText) }
    })
}

const faces = parseFaces(css)

function facesOf(spec: FamilySpec): Face[] {
  return faces.filter((face) => face.family === spec.family)
}

function covers(ranges: Array<[number, number]>, codePoint: number): boolean {
  return ranges.some(([start, end]) => codePoint >= start && codePoint <= end)
}

/** 覆盖率统计用：把区间摊平成码位集合 */
function toCodePointSet(ranges: Array<[number, number]>): Set<number> {
  const set = new Set<number>()
  for (const [start, end] of ranges) {
    for (let code = start; code <= end; code += 1) set.add(code)
  }
  return set
}

/** 中文正文里实际会出现的标点（不含 〘〙 这类日文专用符号，字体本身不提供） */
const CJK_PUNCTUATION = '、。〃〈〉《》「」『』【】〔〕〖〗〜〝〞〰〓…—‘’“”·￥'

const COMMON_HANZI =
  '的一是了我不人在他有这个上们来到时大地为子中你说生国年着就那和要她出也得里后自以会家可下而过天去能对小多然于心学么之都好看起发当没成只如事把还用第样道想作种开美总从无情己面最女但现前些所同日手又行意动方期它头经长儿回位分爱老因很给名法间斯知世什两次使身者被高已亲其进此话常与活正感'

describe('自托管字体：资源与地址', () => {
  it('样式表里没有任何外部字体地址', () => {
    expect(css).not.toMatch(/https?:\/\//i)
    expect(css).not.toMatch(/fonts\.(googleapis|gstatic)\.com/i)
    expect(css).not.toMatch(/url\(\s*['"]?\/\//)
  })

  it('每一条 @font-face 都指向仓库内的 woff2', () => {
    expect(faces.length).toBe(FAMILIES.reduce((sum, spec) => sum + spec.slices, 0))
    for (const face of faces) {
      const spec = FAMILIES.find((item) => item.family === face.family)
      expect(spec, `未登记的字族：${face.family}`).toBeTruthy()
      expect(face.url).toMatch(
        new RegExp(`^\\.\\./\\.\\./assets/fonts/${spec?.dir}/[\\w.-]+\\.woff2$`),
      )
    }
  })

  it('每个分片都声明 woff2 格式、可变字重轴与 unicode-range', () => {
    for (const spec of FAMILIES) {
      const own = facesOf(spec)
      expect(own.length, `${spec.family} 分片数`).toBe(spec.slices)
      for (const face of own) {
        expect(face.weight, `${face.url} 字重`).toBe(spec.weight)
        expect(face.display, `${face.url} font-display`).toBe('swap')
        expect(face.ranges.length, `${face.url} unicode-range`).toBeGreaterThan(0)
      }
    }
    const formats = css.match(/format\('woff2'\)/g) ?? []
    expect(formats.length).toBe(faces.length)
  })

  it('引用的字体文件都存在，磁盘上也没有多余文件', () => {
    const referenced = new Set(faces.map((face) => face.url.split('/').pop()))
    const onDisk = new Set<string>()
    for (const spec of FAMILIES) {
      for (const name of readdirSync(join(ASSETS, spec.dir))) {
        if (name.endsWith('.woff2')) onDisk.add(name)
      }
    }
    expect(onDisk.size).toBe(referenced.size)
    expect([...referenced].sort()).toEqual([...onDisk].sort())
    for (const spec of FAMILIES) {
      for (const name of readdirSync(join(ASSETS, spec.dir))) {
        if (name.endsWith('.woff2'))
          expect(statSync(join(ASSETS, spec.dir, name)).size).toBeGreaterThan(0)
      }
    }
  })

  it('manifest 的文件名、字节数与 unicode-range 与样式表一致', () => {
    for (const spec of FAMILIES) {
      const dir = join(ASSETS, spec.dir)
      const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as {
        family: string
        files: Array<{ name: string; bytes: number; unicodeRange: string }>
      }
      expect(manifest.family).toBe(spec.family)
      expect(manifest.files.length).toBe(spec.slices)

      const fromCss = new Map(
        facesOf(spec).map((face) => [face.url.split('/').pop() as string, face.ranges]),
      )
      for (const file of manifest.files) {
        expect(statSync(join(dir, file.name)).size, `${file.name} 字节数`).toBe(file.bytes)
        expect(fromCss.get(file.name), `${file.name} 未被样式表引用`).toBeTruthy()
        expect(fromCss.get(file.name), `${file.name} unicode-range 漂移`).toEqual(
          parseRanges(file.unicodeRange),
        )
      }
    }
  })
})

describe('自托管字体：子集覆盖', () => {
  it('同一字族的汉字区间不重叠', () => {
    for (const spec of FAMILIES) {
      const ranges = facesOf(spec).flatMap((face) => face.ranges)
      const seen = new Set<number>()
      const duplicated: number[] = []
      for (const [start, end] of ranges) {
        for (let code = start; code <= end; code += 1) {
          if (seen.has(code)) duplicated.push(code)
          seen.add(code)
        }
      }
      // 官方切片在拉丁/货币区有少量重复（后声明的 script 分片覆盖前面的），
      // 汉字区必须严格互斥，否则同一个字会命中两份字形。
      const ideographs = duplicated.filter((code) => code >= 0x3400 && code <= 0x9fff)
      expect(ideographs, `${spec.family} 汉字区间重叠`).toEqual([])
      expect(duplicated.filter((code) => code >= 0x2e80).sort()).toEqual([0xfeff, 0xfffd])
    }
  })

  it('覆盖 ASCII、中文标点、全角形式与常用汉字', () => {
    for (const spec of FAMILIES) {
      const ranges = facesOf(spec).flatMap((face) => face.ranges)
      const missing: string[] = []
      const check = (label: string, code: number) => {
        if (!covers(ranges, code)) missing.push(`${label} U+${code.toString(16).toUpperCase()}`)
      }

      for (let code = 0x20; code <= 0x7e; code += 1) check('ASCII', code)
      for (const char of CJK_PUNCTUATION) check(char, char.codePointAt(0) as number)
      // 全角 ASCII 变体与全角货币符号；FF5F 之后的半角片假名等不在字体覆盖面内
      for (let code = 0xff01; code <= 0xff5e; code += 1) check('全角', code)
      for (let code = 0xffe0; code <= 0xffe6; code += 1) check('全角货币', code)
      for (const char of COMMON_HANZI) check(char, char.codePointAt(0) as number)

      expect(missing, `${spec.family} 缺字`).toEqual([])

      const ideographCount = [...toCodePointSet(ranges)].filter(
        (code) => code >= 0x4e00 && code <= 0x9fff,
      ).length
      expect(ideographCount, `${spec.family} 基本区汉字覆盖量`).toBeGreaterThan(12000)
    }
  })
})

describe('自托管字体：接入方式', () => {
  it('tokens.css 的语义变量把自托管字体放到回退栈首位，等宽栈不动', () => {
    // 单一来源：字体栈只定义一次（tokens.css 的 @theme），fonts.css 只管 @font-face。
    const theme = stripCssComments(
      readFileSync(join(SRC, 'design-system/tokens/tokens.css'), 'utf8'),
    )
    const stackOf = (name: string) =>
      theme
        .match(new RegExp(`${name}:\\s*([\\s\\S]*?);`))?.[1]
        .replace(/\s+/g, ' ')
        .trim()

    const sans = stackOf('--font-sans')
    const serif = stackOf('--font-serif')
    const mono = stackOf('--font-mono')

    expect(sans?.startsWith("'Noto Sans SC'")).toBe(true)
    expect(sans).toContain("'PingFang SC'")
    expect(sans?.endsWith('sans-serif')).toBe(true)
    expect(serif?.startsWith("'Noto Serif SC'")).toBe(true)
    expect(serif).toContain("'Songti SC'")
    expect(serif?.endsWith('serif')).toBe(true)
    // 等宽与中文本地化无关，不引入任何 Web Font
    expect(mono?.startsWith('ui-monospace')).toBe(true)
    expect(mono).not.toContain('Noto')

    // fonts.css 不得再声明这些变量，否则同一变量会有两个来源
    expect(css).not.toMatch(/--font-(sans|serif|mono)\s*:/)
  })

  it('layout 在 globals.css 之后引入字体样式', () => {
    const layout = readFileSync(join(SRC, 'app/layout.tsx'), 'utf8')
    const globals = layout.indexOf("import './globals.css'")
    const fonts = layout.indexOf("import '@/design-system/styles/fonts.css'")
    expect(globals).toBeGreaterThan(-1)
    expect(fonts).toBeGreaterThan(globals)
    // 单一入口：只在这一处引入字体样式
    const imports = (css.match(/@import/g) ?? []).length
    expect(imports).toBe(0)
  })

  it('OFL 许可与版权声明随字体一起分发', () => {
    for (const name of ['LICENSE-OFL-NotoSansSC.txt', 'LICENSE-OFL-NotoSerifSC.txt']) {
      const text = readFileSync(join(ASSETS, name), 'utf8')
      expect(text).toContain('SIL OPEN FONT LICENSE Version 1.1')
      expect(text).toMatch(/Reserved Font Name/i)
      expect(text).toMatch(/Copyright \d{4}/)
    }
    const readme = readFileSync(join(ASSETS, 'README.md'), 'utf8')
    expect(readme).toContain('OFL')
    expect(readme).toContain('LICENSE-OFL-NotoSansSC.txt')
    expect(readme).toContain('LICENSE-OFL-NotoSerifSC.txt')
  })
})
