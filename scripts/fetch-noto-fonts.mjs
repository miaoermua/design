/**
 * 拉取并落盘 Noto Sans SC / Noto Serif SC 的官方 woff2 切片，生成自托管 @font-face。
 *
 * 用法：node scripts/fetch-noto-fonts.mjs
 *
 * 行为：
 *   1. 从 Google Fonts 官方 CSS 接口取「可变字体」切片表（每族 101 个 unicode-range 分片）；
 *   2. 逐个下载 woff2 到 src/assets/fonts/<slug>/，校验 wOF2 魔数；
 *   3. 生成 src/design-system/styles/fonts.css（相对路径 + 官方 unicode-range 原样保留）；
 *   4. 写入 src/assets/fonts/<slug>/manifest.json，记录每片的来源 URL 与字节数。
 *
 * 只在字体版本变动时手工执行；运行期与构建期都不访问网络（生成的 CSS 与字体已入库）。
 * 该脚本不下载许可证；OFL 文本随仓库保存在 src/assets/fonts/LICENSE-OFL-*.txt。
 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const ROOT = join(import.meta.dirname, '..')
const FONT_ROOT = join(ROOT, 'src/assets/fonts')

const FAMILIES = [
  {
    slug: 'noto-sans-sc',
    family: 'Noto Sans SC',
    query: 'Noto+Sans+SC:wght@100..900',
    weight: '100 900',
  },
  {
    slug: 'noto-serif-sc',
    family: 'Noto Serif SC',
    query: 'Noto+Serif+SC:wght@200..900',
    weight: '200 900',
  },
]

async function download(url) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (error) {
      if (attempt === 3) throw error
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)))
    }
  }
}

const blocks = []
const summary = []

for (const fam of FAMILIES) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${fam.query}&display=swap`
  const cssRes = await fetch(cssUrl, { headers: { 'User-Agent': UA } })
  if (!cssRes.ok) throw new Error(`CSS ${cssRes.status}: ${cssUrl}`)
  const css = await cssRes.text()

  const faces = css
    .split('@font-face')
    .slice(1)
    .map((chunk) => {
      const unicodeRange = chunk.match(/unicode-range:\s*([^;]+);/)?.[1].trim()
      const url = chunk.match(/url\((https:[^)]+)\)/)?.[1]
      if (!unicodeRange || !url) throw new Error('无法解析 Google Fonts 的 @font-face 块')
      return { unicodeRange, url }
    })

  const dir = join(FONT_ROOT, fam.slug)
  await mkdir(dir, { recursive: true })

  const files = []
  let bytes = 0
  for (let i = 0; i < faces.length; i++) {
    const name = `${fam.slug}-${String(i).padStart(3, '0')}.woff2`
    const target = join(dir, name)
    // 已下载且魔数正确则跳过，避免每次重生成都拉 200 个文件（--force 可强制重下）。
    if (!process.argv.includes('--force') && existsSync(target)) {
      const cached = await readFile(target)
      if (cached.subarray(0, 4).toString('latin1') === 'wOF2') {
        bytes += cached.byteLength
        files.push({
          name,
          bytes: cached.byteLength,
          source: faces[i].url,
          unicodeRange: faces[i].unicodeRange,
        })
        continue
      }
    }
    const buffer = await download(faces[i].url)
    if (buffer.subarray(0, 4).toString('latin1') !== 'wOF2') {
      throw new Error(`${name} 不是 WOFF2 文件`)
    }
    await writeFile(target, buffer)
    bytes += buffer.byteLength
    files.push({
      name,
      bytes: buffer.byteLength,
      source: faces[i].url,
      unicodeRange: faces[i].unicodeRange,
    })
  }

  await writeFile(
    join(dir, 'manifest.json'),
    `${JSON.stringify(
      { family: fam.family, cssSource: cssUrl, generatedAt: new Date().toISOString(), files },
      null,
      2,
    )}\n`,
  )

  for (const file of files) {
    blocks.push(`@font-face {
  font-family: '${fam.family}';
  font-style: normal;
  font-weight: ${fam.weight};
  font-display: swap;
  src: url('../../assets/fonts/${fam.slug}/${file.name}') format('woff2');
  unicode-range: ${file.unicodeRange};
}`)
  }

  summary.push(`${fam.family}: ${files.length} 片 / ${(bytes / 1048576).toFixed(2)}MB`)
}

const header = `/*
 * Folio — 自托管中文字体
 *
 * 来源：Google Fonts 官方 CSS 接口（fonts.googleapis.com / fonts.gstatic.com）分发的
 *      Noto Sans SC / Noto Serif SC 可变字体 woff2 切片，一次性下载后随仓库托管，
 *      运行期不产生任何第三方字体请求。
 * 许可：SIL Open Font License 1.1（见 src/assets/fonts/LICENSE-OFL-*.txt）。
 * 生成：node scripts/fetch-noto-fonts.mjs；不要手工编辑本文件。
 * 说明：font-weight 为可变字体范围；unicode-range 由官方切片给出，未手工改动。
 *      本文件只声明 @font-face；语义字体栈（--font-sans / --font-serif / --font-mono）
 *      定义在 tokens.css 的 @theme 里，两者职责分离，避免同一变量出现两个来源。
 */

`

await writeFile(
  join(ROOT, 'src/design-system/styles/fonts.css'),
  header + blocks.join('\n\n') + '\n',
)

// 生成的 CSS 交给仓库既有的 prettier 格式化，保证 `pnpm format:check` 不会因为它报错。
function formatWithPrettier(file) {
  try {
    const require = createRequire(import.meta.url)
    const bin = require.resolve('prettier/bin/prettier.cjs')
    execFileSync(process.execPath, [bin, '--write', file], { stdio: 'ignore' })
  } catch {
    console.warn(`prettier 不可用，跳过格式化：${file}`)
  }
}

formatWithPrettier(join(ROOT, 'src/design-system/styles/fonts.css'))

console.log(summary.join('\n'))
