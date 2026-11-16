/**
 * 日记列表摘要化的视觉验收
 *
 * 覆盖：桌面 / 手机、亮 / 暗、有图 / 无图条目、分页位置、图片占位稳定性。
 * 只读，不发任何写请求。
 *
 * 用法：FOLIO_BASE=http://127.0.0.1:3000 node scripts/visual/diary-list-shots.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { launchChrome, navigate, openPage, preparePage, screenshot, scrollTo, settle, sleep } from './cdp.mjs'

const BASE = process.env.FOLIO_BASE ?? 'http://127.0.0.1:3000'
const OUT = process.env.FOLIO_SHOTS ?? join(tmpdir(), 'folio-diary-list')

mkdirSync(OUT, { recursive: true })

const chrome = await launchChrome({ port: 9383 })
const client = await openPage(chrome.port)
const report = { base: BASE, shots: [], checks: {} }

try {
  /* ── 桌面：亮 / 暗 ─────────────────────────────────────────── */
  for (const [theme, name] of [
    ['light', 'desktop-1440-light'],
    ['dark', 'desktop-1440-dark'],
  ]) {
    await preparePage(client, { width: 1440, height: 900, theme })
    await navigate(client, `${BASE}/diaries`)
    await settle(client)
    writeFileSync(join(OUT, `${name}.png`), await screenshot(client))
    report.shots.push(`${name}.png`)
  }

  /* ── 条目细节：有图 / 无图 / 长文 ───────────────────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/diaries`)
  await settle(client)

  // 第一条（无图）与第二条（713 张图 → 现在只有 1 张）
  await scrollTo(client, 'main h1')
  report.checks.firstEntries = await client.evaluate(`(() => {
    const arts = [...document.querySelectorAll('article')]
    return arts.slice(0, 4).map((el) => {
      const img = el.querySelector('img')
      const r = img?.getBoundingClientRect()
      const p = el.querySelector('[data-diary-excerpt]')
      return {
        title: (el.querySelector('h3')?.textContent ?? '').trim().slice(0, 16),
        imgs: el.querySelectorAll('img').length,
        imgBox: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
        excerptLines: p ? Math.round(p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight)) : 0,
        entryHeight: Math.round(el.getBoundingClientRect().height),
      }
    })
  })()`)

  // 图片加载前后：容器尺寸不变才算没有布局偏移
  report.checks.layoutStability = await client.evaluate(`(async () => {
    const img = document.querySelector('article img')
    if (!img) return { skipped: true }
    const before = img.getBoundingClientRect()
    const parent = img.parentElement
    const parentBefore = parent.getBoundingClientRect()
    // 强制等这张图加载完（lazy 的图滚动到视口后才开始请求）
    img.scrollIntoView({ block: 'center' })
    await new Promise((r) => setTimeout(r, 1200))
    const after = img.getBoundingClientRect()
    const parentAfter = parent.getBoundingClientRect()
    return {
      imgBefore: { w: Math.round(before.width), h: Math.round(before.height) },
      imgAfter: { w: Math.round(after.width), h: Math.round(after.height) },
      parentBefore: { w: Math.round(parentBefore.width), h: Math.round(parentBefore.height) },
      parentAfter: { w: Math.round(parentAfter.width), h: Math.round(parentAfter.height) },
      stable:
        Math.round(parentBefore.height) === Math.round(parentAfter.height) &&
        Math.round(parentBefore.width) === Math.round(parentAfter.width),
      loaded: img.complete && img.naturalWidth > 0,
    }
  })()`)
  writeFileSync(join(OUT, 'entry-with-image.png'), await screenshot(client))

  // 无图条目
  await client.evaluate(`window.scrollTo({ top: 0, behavior: 'instant' })`)
  await sleep(300)
  writeFileSync(join(OUT, 'entry-without-image.png'), await screenshot(client))

  /* ── 分页位置 ─────────────────────────────────────────────── */
  report.checks.pagination = await client.evaluate(`(() => {
    const nav = [...document.querySelectorAll('main nav, main a')].filter((el) =>
      /下一页|上一页|older|newer|第 \\d+ 页/.test(el.textContent || ''),
    )
    const last = nav.at(-1)
    return last
      ? { found: true, text: (last.textContent || '').trim().slice(0, 30), top: Math.round(last.getBoundingClientRect().top + window.scrollY) }
      : { found: false }
  })()`)

  /* ── 手机：亮 / 暗 ─────────────────────────────────────────── */
  for (const [theme, name] of [
    ['light', 'mobile-390-light'],
    ['dark', 'mobile-390-dark'],
  ]) {
    await preparePage(client, { width: 390, height: 844, theme })
    await navigate(client, `${BASE}/diaries`)
    await settle(client)
    writeFileSync(join(OUT, `${name}.png`), await screenshot(client))
    report.shots.push(`${name}.png`)
  }

  /* ── 长日记（原 30 屏）现在的样子 ──────────────────────────── */
  await preparePage(client, { width: 1440, height: 900, theme: 'light' })
  await navigate(client, `${BASE}/diaries?page=1`)
  await settle(client)
  await scrollTo(client, 'article:nth-of-type(2)')
  writeFileSync(join(OUT, 'long-diary-entry.png'), await screenshot(client))

  /* ── 详情页仍完整（对照） ─────────────────────────────────── */
  await navigate(client, `${BASE}/diaries/155695797663436800`)
  await settle(client, { extraDelay: 900 })
  report.checks.detail = await client.evaluate(`(() => {
    const doc = document.documentElement
    return {
      pageHeight: doc.scrollHeight,
      imgs: document.querySelectorAll('.prose img').length,
      prose: document.querySelectorAll('.prose').length,
      hasToc: document.querySelectorAll('[data-reading-tools], aside').length > 0,
    }
  })()`)
  writeFileSync(join(OUT, 'detail-full.png'), await screenshot(client))
} finally {
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2))
  client.close()
  await chrome.close()
}

console.log(JSON.stringify(report, null, 2))
