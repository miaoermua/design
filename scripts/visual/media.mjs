/**
 * Phase 4D 图片预览 / 相册 / Mermaid 补水验收
 *
 * 这三件事都依赖客户端增强器，静态 HTML 看不出来，必须真的点一次。
 *
 * 用法：`node scripts/visual/media.mjs`
 * 输出：docs/audits/assets/phase-4d/media.json + 截图
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  applyTheme,
  launchChrome,
  navigate,
  openPage,
  preparePage,
  screenshot,
  settle,
  sleep,
} from './cdp.mjs'

const BASE = process.env.FOLIO_BASE_URL ?? 'http://127.0.0.1:3021'
const OUT_DIR = 'docs/audits/assets/phase-4d'
const SHOT_DIR = join(OUT_DIR, 'screenshots')
const ROUTE = '/visual-tests/markdown'

const results = []
const shots = []

function record(check, status, detail) {
  results.push({ check, status, detail, at: new Date().toISOString() })
  console.log(`${status.padEnd(10)} ${check} — ${detail}`)
}

async function shoot(client, file, note) {
  const buffer = await screenshot(client)
  writeFileSync(join(SHOT_DIR, file), buffer)
  shots.push({ file: `screenshots/${file}`, note, bytes: buffer.length })
  console.log(`  ↳ ${file} (${Math.round(buffer.length / 1024)}KB)`)
}

async function clickAt(client, x, y) {
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none' })
  await client.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
  await client.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    clickCount: 1,
  })
  await sleep(420)
}

const centerOf = (selector) => `(() => {
  const el = document.querySelector(${JSON.stringify(selector)})
  if (!el) return null
  el.scrollIntoView({ block: 'center', behavior: 'instant' })
  const rect = el.getBoundingClientRect()
  return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) }
})()`

const PREVIEW_STATE = `(() => {
  const layer = document.querySelector('.md-preview')
  if (!layer) return { present: false }
  const style = getComputedStyle(layer)
  const img = layer.querySelector('img')
  return {
    present: true,
    visibility: style.visibility,
    opacity: style.opacity,
    display: style.display,
    hasImage: Boolean(img),
    imageSrc: img ? img.getAttribute('src') : null,
    imageLoaded: img ? img.complete && img.naturalWidth > 0 : false,
    hint: layer.textContent.trim().slice(0, 40),
  }
})()`

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true })
  const chrome = await launchChrome({ port: 9340 })
  const client = await openPage(chrome.port)

  await preparePage(client, { width: 1280, height: 800, theme: 'light' })
  await navigate(client, `${BASE}${ROUTE}`)
  await applyTheme(client, 'light')
  await settle(client)

  // ── Mermaid 补水 ───────────────────────────────────────────────
  const mermaid = await client.evaluate(`(async () => {
    const deadline = Date.now() + 8000
    while (Date.now() < deadline) {
      const block = document.querySelector('.mermaid-block')
      if (block && block.querySelector('svg')) break
      await new Promise((r) => setTimeout(r, 120))
    }
    const block = document.querySelector('.mermaid-block')
    if (!block) return { present: false }
    const svg = block.querySelector('svg')
    return {
      present: true,
      hydrated: Boolean(svg),
      state: block.dataset.mermaidState ?? null,
      svgNodes: svg ? svg.querySelectorAll('g').length : 0,
      placeholder: block.textContent.includes('Mermaid'),
      height: Math.round(block.getBoundingClientRect().height),
    }
  })()`)
  record(
    'Mermaid 客户端补水',
    mermaid.hydrated ? 'PASS' : 'FAIL',
    `hydrated=${mermaid.hydrated}, state=${mermaid.state}, <g> 节点=${mermaid.svgNodes}, 高度=${mermaid.height}px, 仍显示占位文本=${mermaid.placeholder}`,
  )

  // 增强器不会删除服务端静态轨道（只靠 data-enhanced 在样式里隐藏），
  // 所以同一条目会同时出现在「静态轨道」和「portal 轨道」里，
  // 计数只取增强后的那份，另记静态条目数用于确认两条轨道都在。
  const galleryState = await client.evaluate(`(() => {
    const carousel = document.querySelector('.md-gallery--carousel')
    const track = carousel?.querySelector('.md-gallery__track') ?? null
    return {
      gallery: document.querySelectorAll('.md-gallery').length,
      carousel: document.querySelectorAll('.md-gallery--carousel').length,
      items: document.querySelectorAll('.md-gallery__mount .md-gallery__item').length,
      staticItems: document.querySelectorAll('.md-gallery > .md-gallery__track > .md-gallery__item').length,
      enhanced: document.querySelectorAll('.md-gallery[data-enhanced="true"]').length,
      counter: carousel?.querySelector('.md-gallery__counter')?.textContent?.trim() ?? null,
      trackItems: track ? track.children.length : 0,
      scrollable: track ? track.scrollWidth > track.clientWidth + 4 : null,
    }
  })()`)
  record(
    '相册 / 轮播结构',
    galleryState.gallery > 0 &&
      galleryState.carousel > 0 &&
      galleryState.items > 0 &&
      galleryState.trackItems > 0
      ? 'PASS'
      : 'FAIL',
    `gallery=${galleryState.gallery}, carousel=${galleryState.carousel}, 增强后条目=${galleryState.items}, 静态条目=${galleryState.staticItems}, 已增强容器=${galleryState.enhanced}, 轮播轨道子项=${galleryState.trackItems}, 计数器=${galleryState.counter}, 可横向滚动=${galleryState.scrollable}`,
  )

  // ── 单图预览：点击打开 ─────────────────────────────────────────
  const before = await client.evaluate(PREVIEW_STATE)
  const figurePoint = await client.evaluate(centerOf('.prose figure img'))
  if (!figurePoint) {
    record('图片预览 · 打开', 'BLOCKED', '页面里没有 figure img')
  } else {
    await clickAt(client, figurePoint.x, figurePoint.y)
    const opened = await client.evaluate(PREVIEW_STATE)
    await shoot(client, 'light-preview-open-1280.png', '点击正文插图后的预览层（亮色）')
    record(
      '图片预览 · 点击打开',
      opened.present && opened.hasImage && opened.imageLoaded ? 'PASS' : 'FAIL',
      `打开前 present=${before.present}；打开后 present=${opened.present}, 图片已加载=${opened.imageLoaded}, visibility=${opened.visibility}, opacity=${opened.opacity}`,
    )

    // Esc 关闭
    await client.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
      code: 'Escape',
      key: 'Escape',
    })
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
      code: 'Escape',
      key: 'Escape',
    })
    await sleep(420)
    const closed = await client.evaluate(PREVIEW_STATE)
    record(
      '图片预览 · Esc 关闭',
      !closed.present ||
        closed.visibility === 'hidden' ||
        Number.parseFloat(closed.opacity ?? '1') < 0.05
        ? 'PASS'
        : 'FAIL',
      `关闭后 present=${closed.present ?? false}, visibility=${closed.visibility ?? 'n/a'}, opacity=${closed.opacity ?? 'n/a'}`,
    )
  }

  writeFileSync(
    join(OUT_DIR, 'media.json'),
    `${JSON.stringify(
      {
        stage: 'Phase 4D-0 媒体增强器验收',
        generatedAt: new Date().toISOString(),
        route: ROUTE,
        browser: chrome.version.browser,
        mermaid,
        gallery: galleryState,
        results,
        shots,
      },
      null,
      2,
    )}\n`,
  )

  client.close()
  await chrome.close()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
